const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createCheckoutSession,
  createPortalSession,
  getSubscription,
} = require('../controllers/paymentController');

// All routes below require authentication
router.post('/create-checkout-session', protect, createCheckoutSession);
router.post('/create-portal-session', protect, createPortalSession);
router.get('/subscription', protect, getSubscription);

// Webhook is registered separately in app.js (needs raw body parser)

module.exports = router;
