const express = require('express');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Validation helpers
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function sanitize(str) {
  return typeof str === 'string' ? str.replace(/[<>]/g, '').trim() : '';
}

router.get('/', authenticate, authorize('vendors', 'view'), async (req, res) => {
  try {
    const vendors = await Vendor.find().populate('created_by', 'username').sort({ name: 1 }).lean();
    res.json(vendors.map((v) => ({
      id: v._id, ...v,
      created_by_name: v.created_by?.username || '',
      created_by: v.created_by?._id || v.created_by,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

router.get('/:id', authenticate, authorize('vendors', 'view'), async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).populate('created_by', 'username').lean();
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    // Get linked products
    const products = await Product.find({ vendor_id: vendor._id }).select('name hsn rate unit gst status').lean();

    res.json({
      id: vendor._id, ...vendor,
      created_by_name: vendor.created_by?.username || '',
      created_by: vendor.created_by?._id || vendor.created_by,
      products: products.map(p => ({ id: p._id, ...p })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

router.post('/', authenticate, authorize('vendors', 'create'), async (req, res) => {
  try {
    const { name, gstin, pan, contact, contact1, contact2, city, phone, email, state, address, pincode, bank_details } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Vendor name is required' });
    if (phone && !PHONE_RE.test(phone)) return res.status(400).json({ error: 'Invalid phone number (10 digits starting with 6-9)' });
    if (contact1 && !PHONE_RE.test(contact1)) return res.status(400).json({ error: 'Invalid Contact 1 (10 digits starting with 6-9)' });
    if (contact2 && !PHONE_RE.test(contact2)) return res.status(400).json({ error: 'Invalid Contact 2 (10 digits starting with 6-9)' });
    if (pan && !PAN_RE.test(pan)) return res.status(400).json({ error: 'Invalid PAN format' });
    if (gstin && !GSTIN_RE.test(gstin)) return res.status(400).json({ error: 'Invalid GSTIN format' });

    const vendor = await Vendor.create({
      name: sanitize(name), gstin: sanitize(gstin), pan: sanitize(pan),
      contact: sanitize(contact), contact1: sanitize(contact1), contact2: sanitize(contact2),
      city: sanitize(city), phone: sanitize(phone),
      email: sanitize(email), state: sanitize(state), address: sanitize(address),
      pincode: sanitize(pincode), bank_details: bank_details || {},
      created_by: req.user.id,
    });
    res.status(201).json({ id: vendor._id, ...vendor.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

router.put('/:id', authenticate, authorize('vendors', 'edit'), async (req, res) => {
  try {
    if (req.body.phone && !PHONE_RE.test(req.body.phone)) return res.status(400).json({ error: 'Invalid phone number (10 digits starting with 6-9)' });
    if (req.body.contact1 && !PHONE_RE.test(req.body.contact1)) return res.status(400).json({ error: 'Invalid Contact 1 (10 digits starting with 6-9)' });
    if (req.body.contact2 && !PHONE_RE.test(req.body.contact2)) return res.status(400).json({ error: 'Invalid Contact 2 (10 digits starting with 6-9)' });
    if (req.body.pan && !PAN_RE.test(req.body.pan)) return res.status(400).json({ error: 'Invalid PAN format' });
    if (req.body.gstin && !GSTIN_RE.test(req.body.gstin)) return res.status(400).json({ error: 'Invalid GSTIN format' });

    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true }).lean();
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ id: vendor._id, ...vendor });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

router.delete('/:id', authenticate, authorize('vendors', 'delete'), async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ message: 'Vendor deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

module.exports = router;
