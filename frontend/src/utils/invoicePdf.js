import jsPDF from 'jspdf';
import 'jspdf-autotable';

const RED = [229, 57, 53];
const BLACK = [0, 0, 0];
const GRAY = [120, 120, 120];
const BORDER = [200, 200, 200];
const WHITE = [255, 255, 255];
const LIGHT_BG = [237, 246, 249];
const TABLE_HEADER = [206, 215, 220];

const cleanInvoiceNumber = (num) => num ? num.replace(/^(TAX|PRO)-/, '') : '';

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

function drawBox(doc, x, y, w, h) {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
}

// Load Roboto from Google Fonts and register with jsPDF (cached after first call)
let _robotoLoaded = false;
async function ensureRoboto(doc) {
    if (_robotoLoaded) return;
    const toBase64 = (ab) => {
        const arr = new Uint8Array(ab);
        let s = '';
        for (const byte of arr) s += String.fromCodePoint(byte);
        return btoa(s);
    };
    try {
        const [rR, rB, rI] = await Promise.all([
            fetch('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf'),
            fetch('https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf'),
            fetch('https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1Me5WZFCzYlKw.ttf'),
        ]);
        const [ab1, ab2, ab3] = await Promise.all([rR.arrayBuffer(), rB.arrayBuffer(), rI.arrayBuffer()]);
        doc.addFileToVFS('Roboto-Regular.ttf', toBase64(ab1));
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.addFileToVFS('Roboto-Bold.ttf', toBase64(ab2));
        doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
        doc.addFileToVFS('Roboto-Italic.ttf', toBase64(ab3));
        doc.addFont('Roboto-Italic.ttf', 'Roboto', 'italic');
        _robotoLoaded = true;
    } catch {
        // Offline or CDN unreachable — stay on Helvetica
    }
}

