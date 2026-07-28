const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Client = require('../models/Client');

async function reconcileInvoice(invoiceId) {
  if (!invoiceId) return;
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;

  // Sum payments linked via invoice_id OR via invoice_ids array
  const payments = await Payment.aggregate([
    { $match: { $or: [{ invoice_id: invoice._id }, { invoice_ids: invoice._id }] } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalPaid = Math.round(payments[0]?.total || 0);
  const balance = Math.round(invoice.grand_total - totalPaid);

  invoice.amount_paid = totalPaid;
  invoice.balance = balance;
  if (balance <= 0) invoice.status = 'Paid';
  else if (totalPaid > 0) invoice.status = 'Partially Paid';
  else if (invoice.status === 'Paid' || invoice.status === 'Partially Paid') invoice.status = 'Sent';
  await invoice.save();
}

async function recalcClientOutstanding(clientId) {
  if (!clientId) return;
  const result = await Invoice.aggregate([
    { $match: { client_id: clientId, status: { $nin: ['Paid', 'Cancelled'] } } },
    { $group: { _id: null, total: { $sum: '$balance' } } },
  ]);
  await Client.findByIdAndUpdate(clientId, { outstanding: result[0]?.total || 0 });
}

async function getNextInvoiceNumber(type) {
  // Find the latest invoice of this type (handles both old prefixed and new clean formats)
  const last = await Invoice.findOne({ type: type })
    .sort({ _id: -1 }).select('invoice_number').lean();
  if (!last) return '1';
  // Extract numeric part from either "TAX-0001" / "PRO-0001" or "1"
  const numStr = last.invoice_number.replace(/^[A-Z]+-/, '');
  const num = parseInt(numStr, 10) || 0;
  return String(num + 1);
}

function processInvoiceItems(items) {
  let subtotal = 0;
  let taxableAmount = 0;

  const processedItems = (items || []).map((item) => {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    const discPct = parseFloat(item.discount_pct) || 0;
    const taxPct = parseFloat(item.tax_pct) || 0;
    const lineTotal = qty * rate;
    const afterDiscount = lineTotal - lineTotal * (discPct / 100);
    const taxAmount = afterDiscount * (taxPct / 100);
    const amount = Math.round(afterDiscount + taxAmount);
    subtotal += afterDiscount;
    taxableAmount += taxAmount;
    return {
      product_id: item.product_id || null,
      product_name: item.product_name || '',
      description: item.description || '',
      hsn: item.hsn || '',
      qty, unit: item.unit || 'NOS', rate,
      discount_pct: discPct, tax_pct: taxPct, amount,
    };
  });

  return {
    processedItems,
    subtotal: Math.round(subtotal),
    taxableAmount: Math.round(taxableAmount),
    grandTotal: Math.round(subtotal + taxableAmount),
  };
}

/**
 * Strip legacy prefix (TAX-/PRO-) and leading zeros.
 * e.g. "TAX-0001" → "1", "0020" → "20", "100" → "100"
 */
function cleanInvoiceNumber(num) {
  if (!num) return '';
  const stripped = num.replace(/^(TAX|PRO)-/i, '');
  const n = parseInt(stripped, 10);
  if (isNaN(n)) return stripped;
  return String(n);
}

module.exports = {
  reconcileInvoice,
  recalcClientOutstanding,
  getNextInvoiceNumber,
  processInvoiceItems,
  cleanInvoiceNumber,
};
