const prisma = require('../prismaClient');

// ช่วยดึงหรือสร้าง Cart สำหรับ User
async function getOrCreateCart(userId) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: { product: true }
      }
    }
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });
  }

  return cart;
}

// GET /api/cart
async function getCart(req, res) {
  try {
    const cart = await getOrCreateCart(req.user.id);

    const formattedItems = cart.items.map(item => ({
      id: item.id,
      productId: item.productId,
      title: item.product.title,
      price: item.product.price,
      quantity: item.quantity,
      itemTotal: item.product.price * item.quantity
    }));

    const totalAmount = formattedItems.reduce((acc, item) => acc + item.itemTotal, 0);

    return res.json({
      cartId: cart.id,
      items: formattedItems,
      totalAmount
    });
  } catch (error) {
    console.error('Get Cart Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// POST /api/cart/items
async function addToCart(req, res) {
  try {
    const { productId, quantity = 1 } = req.body;
    const qty = parseInt(quantity);

    if (!productId || qty <= 0) {
      return res.status(400).json({ error: 'Validation Error: valid productId and quantity (> 0) are required' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const cart = await getOrCreateCart(req.user.id);

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId
        }
      }
    });

    const newQuantity = (existingItem ? existingItem.quantity : 0) + qty;

    if (newQuantity > product.inventory) {
      return res.status(400).json({
        error: `Insufficient inventory. Available: ${product.inventory}, Requested: ${newQuantity}`
      });
    }

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity }
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity: qty
        }
      });
    }

    return getCart(req, res);
  } catch (error) {
    console.error('Add To Cart Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// PUT /api/cart/items/:productId
async function updateCartItem(req, res) {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const qty = parseInt(quantity);

    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({ error: 'Validation Error: valid quantity is required' });
    }

    const cart = await getOrCreateCart(req.user.id);

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId
        }
      }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    if (qty === 0) {
      await prisma.cartItem.delete({ where: { id: existingItem.id } });
    } else {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (qty > product.inventory) {
        return res.status(400).json({
          error: `Insufficient inventory. Available: ${product.inventory}, Requested: ${qty}`
        });
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: qty }
      });
    }

    return getCart(req, res);
  } catch (error) {
    console.error('Update Cart Item Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// DELETE /api/cart/items/:productId
async function removeCartItem(req, res) {
  try {
    const { productId } = req.params;
    const cart = await getOrCreateCart(req.user.id);

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId
        }
      }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    await prisma.cartItem.delete({ where: { id: existingItem.id } });

    return getCart(req, res);
  } catch (error) {
    console.error('Remove Cart Item Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// DELETE /api/cart
async function clearCart(req, res) {
  try {
    const cart = await getOrCreateCart(req.user.id);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    return res.json({ message: 'Cart cleared successfully', items: [], totalAmount: 0 });
  } catch (error) {
    console.error('Clear Cart Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart
};
