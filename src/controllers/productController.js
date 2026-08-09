const prisma = require('../prismaClient');

// GET /api/products (ค้นหา คัดกรอง แบ่งหน้า)
async function getProducts(req, res) {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } }
      ];
    }
    if (category) {
      where.category = category;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where })
    ]);

    return res.json({
      data: products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get Products Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// GET /api/products/:id
async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json(product);
  } catch (error) {
    console.error('Get Product By Id Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// POST /api/admin/products (Admin Only)
async function createProduct(req, res) {
  try {
    const { title, description, price, inventory, category } = req.body;

    if (!title || price === undefined || price === null) {
      return res.status(400).json({ error: 'Validation Error: title and price are required' });
    }

    const product = await prisma.product.create({
      data: {
        title,
        description: description || '',
        price: parseFloat(price),
        inventory: inventory !== undefined ? parseInt(inventory) : 0,
        category: category || 'General'
      }
    });

    return res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create Product Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// PUT /api/admin/products/:id (Admin Only)
async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const { title, description, price, inventory, category } = req.body;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (inventory !== undefined) updateData.inventory = parseInt(inventory);
    if (category !== undefined) updateData.category = category;

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData
    });

    return res.json({
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update Product Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// DELETE /api/admin/products/:id (Admin Only)
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await prisma.product.delete({ where: { id } });

    return res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete Product Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
