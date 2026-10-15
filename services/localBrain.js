// Built-in conversational engine used when no ANTHROPIC_API_KEY is set (or the API is down).
// It reads the WHOLE conversation, remembers what the visitor told it (room, size, style, budget, name),
// works out what they mean, and answers that specific message - with a follow-up question to keep the chat going.
const studio = require('../config/studio');

/* ---------- small helpers ---------- */
const pick = (arr, n) => arr[Math.abs(n) % arr.length];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const an = (s) => (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s;
const money = (lakh) => (lakh >= 100 ? `Rs ${+(lakh / 100).toFixed(2)} crore` : `Rs ${+lakh.toFixed(2)} lakh`);

const ROOMS = [
  { id: 'kitchen', label: 'modular kitchen', re: /\b(kitchens?|modular|pantry|chimney|hob)\b/, key: 'Modular kitchen' },
  { id: 'bedroom', label: 'bedroom', re: /\b(bed ?rooms?|master bed|kids? room|nursery|guest room|wardrobes?)\b/, key: 'Bedroom' },
  { id: 'living', label: 'living room', re: /\b(living|lounge|drawing room|tv unit|sofa|hall)\b/, key: 'Living room' },
  { id: 'home', label: 'full home', re: /\b(full home|whole (home|house)|entire (home|house|flat|apartment)|[1-5] ?bhk|villa|apartment|flat|new (home|house)|turnkey|complete interiors?)\b/, key: 'Full home (2-3 BHK)' },
  { id: 'office', label: 'office or retail space', re: /\b(office|workspace|co-?working|shop|store|retail|showroom|clinic|cafe|restaurant|salon)\b/, key: 'Office / retail' }
];
const STYLES = [
  ['warm minimal', /\b(minimal(ist)?|minimalism|warm minimal)\b/],
  ['modern luxe', /\b(luxe|luxury|luxurious|premium|opulent)\b/],
  ['scandinavian', /\b(scandi(navian)?|nordic)\b/],
  ['classic', /\b(classic(al)?|traditional|timeless|vintage)\b/],
  ['industrial', /\b(industrial|loft|exposed (brick|concrete))\b/],
  ['contemporary', /\b(contemporary|modern)\b/],
  ['japandi', /\b(japandi|japanese|zen)\b/],
  ['boho', /\b(boho|bohemian|eclectic)\b/]
];
const STYLE_INFO = {
  'warm minimal': 'Warm minimal is calm and uncluttered: oak or ash wood, linen, soft off-whites and hidden storage so surfaces stay clear.',
  'modern luxe': 'Modern luxe mixes clean lines with rich touches: stone, brass or bronze accents, statement lighting and layered textures.',
  scandinavian: 'Scandinavian is light and cosy: pale woods, soft greys and whites, natural textiles and plenty of daylight.',
  classic: 'Classic interiors use panelling, teak or walnut furniture, symmetry and warm, traditional colours that never feel dated.',
  industrial: 'Industrial leans on raw materials: exposed concrete or brick, black metal, leather and bold pendant lights.',
  contemporary: 'Contemporary is current and clean: neutral bases, simple shapes, handleless joinery and one or two bold accents.',
  japandi: 'Japandi blends Japanese calm with Scandinavian warmth: low furniture, natural wood, muted earthy tones and very little clutter.',
  boho: 'Boho is relaxed and layered: rattan, plants, patterned textiles and colour collected over time rather than matched.'
};

const parseRange = (str) => {
  const m = /([\d.]+)\s*-\s*([\d.]+)\s*lakh/i.exec(str || '');
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
};

/* ---------- pull facts out of what the visitor has said ---------- */
const NOT_NAMES = new Set(['looking', 'planning', 'interested', 'thinking', 'trying', 'wondering', 'just', 'here', 'new', 'not', 'also', 'from', 'in', 'on', 'at', 'a', 'an', 'the', 'sure', 'fine', 'good', 'great', 'okay', 'ok', 'confused', 'curious', 'ready', 'going', 'moving', 'building', 'renovating', 'having', 'want', 'wanting', 'needing', 'so', 'very', 'really']);

const extract = (text, original) => {
  const t = text.toLowerCase();
  const out = {};
  for (const r of ROOMS) if (r.re.test(t)) { out.room = r.id; break; }
  const bhk = /\b([1-5]) ?bhk\b/.exec(t);
  if (bhk) { out.bhk = +bhk[1]; out.room = 'home'; }
  for (const [name, re] of STYLES) if (re.test(t)) { out.style = name; break; }
  const sz = /(\d[\d,]{1,5})\s*(sq\.?\s?ft|sqft|sft|square f(?:ee|oo)t|sq feet)/.exec(t);
  if (sz) out.size = parseInt(sz[1].replace(/,/g, ''), 10);
  const lk = /(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|lak|l\b)/.exec(t);
  const cr = /(\d+(?:\.\d+)?)\s*(crores?|cr\b)/.exec(t);
  if (cr) out.budget = parseFloat(cr[1]) * 100;
  else if (lk) out.budget = parseFloat(lk[1]);
  else {
    const raw = /(?:rs\.?|inr|₹)\s*([\d,]{5,})|\b([\d,]{5,})\s*(?:rs|rupees|inr)\b|\b(\d{1,3}(?:,\d{2}){1,2},\d{3})\b/.exec(t);
    if (raw) { const n = parseInt((raw[1] || raw[2] || raw[3]).replace(/,/g, ''), 10); if (n >= 50000) out.budget = n / 100000; }
  }
  const nm = /\b(?:my name is|call me|name'?s|this is)\s+([a-z]{2,20})\b/i.exec(original) || /\b(?:[Ii] am|[Ii]'m|[Ii]m)\s+([A-Z][a-z]{1,19})\b/.exec(original);
  if (nm && !NOT_NAMES.has(nm[1].toLowerCase())) out.name = cap(nm[1].toLowerCase());
  const city = /\b(chennai|coimbatore|madurai|trichy|salem|pondicherry|bengaluru|bangalore|hyderabad|mumbai|delhi|kochi|erode|vellore|tirunelveli)\b/.exec(t);
  if (city) out.city = cap(city[1]);
  return out;
};

const factsFrom = (userTexts) => userTexts.reduce((acc, t) => ({ ...acc, ...extract(t, t) }), {});

/* ---------- design tips & FAQs (checked in order) ---------- */
const TIPS = [
  [/\b(small|compact|tiny|cramped|narrow|space[- ]saving|limited space|studio (flat|apartment))\b/, 'For small spaces: keep walls and big pieces light, use mirrors opposite windows, choose furniture that earns double duty (storage beds, fold-down desks) and take storage up to the ceiling. Fewer, better pieces beat many small ones.'],
  [/\b(colou?rs?|palette|paint|shade|wall colou?r|scheme)\b/, 'A reliable rule is 60-30-10: about 60% a calm base colour, 30% a supporting tone, 10% an accent. Repeat each colour at least twice in the room so it looks planned. Warm whites, sage, terracotta and deep teal are all popular right now.'],
  [/\b(light(s|ing)?|lamp|chandelier|pendant|cove|dim|bright|dark room)\b/, 'Good lighting is layered: a soft ambient layer (cove or ceiling), task lights where you work or read, and accent lights on art or textures. Use warm 2700-3000K bulbs in living areas and bedrooms, and put everything on dimmers.'],
  [/\b(floor(ing)?|tiles?|marble|wood(en)? floor|vitrified|laminate floor|granite)\b/, 'Vitrified tiles are the practical all-rounder, engineered wood or wood-look planks give warmth in bedrooms and living rooms, and natural stone looks beautiful but needs sealing and care. Run one flooring through connected rooms to make the home feel bigger.'],
  [/\b(curtains?|blinds?|drapes?|upholstery|fabric)\b/, 'For curtains, hang the rod close to the ceiling and let them touch the floor to make the room look taller. Layer a sheer with a heavier or blackout curtain so you control both light and privacy.'],
  [/\b(false ceiling|ceiling|pop|gypsum)\b/, 'A false ceiling works best when it is simple: a slim peripheral cove with warm LED lighting hides wiring and looks elegant. Heavy, multi-level designs tend to date quickly and make low rooms feel lower.'],
  [/\b(plywood|laminate|veneer|material|mdf|hdhmr|quartz|countertop|granite top|finish(es)?|acrylic|membrane)\b/, 'For wet areas like kitchens and bathrooms we recommend moisture-resistant boards (BWP plywood or similar) with durable laminates or acrylic shutters, and quartz or granite counters. Veneer and solid wood suit living and bedroom pieces. Tell me the room and I can suggest a combination.'],
  [/\b(vastu|vaastu|feng shui)\b/, 'Yes, we can plan around vastu preferences, for example kitchen position, bed orientation and the pooja unit. Share your floor plan at the consultation and the designer will balance vastu with practical layout.'],
  [/\b(storage|clutter|wardrobe|cupboard|shelf|shelves|organi[sz]e)\b/, 'Full-height joinery is the best storage investment: closed cabinets at eye level and below, open display only at one or two spots. Loft storage above wardrobes and under-bed drawers use space you already have.'],
  [/\b(layout|l-shaped|u-shaped|island|parallel|work triangle|kitchen layout)\b/, 'Kitchen layouts: L-shaped suits most flats, parallel (galley) is efficient for narrow rooms, U-shaped gives the most counter space and an island works when the room is at least about 10 x 12 ft. Keep the sink, hob and fridge in a compact triangle.'],
  [/\b(plants?|greenery|indoor plant|biophilic)\b/, 'Plants lift almost any room. Snake plants, pothos and ZZ plants cope well with low light, while a large fiddle-leaf or areca palm works as a living sculpture near a bright window.'],
  [/\b(budget[- ]friendly|save money|cut cost|low cost|cheap|economical|reduce cost|affordable)\b/, 'To keep cost down without looking cheap: spend on the things used daily (mattress, kitchen hardware, lighting), keep layouts that avoid moving plumbing, use paint and lighting for impact instead of heavy cladding, and phase non-urgent rooms for later.'],
  [/\b(tv (unit|wall)|entertainment|media wall)\b/, 'For a TV wall, keep the screen centre at seated eye level, hide cables inside the panel, and add indirect backlighting to reduce eye strain. A slim floating unit keeps the floor open and easier to clean.'],
  [/\b(pooja|puja|prayer|mandir|temple unit)\b/, 'A pooja unit works well as a compact wall-mounted or corner cabinet with warm lighting, closed doors for privacy and a drawer for lamps and incense. Natural wood or marble suits it best.']
];

const FAQS = [
  [/\b(pay(ment)?|instal+ments?|advance|emi|milestone|deposit|gst|invoice)\b/, 'Payment is normally milestone-based: a booking amount, then stages tied to design approval, material delivery and execution, with the exact schedule written in your quotation. A designer can walk you through it on the call.'],
  [/\b(warranty|guarantee|after[- ]?sales|defect|maintenance|service after)\b/, 'We stand behind our work with a written warranty on workmanship and pass on manufacturer warranties for hardware and materials. The exact terms are in your agreement, and your designer will explain them before you sign.'],
  [/\b(3d|render(ing)?s?|visuali[sz]ation|walk ?through|before (you|we) start|see (it )?before)\b/, 'Yes, you see 3D visuals of your rooms before anything is built, so you can change layouts, colours and materials while it is still easy. You can also try colours yourself on our Room Designer page.'],
  [/\b(revisions?|changes?|modify|don'?t like|not happy|redo)\b/, 'You get design revisions before sign-off, so the concept is right before we start execution. Changes after approval are possible too, though they can affect cost and timeline, and we always tell you first.'],
  [/\b(site visit|measure(ment)?s?|come to (my|our) (home|site)|visit (my|our))\b/, 'A designer visits your site to take measurements and understand how you live, which makes the quote far more accurate. Request a callback and we will fix a slot.'],
  [/\b(cities|city|areas?|outstation|serve|serving|available in|do you work in|outside)\b/, `We are based in Chennai and take projects across Tamil Nadu. For other cities, share the location with the team and they will confirm what is possible.`],
  [/\b(renovat(e|ion|ing)|remodel(l?ing)?|existing (home|house|flat)|old (home|house|flat))\b/, 'Yes, we handle renovations as well as new homes. We can keep what works, such as good flooring or structure, and redo what does not, so you only pay for the change you need.'],
  [/\b(live in|stay (there|in)|during (work|construction)|dust|mess|occupied)\b/, 'Living in during work is possible for single rooms, but a full-home project is faster and cleaner when the house is empty. We protect finished areas and schedule noisy work in sequence to keep disruption low.'],
  [/\b(own (materials?|furniture|designs?)|existing furniture|reuse|bring my)\b/, 'Yes, you can keep and reuse existing furniture or supply your own materials. We plan the design around those pieces and can refinish or reupholster them if needed.'],
  [/\b(your (team|designers?)|who (is|are) (your|the)|architects?|experience|how many years)\b/, `${studio.name} is run by a team of in-house designers and execution managers. You can see the people and the story on our About page.`],
  [/\b(modular)\b.*\b(brand|hettich|hafele|blum)\b|\b(brand|hettich|hafele|blum)\b/, 'We use well-known hardware brands for hinges, channels and fittings, and the exact brands are listed item by item in the quotation so you know what you are paying for.']
];

/* ---------- intents ---------- */
const INTENTS = [
  ['frustrated', /\b(not (working|helpful|understanding|answering)|useless|stupid|rubbish|wrong answer|doesn'?t make sense|you don'?t understand|bad bot|irrelevant|same (answer|thing)|didn'?t answer|waste)\b/, 5],
  ['howareyou', /\b(how are (you|u)|how r u|how'?s it going|what'?s up|wassup|how do you do)\b/, 4],
  ['identity', /\b(who are you|what are you|your name|are you (a |an )?(bot|human|real|ai|robot|person|chatgpt|claude)|am i (talking|chatting) (to|with)|what('?s| is) aria)\b/, 4],
  ['human', /\b(call ?back|call me|ring me|phone me|talk to (a |an |the )?(human|person|designer|someone|team)|speak (to|with) (a |an |the )?(human|person|designer|someone|team)|real person|human agent|connect me)\b/, 5],
  ['booking', /\b(book|appointment|consult(ation)?|schedule|free quote|get started|how (do|can) i start|start (a|my|the) project|hire|work with you|meeting)\b/, 4],
  ['price', /\b(price|prices|pricing|cost|costs|budget|how much|rates?|charges?|quote|quotation|estimate|expensive|afford|lakhs?|per sq ?ft|rs\.?|inr|fees?|spend)\b|₹/, 3],
  ['timeline', /\b(how long|duration|timeline|time ?frame|how many (weeks|months|days)|weeks?|months?|deadline|how soon|how fast|delivery|handover|ready by|takes? (to|how))\b|\bwhen (can|will|do)\b/, 3],
  ['services', /\b(services?|what do you (do|offer)|do you (do|design|offer|handle|take)|offerings?|speciali[sz]e|scope|what (can|all) you|what (kind|type)s? of)\b/, 3],
  ['portfolio', /\b(portfolio|previous work|past work|projects?|examples?|samples?|gallery|photos?|work you('ve| have) done|case stud(y|ies)|show me)\b/, 3],
  ['process', /\b(process|steps|procedure|how (does|do) (it|you|this) work|how it works|what happens (after|next)|workflow|stages)\b/, 3],
  ['estimator', /\b(estimator|calculator|calculate)\b/, 4],
  ['visualizer', /\b(visuali[sz]er|room designer|try (out )?(colou?rs?|styles?)|preview)\b/, 4],
  ['hours', /\b(hours?|timings?|opening|open (on|today|now)|closed?|sunday|saturday|weekend|working days)\b/, 3],
  ['address', /\b(address|located|location|where (are|is)|find you|directions?|map|landmark|your office)\b/, 3],
  ['contact', /\b(contact|phone|number|call|email|mail|reach|whatsapp)\b/, 3],
  ['greeting', /^\s*(hi+|hello+|hey+|hai|hii+|namaste|vanakkam|good (morning|afternoon|evening)|yo|hola|sup)\b/, 2],
  ['pleasantry', /\b(nice to meet|pleased to meet|good to (meet|know)|great|awesome|cool|nice|wonderful|perfect|got it|i see|understood|makes sense|interesting)\b/, 1],
  ['project', /\b(looking for|i need|i want|planning|thinking (of|about)|interested in|require|help me)\b/, 1],
  ['thanks', /\b(thanks?|thank you|thx|ty|appreciate|cheers)\b/, 4],
  ['bye', /\b(bye|goodbye|see you|talk later|that'?s all|nothing else|take care|good night)\b/, 4],
  ['yes', /^\s*(yes|yeah|yep|yup|sure|ok(ay)?|please do|go ahead|sounds good|definitely|of course|alright|fine|why not|y)\b/, 2],
  ['no', /^\s*(no|nope|nah|not now|not really|maybe later|no thanks|not yet|n)\b/, 2],
  ['joke', /\b(joke|funny|make me laugh)\b/, 4],
  ['offtopic', /\b(weather|cricket|football|ipl|movie|song|politics|president|prime minister|capital of|stocks?|bitcoin|crypto|recipe|homework|python|javascript|programming|translate|news|who (won|is the)|what is \d|\d+ ?[+*/x] ?\d+)\b/, 3]
];

const detect = (t) => {
  let best = null;
  for (const [id, re, w] of INTENTS) if (re.test(t) && (!best || w > best.w)) best = { id, w };
  return best ? best.id : null;
};
const detectTip = (t) => TIPS.find(([re]) => re.test(t)) || null;
const detectFaq = (t) => FAQS.find(([re]) => re.test(t)) || null;

/* ---------- reply builders ---------- */
const roomLabel = (id) => (ROOMS.find((r) => r.id === id) || {}).label;
const priceKeyFor = (id) => (ROOMS.find((r) => r.id === id) || {}).key;

const nextQuestion = (f, n) => {
  if (!f.room) return pick(['Which space are you planning: living room, bedroom, kitchen, full home or an office?', 'What are you looking to design first: a room, the kitchen, or a whole home?'], n);
  if (!f.size && f.room !== 'home') return `Roughly how big is the ${roomLabel(f.room)} in sq ft?`;
  if (f.room === 'home' && !f.bhk && !f.size) return 'Is it a 2 BHK, 3 BHK or something larger?';
  if (!f.style) return 'Do you have a style in mind, such as modern, minimal, classic or Scandinavian?';
  if (!f.budget) return 'Do you have a rough budget in mind? It helps us suggest the right materials.';
  return 'Shall I have a designer call you to plan the next steps?';
};

const reply = {
  greeting: (f, n) => `${pick(['Hello', 'Hi', 'Hey there'], n)}${f.name ? ' ' + f.name : ''}! I'm Aria, the virtual assistant at ${studio.name}. ${pick(['What are you planning to design?', 'Tell me about your space and I will point you in the right direction.'], n)}`,
  howareyou: (f, n) => `I'm doing well, thanks for asking! ${nextQuestion(f, n)}`,
  pleasantry: (f, n) => `${pick(['Glad to hear it', 'Lovely', 'Great'], n)}${f.name ? ', ' + f.name : ''}! ${nextQuestion(f, n)}`,
  project: (f, n) => `Happy to help${f.name ? ', ' + f.name : ''}! ${nextQuestion(f, n)}`,
  thanks: (f, n) => `${pick(["You're welcome", 'Happy to help', 'Anytime'], n)}${f.name ? ', ' + f.name : ''}! Anything else about your design plans, budget or timeline?`,
  bye: (f, n) => `${pick(['Goodbye', 'Take care', 'Thanks for chatting'], n)}${f.name ? ', ' + f.name : ''}! If you want a designer to call you, just tap "Request a callback" anytime.`,
  identity: () => `I'm Aria, the automated assistant for ${studio.name}. I can answer questions about services, budgets, timelines and design ideas. If you would like a real designer, tap "Request a callback".`,
  frustrated: () => `Sorry about that, I clearly missed what you meant. Could you say it in a different way? Or tap "Request a callback" and a designer from our team will speak with you directly.`,
  joke: () => `Why did the sofa get promoted? It always supported the team. Now, shall we talk about your living room?`,
  offtopic: () => `That one is outside my area. I'm best at interior design and ${studio.name}: services, budgets, timelines, styles and colours. What are you planning for your space?`,
  human: () => ({ text: 'Of course. Leave your name and number and a designer will call you within one working day.', lead: true }),
  booking: (f, n) => ({
    text: `${f.name ? f.name + ', ' : ''}we offer a free first consultation. Leave your name and number below and a designer will call to fix a time${f.room ? ` and talk through your ${roomLabel(f.room)}` : ''}.`,
    lead: true
  }),
  services: (f, n) => `We design living rooms, bedrooms, modular kitchens, full homes and offices. Each project includes 3D visuals, material selection and on-site execution so one team handles it end to end. ${nextQuestion(f, n)}`,
  portfolio: () => 'You can browse finished homes, kitchens, bedrooms and offices on our Portfolio page, with photos and a short story for each. Marina Heights Residence and Lakeview Living Room are good places to start. Which type of space interests you?',
  process: () => 'It runs in five steps: free consultation and site visit, concept and 3D visuals, a detailed quotation, material selection, then execution with regular updates until handover. Want a designer to call you to start step one?',
  estimator: () => 'Our Cost Estimator page gives an instant budget range and timeline based on room type, size, finish level and add-ons. Open "Estimator" in the menu, and I am happy to explain any figure it shows.',
  visualizer: () => 'The Room Designer page lets you change wall colours, floors, sofa and lighting live and send your favourite look to us. Open "Visualizer" in the menu. Want me to suggest a palette to try first?',
  hours: () => `We are open ${studio.hours}. You can also leave a callback request anytime and we will ring you back in working hours.`,
  address: () => `You can find us at ${studio.address} (${studio.hours}). It is best to book a time first so a designer is free for you.`,
  contact: (f, t) => {
    if (/\b(e-?mail|mail)\b/.test(t)) return `Our email is ${studio.email}. For a faster reply, tap "Request a callback" and we will phone you.`;
    return `You can call us on ${studio.phone} or write to ${studio.email}. Prefer us to call you? Tap "Request a callback" below.`;
  },
  timeline: (f, n) => {
    const where = f.room === 'home' ? 'A full home usually takes 12-20 weeks' : f.room ? `A ${roomLabel(f.room)} usually takes 4-8 weeks` : 'Most rooms take 4-8 weeks and a full home 12-20 weeks';
    return `${where}, counted from design sign-off, and it depends on size, material lead times and any civil work. ${f.room ? 'Do you have a target move-in date?' : 'Which space are you planning?'}`;
  },
  price: (f, n, compact) => {
    const key = priceKeyFor(f.room);
    if (f.room === 'office') return `Offices and retail spaces are quoted per square foot after a site visit, because layout and services vary a lot. ${f.size ? `For about ${f.size} sq ft, a` : 'A'} free consultation will give you a firm figure. What type of space is it?`;
    if (key && studio.priceGuide[key]) {
      const range = parseRange(studio.priceGuide[key]);
      let extra = '';
      if (f.budget && range) {
        if (f.budget < range[0]) extra = ` Your ${money(f.budget)} is below that, but we can often work by prioritising key items or phasing the work.`;
        else if (f.budget <= range[1]) extra = ` Your ${money(f.budget)} sits comfortably inside that range.`;
        else extra = ` Your ${money(f.budget)} gives room for premium finishes and custom pieces.`;
      } else if (f.size && f.room !== 'home') extra = ` At ${f.size} sq ft, expect the figure to land according to materials and how much custom joinery you want.`;
      else if (f.bhk) extra = ` For a ${f.bhk} BHK, a smaller flat sits near the lower end and a larger one near the top.`;
      if (compact && extra) return `${extra.trim()} ${nextQuestion(f, n)}`;
      return `For ${an(roomLabel(f.room))}, we typically see ${studio.priceGuide[key]}.${extra} This is only a guide, and a free consultation gives you a proper quote. ${nextQuestion(f, n)}`;
    }
    const line = Object.entries(studio.priceGuide).slice(0, 4).map(([k, v]) => `${k.toLowerCase()} ${v}`).join('; ');
    return `As a rough guide: ${line}. Final cost depends on size, materials and scope. Which space are you planning, so I can narrow it down?`;
  }
};

const styleReply = (style, f, n) => `${STYLE_INFO[style]} ${f.room ? `For your ${roomLabel(f.room)}, we can show it in 3D before anything is built.` : 'Which room do you want to try it in?'}`;

const slotReply = (f, said, n) => {
  const bits = [];
  if (said.room) bits.push(an(roomLabel(said.room)));
  if (said.size) bits.push(`about ${said.size} sq ft`);
  if (said.style) bits.push(`${said.style} style`);
  if (said.budget) bits.push(`a budget near ${money(said.budget)}`);
  const lead = said.name && !bits.length ? `Nice to meet you, ${said.name}!` : bits.length ? `Got it: ${bits.join(', ')}.` : 'Thanks for sharing that.';
  const q = nextQuestion(f, n);
  const stage = f.room && (f.size || f.bhk) && f.budget;
  return { text: `${lead} ${q}`, lead: !!stage && /call you/.test(q) };
};

const suggestionsFor = (f, intent) => {
  if (['thanks', 'bye', 'identity', 'frustrated', 'human', 'booking'].includes(intent)) return [];
  if (intent === 'price' && !f.room) return ['Living room', 'Bedroom', 'Modular kitchen', 'Full home'];
  if (!f.room) return ['Living room', 'Bedroom', 'Modular kitchen', 'Full home'];
  if (!f.size && f.room !== 'home') return ['Under 150 sq ft', '150-300 sq ft', 'Over 300 sq ft'];
  if (!f.style) return ['Modern', 'Minimal', 'Classic', 'Not sure yet'];
  return ['How much will it cost?', 'How long will it take?', 'Request a callback'];
};

/* ---------- main entry ---------- */
const respond = (messages) => {
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const last = users[users.length - 1] || '';
  const lastLower = last.toLowerCase().trim();
  const prevAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const n = messages.length + lastLower.length;

  const facts = factsFrom(users);
  const said = extract(last, last);
  let intent = detect(lastLower);

  // a plain "hi" should not beat a real question like "hi, how much is a kitchen"
  if (intent === 'greeting' && lastLower.replace(/^\W*(hi+|hello+|hey+|hai|hii+|namaste|vanakkam|good \w+|yo|hola|sup)\W*/, '').length > 6) {
    const rest = lastLower.replace(/^\W*(hi+|hello+|hey+|hai|hii+|namaste|vanakkam|good \w+|yo|hola|sup)\W*/, '');
    intent = detect(rest) || (detectTip(rest) ? 'tip' : null) || 'greeting';
  }

  const tip = detectTip(lastLower);
  const faq = detectFaq(lastLower);
  const hasSlot = Object.keys(said).length > 0;
  const strongIntent = ['frustrated', 'human', 'booking', 'identity', 'howareyou', 'thanks', 'bye', 'joke', 'offtopic', 'hours', 'address'].includes(intent) || (['pleasantry', 'project'].includes(intent) && !hasSlot && !tip && !faq);

  let out;
  const done = (text, extra = {}) => ({ reply: text, suggestions: extra.suggestions || suggestionsFor(facts, intent), lead: !!extra.lead });
  const wrap = (r) => (typeof r === 'string' ? done(r) : done(r.text, { lead: r.lead, suggestions: r.lead ? [] : undefined }));

  if (strongIntent) {
    if (intent === 'hours') return wrap(reply.hours(facts, n));
    if (intent === 'address') return wrap(reply.address(facts, n));
    return wrap(reply[intent](facts, n));
  }

  // yes / no answer to the assistant's last question
  if (intent === 'yes' || intent === 'no') {
    const prev = (prevAssistant && prevAssistant.content || '').toLowerCase();
    if (intent === 'yes') {
      if (/callback|call you|designer (to )?call|consultation/.test(prev)) return wrap(reply.booking(facts, n));
      if (/move-in/.test(prev)) return done('Lovely. Tell me the month you would like to move in, and a designer can check it against the timeline when they call you.', { suggestions: ['Request a callback'] });
      if (/palette/.test(prev)) return done('Try a warm white base, sage green as the supporting colour and brass or walnut as the accent. Which room is it for? I can refine it.');
      return done(`Great. ${nextQuestion(facts, n)}`);
    }
    return done(`No problem. ${/callback|call you|consultation/.test(prev) ? 'Whenever you are ready, "Request a callback" is always there.' : 'Ask me anything else about services, budget, timeline or design ideas.'}`, { suggestions: ['What services do you offer?', 'How much does it cost?'] });
  }

  if (intent === 'price') {
    const prevText = ((prevAssistant && prevAssistant.content) || '').toLowerCase();
    const follow = /we typically see|rough guide|quoted per square/.test(prevText) && lastLower.split(/\s+/).length < 8 && !said.room;
    return wrap(reply.price(facts, n, follow));
  }
  if (intent === 'timeline') return wrap(reply.timeline(facts, n));
  if (['services', 'portfolio', 'process', 'estimator', 'visualizer'].includes(intent)) return wrap(reply[intent](facts, n));
  if (intent === 'contact') return wrap(reply.contact(facts, lastLower));

  if (faq) return done(faq[1], { suggestions: ['How much does it cost?', 'Request a callback'] });
  if (tip) return done(`${tip[1]} ${facts.room ? '' : 'Which room are you working on?'}`.trim());
  if (said.style && /\b(what is|what'?s|tell me about|explain|describe|about)\b/.test(lastLower)) return done(styleReply(said.style, facts, n));
  if (intent === 'greeting') return wrap(reply.greeting(facts, n));

  if (hasSlot) {
    // visitor just gave us a detail (room, size, style, budget, name): acknowledge and keep the conversation moving
    const prevTopic = [...users].slice(0, -1).reverse().map((u) => detect(u.toLowerCase())).find((i) => ['price', 'timeline'].includes(i));
    if (prevTopic && (said.room || said.size || said.budget || said.bhk)) return wrap(reply[prevTopic](facts, n, !said.room));
    if (said.style && !said.room) return done(styleReply(said.style, facts, n));
    return wrap(slotReply(facts, said, n));
  }

  // nothing recognised: be honest, stay useful
  const fallbackTexts = [
    `I'm not sure I understood that. I can help with services, budgets, timelines, design ideas and booking a consultation. For anything specific, tap "Request a callback" and our team will answer directly.`,
    `I don't have a good answer to that one. Could you tell me which room you're planning, or ask about cost, timeline or styles? Or tap "Request a callback" to talk to a designer.`
  ];
  return done(pick(fallbackTexts, n), { suggestions: ['What services do you offer?', 'How much does a kitchen cost?', 'Request a callback'] });
};

module.exports = { respond, extract, factsFrom };
