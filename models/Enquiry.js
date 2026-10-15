const mongoose = require('mongoose');

module.exports = mongoose.model(
  'Enquiry',
  new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, trim: true, lowercase: true, default: '' },
      phone: { type: String, required: true, trim: true },
      projectType: { type: String, default: '' },
      budget: { type: String, default: '' },
      message: { type: String, default: '' },
      source: { type: String, enum: ['contact-form', 'chatbot', 'estimator', 'visualizer'], default: 'contact-form' },
      status: { type: String, enum: ['new', 'contacted', 'booked', 'closed'], default: 'new' }
    },
    { timestamps: true }
  )
);
