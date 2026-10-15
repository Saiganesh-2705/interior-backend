const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Sign in to continue.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'Account not found.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Session expired. Sign in again.' });
  }
};

exports.adminOnly = (req, res, next) =>
  req.user && req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admins only.' });
