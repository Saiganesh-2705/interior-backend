const mongoose = require('mongoose');

module.exports = mongoose.model(
  'Service',
  new mongoose.Schema(
    {
      title: { type: String, required: true },
      summary: { type: String, required: true },
      details: { type: String, default: '' },
      image: { type: String, default: '' },
      features: [String],
      order: { type: Number, default: 0 }
    },
    { timestamps: true }
  )
);
