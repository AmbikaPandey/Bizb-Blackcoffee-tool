/**
 * HSN Code Seeder Script
 * Seeds the database with common HSN and SAC codes
 * Usage: npm run seed:hsn
 */
require('dotenv').config();
const mongoose = require('mongoose');
const HsnCode = require('../models/HsnCode');

const hsnData = [
  // Common HSN codes for goods
  { hsnCode: '4901', productName: 'Printed Books, Brochures, Leaflets', gstRate: 0, category: 'Printing', type: 'HSN' },
  { hsnCode: '4911', productName: 'Printed Matter (Catalogues, Posters)', gstRate: 12, category: 'Printing', type: 'HSN' },
  { hsnCode: '49111010', productName: 'Trade Advertising Material', gstRate: 12, category: 'Printing', type: 'HSN' },
  { hsnCode: '8471', productName: 'Computers and Computer Hardware', gstRate: 18, category: 'Electronics', type: 'HSN' },
  { hsnCode: '84713010', productName: 'Laptops', gstRate: 18, category: 'Electronics', type: 'HSN' },
  { hsnCode: '8517', productName: 'Telephone Sets & Communication Devices', gstRate: 18, category: 'Electronics', type: 'HSN' },
  { hsnCode: '85171100', productName: 'Smartphones / Mobile Phones', gstRate: 12, category: 'Electronics', type: 'HSN' },
  { hsnCode: '8523', productName: 'Digital Media (USB, SD Cards)', gstRate: 18, category: 'Electronics', type: 'HSN' },
  { hsnCode: '3926', productName: 'Plastic Articles (Signage, Display)', gstRate: 18, category: 'Signage', type: 'HSN' },
  { hsnCode: '7308', productName: 'Structures of Iron or Steel', gstRate: 18, category: 'Fabrication', type: 'HSN' },
  { hsnCode: '7610', productName: 'Aluminium Structures (Frames, Boards)', gstRate: 18, category: 'Fabrication', type: 'HSN' },
  { hsnCode: '8310', productName: 'Sign Plates, Name Plates of Base Metal', gstRate: 18, category: 'Signage', type: 'HSN' },
  { hsnCode: '6802', productName: 'Worked Stone (Monuments, Slabs)', gstRate: 18, category: 'Construction', type: 'HSN' },
  { hsnCode: '3919', productName: 'Self-adhesive Vinyl (Stickers)', gstRate: 18, category: 'Signage', type: 'HSN' },
  { hsnCode: '9405', productName: 'Lamps and Lighting Fittings', gstRate: 18, category: 'Lighting', type: 'HSN' },
  { hsnCode: '94054', productName: 'LED Lights and Fixtures', gstRate: 18, category: 'Lighting', type: 'HSN' },
  { hsnCode: '4819', productName: 'Cartons, Boxes (Packaging)', gstRate: 12, category: 'Packaging', type: 'HSN' },
  { hsnCode: '4821', productName: 'Paper Labels (Stickers, Tags)', gstRate: 12, category: 'Printing', type: 'HSN' },
  { hsnCode: '3920', productName: 'Plastic Sheets, Films (Flex, Banners)', gstRate: 18, category: 'Signage', type: 'HSN' },
  { hsnCode: '8528', productName: 'Monitors, Projectors, TVs', gstRate: 18, category: 'Electronics', type: 'HSN' },
  { hsnCode: '9503', productName: 'Toys and Models', gstRate: 12, category: 'General', type: 'HSN' },
  { hsnCode: '6307', productName: 'Textile Articles (Banners, Flags)', gstRate: 12, category: 'Textiles', type: 'HSN' },
  { hsnCode: '4823', productName: 'Paper Articles (POP Material)', gstRate: 18, category: 'Printing', type: 'HSN' },
  { hsnCode: '3923', productName: 'Plastic Articles for Packing', gstRate: 18, category: 'Packaging', type: 'HSN' },
  { hsnCode: '8504', productName: 'Electrical Transformers, Power Supplies', gstRate: 18, category: 'Electronics', type: 'HSN' },
  { hsnCode: '9401', productName: 'Seats and Chairs', gstRate: 18, category: 'Furniture', type: 'HSN' },
  { hsnCode: '9403', productName: 'Furniture (Office, Display)', gstRate: 18, category: 'Furniture', type: 'HSN' },
  { hsnCode: '6306', productName: 'Tarpaulins, Tents, Canopies', gstRate: 18, category: 'Events', type: 'HSN' },

  // Common SAC codes for services
  { hsnCode: '9971', productName: 'Financial and Related Services', gstRate: 18, category: 'Finance', type: 'SAC' },
  { hsnCode: '9973', productName: 'Leasing or Rental Services', gstRate: 18, category: 'Rental', type: 'SAC' },
  { hsnCode: '9981', productName: 'Research and Development Services', gstRate: 18, category: 'R&D', type: 'SAC' },
  { hsnCode: '9982', productName: 'Legal and Accounting Services', gstRate: 18, category: 'Professional', type: 'SAC' },
  { hsnCode: '9983', productName: 'Management Consulting Services', gstRate: 18, category: 'Consulting', type: 'SAC' },
  { hsnCode: '998311', productName: 'Management Consulting Services', gstRate: 18, category: 'Consulting', type: 'SAC' },
  { hsnCode: '998312', productName: 'Business Consulting Services', gstRate: 18, category: 'Consulting', type: 'SAC' },
  { hsnCode: '998313', productName: 'IT Consulting Services', gstRate: 18, category: 'IT Services', type: 'SAC' },
  { hsnCode: '998314', productName: 'Marketing / PR Consulting', gstRate: 18, category: 'Marketing', type: 'SAC' },
  { hsnCode: '9984', productName: 'Telecommunications Services', gstRate: 18, category: 'Telecom', type: 'SAC' },
  { hsnCode: '9985', productName: 'Transport of Goods', gstRate: 5, category: 'Logistics', type: 'SAC' },
  { hsnCode: '9986', productName: 'Transport of Passengers', gstRate: 5, category: 'Travel', type: 'SAC' },
  { hsnCode: '9987', productName: 'Travel and Tourism Services', gstRate: 5, category: 'Travel', type: 'SAC' },
  { hsnCode: '9988', productName: 'Manufacturing Services', gstRate: 18, category: 'Manufacturing', type: 'SAC' },
  { hsnCode: '9989', productName: 'Other Manufacturing Services', gstRate: 18, category: 'Manufacturing', type: 'SAC' },
  { hsnCode: '9991', productName: 'Public Administration Services', gstRate: 18, category: 'Government', type: 'SAC' },
  { hsnCode: '9992', productName: 'Education Services', gstRate: 0, category: 'Education', type: 'SAC' },
  { hsnCode: '9993', productName: 'Health and Social Services', gstRate: 0, category: 'Healthcare', type: 'SAC' },
  { hsnCode: '9994', productName: 'Sewage and Waste Management', gstRate: 18, category: 'Sanitation', type: 'SAC' },
  { hsnCode: '9995', productName: 'Services of Membership Organisations', gstRate: 18, category: 'Membership', type: 'SAC' },
  { hsnCode: '9996', productName: 'Recreational, Cultural and Sporting', gstRate: 18, category: 'Entertainment', type: 'SAC' },
  { hsnCode: '999611', productName: 'Audiovisual Production Services', gstRate: 18, category: 'Media', type: 'SAC' },
  { hsnCode: '999612', productName: 'Motion Picture / Video Production', gstRate: 18, category: 'Media', type: 'SAC' },
  { hsnCode: '9997', productName: 'Other Services (Event, Advertising)', gstRate: 18, category: 'Advertising', type: 'SAC' },
  { hsnCode: '998361', productName: 'Advertising Services', gstRate: 18, category: 'Advertising', type: 'SAC' },
  { hsnCode: '998362', productName: 'Advertising Agency Services', gstRate: 18, category: 'Advertising', type: 'SAC' },
  { hsnCode: '998363', productName: 'Sale of Advertising Space/Time', gstRate: 18, category: 'Advertising', type: 'SAC' },
  { hsnCode: '998364', productName: 'Outdoor Advertising Services', gstRate: 18, category: 'Advertising', type: 'SAC' },
  { hsnCode: '998365', productName: 'Digital Advertising Services', gstRate: 18, category: 'Advertising', type: 'SAC' },
  { hsnCode: '998366', productName: 'Creative Design Services', gstRate: 18, category: 'Design', type: 'SAC' },
  { hsnCode: '998371', productName: 'Photography and Videography', gstRate: 18, category: 'Media', type: 'SAC' },
  { hsnCode: '998372', productName: 'Event Management Services', gstRate: 18, category: 'Events', type: 'SAC' },
  { hsnCode: '998511', productName: 'Web Development Services', gstRate: 18, category: 'IT Services', type: 'SAC' },
  { hsnCode: '998512', productName: 'Software Development Services', gstRate: 18, category: 'IT Services', type: 'SAC' },
  { hsnCode: '998513', productName: 'IT Infrastructure Services', gstRate: 18, category: 'IT Services', type: 'SAC' },
  { hsnCode: '998514', productName: 'Hosting and Cloud Services', gstRate: 18, category: 'IT Services', type: 'SAC' },
  { hsnCode: '998515', productName: 'Data Processing Services', gstRate: 18, category: 'IT Services', type: 'SAC' },
  { hsnCode: '9954', productName: 'Construction Services', gstRate: 18, category: 'Construction', type: 'SAC' },
  { hsnCode: '9961', productName: 'Supply of Food and Beverages (Events)', gstRate: 18, category: 'Catering', type: 'SAC' },
  { hsnCode: '9963', productName: 'Accommodation Services', gstRate: 12, category: 'Hospitality', type: 'SAC' },
  { hsnCode: '9964', productName: 'Passenger Transport Services', gstRate: 5, category: 'Travel', type: 'SAC' },
  { hsnCode: '9965', productName: 'Goods Transport Services', gstRate: 5, category: 'Logistics', type: 'SAC' },
  { hsnCode: '9966', productName: 'Rental Services of Transport Vehicles', gstRate: 18, category: 'Rental', type: 'SAC' },
  { hsnCode: '9967', productName: 'Supporting Services in Transport', gstRate: 18, category: 'Logistics', type: 'SAC' },
  { hsnCode: '9968', productName: 'Postal and Courier Services', gstRate: 18, category: 'Logistics', type: 'SAC' },
  { hsnCode: '9969', productName: 'Electricity Distribution Services', gstRate: 18, category: 'Utilities', type: 'SAC' },
];

async function seedHSN() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bizb';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB for HSN seeding...');

  // Upsert each HSN code (won't duplicate on re-run)
  let inserted = 0;
  let updated = 0;
  for (const item of hsnData) {
    const result = await HsnCode.findOneAndUpdate(
      { hsnCode: item.hsnCode },
      { ...item, isActive: true },
      { upsert: true, returnDocument: 'after' }
    );
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      inserted++;
    } else {
      updated++;
    }
  }

  console.log(`HSN Seeding complete: ${inserted} inserted, ${updated} updated (total: ${hsnData.length})`);
  await mongoose.disconnect();
  process.exit(0);
}

seedHSN().catch((err) => {
  console.error('HSN Seed failed:', err);
  process.exit(1);
});
