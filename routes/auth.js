const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const wrap = require('../middleware/wrap');
const { protect } = require('../middleware/auth');

const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const shape = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Enter your email and password.' });
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await user.matches(password))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  res.json({ token: sign(user), user: shape(user) });
}));

router.get('/me', protect, (req, res) => res.json({ user: shape(req.user) }));

module.exports = router;
