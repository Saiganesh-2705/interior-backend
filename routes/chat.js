const router = require('express').Router();
const mongoose = require('mongoose');
const studio = require('../config/studio');
const Service = require('../models/Service');
const wrap = require('../middleware/wrap');

// Basic per-IP rate limit (20 messages / minute) so the API key can't be drained
const hits = new Map();
const limited = (ip) => {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 20;
};

const buildSystemPrompt = async () => {
  let services = [];
  if (mongoose.connection.readyState === 1) {
    try { services = await Service.find().sort('order'); } catch (e) { /* use the default line below */ }
  }
  const serviceLines = services.map((s) => `- ${s.title}: ${s.summary}`).join('\n') || '- Residential and commercial interior design';
  const prices = Object.entries(studio.priceGuide).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  return `You are Aria, the friendly virtual assistant for ${studio.name}, an interior design studio. You help website visitors with questions about our services, design styles, budgets, timelines and how to book a consultation.

Studio details:
- Phone: ${studio.phone} | Email: ${studio.email}
- Address: ${studio.address}
- Hours: ${studio.hours}

Services:
${serviceLines}

Indicative budgets (always say these are rough and depend on size, materials and scope):
${prices}

Timelines: ${studio.timeline}

Rules:
- You are in a live chat. Reply directly to what the visitor just said, using everything they told you earlier (room, size, style, budget, name) and never ask again for something they already gave.
- Keep replies short: 2-4 sentences, plain language, no markdown headings or bullet lists. End with one relevant follow-up question when it helps.
- Answer only about interior design and our studio. For anything else, politely steer back.
- Never promise exact prices, dates or discounts. Offer a free consultation for a proper quote.
- When a visitor shows buying intent (budget, room, timeline, "how do I start"), invite them to leave their name and phone number using the "Request a callback" button in this chat, or to use the Contact page.
- If you do not know something, say so and offer to connect them with the design team.
- Offer 1 or 2 practical design tips when asked about styles, colours, lighting or space planning.`;
};

const { respond } = require('../services/localBrain');

const fallbackReply = (messages) => respond(messages);

router.post('/', wrap(async (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ reply: 'You are sending messages quickly. Please wait a minute and try again.' });

  const raw = Array.isArray(req.body.messages) ? req.body.messages : [];
  let messages = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length) return res.status(400).json({ reply: 'Ask me anything about our interior design services.' });

  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) return res.json({ ...fallbackReply(messages), mode: 'local' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 500,
        system: await buildSystemPrompt(),
        messages
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) throw new Error(`Anthropic API ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const reply = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!reply) return res.json({ ...fallbackReply(messages), mode: 'local' });
    const wantsLead = /request a callback|leave (your )?(name|number)/i.test(reply) && /(callback|call you|consultation|name and (phone )?number)/i.test(reply);
    res.json({ reply, mode: 'ai', lead: false, suggestions: wantsLead ? ['Request a callback'] : [] });
  } catch (err) {
    console.error('Chat error (using built-in replies instead):', err.message);
    res.json({ ...fallbackReply(messages), mode: 'local' });
  }
}));

// Tells you (and the admin) which brain is answering: GET /api/chat/status
router.get('/status', (req, res) => res.json({ mode: (process.env.ANTHROPIC_API_KEY || '').trim() ? 'ai' : 'local' }));

module.exports = router;
