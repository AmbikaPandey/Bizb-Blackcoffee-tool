import jsPDF from 'jspdf';
import 'jspdf-autotable';

const RED = [220, 38, 38];
const BLACK = [0, 0, 0];
const GRAY = [120, 120, 120];
const BORDER = [200, 200, 200];
const WHITE = [255, 255, 255];

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

function drawBox(doc, x, y, w, h) {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
}

export function generateInvoicePdf(invoice, company, bank) {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 15;
    const cw = pw - m * 2;
    let y = m;

    // ── HEADER ──────────────────────────────────────────────
    // Logo (left)
    let logoEndX = m;
    if (company.logo) {
        try {
            doc.addImage(company.logo, 'AUTO', m, y, 40, 18);
            logoEndX = m + 44;
        } catch {
            logoEndX = m;
        }
    }

    // Company name next to logo (or at left if no logo)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...BLACK);
    doc.text(company.name || 'Company Name', logoEndX, y + 10);

    // Invoice type (right, red)
    const invoiceLabel = invoice.type === 'proforma' ? 'PROFORMA INVOICE' : 'TAX INVOICE';
    doc.setFontSize(14);
    doc.setTextColor(...RED);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceLabel, pw - m, y + 4, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Original Copy', pw - m, y + 9, { align: 'right' });

    // Invoice No box (right)
    const boxW = 38;
    const boxH = 9;
    const boxX = pw - m - boxW;
    const boxY1 = y + 13;

    drawBox(doc, boxX, boxY1, boxW, boxH);
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text('INVOICE NO.', boxX + boxW / 2, boxY1 + 3.5, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'bold');
    doc.text(cleanInvoiceNumber(invoice.invoice_number) || '', boxX + boxW / 2, boxY1 + 8, { align: 'center' });

    const boxY2 = boxY1 + boxH;
    drawBox(doc, boxX, boxY2, boxW, boxH);
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text('DATE', boxX + boxW / 2, boxY2 + 3.5, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(invoice.invoice_date), boxX + boxW / 2, boxY2 + 8, { align: 'center' });

    y = boxY2 + boxH + 5;

    // ── GSTIN LINE ──────────────────────────────────────────
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(m, y, pw - m, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(`GSTIN: ${company.gstin || ''}`, m, y);
    y += 6;

    // ── CLIENT DETAILS + SUPPLY DETAILS (two bordered boxes) ───────
    const halfW = cw / 2;
    const billBoxX = m;
    const supplyBoxX = m + halfW;
    const sectionTop = y;

    // Build client lines
    const clientLines = [];
    clientLines.push({ text: `M/S ${invoice.client_name || ''}`, bold: true, size: 9 });
    if (invoice.client_address) clientLines.push({ text: invoice.client_address, bold: false, size: 7.5 });
    const cityState = [invoice.client_city, invoice.client_state].filter(Boolean).join(', ');
    if (cityState) clientLines.push({ text: cityState, bold: false, size: 7.5 });
    if (invoice.client_gstin) clientLines.push({ text: `GSTIN: ${invoice.client_gstin}`, bold: false, size: 7.5 });
    if (invoice.client_phone) clientLines.push({ text: `Phone: ${invoice.client_phone}`, bold: false, size: 7.5 });

    // Supply detail rows
    const supplyRows = [
        ['Place of Supply:', formatPlaceOfSupply(invoice.place_of_supply)],
        ['Reverse Charge:', 'No'],
        ['Transport:', invoice.transport || '-'],
        ['Vehicle No.:', invoice.vehicle_no || '-'],
        ['GR/RR No.:', invoice.gr_rr_no || '-'],
        ['E-Way Bill:', invoice.eway_bill || '-'],
    ];

    const sectionH = Math.max(clientLines.length * 5 + 6, supplyRows.length * 5 + 4);

    drawBox(doc, billBoxX, sectionTop, halfW, sectionH);
    drawBox(doc, supplyBoxX, sectionTop, halfW, sectionH);

    // Fill client details
    let by = sectionTop + 6;
    clientLines.forEach((line) => {
        doc.setFont('helvetica', line.bold ? 'bold' : 'normal');
        doc.setFontSize(line.size);
        doc.setTextColor(...BLACK);
        doc.text(line.text, billBoxX + 3, by);
        by += line.bold ? 5.5 : 4.5;
    });

    // Fill supply details
    let sy = sectionTop + 6;
    doc.setFontSize(8);
    supplyRows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BLACK);
        doc.text(label, supplyBoxX + 3, sy);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...BLACK);
        doc.text(value, supplyBoxX + 35, sy);
        sy += 5;
    });

    y = sectionTop + sectionH + 4;

    // ── ITEMS TABLE ─────────────────────────────────────────
    const items = invoice.items || [];
    const tableHead = [['Sr.\nNo.', 'Description', 'HSN/SAC\nCode', 'Qty', 'Rate', 'Taxable', 'GST', 'Amount']];
    const tableBody = items.map((item, i) => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discPct = parseFloat(item.discount_pct) || 0;
        const taxPct = parseFloat(item.tax_pct) || 0;
        const lineTotal = qty * rate;
        const afterDiscount = lineTotal - lineTotal * (discPct / 100);
        return [
            i + 1,
            item.product_name || item.description || '',
            item.hsn || '-',
            qty,
            fmt(rate),
            fmt(afterDiscount),
            `${taxPct}%`,
            fmt(item.amount),
        ];
    });

    doc.autoTable({
        startY: y,
        head: tableHead,
        body: tableBody,
        margin: { left: m, right: m },
        styles: {
            fontSize: 8,
            cellPadding: 3,
            lineColor: [...BORDER],
            lineWidth: 0.3,
            textColor: BLACK,
        },
        headStyles: {
            fillColor: WHITE,
            textColor: BLACK,
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center',
            valign: 'middle',
        },
        bodyStyles: {
            valign: 'middle',
        },
        columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 18, halign: 'center' },
            3: { cellWidth: 14, halign: 'center' },
            4: { cellWidth: 22, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 16, halign: 'center' },
            7: { cellWidth: 24, halign: 'right' },
        },
        theme: 'grid',
    });

    y = doc.lastAutoTable.finalY + 2;

    // ── BOTTOM SECTION ──────────────────────────────────────
    const subtotal = invoice.subtotal || 0;
    const taxTotal = invoice.taxable_amount || 0;
    const grandTotal = invoice.grand_total || 0;
    const taxType = invoice.tax_type || 'IGST';
    const leftColW = halfW;
    const rightColX = m + halfW;
    const rightColW = halfW;

    // --- RIGHT: Summary rows ---
    const summaryTop = y;
    const rowH = 7;
    let rY = summaryTop;

    function summaryRow(label, value, bold) {
        drawBox(doc, rightColX, rY, rightColW, rowH);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...BLACK);
        doc.text(label, rightColX + 3, rY + 5);
        // Black square bullet before value
        doc.setFillColor(...BLACK);
        const valWidth = doc.getTextWidth(value);
        doc.rect(rightColX + rightColW - valWidth - 7, rY + 2.5, 2, 2, 'F');
        doc.text(value, rightColX + rightColW - 3, rY + 5, { align: 'right' });
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

    // Grand Total row (bold, slightly taller)
    drawBox(doc, rightColX, rY, rightColW, rowH + 1);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('GRAND TOTAL', rightColX + 3, rY + 5.5);
    doc.setFillColor(...BLACK);
    const gtText = fmt(Math.round(grandTotal));
    const gtWidth = doc.getTextWidth(gtText);
    doc.rect(rightColX + rightColW - gtWidth - 7, rY + 3, 2, 2, 'F');
    doc.text(gtText, rightColX + rightColW - 3, rY + 5.5, { align: 'right' });
    rY += rowH + 1;

    // --- LEFT: Amount in words box (spans same height as summary) ---
    const wordsBoxH = rY - summaryTop;
    drawBox(doc, m, summaryTop, leftColW, wordsBoxH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...BLACK);
    doc.text('AMOUNT IN WORDS', m + 3, summaryTop + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const wordsLines = doc.splitTextToSize(numberToWords(Math.round(grandTotal)), leftColW - 6);
    doc.text(wordsLines, m + 3, summaryTop + 11);

    y = rY + 6;

    // --- Payment Terms (left) ---
    let leftY = y;
    if (invoice.terms) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...BLACK);
        doc.text('Payment Terms', m, leftY);
        leftY += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const termLines = doc.splitTextToSize(invoice.terms, leftColW - 4);
        doc.text(termLines, m, leftY);
        leftY += termLines.length * 3 + 5;
    }

    // --- Bank Details (left) ---
    const bk = bank || {};
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text('BANK DETAILS', m, leftY);
    leftY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(company.name || '', m, leftY);
    leftY += 3.5;
    doc.setFont('helvetica', 'normal');
    if (bk.bank) { doc.text(`Bank: ${bk.bank}`, m, leftY); leftY += 3.5; }
    if (bk.accountNo) { doc.text(`A/C No: ${bk.accountNo}`, m, leftY); leftY += 3.5; }
    if (bk.ifsc) { doc.text(`IFSC: ${bk.ifsc}`, m, leftY); leftY += 3.5; }
    if (bk.upi) { doc.text(`UPI: ${bk.upi}`, m, leftY); leftY += 3.5; }

    // --- Signatory (right) ---
    let sigY = y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    const compName = company.name || '';
    doc.text(`For ${compName}`, pw - m, sigY, { align: 'right' });
    sigY += 20;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('Authorised Signatory', pw - m, sigY, { align: 'right' });
    doc.setTextColor(...BLACK);

    // ── FOOTER ──────────────────────────────────────────────
    const footerY = ph - 12;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(m, footerY, pw - m, footerY);
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    const footerParts = [];
    const addr = buildCompanyAddress(company);
    if (addr) footerParts.push(`Registered Office: ${addr}`);
    if (company.phone) footerParts.push(`m: ${company.phone}`);
    if (company.email) footerParts.push(`e: ${company.email}`);
    doc.text(footerParts.join('  |  '), pw / 2, footerY + 4, { align: 'center', maxWidth: cw });

    // Save
    const filename = `Invoice_${(cleanInvoiceNumber(invoice.invoice_number) || 'draft').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    doc.save(filename);
}
