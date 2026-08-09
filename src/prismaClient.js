const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// In-Memory Database for E-Commerce API with automatic initial seed data
class Database {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = [];
    this.products = [];
    this.carts = [];
    this.cartItems = [];
    this.orders = [];
    this.orderItems = [];

    // Pre-populate default seed data on initialization so web app & API always have initial products
    this.initDefaultData();
  }

  initDefaultData() {
    const adminPasswordHash = bcrypt.hashSync('admin1234', 10);
    const adminUser = {
      id: 'usr_admin_default',
      email: 'admin@ecommerce.com',
      passwordHash: adminPasswordHash,
      name: 'System Admin',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.push(adminUser);
    this.carts.push({ id: 'cart_admin_default', userId: adminUser.id, createdAt: new Date(), updatedAt: new Date() });

    const userPasswordHash = bcrypt.hashSync('user1234', 10);
    const normalUser = {
      id: 'usr_normal_default',
      email: 'john@example.com',
      passwordHash: userPasswordHash,
      name: 'John Doe',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.push(normalUser);
    this.carts.push({ id: 'cart_normal_default', userId: normalUser.id, createdAt: new Date(), updatedAt: new Date() });

    const defaultProducts = [
      {
        id: 'prod_1',
        title: 'Wireless Noise-Canceling Headphones',
        description: 'High-fidelity audio with active noise cancellation and 30-hour battery life.',
        price: 4990.0,
        inventory: 25,
        category: 'Electronics',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'prod_2',
        title: 'Mechanical Gaming Keyboard',
        description: 'RGB backlit mechanical keyboard with hot-swappable switches.',
        price: 2590.0,
        inventory: 15,
        category: 'Electronics',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'prod_3',
        title: 'Ergonomic Office Chair',
        description: 'Breathable mesh chair with adjustable lumbar support and 3D armrests.',
        price: 6890.0,
        inventory: 10,
        category: 'Furniture',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'prod_4',
        title: 'Stainless Steel Water Bottle 1L',
        description: 'Double-wall vacuum insulated water bottle keeping drinks cold for 24 hours.',
        price: 590.0,
        inventory: 50,
        category: 'Lifestyle',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    this.products.push(...defaultProducts);
  }

  // Helpers
  generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
  }

  // --- USER MODEL ---
  user = {
    findUnique: async ({ where }) => {
      if (where.id) return this.users.find(u => u.id === where.id) || null;
      if (where.email) return this.users.find(u => u.email === where.email) || null;
      return null;
    },
    create: async ({ data, select }) => {
      const newUser = {
        id: this.generateId(),
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        role: data.role || 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.users.push(newUser);

      if (data.cart && data.cart.create) {
        await this.cart.create({ data: { userId: newUser.id } });
      }

      if (select) {
        const result = {};
        for (const key of Object.keys(select)) {
          if (select[key]) result[key] = newUser[key];
        }
        return result;
      }
      return newUser;
    },
    findMany: async () => this.users,
    deleteMany: async () => { this.users = []; return { count: 0 }; }
  };

  // --- PRODUCT MODEL ---
  product = {
    findMany: async ({ where = {}, skip = 0, take = 20, orderBy } = {}) => {
      let result = [...this.products];
      if (where.category) {
        result = result.filter(p => p.category === where.category);
      }
      if (where.OR) {
        result = result.filter(p => {
          return where.OR.some(cond => {
            if (cond.title && cond.title.contains) {
              return p.title.toLowerCase().includes(cond.title.contains.toLowerCase());
            }
            if (cond.description && cond.description.contains) {
              return p.description.toLowerCase().includes(cond.description.contains.toLowerCase());
            }
            return false;
          });
        });
      }
      if (orderBy && orderBy.createdAt === 'desc') {
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return result.slice(skip, skip + take);
    },
    count: async ({ where = {} } = {}) => {
      const items = await this.product.findMany({ where, skip: 0, take: 999999 });
      return items.length;
    },
    findUnique: async ({ where }) => {
      return this.products.find(p => p.id === where.id) || null;
    },
    create: async ({ data }) => {
      const newProduct = {
        id: this.generateId(),
        title: data.title,
        description: data.description || '',
        price: parseFloat(data.price),
        inventory: parseInt(data.inventory || 0),
        category: data.category || 'General',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.products.push(newProduct);
      return newProduct;
    },
    update: async ({ where, data }) => {
      const product = this.products.find(p => p.id === where.id);
      if (!product) throw new Error('Product not found');

      if (data.title !== undefined) product.title = data.title;
      if (data.description !== undefined) product.description = data.description;
      if (data.price !== undefined) product.price = parseFloat(data.price);
      if (data.inventory !== undefined) {
        if (typeof data.inventory === 'object' && data.inventory.decrement !== undefined) {
          product.inventory -= data.inventory.decrement;
        } else {
          product.inventory = parseInt(data.inventory);
        }
      }
      if (data.category !== undefined) product.category = data.category;
      product.updatedAt = new Date();
      return product;
    },
    delete: async ({ where }) => {
      const idx = this.products.findIndex(p => p.id === where.id);
      if (idx !== -1) this.products.splice(idx, 1);
      return { id: where.id };
    },
    deleteMany: async () => { this.products = []; return { count: 0 }; }
  };

  // --- CART MODEL ---
  cart = {
    findUnique: async ({ where, include }) => {
      let cart = null;
      if (where.userId) cart = this.carts.find(c => c.userId === where.userId) || null;
      if (where.id) cart = this.carts.find(c => c.id === where.id) || null;

      if (cart && include && include.items) {
        const items = this.cartItems.filter(ci => ci.cartId === cart.id);
        if (include.items.include && include.items.include.product) {
          cart.items = items.map(item => ({
            ...item,
            product: this.products.find(p => p.id === item.productId)
          }));
        } else {
          cart.items = items;
        }
      }
      return cart;
    },
    create: async ({ data, include }) => {
      const newCart = {
        id: this.generateId(),
        userId: data.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: []
      };
      this.carts.push(newCart);
      return this.cart.findUnique({ where: { id: newCart.id }, include });
    },
    deleteMany: async () => { this.carts = []; return { count: 0 }; }
  };

  // --- CART ITEM MODEL ---
  cartItem = {
    findUnique: async ({ where }) => {
      if (where.id) return this.cartItems.find(ci => ci.id === where.id) || null;
      if (where.cartId_productId) {
        return this.cartItems.find(ci => ci.cartId === where.cartId_productId.cartId && ci.productId === where.cartId_productId.productId) || null;
      }
      return null;
    },
    create: async ({ data }) => {
      const item = {
        id: this.generateId(),
        cartId: data.cartId,
        productId: data.productId,
        quantity: parseInt(data.quantity || 1),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.cartItems.push(item);
      return item;
    },
    update: async ({ where, data }) => {
      const item = this.cartItems.find(ci => ci.id === where.id);
      if (item) {
        item.quantity = parseInt(data.quantity);
        item.updatedAt = new Date();
      }
      return item;
    },
    delete: async ({ where }) => {
      const idx = this.cartItems.findIndex(ci => ci.id === where.id);
      if (idx !== -1) this.cartItems.splice(idx, 1);
      return { id: where.id };
    },
    deleteMany: async ({ where = {} } = {}) => {
      if (where.cartId) {
        this.cartItems = this.cartItems.filter(ci => ci.cartId !== where.cartId);
      } else {
        this.cartItems = [];
      }
      return { count: 0 };
    }
  };

  // --- ORDER MODEL ---
  order = {
    create: async ({ data, include }) => {
      const newOrder = {
        id: this.generateId(),
        userId: data.userId,
        totalAmount: parseFloat(data.totalAmount),
        status: data.status || 'pending',
        stripePaymentIntentId: data.stripePaymentIntentId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: []
      };

      if (data.items && data.items.create) {
        for (const itemData of data.items.create) {
          const orderItem = {
            id: this.generateId(),
            orderId: newOrder.id,
            productId: itemData.productId,
            price: parseFloat(itemData.price),
            quantity: parseInt(itemData.quantity)
          };
          this.orderItems.push(orderItem);
          newOrder.items.push(orderItem);
        }
      }

      this.orders.push(newOrder);
      return this.order.findUnique({ where: { id: newOrder.id }, include });
    },
    findUnique: async ({ where, include }) => {
      const order = this.orders.find(o => o.id === where.id);
      if (!order) return null;

      if (include && include.items) {
        let items = this.orderItems.filter(oi => oi.orderId === order.id);
        if (include.items.include && include.items.include.product) {
          items = items.map(i => ({
            ...i,
            product: this.products.find(p => p.id === i.productId)
          }));
        }
        return { ...order, items };
      }
      return order;
    },
    findFirst: async ({ where, include }) => {
      const order = this.orders.find(o => o.stripePaymentIntentId === where.stripePaymentIntentId);
      if (!order) return null;
      return this.order.findUnique({ where: { id: order.id }, include });
    },
    findMany: async ({ where = {}, include, orderBy } = {}) => {
      let result = [...this.orders];
      if (where.userId) {
        result = result.filter(o => o.userId === where.userId);
      }
      if (orderBy && orderBy.createdAt === 'desc') {
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      if (include && include.items) {
        result = result.map(o => {
          let items = this.orderItems.filter(oi => oi.orderId === o.id);
          if (include.items.include && include.items.include.product) {
            items = items.map(i => ({
              ...i,
              product: this.products.find(p => p.id === i.productId)
            }));
          }
          return { ...o, items };
        });
      }
      return result;
    },
    update: async ({ where, data, include }) => {
      const order = this.orders.find(o => o.id === where.id);
      if (order) {
        if (data.status) order.status = data.status;
        order.updatedAt = new Date();
      }
      return this.order.findUnique({ where: { id: where.id }, include });
    },
    deleteMany: async () => { this.orders = []; return { count: 0 }; }
  };

  // --- ORDER ITEM MODEL ---
  orderItem = {
    deleteMany: async () => { this.orderItems = []; return { count: 0 }; }
  };

  $connect = async () => {};
  $disconnect = async () => {};
}

const db = new Database();
module.exports = db;
