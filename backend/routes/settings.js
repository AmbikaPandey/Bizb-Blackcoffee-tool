const express = require('express');
const Setting = require('../models/Setting');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const settings = await Setting.find().lean();
    const obj = {};
    settings.forEach((s) => { obj[s.key] = s.value; });
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await Setting.findOneAndUpdate({ key }, { key, value }, { upsert: true });
    }
    res.json({ message: 'Settings saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
