const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');
const prisma = require('../src/prismaClient');

let server;
let baseUrl;
let adminToken = '';
let userToken = '';
let productId = '';
let createdOrderId = '';

// Helper to make HTTP request easily
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ statusCode: res.statusCode, body: json });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

describe('E-Commerce REST API Test Suite (Native Test Runner)', () => {

  before(async () => {
    await prisma.reset();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    if (server) server.close();
  });

  test('1. Health Check Endpoint (GET /api/health)', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  test('2. Registration - Admin User', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: 'admin_test@ecommerce.com',
      password: 'password123',
      name: 'Admin Tester',
      role: 'admin'
    });
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.user.role, 'admin');
    assert.ok(res.body.token);
    adminToken = res.body.token;
  });

  test('3. Registration - Normal User', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: 'user_test@ecommerce.com',
      password: 'password123',
      name: 'User Tester',
      role: 'user'
    });
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.user.role, 'user');
    assert.ok(res.body.token);
    userToken = res.body.token;
  });

  test('4. Login - Valid Credentials', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'user_test@ecommerce.com',
      password: 'password123'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.token);
  });

  test('5. Login - Invalid Credentials (401 Unauthorized)', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'user_test@ecommerce.com',
      password: 'wrongpassword'
    });
    assert.strictEqual(res.statusCode, 401);
  });

  test('6. Products - Normal User cannot create product (403 Forbidden)', async () => {
    const res = await request('POST', '/api/products/admin', {
      title: 'Unauthorized Product',
      price: 100
    }, userToken);
    assert.strictEqual(res.statusCode, 403);
  });

  test('7. Products - Admin User creates product (201 Created)', async () => {
    const res = await request('POST', '/api/products/admin', {
      title: 'Smart Watch Pro',
      description: 'A premium smart watch with heart rate sensor',
      price: 3500,
      inventory: 10,
      category: 'Gadgets'
    }, adminToken);
    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.body.product.id);
    productId = res.body.product.id;
  });

  test('8. Products - Fetch product list (GET /api/products)', async () => {
    const res = await request('GET', '/api/products');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.length > 0);
  });

  test('9. Products - Search product by title', async () => {
    const res = await request('GET', '/api/products?search=Watch');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data[0].title, 'Smart Watch Pro');
  });

  test('10. Cart - Add product to user cart', async () => {
    const res = await request('POST', '/api/cart/items', {
      productId,
      quantity: 2
    }, userToken);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.items.length, 1);
    assert.strictEqual(res.body.totalAmount, 7000);
  });

  test('11. Cart - Add items exceeding inventory (400 Bad Request)', async () => {
    const res = await request('POST', '/api/cart/items', {
      productId,
      quantity: 100
    }, userToken);
    assert.strictEqual(res.statusCode, 400);
  });

  test('12. Checkout - Create Stripe Intent', async () => {
    const res = await request('POST', '/api/checkout/create-intent', null, userToken);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.orderId);
    assert.ok(res.body.paymentIntentId);
    createdOrderId = res.body.orderId;
  });

  test('13. Checkout - Confirm Payment and deduct inventory stock', async () => {
    const res = await request('POST', '/api/checkout/confirm-mock-payment', {
      orderId: createdOrderId
    }, userToken);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.order.status, 'paid');

    // Verify stock inventory reduced from 10 to 8
    const productRes = await request('GET', `/api/products/${productId}`);
    assert.strictEqual(productRes.body.inventory, 8);
  });

  test('14. Orders - Retrieve user order history', async () => {
    const res = await request('GET', '/api/orders', null, userToken);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].status, 'paid');
  });
});
