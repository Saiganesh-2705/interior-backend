const router = require('express').Router();
const Enquiry = require('../models/Enquiry');
const wrap = require('../middleware/wrap');
const { protect, adminOnly } = require('../middleware/auth');

// Public: contact form and chatbot lead capture
router.post('/', wrap(async (req, res) => {
  const { name, email, phone, projectType, budget, message, source } = req.body;
  if (!name || !phone) return res.status(400).json({ message: 'Name and phone number are required.' });
  await Enquiry.create({
    name, email, phone, projectType, budget,
    message: (message || '').slice(0, 2000),
    source: ['chatbot', 'estimator', 'visualizer'].includes(source) ? source : 'contact-form'
  });
  res.status(201).json({ ok: true, message: 'Thank you. Our design team will call you within one working day.' });
}));

// Admin
router.get('/', protect, adminOnly, wrap(async (req, res) => res.json(await Enquiry.find().sort('-createdAt'))));

router.patch('/:id', protect, adminOnly, wrap(async (req, res) => {
  const doc = await Enquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!doc) return res.status(404).json({ message: 'Not found.' });
  res.json(doc);
}));

router.delete('/:id', protect, adminOnly, wrap(async (req, res) => {
  await Enquiry.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

module.exports = router;
