const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLibDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const LETTERHEAD_PATH = path.join(__dirname, '..', 'assets', 'letterhead.pdf');

const RED = '#E53935';
const BLACK = '#000000';
const GRAY = '#787878';
const BORDER = '#C8C8C8';
const WHITE = '#FFFFFF';
const LIGHT_BG = '#EDF6F9';
const TABLE_HEADER = '#CED7DC';

function fmt(val) {
  return Number(val || 0).toLocaleString('en-IN');
}

function fmtDec(val) {
  return Number(val || 0).toFixed(2);
}

function formatShortDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${(date.getFullYear() % 100).toString().padStart(2, '0')}`;
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
      doc.on('end', async () => {
        try {
          const invoiceBytes = Buffer.concat(chunks);
          if (isPrint) {
            resolve(invoiceBytes);
            return;
          }
          // Overlay invoice onto letterhead background
          const letterheadBytes = fs.readFileSync(LETTERHEAD_PATH);
          const letterheadDoc = await PDFLibDocument.load(letterheadBytes);
          const invoiceDoc = await PDFLibDocument.load(invoiceBytes);
          const mergedDoc = await PDFLibDocument.create();
          const invoicePages = invoiceDoc.getPageCount();
          const [letterheadPage] = await mergedDoc.embedPdf(letterheadDoc, [0]);

          for (let i = 0; i < invoicePages; i++) {
            const [embeddedInvoicePage] = await mergedDoc.embedPdf(invoiceDoc, [i]);
            const page = mergedDoc.addPage([595.28, 841.89]);
            // Draw letterhead scaled to full A4
            page.drawPage(letterheadPage, { x: 0, y: 0, width: 595.28, height: 841.89 });
            // Draw invoice content on top
            page.drawPage(embeddedInvoicePage, { x: 0, y: 0, width: 595.28, height: 841.89 });
          }

          const mergedBytes = await mergedDoc.save();
          resolve(Buffer.from(mergedBytes));
        } catch (mergeErr) {
          reject(mergeErr);
        }
      });
      doc.on('error', reject);

      const pw = 595.28;
      const ph = 841.89;
      const m = 38;
      const cw = pw - m * 2;
      // Start content below letterhead header area
      let y = 160;

      // ── HEADER: Logo + Company Name ──────────────
      // Skipped — letterhead provides header for download, not needed for print

      // ── GSTIN + INVOICE TITLE ROW ────────────────
      // No top border — letterhead provides visual separation
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
      doc.text(`GSTIN: ${company.gstin || ''}`, m + 6, y);

      const invoiceLabel = invoice.type === 'proforma' ? 'PROFORMA INVOICE' : 'INVOICE';
      doc.font('Helvetica-Bold').fontSize(16).fillColor(BLACK);
      const labelW = doc.widthOfString(invoiceLabel);
      doc.text(invoiceLabel, (pw - labelW) / 2, y - 4);

      doc.font('Helvetica').fontSize(7).fillColor(BLACK);
      doc.text('Original Copy', pw - m - 60, y, { width: 54, align: 'right' });

      y += 22;
      // Grey line full width + short red accent on right (matching footer style)
      doc.strokeColor(BORDER).lineWidth(1.5).moveTo(m, y).lineTo(pw - m, y).stroke();
      const redAccentW = 60;
      doc.strokeColor(RED).lineWidth(1.5).moveTo(pw - m - redAccentW, y).lineTo(pw - m, y).stroke();
      y += 8;

      // ── BILL TO + INVOICE DETAILS ────────────────
      const halfW = cw / 2;
      // Bill To takes left 55%, Info panel anchored to right
      const billToW = Math.round(cw * 0.55);
      const infoPanelX = pw - m - 180; // info panel: 180px wide, right-anchored
      const detailsTop = y;

      // Bill To (left)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK);
      doc.text('BILL TO', m + 6, y + 4);

      y += 17;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK);
      doc.text(invoice.client_name || 'COMPANY NAME', m + 6, y);
      y += 16;
      doc.font('Helvetica').fontSize(9).fillColor(BLACK);
      if (invoice.client_address) {
        const addrH = doc.heightOfString(invoice.client_address, { width: billToW - 12 });
        doc.text(invoice.client_address, m + 6, y, { width: billToW - 12 });
        y += addrH + 4;
      }
      const cityState = [invoice.client_city, invoice.client_state].filter(Boolean).join(', ');
      if (cityState) { doc.text(cityState, m + 6, y); y += 25; }
      if (invoice.client_pincode) { doc.text(`${invoice.client_state || 'State'} - ${invoice.client_pincode}`, m + 6, y); y += 25; }
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
      doc.text(`GSTIN: ${invoice.client_gstin || ''}`, m + 6, y); y += 20;
      doc.font('Helvetica').fontSize(9).fillColor(BLACK);
      doc.text(`Contact Person: ${invoice.client_contact || ''}`, m + 6, y);

      // No vertical divider — clean layout
      const infoRowH = 13;
      const billToBottom = y + 16;
      const infoBottom = detailsTop + 4 + infoRowH * 5 + 4;
      const sectionBottom = Math.max(billToBottom, infoBottom) + 6;

      // Invoice details (right side — right-anchored)
      const infoX = infoPanelX;
      const infoLabelW = 80;
      let iY = detailsTop + 8;

      const infoRows = [
        ['Invoice No.', cleanInvoiceNumber(invoice.invoice_number) || ''],
        ['Dated', formatShortDate(invoice.invoice_date)],
        ['P.O. No.', invoice.po_number || ''],
        ['P.O. Date', invoice.po_date ? formatShortDate(invoice.po_date) : ''],
      ];

      const colonX = infoX + infoLabelW + 6;
      const infoValX = colonX + 8;
      const infoValW = (pw - m) - infoValX; // right edge = pw - m

      infoRows.forEach(([label, value]) => {
        doc.font('Helvetica').fontSize(9).fillColor(BLACK);
        doc.text(label, infoX, iY, { width: infoLabelW, align: 'right' });
        doc.fillColor(BLACK).text(':', colonX, iY);
        doc.font('Helvetica-Bold').fillColor(BLACK);
        doc.text(value, infoValX, iY, { width: infoValW, align: 'right' });
        iY += infoRowH;
      });

      // E-way Bill row
      doc.font('Helvetica').fontSize(9).fillColor(BLACK);
      doc.text('E-way Bill No.', infoX, iY, { width: infoLabelW, align: 'right' });
      doc.fillColor(BLACK).text(':', colonX, iY);
      doc.font('Helvetica').fillColor(BLACK);
      doc.text(invoice.eway_bill || '', infoValX, iY, { width: infoValW, align: 'right' });

      y = sectionBottom;

      // ── ITEMS TABLE ──────────────────────────────
      const items = invoice.items || [];
      const tableInset = 0; // no inset — full width table
      const tableX = m;
      const tableW = cw;
      // Column widths proportional to table width
      const colWidths = [
        Math.round(tableW * 0.09),   // Sr. No.
        0,                            // Description (auto-fill)
        Math.round(tableW * 0.15),   // HSN/SAC
        Math.round(tableW * 0.06),   // Qty
        Math.round(tableW * 0.10),   // Rate
        Math.round(tableW * 0.085),  // IGST
        Math.round(tableW * 0.115),  // Amount
      ];
      colWidths[1] = tableW - colWidths[0] - colWidths[2] - colWidths[3] - colWidths[4] - colWidths[5] - colWidths[6];

      const headers = ['Sr. No.', 'Description', 'HSN/SAC Code', 'Qty', 'Rate', 'IGST', 'Amount'];
      const headerH = 18;
      const cellPadX = 6;
      const cellPadY = 14;

      // Table header row — filled with border radius, no borders
      const hdrR = 4;
      doc.save();
      doc.moveTo(tableX + hdrR, y)
        .lineTo(tableX + tableW - hdrR, y)
        .quadraticCurveTo(tableX + tableW, y, tableX + tableW, y + hdrR)
        .lineTo(tableX + tableW, y + headerH - hdrR)
        .quadraticCurveTo(tableX + tableW, y + headerH, tableX + tableW - hdrR, y + headerH)
        .lineTo(tableX + hdrR, y + headerH)
        .quadraticCurveTo(tableX, y + headerH, tableX, y + headerH - hdrR)
        .lineTo(tableX, y + hdrR)
        .quadraticCurveTo(tableX, y, tableX + hdrR, y)
        .fill(TABLE_HEADER);
      doc.restore();

      // Header text — no column separators
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK);
      let hx = tableX;
      headers.forEach((h, i) => {
        const align = (i >= 4) ? 'right' : (i === 0 || i === 2 || i === 3 ? 'center' : 'left');
        const textY = y + (headerH - 8) / 2;
        doc.text(h, hx + cellPadX, textY, { width: colWidths[i] - cellPadX * 2, align });
        hx += colWidths[i];
      });
      y += headerH;

      // Table body rows
      const rowStartY = y;
      items.forEach((item, idx) => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        const taxPct = parseFloat(item.tax_pct) || 0;
        const taxAmt = (qty * rate * taxPct) / 100;

        const rowData = [
          String(idx + 1),
          item.product_name || item.description || '',
          item.hsn || '-',
          String(qty),
          fmt(rate),
          fmt(taxAmt),
          fmt(item.amount),
        ];

        const descWidth = colWidths[1] - cellPadX * 2;
        const descHeight = doc.heightOfString(rowData[1], { width: descWidth, fontSize: 7.5 });
        const rowH = Math.max(20, descHeight + cellPadY * 2);

        const bottomLimit = 130;
        if (y + rowH > ph - bottomLimit) {
          doc.addPage();
          y = 130;
        }

        // Only bottom border per row — no background fill, no vertical borders
        doc.strokeColor('#DDE3E7').lineWidth(1)
          .moveTo(tableX, y + rowH)
          .lineTo(tableX + tableW, y + rowH)
          .stroke();

        // Cell content — no column separators
        let rx = tableX;
        rowData.forEach((cell, ci) => {
          const align = (ci >= 4) ? 'right' : (ci === 0 || ci === 2 || ci === 3 ? 'center' : 'left');
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BLACK);
          const textY = y + (rowH - 7.5) / 2;
          doc.text(cell, rx + cellPadX, textY, { width: colWidths[ci] - cellPadX * 2, align });
          rx += colWidths[ci];
        });

        y += rowH + 10;
      });

      // ── MID SECTION: Note + Tax Table | Subtotal + Total ──
      const subtotal = invoice.subtotal || 0;
      const taxTotal = invoice.taxable_amount || 0;
      const grandTotal = invoice.grand_total || 0;
      const amountPaid = invoice.amount_paid || 0;
      const balance = invoice.balance || 0;
      const taxType = invoice.tax_type || 'IGST';

      y += 18;

      if (y + 120 > ph - 100) {
        doc.addPage();
        y = 100;
      }

      const midTop = y + 4;
      const midGap = 16; // gap between tax table and summary
      const midLeftW = halfW - midGap / 2;
      const midRightW = cw * 0.30;
      const midRightX = pw - m - midRightW;

      // LEFT: Note + Tax breakdown table
      let leftY = midTop;
      const taxTableX = tableX;
      const taxTableW = midLeftW - tableInset;
      const taxColW = taxTableW / 4;

      if (invoice.notes) {
        doc.font('Helvetica-Bold').fontSize(7).fillColor(RED);
        doc.text('Note: ', tableX, leftY, { continued: true, width: taxTableW });
        doc.font('Helvetica').fillColor(BLACK);
        doc.text(invoice.notes, { continued: false, width: taxTableW });
        leftY += doc.heightOfString('Note: ' + invoice.notes, { width: taxTableW }) + 6;
      }

      // Tax breakdown mini table
      const taxHeaders = ['Tax\nRate', 'Taxable\nAmount', `${taxType === 'IGST' ? 'IGST' : 'CGST'}\n@ ${items[0]?.tax_pct || 18}%`, 'Total\nTax'];
      const taxRowH = 20;

      // Tax header row with rounded top
      doc.save().roundedRect(taxTableX, leftY, taxTableW, taxRowH, 4).clip();
      doc.rect(taxTableX, leftY, taxTableW, taxRowH).fill('#F0F4F6');
      doc.restore();

      let txX = taxTableX;
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(BLACK);
      taxHeaders.forEach((h, i) => {
        doc.text(h, txX + 4, leftY + 3, { width: taxColW - 8, align: 'center', lineGap: 1 });
        if (i < taxHeaders.length - 1) {
          doc.strokeColor('#D0D8DD').lineWidth(0.3)
            .moveTo(txX + taxColW, leftY + 3).lineTo(txX + taxColW, leftY + taxRowH - 3).stroke();
        }
        txX += taxColW;
      });
      leftY += taxRowH;

      // Tax data row
      txX = taxTableX;
      doc.save().rect(taxTableX, leftY, taxTableW, 16).fill(WHITE).restore();
      const taxData = [`${items[0]?.tax_pct || 18}%`, fmtDec(subtotal), fmtDec(taxTotal), fmtDec(taxTotal)];
      doc.font('Helvetica').fontSize(7.5).fillColor(BLACK);
      taxData.forEach((val, i) => {
        doc.text(val, txX + 4, leftY + 4, { width: taxColW - 8, align: 'center' });
        if (i < taxData.length - 1) {
          doc.strokeColor('#E5EAED').lineWidth(0.3)
            .moveTo(txX + taxColW, leftY + 2).lineTo(txX + taxColW, leftY + 14).stroke();
        }
        txX += taxColW;
      });

      // Tax table border
      doc.roundedRect(taxTableX, leftY - taxRowH, taxTableW, taxRowH + 16, 4)
        .strokeColor('#B8C4CA').lineWidth(0.5).stroke();
      // Horizontal separator
      doc.strokeColor('#D0D8DD').lineWidth(0.3)
        .moveTo(taxTableX, leftY).lineTo(taxTableX + taxTableW, leftY).stroke();

      leftY += 16;

      // RIGHT: Subtotal, Tax, Total
      let rY = midTop;
      const summaryRowH = 18;

      function summaryRow(label, value, bold) {
        doc.save().rect(midRightX, rY, midRightW, summaryRowH).fill(WHITE).restore();
        doc.strokeColor('#DDE3E7').lineWidth(0.4)
          .moveTo(midRightX, rY + summaryRowH).lineTo(midRightX + midRightW, rY + summaryRowH).stroke();
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(BLACK);
        doc.text(label, midRightX + 10, rY + (summaryRowH - 10) / 2 + 1);
        doc.text(value, midRightX + midRightW - 70, rY + (summaryRowH - 10) / 2 + 1, { width: 60, align: 'right' });
        rY += summaryRowH;
      }

      summaryRow('Subtotal', fmt(subtotal), false);
      if (taxType === 'IGST') {
        summaryRow(`IGST @${items[0]?.tax_pct || 18}%`, fmt(taxTotal), false);
      } else {
        const halfTax = taxTotal / 2;
        const taxPct = items[0]?.tax_pct || 18;
        summaryRow(`CGST @${taxPct / 2}%`, fmt(halfTax), false);
        summaryRow(`SGST @${taxPct / 2}%`, fmt(halfTax), false);
      }

      // Grey TOTAL row with rounded bottom
      const totalRowH = summaryRowH + 2;
      doc.save().roundedRect(midRightX, rY - 1, midRightW, totalRowH + 1, 4).clip();
      doc.rect(midRightX, rY - 1, midRightW, totalRowH + 1).fill(TABLE_HEADER);
      doc.restore();
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
      doc.text('TOTAL', midRightX + 10, rY + (totalRowH - 10) / 2);
      doc.text(fmt(Math.round(grandTotal)), midRightX + midRightW - 70, rY + (totalRowH - 10) / 2, { width: 60, align: 'right' });
      rY += totalRowH;

      // Paid & Balance
      if (amountPaid > 0) {
        summaryRow('Amount Paid', `-${fmt(amountPaid)}`, false);
        summaryRow('Balance Due', fmt(balance), true);
      }

      // Amount in words — single line
      doc.font('Helvetica').fontSize(7.5).fillColor(BLACK);
      const wordsText = numberToWords(Math.round(grandTotal));
      doc.text(wordsText, midRightX + 6, rY + 8, { width: midRightW - 12, align: 'right' });

      y = Math.max(leftY + 20, rY + 28);

      // ── BANK DETAILS + SIGNATORY ─────────────────
      if (y + 60 > ph - 100) {
        doc.addPage();
        y = 100;
      }

      y += 6;

      // Bank Details (left)
      doc.font('Helvetica').fontSize(7).fillColor(BLACK);
      doc.text('Bank Details:', m + 6, y);
      y += 10;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK);
      doc.text(company.name || '', m + 6, y);
      y += 10;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK);
      if (bank.accountNo) { doc.text(`A/c No.: ${bank.accountNo}`, m + 6, y); y += 10; }
      if (bank.ifsc) { doc.text(`IFSC: ${bank.ifsc}`, m + 6, y); y += 10; }
      if (bank.bank) { doc.text(bank.bank, m + 6, y); y += 10; }
      if (bank.upi) { doc.text(`UPI: ${bank.upi}`, m + 6, y); y += 10; }

      // Signatory (right)
      const sigStartY = y - 40;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BLACK);
      doc.text(`For ${company.name || ''}`, midRightX, sigStartY, { width: midRightW - 6, align: 'right' });
      doc.font('Helvetica').fontSize(7).fillColor(BLACK);
      doc.text('Authorised Signatory', midRightX, sigStartY + 32, { width: midRightW - 6, align: 'right' });

      y += 6;

      // ── FOOTER ────────────────────────────────────
      // Payment terms positioned just above footer on last page
      const footerTopY = ph - 80; // above letterhead footer area

      if (invoice.terms) {
        let ptY = footerTopY - 30;
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BLACK);
        doc.text('Payment Terms:', m + 6, ptY);
        ptY += 11;
        doc.font('Helvetica').fontSize(7).fillColor(BLACK);
        doc.text(invoice.terms, m + 6, ptY, { width: cw - 12 });
      }


      // Page numbers
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(5).fillColor(GRAY);
        doc.text(`Page ${i + 1} of ${pages.count}`, m, ph - 46, { width: cw, align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePdfBuffer, cleanInvoiceNumber };
