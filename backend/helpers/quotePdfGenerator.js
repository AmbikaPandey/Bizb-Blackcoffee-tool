const PDFDocument = require('pdfkit');

const PRIMARY = '#3c2415';
const ACCENT = '#c8956c';
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

function drawLine(doc, x1, y1, x2, y2) {
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(x1, y1).lineTo(x2, y2).stroke();
}

function drawBox(doc, x, y, w, h, fill) {
  if (fill) doc.save().rect(x, y, w, h).fill(fill).restore();
  doc.strokeColor(BORDER).lineWidth(0.5).rect(x, y, w, h).stroke();
}

function generateQuotePdfBuffer(quote, company = {}, bank = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pw = 595.28;
      const ph = 841.89;
      const m = 40;
      const cw = pw - m * 2;
      let y = m;

      // ── BRANDED HEADER ──────────────────────────
      // Company Name (left)
      doc.font('Helvetica-Bold').fontSize(14).fillColor(PRIMARY);
      doc.text(company.name || 'Company Name', m, y, { width: cw / 2 });

      // QUOTATION label (right)
      doc.font('Helvetica-Bold').fontSize(14).fillColor(ACCENT);
      doc.text('QUOTATION', pw / 2, y, { width: cw / 2, align: 'right' });

      y += 18;
      if (quote.revision > 1) {
        doc.font('Helvetica').fontSize(8).fillColor(GRAY);
        doc.text(`Revision ${quote.revision}`, pw / 2, y, { width: cw / 2, align: 'right' });
      }
      y += 16;

      // Quote No & Date boxes
      const boxW = 110;
      const boxH = 28;
      const boxX = pw - m - boxW;

      drawBox(doc, boxX, y, boxW, boxH);
      doc.font('Helvetica').fontSize(7).fillColor(GRAY);
      doc.text('QUOTE NO.', boxX + 5, y + 4, { width: boxW - 10, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK);
      doc.text(quote.quote_number || '', boxX + 5, y + 14, { width: boxW - 10, align: 'center' });

      const boxY2 = y + boxH;
      drawBox(doc, boxX, boxY2, boxW, boxH);
      doc.font('Helvetica').fontSize(7).fillColor(GRAY);
      doc.text('DATE', boxX + 5, boxY2 + 4, { width: boxW - 10, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
      doc.text(formatDate(quote.createdAt), boxX + 5, boxY2 + 14, { width: boxW - 10, align: 'center' });

      // Company details (left side)
      let ly = y;
      doc.font('Helvetica').fontSize(7.5).fillColor(GRAY);
      if (company.address) { doc.text(company.address, m, ly); ly += 10; }
      const compCityState = [company.city, company.state].filter(Boolean).join(', ');
      if (compCityState) { doc.text(compCityState, m, ly); ly += 10; }
      if (company.gstin) { doc.text(`GSTIN: ${company.gstin}`, m, ly); ly += 10; }
      if (company.phone) { doc.text(`Phone: ${company.phone}`, m, ly); ly += 10; }
      if (company.email) { doc.text(`Email: ${company.email}`, m, ly); ly += 10; }

      y = boxY2 + boxH + 10;

      // ── ACCENT LINE ──────────────────────────────
      doc.strokeColor(ACCENT).lineWidth(2).moveTo(m, y).lineTo(pw - m, y).stroke();
      y += 12;

      // ── BILL TO ──────────────────────────────────
      const client = quote.client_id || {};
      drawBox(doc, m, y, cw, 80);
      doc.font('Helvetica').fontSize(7).fillColor(ACCENT);
      doc.text('QUOTE FOR', m + 8, y + 6);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
      doc.text(`M/S ${client.name || ''}`, m + 8, y + 18, { width: cw - 16 });

      let by = y + 30;
      doc.font('Helvetica').fontSize(7.5).fillColor(GRAY);
      if (client.address) { doc.text(client.address, m + 8, by, { width: cw / 2 - 16 }); by += 10; }
      const clCityState = [client.city, client.state].filter(Boolean).join(', ');
      if (clCityState) { doc.text(clCityState, m + 8, by); by += 10; }
      if (client.gstin) { doc.text(`GSTIN: ${client.gstin}`, m + 8, by); by += 10; }

      // Valid until on right side
      if (quote.valid_until) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PRIMARY);
        doc.text(`Valid Until: ${formatDate(quote.valid_until)}`, pw / 2, y + 18, { width: cw / 2 - 8, align: 'right' });
      }

      // Title
      if (quote.title) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK);
        doc.text(`RE: ${quote.title}`, pw / 2, y + 32, { width: cw / 2 - 8, align: 'right' });
      }

      y += 85;

      // ── ITEMS TABLE ──────────────────────────────
      const items = quote.items || [];
      const colWidths = [30, cw - 30 - 55 - 40 - 55 - 55 - 40 - 65, 55, 40, 55, 55, 40, 65];
      const headers = ['Sr No', 'Description', 'HSN/SAC', 'Qty', 'Rate', 'Taxable', 'GST', 'Amount'];
      const headerH = 22;

      drawBox(doc, m, y, cw, headerH, PRIMARY);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(WHITE);
      let hx = m;
      headers.forEach((h, i) => {
        doc.text(h, hx + 3, y + 7, { width: colWidths[i] - 6, align: 'center' });
        hx += colWidths[i];
      });
      y += headerH;

      items.forEach((item, idx) => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discPct = parseFloat(item.discount_pct) || 0;
        const gstPct = parseFloat(item.gst_pct) || 0;
        const lineTotal = qty * rate;
        const afterDiscount = lineTotal - lineTotal * (discPct / 100);

        const rowData = [
          String(idx + 1),
          item.description || '',
          item.hsn || '-',
          String(qty),
          fmt(rate),
          fmt(afterDiscount),
          `${gstPct}%`,
          fmt(item.amount),
        ];

        const descWidth = colWidths[1] - 6;
        const descHeight = doc.heightOfString(rowData[1], { width: descWidth, fontSize: 7.5 });
        const rowH = Math.max(20, descHeight + 10);

        if (y + rowH > ph - 80) { doc.addPage(); y = m; }

        const bgColor = idx % 2 === 0 ? null : LIGHT_BG;
        drawBox(doc, m, y, cw, rowH, bgColor);

        let rx = m;
        rowData.forEach((cell, ci) => {
          const isNum = ci >= 3;
          doc.font('Helvetica').fontSize(7.5).fillColor(BLACK);
          doc.text(cell, rx + 3, y + 5, {
            width: colWidths[ci] - 6,
            align: isNum ? 'right' : (ci === 0 ? 'center' : 'left'),
          });
          rx += colWidths[ci];
        });
        y += rowH;
      });

      y += 6;

      // ── SUMMARY ──────────────────────────────────
      const subtotal = quote.subtotal || 0;
      const agencyCharge = quote.agency_service_charge || 0;
      const agencyPct = quote.agency_service_charge_pct || 0;
      const taxTotal = quote.tax_amount || 0;
      const grandTotal = quote.grand_total || 0;

      if (y + 100 > ph - 80) { doc.addPage(); y = m; }

      const summaryX = pw - m - 200;
      const summaryW = 200;
      const rows = [
        ['Subtotal', fmt(subtotal)],
      ];
      if (agencyCharge > 0) {
        rows.push([`Agency Service Charge (${agencyPct}%)`, fmt(agencyCharge)]);
      }
      rows.push(['Tax', fmt(taxTotal)]);

      rows.forEach(([label, value]) => {
        doc.font('Helvetica').fontSize(8).fillColor(BLACK);
        doc.text(label, summaryX, y, { width: summaryW - 70, align: 'right' });
        doc.text(value, summaryX + summaryW - 65, y, { width: 60, align: 'right' });
        y += 14;
      });

      // Grand total
      drawBox(doc, summaryX, y, summaryW, 22, PRIMARY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE);
      doc.text('TOTAL', summaryX + 5, y + 6, { width: summaryW - 75, align: 'right' });
      doc.text(fmt(grandTotal), summaryX + summaryW - 65, y + 6, { width: 60, align: 'right' });
      y += 28;

      // Amount in words
      doc.font('Helvetica').fontSize(7.5).fillColor(GRAY);
      doc.text(numberToWords(grandTotal), m, y, { width: cw });
      y += 20;

      // ── TERMS & CONDITIONS ───────────────────────
      if (quote.terms) {
        if (y + 60 > ph - 40) { doc.addPage(); y = m; }
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PRIMARY);
        doc.text('Terms & Conditions', m, y);
        y += 12;
        doc.font('Helvetica').fontSize(7).fillColor(GRAY);
        doc.text(quote.terms, m, y, { width: cw });
        y += doc.heightOfString(quote.terms, { width: cw, fontSize: 7 }) + 10;
      }

      // ── NOTES ────────────────────────────────────
      if (quote.notes) {
        if (y + 40 > ph - 40) { doc.addPage(); y = m; }
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PRIMARY);
        doc.text('Notes', m, y);
        y += 12;
        doc.font('Helvetica').fontSize(7).fillColor(GRAY);
        doc.text(quote.notes, m, y, { width: cw });
        y += doc.heightOfString(quote.notes, { width: cw, fontSize: 7 }) + 10;
      }

      // ── BANK DETAILS ─────────────────────────────
      if (bank.account_number || bank.ifsc_code) {
        if (y + 60 > ph - 40) { doc.addPage(); y = m; }
        drawLine(doc, m, y, pw - m, y);
        y += 8;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PRIMARY);
        doc.text('Bank Details', m, y);
        y += 12;
        doc.font('Helvetica').fontSize(7).fillColor(GRAY);
        if (bank.bank_name) { doc.text(`Bank: ${bank.bank_name}`, m, y); y += 10; }
        if (bank.account_number) { doc.text(`A/C No: ${bank.account_number}`, m, y); y += 10; }
        if (bank.ifsc_code) { doc.text(`IFSC: ${bank.ifsc_code}`, m, y); y += 10; }
        if (bank.branch_name) { doc.text(`Branch: ${bank.branch_name}`, m, y); y += 10; }
      }

      // ── SIGNATURE ────────────────────────────────
      y = Math.max(y + 20, ph - 80);
      if (y > ph - 40) { doc.addPage(); y = ph - 80; }
      drawLine(doc, pw - m - 150, y, pw - m, y);
      doc.font('Helvetica').fontSize(8).fillColor(BLACK);
      doc.text('Authorized Signatory', pw - m - 150, y + 5, { width: 150, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(7).fillColor(PRIMARY);
      doc.text(company.name || '', pw - m - 150, y + 16, { width: 150, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateQuotePdfBuffer };
