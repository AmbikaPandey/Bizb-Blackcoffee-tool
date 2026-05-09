/**
 * BUSY Export Routes
 * Handles exporting invoices to BUSY-compatible XML format.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const Invoice = require('../models/Invoice');
const Setting = require('../models/Setting');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');
const { generateBusyInvoiceXML, validateForBusyExport } = require('../utils/busy/xmlGenerator');

const router = express.Router();

// Ensure export directory exists
const EXPORT_DIR = path.join(__dirname, '..', 'exports', 'busy', 'invoices');
function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

/**
 * Helper: build full invoice data with client details
 */
async function getFullInvoice(invoiceId) {
  const invoice = await Invoice.findById(invoiceId)
    .populate('client_id', 'name gstin address city state contact email phone')
    .lean();
  if (!invoice) return null;

  return {
    ...invoice,
    client_name: invoice.client_id?.name || '',
    client_gstin: invoice.client_id?.gstin || '',
    client_address: invoice.client_id?.address || '',
    client_city: invoice.client_id?.city || '',
    client_state: invoice.client_id?.state || '',
    client_contact: invoice.client_id?.contact || '',
    client_email: invoice.client_id?.email || '',
    client_phone: invoice.client_id?.phone || '',
  };
}

/**
 * POST /api/busy/export/:invoiceId
 * Export a single invoice to BUSY XML
 */
router.post('/export/:invoiceId', authenticate, authorize('busyExports', 'export'), async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const fullInvoice = await getFullInvoice(invoiceId);
    if (!fullInvoice) return res.status(404).json({ error: 'Invoice not found' });

    // Validate invoice data
    const validation = validateForBusyExport(fullInvoice);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
    }

    // Get company settings
    const settings = await Setting.find({ key: 'company' }).lean();
    const company = settings[0]?.value || {};

    // Generate XML
    const xml = generateBusyInvoiceXML(fullInvoice, company);

    // Save XML file
    ensureExportDir();
    const invNum = (fullInvoice.invoice_number || 'DRAFT').replace(/[^a-zA-Z0-9-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fileName = `INV_${invNum}_${dateStr}.xml`;
    const filePath = path.join(EXPORT_DIR, fileName);
    fs.writeFileSync(filePath, xml, 'utf-8');

    // Update invoice with sync status
    await Invoice.findByIdAndUpdate(invoiceId, {
      busySynced: true,
      busySyncDate: new Date(),
      busyReferenceNo: `BUSY-${invNum}-${dateStr}`,
      busyExportPath: filePath,
      busySyncError: null,
    });

    res.json({
      success: true,
      message: 'Invoice exported to BUSY XML successfully',
      fileName,
      referenceNo: `BUSY-${invNum}-${dateStr}`,
      exportPath: filePath,
    });
  } catch (err) {
    // Record error in invoice
    if (req.params.invoiceId) {
      await Invoice.findByIdAndUpdate(req.params.invoiceId, {
        busySynced: false,
        busySyncError: err.message,
      }).catch(() => {});
    }
    logger.error('BUSY export error: ' + err.message);
    res.status(500).json({ error: 'Failed to export invoice to BUSY', details: err.message });
  }
});

/**
 * POST /api/busy/export-bulk
 * Export multiple invoices to BUSY XML
 * Body: { invoiceIds: [id1, id2, ...] }
 */
router.post('/export-bulk', authenticate, authorize('busyExports', 'export'), async (req, res) => {
  try {
    const { invoiceIds } = req.body;
    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ error: 'invoiceIds array is required' });
    }

    if (invoiceIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 invoices can be exported at once' });
    }

    const settings = await Setting.find({ key: 'company' }).lean();
    const company = settings[0]?.value || {};
    ensureExportDir();

    const results = [];
    for (const id of invoiceIds) {
      try {
        const fullInvoice = await getFullInvoice(id);
        if (!fullInvoice) {
          results.push({ id, success: false, error: 'Invoice not found' });
          continue;
        }

        const validation = validateForBusyExport(fullInvoice);
        if (!validation.valid) {
          results.push({ id, success: false, error: validation.errors.join(', ') });
          await Invoice.findByIdAndUpdate(id, { busySynced: false, busySyncError: validation.errors.join(', ') });
          continue;
        }

        const xml = generateBusyInvoiceXML(fullInvoice, company);
        const invNum = (fullInvoice.invoice_number || 'DRAFT').replace(/[^a-zA-Z0-9-]/g, '_');
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const fileName = `INV_${invNum}_${dateStr}.xml`;
        const filePath = path.join(EXPORT_DIR, fileName);
        fs.writeFileSync(filePath, xml, 'utf-8');

        await Invoice.findByIdAndUpdate(id, {
          busySynced: true,
          busySyncDate: new Date(),
          busyReferenceNo: `BUSY-${invNum}-${dateStr}`,
          busyExportPath: filePath,
          busySyncError: null,
        });

        results.push({ id, success: true, fileName, invoiceNumber: fullInvoice.invoice_number });
      } catch (itemErr) {
        results.push({ id, success: false, error: itemErr.message });
        await Invoice.findByIdAndUpdate(id, { busySynced: false, busySyncError: itemErr.message }).catch(() => {});
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Exported ${successCount} of ${invoiceIds.length} invoices`,
      successCount,
      failCount,
      results,
    });
  } catch (err) {
    logger.error('BUSY bulk export error: ' + err.message);
    res.status(500).json({ error: 'Bulk export failed', details: err.message });
  }
});

/**
 * GET /api/busy/history
 * Fetch export history (invoices that have been synced)
 */
router.get('/history', authenticate, authorize('busyExports', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status === 'synced') filter.busySynced = true;
    else if (status === 'failed') { filter.busySynced = false; filter.busySyncError = { $ne: null }; }
    else if (status === 'pending') { filter.busySynced = false; filter.busySyncError = null; }
    else {
      // Show all that have been attempted or synced
      filter.$or = [{ busySynced: true }, { busySyncError: { $ne: null } }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .select('invoice_number invoice_date grand_total status busySynced busySyncDate busyReferenceNo busySyncError client_id')
        .populate('client_id', 'name')
        .sort({ busySyncDate: -1, _id: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    const results = invoices.map(inv => ({
      id: inv._id,
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      grandTotal: inv.grand_total,
      status: inv.status,
      clientName: inv.client_id?.name || '',
      busySynced: inv.busySynced,
      busySyncDate: inv.busySyncDate,
      busyReferenceNo: inv.busyReferenceNo,
      busySyncError: inv.busySyncError,
    }));

    res.json({ results, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch export history' });
  }
});

/**
 * GET /api/busy/download/:invoiceId
 * Download generated XML file for an invoice
 */
router.get('/download/:invoiceId', authenticate, authorize('busyExports', 'export'), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId).select('busyExportPath invoice_number').lean();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (!invoice.busyExportPath) return res.status(404).json({ error: 'No BUSY export found for this invoice' });

    if (!fs.existsSync(invoice.busyExportPath)) {
      return res.status(404).json({ error: 'Export file not found on server' });
    }

    const fileName = path.basename(invoice.busyExportPath);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(invoice.busyExportPath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download export file' });
  }
});

module.exports = router;
