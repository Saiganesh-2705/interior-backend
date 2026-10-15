const router = require('express').Router();
const Enquiry = require('../models/Enquiry');
const Project = require('../models/Project');
const Service = require('../models/Service');
const Testimonial = require('../models/Testimonial');
const wrap = require('../middleware/wrap');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, adminOnly, wrap(async (req, res) => {
  const [enquiries, newEnquiries, fromChatbot, projects, services, testimonials] = await Promise.all([
    Enquiry.countDocuments(),
    Enquiry.countDocuments({ status: 'new' }),
    Enquiry.countDocuments({ source: 'chatbot' }),
    Project.countDocuments(),
    Service.countDocuments(),
    Testimonial.countDocuments()
  ]);
  res.json({ enquiries, newEnquiries, fromChatbot, projects, services, testimonials });
}));

module.exports = router;