export async function generateInvoicePdf(invoice, company, bank) {
    const doc = new jsPDF('p', 'mm', 'a4');
    await ensureRoboto(doc);
    const FONT = _robotoLoaded ? 'Roboto' : 'helvetica';
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 15;
    const cw = pw - m * 2;
    let y = m;

    // ── PAGE BACKGROUND ─────────────────────────────
    doc.setFillColor(...LIGHT_BG);
    doc.rect(m, m, cw, ph - m * 2, 'F');

    // ── HEADER: Logo + Company Name ─────────────────
    // Red rounded square logo
    doc.setFillColor(...RED);
    doc.roundedRect(m + 4, y + 2, 10, 10, 2, 2, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('B', m + 6.8, y + 9.5);

    // Company name
    doc.setFont(FONT, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...BLACK);
    doc.text(company.name || 'Company Name', m + 17, y + 8);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(company.tagline || '', m + 17, y + 12);

    y += 18;

    // ── GSTIN + INVOICE TITLE ROW ───────────────────
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(m, y, pw - m, y);
    y += 5;

    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(`GSTIN: ${company.gstin || ''}`, m + 3, y);

    const invoiceLabel = invoice.type === 'proforma' ? 'PROFORMA INVOICE' : 'INVOICE';
    doc.setFont(FONT, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BLACK);
    doc.text(invoiceLabel, pw / 2, y + 1, { align: 'center' });

    doc.setFont(FONT, 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text('Original Copy', pw - m - 3, y, { align: 'right' });

    y += 8;
    doc.setDrawColor(...BORDER);
    doc.line(m, y, pw - m, y);
    y += 2;

    // ── BILL TO + INVOICE DETAILS ───────────────────
    const halfW = cw / 2;
    const detailsTop = y;

    // Bill To label
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text('BILL TO', m + 4, y + 4);

    let by = y + 8;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(invoice.client_name || 'COMPANY NAME', m + 4, by);
    by += 5;
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    if (invoice.client_address) { doc.text(invoice.client_address, m + 4, by); by += 4; }
    const cityState = [invoice.client_city, invoice.client_state].filter(Boolean).join(', ');
    if (cityState) { doc.text(cityState, m + 4, by); by += 4; }
    if (invoice.client_pincode) { doc.text(`${invoice.client_state || 'State'} - ${invoice.client_pincode}`, m + 4, by); by += 6; }
    doc.setFont(FONT, 'bold');
    doc.setTextColor(...BLACK);
    doc.text(`GSTIN: ${invoice.client_gstin || ''}`, m + 4, by); by += 4;
    doc.setFont(FONT, 'normal');
    doc.setTextColor(...BLACK);
    doc.text(`Contact Person: ${invoice.client_contact || ''}`, m + 4, by);

    // Vertical divider
    const divX = m + halfW;
    doc.setDrawColor(...BORDER);
    doc.line(divX, detailsTop, divX, detailsTop + 34);

    // Invoice details (right side)
    const infoX = divX + 3;
    const infoLabelW = 20;
    let iY = detailsTop + 4;

    const infoRows = [
        ['Invoice No.', cleanInvoiceNumber(invoice.invoice_number) || ''],
        ['Dated', formatShortDate(invoice.invoice_date)],
        ['P.O. No.', invoice.po_number || ''],
        ['P.O. Date', invoice.po_date ? formatShortDate(invoice.po_date) : ''],
    ];

    infoRows.forEach(([label, value]) => {
        doc.setFont(FONT, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...BLACK);
        doc.text(label, infoX, iY);
        doc.setTextColor(...BLACK);
        doc.text(':', infoX + infoLabelW, iY);
        doc.setFont(FONT, 'bold');
        doc.text(value, infoX + infoLabelW + 3, iY);
        iY += 4;
        doc.setDrawColor(...[220, 220, 220]);
        doc.line(divX, iY - 1, pw - m, iY - 1);
        iY += 1;
    });

    // E-way Bill
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text('E-way Bill No.', infoX, iY);
    doc.setTextColor(...BLACK);
    doc.text(':', infoX + infoLabelW, iY);
    doc.text(invoice.eway_bill || '', infoX + infoLabelW + 3, iY);

    y = detailsTop + 36;
    doc.setDrawColor(...BORDER);
    doc.line(m, y, pw - m, y);
    y += 1;

    // ── ITEMS TABLE ─────────────────────────────────
    const items = invoice.items || [];
    const tableHead = [['Sr. No.', 'Description', 'HSN/SAC\nCode', 'Qty', 'Rate', 'IGST', 'Amount']];
    const tableBody = items.map((item, i) => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        const taxPct = parseFloat(item.tax_pct) || 0;
        const taxAmt = Math.round((qty * rate * taxPct) / 100);
        return [
            i + 1,
            item.product_name || item.description || '',
            item.hsn || '-',
            qty,
            fmt(rate),
            fmt(taxAmt),
            fmt(item.amount),
        ];
    });

    doc.autoTable({
        startY: y,
        head: tableHead,
        body: tableBody,
        margin: { left: m, right: m },
        styles: {
            font: FONT,
            fontSize: 8,
            cellPadding: 3,
            lineColor: [...BORDER],
            lineWidth: 0.3,
            textColor: BLACK,
            fillColor: WHITE,
        },
        headStyles: {
            font: FONT,
            fillColor: TABLE_HEADER,
            textColor: BLACK,
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'center',
            valign: 'middle',
        },
        bodyStyles: {
            valign: 'middle',
        },
        columnStyles: {
            0: { cellWidth: 14, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 22, halign: 'center' },
            3: { cellWidth: 12, halign: 'center' },
            4: { cellWidth: 20, halign: 'right' },
            5: { cellWidth: 18, halign: 'right' },
            6: { cellWidth: 24, halign: 'right' },
        },
        theme: 'grid',
    });

    y = doc.lastAutoTable.finalY + 2;

    // ── MID SECTION: Note + Tax Table | Subtotal + Total ────
    const subtotal = invoice.subtotal || 0;
    const taxTotal = invoice.taxable_amount || 0;
    const grandTotal = invoice.grand_total || 0;
    const taxType = invoice.tax_type || 'IGST';
    const rightColX = m + halfW;
    const rightColW = halfW;

    // LEFT: Note + Tax breakdown
    let leftY = y + 2;
    if (invoice.notes) {
        doc.setFont(FONT, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...RED);
        doc.text('Note: ', m + 3, leftY, { continued: false });
        const noteX = m + 3 + doc.getTextWidth('Note: ');
        doc.setFont(FONT, 'normal');
        doc.setTextColor(...BLACK);
        doc.text(invoice.notes, noteX, leftY);
        leftY += 6;
    }

    // Tax breakdown mini table
    const taxColW = (halfW - 6) / 4;
    const taxHeaders = ['Tax\nRate', 'Taxable\nAmount', `${taxType === 'IGST' ? 'IGST' : 'CGST'}\n@ ${items[0]?.tax_pct || 18}%`, 'Total\nTax'];

    // Tax header row
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.setDrawColor(...BORDER);
    taxHeaders.forEach((h, i) => {
        const x = m + 3 + i * taxColW;
        drawBox(doc, x, leftY, taxColW, 8);
        doc.text(h, x + taxColW / 2, leftY + 3, { align: 'center', maxWidth: taxColW - 2 });
    });
    leftY += 8;

    // Tax data row
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    const taxData = [`${items[0]?.tax_pct || 18}%`, fmt(Math.round(subtotal)), fmt(Math.round(taxTotal)), fmt(Math.round(taxTotal))];
    taxData.forEach((val, i) => {
        const x = m + 3 + i * taxColW;
        drawBox(doc, x, leftY, taxColW, 6);
        doc.text(val, x + taxColW / 2, leftY + 4, { align: 'center' });
    });

    // RIGHT: Summary rows
    const summaryTop = y + 1;
    const rowH = 6;
    let rY = summaryTop;

    function summaryRow(label, value, bold) {
        doc.setFillColor(...WHITE);
        doc.rect(rightColX, rY, rightColW, rowH, 'F');
        drawBox(doc, rightColX, rY, rightColW, rowH);
        doc.setFont(FONT, bold ? 'bold' : 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...BLACK);
        doc.text(label, rightColX + 3, rY + 4.5);
        doc.text(value, rightColX + rightColW - 3, rY + 4.5, { align: 'right' });
        rY += rowH;
    }

    summaryRow('Subtotal', fmt(subtotal), false);

    if (taxType === 'IGST') {
        summaryRow(`IGST @${items[0]?.tax_pct || 18}%`, fmt(Math.round(taxTotal)), false);
    } else {
        const halfTax = Math.round(taxTotal / 2);
        const taxPct = items[0]?.tax_pct || 18;
        summaryRow(`CGST @${taxPct / 2}%`, fmt(halfTax), false);
        summaryRow(`SGST @${taxPct / 2}%`, fmt(halfTax), false);
    }

    // Grey TOTAL row
    doc.setFillColor(...TABLE_HEADER);
    doc.rect(rightColX, rY, rightColW, rowH + 1, 'F');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text('TOTAL', rightColX + 3, rY + 5);
    doc.text(fmt(Math.round(grandTotal)), rightColX + rightColW - 3, rY + 5, { align: 'right' });
    rY += rowH + 1;

    // Amount in words (right, below total)
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    const wordsText = numberToWords(Math.round(grandTotal));
    doc.text(wordsText.replace('Rupees ', ''), rightColX + rightColW - 3, rY + 4, { align: 'right' });
    doc.text('Rupees Only', rightColX + rightColW - 3, rY + 8, { align: 'right' });

    y = Math.max(leftY + 12, rY + 12);

    // ── BANK DETAILS + SIGNATORY ────────────────────
    doc.setDrawColor(...BORDER);
    doc.line(m, y, pw - m, y);
    y += 4;

    // Bank Details (left)
    const bk = bank || {};
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text('Bank Details:', m + 3, y);
    y += 4;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(company.name || '', m + 3, y);
    y += 3.5;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    if (bk.accountNo) { doc.text(`A/c No.: ${bk.accountNo}`, m + 3, y); y += 3.5; }
    if (bk.ifsc) { doc.text(`IFSC: ${bk.ifsc}`, m + 3, y); y += 3.5; }
    if (bk.bank) { doc.text(bk.bank, m + 3, y); y += 3.5; }
    if (bk.upi) { doc.text(`UPI: ${bk.upi}`, m + 3, y); y += 3.5; }

    // Signatory (right)
    const sigY = y - 16;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(`For ${company.name || ''}`, pw - m - 3, sigY, { align: 'right' });
    doc.setFont(FONT, 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text('Authorised Signatory', pw - m - 3, sigY + 14, { align: 'right' });

    y += 4;

    // ── PAYMENT TERMS ───────────────────────────────
    if (invoice.terms) {
        doc.setDrawColor(...BORDER);
        doc.line(m, y, pw - m, y);
        y += 4;
        doc.setFont(FONT, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...BLACK);
        doc.text('Payment Terms:', m + 3, y);
        y += 4;
        doc.setFont(FONT, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...BLACK);
        const termLines = doc.splitTextToSize(invoice.terms, cw - 6);
        doc.text(termLines, m + 3, y);
        y += termLines.length * 3 + 4;
    }

    // ── FOOTER ──────────────────────────────────────
    const footerY = ph - 12;
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.8);
    doc.line(m, footerY, pw - m, footerY);
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.setFont(FONT, 'normal');
    const footerParts = [];
    const addr = buildCompanyAddress(company);
    if (addr) footerParts.push(`Registered Office: ${addr}`);
    if (company.phone) footerParts.push(company.phone);
    if (company.email) footerParts.push(company.email);
    doc.text(footerParts.join('   |   '), pw / 2, footerY + 4, { align: 'center', maxWidth: cw });

    // Save
    const filename = `Invoice_${(cleanInvoiceNumber(invoice.invoice_number) || 'draft').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    doc.save(filename);
}
