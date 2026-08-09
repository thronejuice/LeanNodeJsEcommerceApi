const Stripe = require('stripe');
const prisma = require('../prismaClient');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key';
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

// POST /api/checkout/create-intent
async function createCheckoutIntent(req, res) {
  try {
    const userId = req.user.id;

    // ดึงตะกร้าสินค้าของผู้ใช้งาน
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // ตรวจสอบสต็อกก่อนสั่งซื้อ
    for (const item of cart.items) {
      if (item.quantity > item.product.inventory) {
        return res.status(400).json({
          error: `Product '${item.product.title}' has insufficient stock. Available: ${item.product.inventory}`
        });
      }
    }

    // คำนวณราคารวม
    const totalAmount = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const amountInCents = Math.round(totalAmount * 100);

    let paymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    let clientSecret = `${paymentIntentId}_secret_mock`;

    // ถ้าไม่ใช่ mock key ให้เรียก Stripe API จริง
    if (!stripeSecretKey.startsWith('sk_test_mock')) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'thb',
          metadata: { userId }
        });
        paymentIntentId = paymentIntent.id;
        clientSecret = paymentIntent.client_secret;
      } catch (stripeErr) {
        console.warn('Stripe API Call warning, falling back to mock response:', stripeErr.message);
      }
    }

    // สร้างคำสั่งซื้อสถานะ pending ในระบบ
    const order = await prisma.order.create({
      data: {
        userId,
        totalAmount,
        status: 'pending',
        stripePaymentIntentId: paymentIntentId,
        items: {
          create: cart.items.map(item => ({
            productId: item.productId,
            price: item.product.price,
            quantity: item.quantity
          }))
        }
      },
      include: {
        items: true
      }
    });

    return res.json({
      message: 'Checkout intent created successfully',
      orderId: order.id,
      paymentIntentId,
      clientSecret,
      totalAmount
    });
  } catch (error) {
    console.error('Create Checkout Intent Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// POST /api/checkout/confirm-mock-payment (สำหรับการทดสอบระบบสำเร็จ)
async function confirmMockPayment(req, res) {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'paid') {
      return res.json({ message: 'Order is already paid', order });
    }

    // หักสต็อกสินค้า
    for (const item of order.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          inventory: {
            decrement: item.quantity
          }
        }
      });
    }

    // อัปเดตสถานะเป็น paid
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'paid' },
      include: { items: true }
    });

    // ล้างตะกร้าสินค้า
    const cart = await prisma.cart.findUnique({ where: { userId: order.userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return res.json({
      message: 'Payment confirmed and stock updated',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Confirm Mock Payment Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// POST /api/webhook/stripe (Stripe Webhook Handler)
async function stripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event = req.body;

  if (sig && webhookSecret && !webhookSecret.startsWith('whsec_mock')) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  // ประมวลผล Event
  if (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed') {
    const paymentIntent = event.data.object;
    const paymentIntentId = paymentIntent.id;

    const order = await prisma.order.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { items: true }
    });

    if (order && order.status !== 'paid') {
      // หักสต็อก
      for (const item of order.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { inventory: { decrement: item.quantity } }
        });
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'paid' }
      });

      const cart = await prisma.cart.findUnique({ where: { userId: order.userId } });
      if (cart) {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
    }
  }

  return res.json({ received: true });
}

// GET /api/orders
async function getUserOrders(req, res) {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: {
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(orders);
  } catch (error) {
    console.error('Get User Orders Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// GET /api/orders/:id
async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json(order);
  } catch (error) {
    console.error('Get Order By Id Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  createCheckoutIntent,
  confirmMockPayment,
  stripeWebhook,
  getUserOrders,
  getOrderById
};
