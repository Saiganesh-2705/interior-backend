const mongoose = require('mongoose');

module.exports = mongoose.model(
  'Testimonial',
  new mongoose.Schema(
    {
      name: { type: String, required: true },
      place: { type: String, default: '' },
      quote: { type: String, required: true },
      rating: { type: Number, min: 1, max: 5, default: 5 }
    },
    { timestamps: true }
  )
);
