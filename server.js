require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const Project = require('./models/Project');
const Service = require('./models/Service');
const Testimonial = require('./models/Testimonial');
const crud = require('./routes/crud');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', crud(Project, { sort: '-featured -year -createdAt', filters: ['category', 'featured'] }));
app.use('/api/services', crud(Service, { sort: 'order' }));
app.use('/api/testimonials', crud(Testimonial));
app.use('/api/enquiries', require('./routes/enquiries'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/chat', require('./routes/chat'));

// Serve the built React app when running in production
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../client/dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5001;
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/luxe-interiors')
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
