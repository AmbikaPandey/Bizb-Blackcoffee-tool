/**
 * Production Seed Script
 * Seeds only essential data: admin user, default settings, HSN codes
 * Usage: npm run seed:prod
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Setting = require('../models/Setting');
const logger = require('../utils/logger');

const DEFAULT_SETTINGS = [
  { key: 'company_name', value: 'Black Coffee Communication Pvt. Ltd.' },
  { key: 'company_gstin', value: '' },
  { key: 'company_pan', value: '' },
  { key: 'company_address', value: '' },
  { key: 'company_city', value: '' },
  { key: 'company_state', value: '' },
  { key: 'company_pincode', value: '' },
  { key: 'company_phone', value: '' },
  { key: 'company_email', value: '' },
  { key: 'company_website', value: '' },
  { key: 'bank_name', value: '' },
  { key: 'bank_account', value: '' },
  { key: 'bank_ifsc', value: '' },
  { key: 'bank_branch', value: '' },
  { key: 'invoice_prefix', value: 'INV' },
  { key: 'invoice_next_number', value: '1' },
  { key: 'default_credit_period', value: '30' },
  { key: 'default_tax_type', value: 'IGST' },
  { key: 'default_terms', value: '1. Payment is due within 30 days.\n2. Please include invoice number in payment reference.' },
];

async function seedProduction() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error('MONGODB_URI environment variable is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  logger.info('Connected to MongoDB for production seeding...');

  // 1. Seed admin user
  const adminExists = await User.findOne({ role: 'Admin' });
  if (!adminExists) {
    await User.create({
      username: 'Admin',
      email: 'admin@bizb.in',
      password: 'ChangeMe@2026',
      role: 'Admin',
      is_active: true,
    });
    logger.info('Created admin user (admin@bizb.in) — CHANGE PASSWORD IMMEDIATELY');
  } else {
    logger.info('Admin user already exists, skipping');
  }

  // 2. Seed default settings
  for (const setting of DEFAULT_SETTINGS) {
    await Setting.findOneAndUpdate(
      { key: setting.key },
      { $setOnInsert: setting },
      { upsert: true }
    );
  }
  logger.info(`Ensured ${DEFAULT_SETTINGS.length} default settings exist`);

  // 3. Seed HSN codes (use existing script)
  const HsnCode = require('../models/HsnCode');
  const hsnCount = await HsnCode.countDocuments();
  if (hsnCount === 0) {
    logger.info('No HSN codes found — run `npm run seed:hsn` to seed HSN codes');
  } else {
    logger.info(`${hsnCount} HSN codes already exist`);
  }

  await mongoose.disconnect();
  logger.info('Production seed complete.');
}

seedProduction().catch((err) => {
  logger.error('Production seed error: ' + err.message);
  process.exit(1);
});
