/**
 * Database Reset Script
 * WARNING: This will delete ALL data except the admin user.
 * Usage: npm run reset-db
 * 
 * Requires confirmation via --confirm flag:
 *   node config/resetDb.js --confirm
 */
require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function resetDatabase() {
  if (!process.argv.includes('--confirm')) {
    logger.error('⚠️  DATABASE RESET requires --confirm flag');
    logger.error('Usage: node config/resetDb.js --confirm');
    logger.error('This will DELETE ALL DATA except the admin user.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error('MONGODB_URI environment variable is required');
    process.exit(1);
  }

  // Safety: prevent running on production without explicit override
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force-production')) {
    logger.error('Cannot reset production database without --force-production flag');
    process.exit(1);
  }

  await mongoose.connect(uri);
  logger.info('Connected to MongoDB for database reset...');

  const User = require('../models/User');
  const Client = require('../models/Client');
  const Invoice = require('../models/Invoice');
  const Payment = require('../models/Payment');
  const Product = require('../models/Product');
  const Project = require('../models/Project');
  const Vendor = require('../models/Vendor');
  const Expense = require('../models/Expense');
  const Session = require('../models/Session');

  // Clear all collections except users (keep admin)
  const results = {};
  results.invoices = await Invoice.deleteMany({});
  results.payments = await Payment.deleteMany({});
  results.clients = await Client.deleteMany({});
  results.products = await Product.deleteMany({});
  results.projects = await Project.deleteMany({});
  results.vendors = await Vendor.deleteMany({});
  results.expenses = await Expense.deleteMany({});
  results.sessions = await Session.deleteMany({});

  // Remove non-admin users
  results.users = await User.deleteMany({ role: { $ne: 'Admin' } });

  logger.info('Database reset complete:');
  for (const [collection, result] of Object.entries(results)) {
    logger.info(`  ${collection}: ${result.deletedCount} deleted`);
  }

  await mongoose.disconnect();
  logger.info('Disconnected. Database is clean.');
}

resetDatabase().catch((err) => {
  logger.error('Reset error: ' + err.message);
  process.exit(1);
});
