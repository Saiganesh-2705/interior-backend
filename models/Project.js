const mongoose = require('mongoose');

module.exports = mongoose.model(
  'Project',
  new mongoose.Schema(
    {
      title: { type: String, required: true, trim: true },
      category: { type: String, required: true, enum: ['Living room', 'Bedroom', 'Kitchen', 'Office', 'Full home'] },
      style: { type: String, default: 'Contemporary' },
      location: { type: String, default: '' },
      areaSqft: { type: Number, default: 0 },
      year: { type: Number, default: new Date().getFullYear() },
      summary: { type: String, default: '' },
      description: { type: String, default: '' },
      cover: { type: String, default: '' },
      gallery: [String],
      featured: { type: Boolean, default: false }
    },
    { timestamps: true }
  )
);
