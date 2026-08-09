const express = require('express');
const router = express.Router();
const {
  createCheckoutIntent,
  confirmMockPayment,
  stripeWebhook
} = require('../controllers/checkoutController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.post('/create-intent', authenticateToken, createCheckoutIntent);
router.post('/confirm-mock-payment', authenticateToken, confirmMockPayment);
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

module.exports = router;
