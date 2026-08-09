const express = require('express');
const router = express.Router();
const { getUserOrders, getOrderById } = require('../controllers/checkoutController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.get('/', getUserOrders);
router.get('/:id', getOrderById);

module.exports = router;
