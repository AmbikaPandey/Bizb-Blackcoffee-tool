const express = require('express');
const Product = require('../models/Product');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 }).lean();
    res.json(products.map((p) => ({ id: p._id, ...p })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ id: product._id, ...product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, hsn, rate, unit, gst, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
    const product = await Product.create({ name: name.trim(), hsn, rate, unit, gst, description });
    res.status(201).json({ id: product._id, ...product.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ id: product._id, ...product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
