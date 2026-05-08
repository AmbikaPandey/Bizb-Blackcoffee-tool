const PDFDocument = require('pdfkit');

const RED = '#DC2626';
const BLACK = '#000000';
const GRAY = '#787878';
const BORDER = '#C8C8C8';
const WHITE = '#FFFFFF';
const LIGHT_BG = '#F9FAFB';

function fmt(val) {
  return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function cleanInvoiceNumber(num) {
  return num ? num.replace(/^(TAX|PRO)-/, '') : '';
}

function numberToWords(num) {
  if (num === 0) return 'Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function convert(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }
  return 'Rupees ' + convert(Math.round(num)) + ' Only';
}

const STATE_TO_CODE = {
  'Jammu & Kashmir': '01', 'Jammu and Kashmir': '01', 'Himachal Pradesh': '02', 'Punjab': '03',
  'Chandigarh': '04', 'Uttarakhand': '05', 'Haryana': '06', 'Delhi': '07',
  'Rajasthan': '08', 'Uttar Pradesh': '09', 'Bihar': '10', 'Sikkim': '11',
  'Arunachal Pradesh': '12', 'Nagaland': '13', 'Manipur': '14', 'Mizoram': '15',
  'Tripura': '16', 'Meghalaya': '17', 'Assam': '18', 'West Bengal': '19',
  'Jharkhand': '20', 'Odisha': '21', 'Chhattisgarh': '22', 'Madhya Pradesh': '23',
  'Gujarat': '24', 'Dadra & Nagar Haveli & Daman & Diu': '26',
  'Dadra and Nagar Haveli and Daman and Diu': '26', 'Maharashtra': '27',
  'Karnataka': '29', 'Goa': '30', 'Lakshadweep': '31', 'Kerala': '32',
  'Tamil Nadu': '33', 'Puducherry': '34', 'Andaman & Nicobar Islands': '35',
  'Andaman and Nicobar Islands': '35', 'Telangana': '36', 'Andhra Pradesh': '37', 'Ladakh': '38',
};

function formatPlaceOfSupply(place) {
  if (!place) return '-';
  const code = STATE_TO_CODE[place];
  return code ? `${code}-${place}` : place;
}

function buildCompanyAddress(c) {
  const parts = [];
  if (c.address_line1) parts.push(c.address_line1);
  if (c.address_line2) parts.push(c.address_line2);
  if (c.city) parts.push(c.city);
  if (c.pincode) parts.push(c.pincode);
  return parts.join(', ');
}

function drawLine(doc, x1, y1, x2, y2) {
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(x1, y1).lineTo(x2, y2).stroke();
}

function drawBox(doc, x, y, w, h, fill) {
  if (fill) {
    doc.save().rect(x, y, w, h).fill(fill).restore();
  }
  doc.strokeColor(BORDER).lineWidth(0.5).rect(x, y, w, h).stroke();
}

/**
 * Generate an invoice PDF and return it as a Buffer.
 * @param {Object} invoice - Full invoice document with populated client data
 * @param {Object} company - Company settings object
 * @param {Object} bank - Bank settings object
 * @param {Object} options - { mode: 'download' | 'print' }
 * @returns {Promise<Buffer>}
 */
function generateInvoicePdfBuffer(invoice, company = {}, bank = {}, options = {}) {
  const isPrint = options.mode === 'print';
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pw = 595.28; // A4 width in points
      const ph = 841.89; // A4 height in points
      const m = 28;
      const cw = pw - m * 2;
      // Print mode: leave space for pre-printed letterhead header (~80pt)
      let y = isPrint ? 80 : m;

      // ── HEADER ──────────────────────────────────
      if (!isPrint) {
        // Company Name (left)
        doc.font('Helvetica-Bold').fontSize(12).fillColor(BLACK);
        doc.text(company.name || 'Company Name', m, y, { width: cw / 2 });
      }

      // Invoice type (right, red)
      const invoiceLabel = invoice.type === 'proforma' ? 'PROFORMA INVOICE' : 'TAX INVOICE';
      doc.font('Helvetica-Bold').fontSize(12).fillColor(RED);
      doc.text(invoiceLabel, pw / 2, y, { width: cw / 2, align: 'right' });

      y += 14;
      doc.font('Helvetica').fontSize(7).fillColor(GRAY);
      doc.text('Original Copy', pw / 2, y, { width: cw / 2, align: 'right' });

      y += 12;

      // Invoice No & Date boxes (right side)
      const boxW = 100;
      const boxH = 22;
      const boxX = pw - m - boxW;

      // Invoice No box
      drawBox(doc, boxX, y, boxW, boxH);
      doc.font('Helvetica').fontSize(6).fillColor(GRAY);
      doc.text('INVOICE NO.', boxX + 4, y + 3, { width: boxW - 8, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
      doc.text(cleanInvoiceNumber(invoice.invoice_number) || '', boxX + 4, y + 12, { width: boxW - 8, align: 'center' });

      // Date box
      const boxY2 = y + boxH;
      drawBox(doc, boxX, boxY2, boxW, boxH);
      doc.font('Helvetica').fontSize(6).fillColor(GRAY);
      doc.text('DATE', boxX + 4, boxY2 + 3, { width: boxW - 8, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK);
      doc.text(formatDate(invoice.invoice_date), boxX + 4, boxY2 + 12, { width: boxW - 8, align: 'center' });

      y = boxY2 + boxH + 6;

      // ── GSTIN LINE ───────────────────────────────
      drawLine(doc, m, y, pw - m, y);
      y += 5;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK);
      doc.text(`GSTIN: ${company.gstin || 'N/A'}`, m, y);
      y += 12;

      // ── BILL TO / SUPPLY DETAILS ────────────────
      const halfW = cw / 2;
      const sectionTop = y;

      // Bill To (left box)
      drawBox(doc, m, sectionTop, halfW, 78);
      doc.font('Helvetica').fontSize(6).fillColor(RED);
      doc.text('BILL TO', m + 6, sectionTop + 4);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK);
      doc.text(`M/S ${invoice.client_name || ''}`, m + 6, sectionTop + 14, { width: halfW - 12 });

      let billY = sectionTop + 25;
      doc.font('Helvetica').fontSize(7).fillColor(GRAY);
      if (invoice.client_address) {
        doc.text(invoice.client_address, m + 6, billY, { width: halfW - 12 });
        billY += 9;
      }
      const cityState = [invoice.client_city, invoice.client_state].filter(Boolean).join(', ');
      if (cityState) {
        const cityLine = cityState + (invoice.client_pincode ? ` - ${invoice.client_pincode}` : '');
        doc.text(cityLine, m + 6, billY, { width: halfW - 12 });
        billY += 9;
      }
      if (invoice.client_gstin) {
        doc.text(`GSTIN: ${invoice.client_gstin}`, m + 6, billY, { width: halfW - 12 });
        billY += 9;
      }
      if (invoice.client_phone) {
        doc.text(`Phone: ${invoice.client_phone}`, m + 6, billY, { width: halfW - 12 });
      }

      // Supply Details (right box)
      const supplyX = m + halfW;
      drawBox(doc, supplyX, sectionTop, halfW, 78);

      const supplyRows = [
        ['Place of Supply:', formatPlaceOfSupply(invoice.place_of_supply)],
        ['Reverse Charge:', 'No'],
        ['Transport:', invoice.transport || '-'],
        ['Vehicle No.:', invoice.vehicle_no || '-'],
        ['GR/RR No.:', invoice.gr_rr_no || '-'],
        ['E-Way Bill:', invoice.eway_bill || '-'],
      ];

      let sY = sectionTop + 6;
      supplyRows.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK);
        doc.text(label, supplyX + 6, sY);
        doc.font('Helvetica').fillColor(GRAY);
        doc.text(value, supplyX + 80, sY);
        sY += 11;
      });

      y = sectionTop + 82;

      // ── ITEMS TABLE ──────────────────────────────
      const items = invoice.items || [];
      const colWidths = [24, cw - 24 - 48 - 30 - 50 - 50 - 34 - 58, 48, 30, 50, 50, 34, 58];
      const headers = ['Sr No', 'Description', 'HSN/SAC', 'Qty', 'Rate', 'Taxable', 'GST', 'Amount'];
      const headerH = 18;

      // Table header
      drawBox(doc, m, y, cw, headerH);
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(BLACK);
      let hx = m;
      headers.forEach((h, i) => {
        doc.text(h, hx + 2, y + 5, { width: colWidths[i] - 4, align: 'center' });
        hx += colWidths[i];
      });
      y += headerH;

      // Table rows
      items.forEach((item, idx) => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discPct = parseFloat(item.discount_pct) || 0;
        const taxPct = parseFloat(item.tax_pct) || 0;
        const lineTotal = qty * rate;
        const afterDiscount = lineTotal - lineTotal * (discPct / 100);

        const rowData = [
          String(idx + 1),
          item.product_name || item.description || '',
          item.hsn || '-',
          String(qty),
          fmt(rate),
          fmt(afterDiscount),
          `${taxPct}%`,
          fmt(item.amount),
        ];

        // Calculate row height based on description text wrapping
        const descWidth = colWidths[1] - 4;
        const descHeight = doc.heightOfString(rowData[1], { width: descWidth, fontSize: 7 });
        const rowH = Math.max(16, descHeight + 6);

        // Check for page break
        const bottomLimit = isPrint ? 80 : 60;
        if (y + rowH > ph - bottomLimit) {
          doc.addPage();
          y = isPrint ? 80 : m;
        }

        const bgColor = idx % 2 === 0 ? null : LIGHT_BG;
        drawBox(doc, m, y, cw, rowH, bgColor);

        let rx = m;
        rowData.forEach((cell, ci) => {
          const isNum = ci >= 3;
          doc.font('Helvetica').fontSize(7).fillColor(BLACK);
          doc.text(cell, rx + 2, y + 4, {
            width: colWidths[ci] - 4,
            align: isNum ? 'right' : (ci === 0 ? 'center' : 'left'),
          });
          rx += colWidths[ci];
        });

        y += rowH;
      });

      y += 4;

      // ── SUMMARY SECTION ──────────────────────────
      const subtotal = invoice.subtotal || 0;
      const taxTotal = invoice.taxable_amount || 0;
      const grandTotal = invoice.grand_total || 0;
      const amountPaid = invoice.amount_paid || 0;
      const balance = invoice.balance || 0;
      const taxType = invoice.tax_type || 'IGST';

      // Check for page break
      if (y + 90 > ph - (isPrint ? 60 : 40)) {
        doc.addPage();
        y = isPrint ? 80 : m;
      }

      const summaryX = m + halfW;
      const summaryW = halfW;
      const rowH = 16;
      let rY = y;

      function summaryRow(label, value, bold) {
        drawBox(doc, summaryX, rY, summaryW, rowH);
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7).fillColor(BLACK);
        doc.text(label, summaryX + 6, rY + 4);
        doc.text('■ ₹ ' + value, summaryX + summaryW - 70, rY + 4, { width: 64, align: 'right' });
        rY += rowH;
      }

      summaryRow('Subtotal', fmt(subtotal), false);
      if (taxType === 'IGST') {
        summaryRow(`IGST (${items[0]?.tax_pct || 18}%)`, fmt(taxTotal), false);
      } else {
        const halfTax = taxTotal / 2;
        const taxPct = items[0]?.tax_pct || 18;
        summaryRow(`CGST (${taxPct / 2}%)`, fmt(halfTax), false);
        summaryRow(`SGST (${taxPct / 2}%)`, fmt(halfTax), false);
      }

      // Grand Total row
      drawBox(doc, summaryX, rY, summaryW, rowH + 2);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK);
      doc.text('GRAND TOTAL', summaryX + 6, rY + 5);
      doc.text('■ ₹ ' + fmt(Math.round(grandTotal)), summaryX + summaryW - 70, rY + 5, { width: 64, align: 'right' });
      rY += rowH + 2;

      // Paid & Balance
      if (amountPaid > 0) {
        summaryRow('Amount Paid', fmt(amountPaid), false);
        summaryRow('Balance Due', fmt(balance), true);
      }

      // Amount in words (left, aligned with summary)
      const wordsBoxH = rY - y;
      drawBox(doc, m, y, halfW, wordsBoxH);
      doc.font('Helvetica-Bold').fontSize(6).fillColor(BLACK);
      doc.text('AMOUNT IN WORDS', m + 6, y + 5);
      doc.font('Helvetica').fontSize(7);
      doc.text(numberToWords(Math.round(grandTotal)), m + 6, y + 16, { width: halfW - 12 });

      y = rY + 10;

      // Check for page break
      if (y + 80 > ph - (isPrint ? 60 : 30)) {
        doc.addPage();
        y = isPrint ? 80 : m;
      }

      // ── PAYMENT TERMS (left) ──────────────────────
      let leftY = y;
      if (invoice.terms) {
        doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK);
        doc.text('Payment Terms', m, leftY);
        leftY += 10;
        doc.font('Helvetica').fontSize(6.5).fillColor(GRAY);
        doc.text(invoice.terms, m, leftY, { width: halfW - 8 });
        leftY += doc.heightOfString(invoice.terms, { width: halfW - 8, fontSize: 6.5 }) + 8;
      }

      // ── BANK DETAILS (left) ───────────────────────
      doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK);
      doc.text('BANK DETAILS', m, leftY);
      leftY += 10;
      doc.font('Helvetica-Bold').fontSize(7);
      doc.text(company.name || '', m, leftY);
      leftY += 9;
      doc.font('Helvetica').fontSize(6.5).fillColor(GRAY);
      if (bank.bank) { doc.text(`Bank: ${bank.bank}`, m, leftY); leftY += 8; }
      if (bank.accountNo) { doc.text(`A/C No: ${bank.accountNo}`, m, leftY); leftY += 8; }
      if (bank.ifsc) { doc.text(`IFSC: ${bank.ifsc}`, m, leftY); leftY += 8; }
      if (bank.upi) { doc.text(`UPI: ${bank.upi}`, m, leftY); leftY += 8; }

      // ── SIGNATORY (right) ─────────────────────────
      doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK);
      doc.text(`For ${company.name || ''}`, summaryX, y, { width: summaryW, align: 'right' });
      doc.font('Helvetica').fontSize(6.5).fillColor(GRAY);
      doc.text('Authorised Signatory', summaryX, y + 40, { width: summaryW, align: 'right' });

      // ── FOOTER ────────────────────────────────────
      // Print mode: skip footer (pre-printed on letterhead)
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        if (!isPrint) {
          const footerY = ph - 24;
          drawLine(doc, m, footerY, pw - m, footerY);
          doc.font('Helvetica').fontSize(5.5).fillColor(GRAY);
          const footerParts = [];
          const addr = buildCompanyAddress(company);
          if (addr) footerParts.push(`Registered Office: ${addr}`);
          if (company.phone) footerParts.push(`m: ${company.phone}`);
          if (company.email) footerParts.push(`e: ${company.email}`);
          if (footerParts.length) {
            doc.text(footerParts.join('  |  '), m, footerY + 5, { width: cw, align: 'center' });
          }
        }
        doc.text(`Page ${i + 1} of ${pages.count}`, m, ph - 16, { width: cw, align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePdfBuffer, cleanInvoiceNumber };
