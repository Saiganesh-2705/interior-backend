// Small helper: public read, admin-only write.
const express = require('express');
const wrap = require('../middleware/wrap');
const { protect, adminOnly } = require('../middleware/auth');

module.exports = (Model, { sort = '-createdAt', filters = [] } = {}) => {
  const r = express.Router();

  r.get('/', wrap(async (req, res) => {
    const q = {};
    filters.forEach((f) => {
      if (req.query[f] === undefined) return;
      q[f] = req.query[f] === 'true' ? true : req.query[f] === 'false' ? false : req.query[f];
    });
    res.json(await Model.find(q).sort(sort));
  }));

  r.get('/:id', wrap(async (req, res) => {
    const doc = await Model.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(doc);
  }));

  r.post('/', protect, adminOnly, wrap(async (req, res) => res.status(201).json(await Model.create(req.body))));

  r.put('/:id', protect, adminOnly, wrap(async (req, res) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    res.json(doc);
  }));

  r.delete('/:id', protect, adminOnly, wrap(async (req, res) => {
    await Model.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  }));

  return r;
};
