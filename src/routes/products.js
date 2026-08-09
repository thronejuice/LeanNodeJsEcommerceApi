const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');

// Public Product Endpoints
router.get('/', getProducts);
router.get('/:id', getProductById);

// Admin Product Endpoints
router.post('/admin', authenticateToken, requireAdmin, createProduct);
router.put('/admin/:id', authenticateToken, requireAdmin, updateProduct);
router.delete('/admin/:id', authenticateToken, requireAdmin, deleteProduct);

module.exports = router;
