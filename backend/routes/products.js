const express = require('express');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const products = await Product.find().populate('vendor_id', 'name').sort({ name: 1 }).lean();
    res.json(products.map((p) => ({ id: p._id, ...p, vendor_name: p.vendor_id?.name || '' })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('vendor_id', 'name').lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ id: product._id, ...product, vendor_name: product.vendor_id?.name || '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, vendor_id, category, hsn, rate, unit, gst, description, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
    if (!vendor_id) return res.status(400).json({ error: 'Vendor is required' });
    const vendor = await Vendor.findById(vendor_id);
    if (!vendor) return res.status(400).json({ error: 'Invalid vendor' });
    const product = await Product.create({ name: name.trim(), vendor_id, category, hsn, rate, unit, gst, description, status });
    res.status(201).json({ id: product._id, ...product.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (req.body.vendor_id) {
      const vendor = await Vendor.findById(req.body.vendor_id);
      if (!vendor) return res.status(400).json({ error: 'Invalid vendor' });
    }
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true }).populate('vendor_id', 'name').lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ id: product._id, ...product, vendor_name: product.vendor_id?.name || '' });
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
