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

// Default signature embedded as base64 — used when no signature is uploaded in Settings
const DEFAULT_SIGNATURE_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAoEAAACvCAYAAACCagTXAAAACXBIWXMAAAsTAAALEwEAmpwYAAAE7mlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4xLWMwMDMgNzkuOTY5MGE4NywgMjAyNS8wMy8wNi0xOToxMjowMyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI2LjkgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyNi0wNy0xM1QxMToxNDowMCswNTozMCIgeG1wOk1vZGlmeURhdGU9IjIwMjYtMDctMTNUMTE6MjU6MjMrMDU6MzAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjYtMDctMTNUMTE6MjU6MjMrMDU6MzAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmM4ZTcyNTNhLTU3MGQtYTM0Ni1hM2JkLWRiY2FiNmU0ZjA4MiIgeG1wTU06RG9jdW1lbnRJRD0i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';

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

  // Register Roboto fonts — place TTF files in backend/assets/fonts/
  const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
  const regularPath = path.join(fontsDir, 'Roboto-Regular.ttf');
  const boldPath    = path.join(fontsDir, 'Roboto-Bold.ttf');
  const italicPath  = path.join(fontsDir, 'Roboto-Italic.ttf');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

      if (fs.existsSync(regularPath)) doc.registerFont('Roboto',        regularPath);
      if (fs.existsSync(boldPath))    doc.registerFont('Roboto-Bold',   boldPath);
      if (fs.existsSync(italicPath))  doc.registerFont('Roboto-Italic', italicPath);
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
      doc.font('Roboto').fontSize(9).fillColor(BLACK);
      doc.text('GSTIN: ', m + 6, y, { continued: true });
      doc.font('Roboto-Bold').text(company.gstin || '');

      const invoiceLabel = invoice.type === 'proforma' ? 'PROFORMA INVOICE' : 'INVOICE';
      doc.font('Roboto-Bold').fontSize(16).fillColor(BLACK);
      const labelW = doc.widthOfString(invoiceLabel);
      doc.text(invoiceLabel, (pw - labelW) / 2, y - 4);

      doc.font('Roboto').fontSize(7).fillColor(BLACK);
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
      doc.font('Roboto-Italic').fontSize(8).fillColor(BLACK);
      doc.text('Party Details:', m + 6, y + 4);

      y += 17;
      doc.font('Roboto-Bold').fontSize(12).fillColor(BLACK);
      doc.text(invoice.client_name || 'COMPANY NAME', m + 6, y);
      y += 16;
      doc.font('Roboto').fontSize(9).fillColor(BLACK);
      if (invoice.client_address) {
        const addrH = doc.heightOfString(invoice.client_address, { width: billToW - 12 });
        doc.text(invoice.client_address, m + 6, y, { width: billToW - 12 });
        y += addrH + 4;
      }
      const cityState = [invoice.client_city, invoice.client_state].filter(Boolean).join(', ');
      if (cityState) { doc.text(cityState, m + 6, y); y += 25; }
      if (invoice.client_pincode) { doc.text(`${invoice.client_state || 'State'} - ${invoice.client_pincode}`, m + 6, y); y += 25; }
      doc.font('Roboto').fontSize(9).fillColor(BLACK);
      doc.text(`GSTIN: ${invoice.client_gstin || ''}`, m + 6, y); y += 20;
      doc.font('Roboto').fontSize(9).fillColor(BLACK);
      if (invoice.client_contact) {
        doc.text(`Contact Person: ${invoice.client_contact}`, m + 6, y); y += 14;
      }
      if (invoice.client_phone) {
        doc.text(`Phone: ${invoice.client_phone}`, m + 6, y); y += 14;
      }

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
        [invoice.type === 'proforma' ? 'PI No.' : 'Invoice No.', cleanInvoiceNumber(invoice.invoice_number) || ''],
        ['Dated', formatShortDate(invoice.invoice_date)],
        ['P.O. No.', invoice.po_number || ''],
        ['P.O. Date', invoice.po_date ? formatShortDate(invoice.po_date) : ''],
      ];

      const colonX = infoX + infoLabelW + 6;
      const infoValX = colonX + 8;
      const infoValW = (pw - m) - infoValX; // right edge = pw - m

      infoRows.forEach(([label, value]) => {
        doc.font('Roboto').fontSize(9).fillColor(BLACK);
        doc.text(label, infoX, iY, { width: infoLabelW, align: 'left' });
        doc.fillColor(BLACK).text(':', colonX, iY);
        doc.font('Roboto-Bold').fillColor(BLACK);
        doc.text(value, infoValX, iY, { width: infoValW, align: 'left' });
        iY += infoRowH;
      });

      // E-way Bill row
      doc.font('Roboto').fontSize(9).fillColor(BLACK);
      doc.text('E-way Bill No.', infoX, iY, { width: infoLabelW, align: 'left' });
      doc.fillColor(BLACK).text(':', colonX, iY);
      doc.font('Roboto').fillColor(BLACK);
      doc.text(invoice.eway_bill || '', infoValX, iY, { width: infoValW, align: 'left' });

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
      doc.font('Roboto-Bold').fontSize(8).fillColor(BLACK);
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
        // Measure combined height: product_name (bold 7.5) + description (regular 6.5) if both present
        const hasDesc = item.product_name && item.description;
        const nameText = item.product_name || item.description || '';
        const descText = hasDesc ? item.description : '';
        const nameH = doc.heightOfString(nameText, { width: descWidth, fontSize: 7.5 });
        const descH = hasDesc ? doc.heightOfString(descText, { width: descWidth, fontSize: 6.5 }) + 2 : 0;
        const rowH = Math.max(20, nameH + descH + cellPadY * 2);

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
          const textY = y + (rowH - 7.5) / 2;
          if (ci === 1 && hasDesc) {
            // Product name bold, then description smaller below
            const nameY = y + cellPadY;
            doc.font('Roboto-Bold').fontSize(7.5).fillColor(BLACK);
            doc.text(nameText, rx + cellPadX, nameY, { width: colWidths[ci] - cellPadX * 2, align: 'left' });
            const actualNameH = doc.heightOfString(nameText, { width: colWidths[ci] - cellPadX * 2, fontSize: 7.5 });
            doc.font('Roboto').fontSize(6.5).fillColor('#555555');
            doc.text(descText, rx + cellPadX, nameY + actualNameH + 2, { width: colWidths[ci] - cellPadX * 2, align: 'left' });
            doc.fillColor(BLACK);
          } else {
            doc.font('Roboto-Bold').fontSize(7.5).fillColor(BLACK);
            doc.text(cell, rx + cellPadX, textY, { width: colWidths[ci] - cellPadX * 2, align });
          }
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
        doc.font('Roboto-Bold').fontSize(7).fillColor(RED);
        doc.text('Note: ', tableX, leftY, { continued: true, width: taxTableW });
        doc.font('Roboto').fillColor(BLACK);
        doc.text(invoice.notes, { continued: false, width: taxTableW });
        leftY += doc.heightOfString('Note: ' + invoice.notes, { width: taxTableW }) + 6;
      }

      // Tax breakdown mini table
      const taxHeaders = ['Tax\nRate', 'Taxable\nAmount', `${taxType === 'IGST' ? 'IGST' : 'CGST'}\n@ ${items[0]?.tax_pct || 18}%`, 'Total\nTax'];
      const taxRowH = 22;

      // Tax header row with rounded top
      doc.save().roundedRect(taxTableX, leftY, taxTableW, taxRowH, 4).clip();
      doc.rect(taxTableX, leftY, taxTableW, taxRowH).fill('#F0F4F6');
      doc.restore();

      let txX = taxTableX;
      doc.font('Roboto-Bold').fontSize(6.5).fillColor(BLACK);
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
      doc.font('Roboto').fontSize(7.5).fillColor(BLACK);
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
        doc.font(bold ? 'Roboto-Bold' : 'Roboto').fontSize(8).fillColor(BLACK);
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
      doc.font('Roboto-Bold').fontSize(9).fillColor(BLACK);
      doc.text('TOTAL', midRightX + 10, rY + (totalRowH - 10) / 2);
      doc.text(fmt(Math.round(grandTotal)), midRightX + midRightW - 70, rY + (totalRowH - 10) / 2, { width: 60, align: 'right' });
      rY += totalRowH;

      // Paid & Balance
      if (amountPaid > 0) {
        summaryRow('Amount Paid', `-${fmt(amountPaid)}`, false);
        summaryRow('Balance Due', fmt(balance), true);
      }

      // Amount in words — single line
      doc.font('Roboto-Bold').fontSize(9).fillColor(BLACK);
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
      doc.font('Roboto').fontSize(7).fillColor(BLACK);
      doc.text('Bank Details:', m + 6, y);
      y += 10;
      doc.font('Roboto-Bold').fontSize(8).fillColor(BLACK);
      doc.text(company.name || '', m + 6, y);
      y += 10;
      doc.font('Roboto').fontSize(7).fillColor(BLACK);
      if (bank.accountNo) {
        doc.text('A/c No.: ', m + 6, y, { continued: true });
        doc.font('Roboto-Bold').text(bank.accountNo);
        y += 10;
        doc.font('Roboto').fontSize(7).fillColor(BLACK);
      }
      if (bank.ifsc) {
        doc.text('IFSC: ', m + 6, y, { continued: true });
        doc.font('Roboto-Bold').text(bank.ifsc);
        y += 10;
        doc.font('Roboto').fontSize(7).fillColor(BLACK);
      }
      if (bank.bank) {
        doc.text('Bank: ', m + 6, y, { continued: true });
        doc.font('Roboto-Bold').text(bank.bank);
        y += 10;
        doc.font('Roboto').fontSize(7).fillColor(BLACK);
      }
      if (bank.branch) {
        doc.text('Branch: ', m + 6, y, { continued: true });
        doc.font('Roboto-Bold').text(bank.branch);
        y += 10;
        doc.font('Roboto').fontSize(7).fillColor(BLACK);
      }
      if (bank.upi) {
        doc.text('UPI: ', m + 6, y, { continued: true });
        doc.font('Roboto-Bold').text(bank.upi);
        y += 10;
        doc.font('Roboto').fontSize(7).fillColor(BLACK);
      }

      // Signatory (right) — layout: "For Company" → signature image → "Authorised Signatory"
      const sigStartY = y - 40;

      // Digital signature image — use company.signature, fall back to embedded default
      let sigBuffer = null;
      if (company.signature) {
        try {
          const sigData = company.signature.replace(/^data:image\/[a-z+]+;base64,/, '');
          sigBuffer = Buffer.from(sigData, 'base64');
        } catch (_) { /* ignore */ }
      }
      if (!sigBuffer) {
        // Use embedded default signature (works on all environments including production)
        sigBuffer = Buffer.from(DEFAULT_SIGNATURE_B64, 'base64');
      }

      const sigW = 90;
      const sigH = 32;
      const forTextY   = sigStartY;           // "For Company Name"
      const sigImageY  = forTextY + 12;       // signature image starts below the text
      const sigLabelY  = sigImageY + sigH + 4; // "Authorised Signatory" below image

      doc.font('Roboto-Bold').fontSize(7.5).fillColor(BLACK);
      doc.text(`For ${company.name || ''}`, midRightX, forTextY, { width: midRightW - 6, align: 'right' });

      if (sigBuffer) {
        try {
          doc.image(sigBuffer, midRightX + midRightW - sigW - 6, sigImageY, {
            fit: [sigW, sigH],
            type: 'png',
          });
        } catch (_) { /* skip if image fails */ }
      }

      doc.font('Roboto').fontSize(7).fillColor(BLACK);
      doc.text('Authorised Signatory', midRightX, sigLabelY, { width: midRightW - 6, align: 'right' });

      y += 6;

      // ── FOOTER ────────────────────────────────────
      // Payment terms positioned just above footer on last page
      const footerTopY = ph - 80; // above letterhead footer area

      if (invoice.terms) {
        let ptY = footerTopY - 30;
        // Only render if there is vertical space — avoid auto-page creation
        if (ptY > y + 20) {
          doc.font('Roboto-Bold').fontSize(7.5).fillColor(BLACK);
          doc.text('Payment Terms:', m + 6, ptY);
          ptY += 11;
          doc.font('Roboto').fontSize(7).fillColor(BLACK);
          const maxTermsH = footerTopY - ptY - 6;
          // Clip so overflowing terms never create a new page
          doc.save();
          doc.rect(m + 6, ptY, cw - 12, maxTermsH).clip();
          doc.text(invoice.terms, m + 6, ptY, { width: cw - 12, lineBreak: true });
          doc.restore();
          // Reset PDFKit's internal cursor to prevent auto-page after restore
          doc.y = ptY + maxTermsH;
        }
      }

      // Page numbers — switch to each page, then return to last page before end()
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.font('Roboto').fontSize(5).fillColor(GRAY);
        doc.text(`Page ${i + 1} of ${pages.count}`, m, ph - 46, { width: cw, align: 'center' });
      }
      // Return to last page so doc.end() doesn't append a blank page
      doc.switchToPage(pages.count - 1);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePdfBuffer, cleanInvoiceNumber };

