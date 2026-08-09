const app = require('./app');
const prisma = require('./prismaClient');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Successfully connected to Database via Prisma');

    app.listen(PORT, () => {
      console.log(`🚀 E-Commerce API Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
