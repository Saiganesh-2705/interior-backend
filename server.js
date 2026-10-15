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

// ✅ Allow requests from any origin or your Vercel frontend URL
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json({ limit: '1mb' }));

// ✅ Added a base root route so you can test it directly in your browser
app.get('/', (req, res) => {
  res.send('Interior Backend API is running successfully!');
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', crud(Project, { sort: '-featured -year -createdAt', filters: ['category', 'featured'] }));
app.use('/api/services', crud(Service, { sort: 'order' }));
app.use('/api/testimonials', crud(Testimonial));
app.use('/api/enquiries', require('./routes/enquiries'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/chat', require('./routes/chat'));

// 🛡️ REMOVED THE BREAKING CLIENT FILE ROUTING FROM HERE

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5001;
mongoose
  .connect(process.env.MONGO_URI || 'mongodb+srv://saig6056_db_user:uTxhGnWrgRIYpUbj@cluster0.rze6oyy.mongodb.net/luxe-interiors')
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
