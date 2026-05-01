require('dotenv').config();
const mongoose = require('mongoose');
const Client = require('../models/Client');
const Product = require('../models/Product');
const User = require('../models/User');

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bizb';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB for seeding...');

  // Seed clients
  const clientCount = await Client.countDocuments();
  if (clientCount === 0) {
    await Client.insertMany([
      { name: 'AARADHYA DISPOSAL INDUSTRIES LIMITED', gstin: '23AADCA5724H1Z6', city: 'Dewas', outstanding: 761468.0 },
      { name: 'AKKO GLOBAL SERVICES LIMITED', gstin: '07AABCI3830L1ZY', city: 'NEW DELHI', outstanding: 0 },
      { name: 'ALPEX Solar Limited', gstin: '06AABCA8863Q1ZN', city: 'Greater Noida', outstanding: 0 },
      { name: 'AMRI Mumbai', gstin: '27AAACA7282Q0R2M', city: 'Mumbai', outstanding: 0 },
      { name: 'ANONDITA MEDICARE LIMITED', gstin: '09ABACA3335P1Z0', city: 'Noida', outstanding: 128.0 },
      { name: 'ANYA POLYTECH & FERTILIZERS LIMITED', gstin: '09AACCA3440J1Z1', city: 'Shahjahanpur', outstanding: 0 },
      { name: 'ASPIRE & INNOVATIVE ADVERTISING LIMITED', gstin: '06AAPCA7108K1Z8', city: 'GURGAON', outstanding: 0 },
      { name: 'ASSOCIATION OF NATIONAL EXCHANGES MEMBERS OF INDIA', gstin: '07AAATA7828J1Z1', city: 'New Delhi', outstanding: 0 },
      { name: 'Apex Ecotech Limited', gstin: '07AACCA6496M1Z9', city: 'New Delhi', outstanding: 0 },
      { name: 'NATIONAL STOCK EXCHANGE OF INDIA LIMITED', gstin: '27AAACN1791K1Z1', city: 'Mumbai', outstanding: 2151413.0 },
      { name: 'BSE Limited', gstin: '07AACCO8847L1ZC', city: 'Mumbai', outstanding: 0 },
      { name: 'Commodity Participants Association of India', gstin: '07AAATC7690C1ZL', city: 'New Delhi', outstanding: 0 },
      { name: 'Metropolitan Stock Exchange Of India Limited', gstin: '07AAPFM9434P1Z8', contact: 'Peeyush Jain', city: 'Delhi', outstanding: 0 },
      { name: 'NSDL IFPT', gstin: '27AAAT9652Q1ZIA', city: 'Mumbai', outstanding: 0 },
      { name: 'MULTI COMMODITY EXCHANGE OF INDIA LIMITED', gstin: '07AADCM0819J1ZI', city: 'New Delhi', outstanding: 0 },
    ]);
    console.log('Seeded 15 clients');
  } else {
    console.log(`Clients already exist (${clientCount}), skipping`);
  }

  // Seed products
  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    await Product.insertMany([
      { name: 'Web Development Services', hsn: '998314', rate: 50000, unit: 'Per Project', gst: 18, description: 'Full stack web development' },
      { name: 'UI/UX Design', hsn: '998314', rate: 30000, unit: 'Per Project', gst: 18, description: 'User interface and experience design' },
      { name: 'Digital Marketing', hsn: '998361', rate: 25000, unit: 'Per Month', gst: 18, description: 'SEO, SEM, Social Media' },
      { name: 'Content Writing', hsn: '998397', rate: 5000, unit: 'Per Article', gst: 18, description: 'Blog posts and articles' },
      { name: 'Video Production', hsn: '998371', rate: 75000, unit: 'Per Video', gst: 18, description: 'Corporate video production' },
    ]);
    console.log('Seeded 5 products');
  } else {
    console.log(`Products already exist (${productCount}), skipping`);
  }

  // Seed admin user
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    await User.create({
      username: 'Ambika',
      email: 'ambika@bizb.in',
      password: 'admin123',
      role: 'Super Admin',
    });
    console.log('Seeded super admin user (ambika@bizb.in / admin123)');
  } else {
    console.log(`Users already exist (${userCount}), skipping`);
  }

  await mongoose.disconnect();
  console.log('Seed complete, disconnected.');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
