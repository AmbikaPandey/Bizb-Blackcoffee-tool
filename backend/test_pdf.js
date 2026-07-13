require('dotenv').config();
const mongoose = require('mongoose');
require('./models/Client');
require('./models/Product');
const Invoice = require('./models/Invoice');
const Setting = require('./models/Setting');
const { generateInvoicePdfBuffer } = require('./helpers/pdfGenerator');
const fs = require('fs');
const path = require('path');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bizb').then(async () => {
  const invoice = await Invoice.findOne({ type: 'tax' }).populate('client_id').lean();
  if (!invoice) { console.log('No tax invoice found'); process.exit(1); }

  const settings = await Setting.find({ key: { $in: ['company', 'bank'] } }).lean();
  const map = {};
  settings.forEach(s => { map[s.key] = s.value; });
  const company = map.company || {};
  const bank = map.bank || {};

  console.log('company.signature exists:', !!company.signature);
  console.log('company.signature length:', company.signature ? company.signature.length : 0);

  const defaultSigPath = path.join(__dirname, 'assets', 'signature.png');
  console.log('default sig path:', defaultSigPath);
  console.log('default sig file exists:', fs.existsSync(defaultSigPath));

  const fullInv = {
    ...invoice,
    client_name: invoice.client_id?.name || '',
    client_gstin: invoice.client_id?.gstin || '',
    client_address: invoice.client_id?.address || '',
    client_city: invoice.client_id?.city || '',
    client_state: invoice.client_id?.state || '',
    client_phone: invoice.client_id?.phone || '',
    client_contact: invoice.client_id?.contact || '',
  };

  try {
    const buf = await generateInvoicePdfBuffer(fullInv, company, bank, { mode: 'print' });
    fs.writeFileSync('test_invoice.pdf', buf);
    console.log('PDF generated successfully, size:', buf.length, 'bytes');
  } catch(e) {
    console.error('PDF generation FAILED:', e.message);
    console.error(e.stack);
  }

  await mongoose.disconnect();
}).catch(e => console.error('DB error:', e.message));
