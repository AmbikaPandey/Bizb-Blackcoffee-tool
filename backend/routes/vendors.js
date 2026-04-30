const express = require('express');
const Vendor = require('../models/Vendor');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ name: 1 }).lean();
    res.json(vendors.map((v) => ({ id: v._id, ...v })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).lean();
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ id: vendor._id, ...vendor });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, gstin, contact, city, phone, email, state } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Vendor name is required' });
    const vendor = await Vendor.create({ name: name.trim(), gstin, contact, city, phone, email, state });
    res.status(201).json({ id: vendor._id, ...vendor.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ id: vendor._id, ...vendor });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ message: 'Vendor deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

module.exports = router;
