const bcrypt = require('bcryptjs');
const prisma = require('./prismaClient');

async function main() {
  console.log('🌱 Seeding E-Commerce database...');

  // ลบข้อมูลเดิม
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // สร้าง Admin User
  const adminPasswordHash = await bcrypt.hash('admin1234', 10);
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@ecommerce.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      cart: { create: {} }
    }
  });
  console.log(`👤 Created Admin: ${admin.email} (Password: admin1234)`);

  // สร้าง Normal User
  const userPasswordHash = await bcrypt.hash('user1234', 10);
  const user = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      passwordHash: userPasswordHash,
      role: 'user',
      cart: { create: {} }
    }
  });
  console.log(`👤 Created User: ${user.email} (Password: user1234)`);

  // สร้าง Sample Products
  const products = [
    {
      title: 'Wireless Noise-Canceling Headphones',
      description: 'High-fidelity audio with active noise cancellation and 30-hour battery life.',
      price: 4990.0,
      inventory: 25,
      category: 'Electronics'
    },
    {
      title: 'Mechanical Gaming Keyboard',
      description: 'RGB backlit mechanical keyboard with hot-swappable switches.',
      price: 2590.0,
      inventory: 15,
      category: 'Electronics'
    },
    {
      title: 'Ergonomic Office Chair',
      description: 'Breathable mesh chair with adjustable lumbar support and 3D armrests.',
      price: 6890.0,
      inventory: 10,
      category: 'Furniture'
    },
    {
      title: 'Stainless Steel Water Bottle 1L',
      description: 'Double-wall vacuum insulated water bottle keeping drinks cold for 24 hours.',
      price: 590.0,
      inventory: 50,
      category: 'Lifestyle'
    }
  ];

  for (const p of products) {
    const created = await prisma.product.create({ data: p });
    console.log(`📦 Created Product: ${created.title} - ${created.price} THB (Stock: ${created.inventory})`);
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
