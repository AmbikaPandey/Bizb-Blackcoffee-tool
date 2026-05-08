/**
 * BUSY Accounting Software - Invoice XML Generator
 * Generates BUSY-compatible XML format for invoice export.
 */

const STATE_CODES = {
  'Jammu & Kashmir': '01', 'Jammu and Kashmir': '01', 'Himachal Pradesh': '02',
  'Punjab': '03', 'Chandigarh': '04', 'Uttarakhand': '05', 'Haryana': '06',
  'Delhi': '07', 'Rajasthan': '08', 'Uttar Pradesh': '09', 'Bihar': '10',
  'Sikkim': '11', 'Arunachal Pradesh': '12', 'Nagaland': '13', 'Manipur': '14',
  'Mizoram': '15', 'Tripura': '16', 'Meghalaya': '17', 'Assam': '18',
  'West Bengal': '19', 'Jharkhand': '20', 'Odisha': '21', 'Chhattisgarh': '22',
  'Madhya Pradesh': '23', 'Gujarat': '24', 'Maharashtra': '27', 'Karnataka': '29',
  'Goa': '30', 'Lakshadweep': '31', 'Kerala': '32', 'Tamil Nadu': '33',
  'Puducherry': '34', 'Andaman and Nicobar Islands': '35', 'Telangana': '36',
  'Andhra Pradesh': '37', 'Ladakh': '38',
};

// Case-insensitive state code lookup
function getStateCode(state) {
  if (!state) return '';
  const lower = state.toLowerCase();
  for (const [key, code] of Object.entries(STATE_CODES)) {
    if (key.toLowerCase() === lower) return code;
  }
  return '';
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date to DD-MM-YYYY for BUSY
 */
function formatBusyDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Round to 2 decimal places
 */
function round2(val) {
  return Math.round((val || 0) * 100) / 100;
}

/**
 * Calculate tax breakup for an item based on tax type
 */
function calculateTaxBreakup(item, taxType) {
  const taxableAmount = round2(item.amount || (item.qty * item.rate));
  const taxPct = item.tax_pct || 0;
  const taxAmount = round2(taxableAmount * taxPct / 100);

  if (taxType === 'IGST') {
    return { cgst: 0, sgst: 0, igst: taxAmount, cgstRate: 0, sgstRate: 0, igstRate: taxPct };
  }
  // CGST + SGST (intra-state)
  const halfRate = round2(taxPct / 2);
  const halfTax = round2(taxAmount / 2);
  return { cgst: halfTax, sgst: halfTax, igst: 0, cgstRate: halfRate, sgstRate: halfRate, igstRate: 0 };
}

/**
 * Generate BUSY-compatible XML for an invoice
 * @param {Object} invoiceData - Full invoice data with populated client
 * @param {Object} company - Company settings
 * @returns {String} XML string
 */
function generateBusyInvoiceXML(invoiceData, company = {}) {
  const inv = invoiceData;
  const clientName = escapeXml(inv.client_name || inv.client_id?.name || '');
  const clientGstin = escapeXml(inv.client_gstin || inv.client_id?.gstin || '');
  const clientAddress = escapeXml(inv.client_address || inv.client_id?.address || '');
  const clientCity = escapeXml(inv.client_city || inv.client_id?.city || '');
  const clientState = inv.client_state || inv.client_id?.state || '';
  const stateCode = getStateCode(clientState);
  const placeOfSupply = inv.place_of_supply || clientState || '';
  const posCode = getStateCode(placeOfSupply) || stateCode;
  const taxType = inv.tax_type || 'IGST';
  const isIGST = taxType === 'IGST';

  // Build item allocation XML
  const itemsXml = (inv.items || []).map((item, idx) => {
    const taxable = round2(item.amount || (item.qty * item.rate));
    const tax = calculateTaxBreakup(item, taxType);
    const totalWithTax = round2(taxable + tax.cgst + tax.sgst + tax.igst);

    return `
      <ItemAllocation>
        <SrNo>${idx + 1}</SrNo>
        <ItemName>${escapeXml(item.product_name || '')}</ItemName>
        <Description>${escapeXml(item.description || '')}</Description>
        <HSNCode>${escapeXml(item.hsn || '')}</HSNCode>
        <Quantity>${item.qty || 0}</Quantity>
        <Unit>${escapeXml(item.unit || 'NOS')}</Unit>
        <Rate>${round2(item.rate || 0)}</Rate>
        <DiscountPct>${round2(item.discount_pct || 0)}</DiscountPct>
        <Amount>${taxable}</Amount>
        <TaxableValue>${taxable}</TaxableValue>
        <GSTRate>${item.tax_pct || 0}</GSTRate>
        <CGSTRate>${tax.cgstRate}</CGSTRate>
        <CGSTAmount>${tax.cgst}</CGSTAmount>
        <SGSTRate>${tax.sgstRate}</SGSTRate>
        <SGSTAmount>${tax.sgst}</SGSTAmount>
        <IGSTRate>${tax.igstRate}</IGSTRate>
        <IGSTAmount>${tax.igst}</IGSTAmount>
        <TotalAmount>${totalWithTax}</TotalAmount>
      </ItemAllocation>`;
  }).join('');

  // Calculate totals
  const totalCGST = round2((inv.items || []).reduce((sum, item) => {
    const t = calculateTaxBreakup(item, taxType);
    return sum + t.cgst;
  }, 0));
  const totalSGST = round2((inv.items || []).reduce((sum, item) => {
    const t = calculateTaxBreakup(item, taxType);
    return sum + t.sgst;
  }, 0));
  const totalIGST = round2((inv.items || []).reduce((sum, item) => {
    const t = calculateTaxBreakup(item, taxType);
    return sum + t.igst;
  }, 0));
  const roundOff = round2(inv.grand_total - (inv.taxable_amount + totalCGST + totalSGST + totalIGST));

  // Determine payment status
  let paymentStatus = 'Unpaid';
  if (inv.status === 'Paid') paymentStatus = 'Paid';
  else if (inv.status === 'Partially Paid') paymentStatus = 'Partial';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ABOREXPORT>
  <VOUCHER>
    <VoucherType>Sales</VoucherType>
    <VoucherNo>${escapeXml(inv.invoice_number || '')}</VoucherNo>
    <VoucherDate>${formatBusyDate(inv.invoice_date)}</VoucherDate>
    <InvoiceType>${escapeXml(inv.invoice_type || 'Tax Invoice')}</InvoiceType>
    <PartyName>${clientName}</PartyName>
    <PartyGSTIN>${clientGstin}</PartyGSTIN>
    <BillingAddress>${clientAddress}</BillingAddress>
    <BillingCity>${clientCity}</BillingCity>
    <BillingState>${escapeXml(clientState)}</BillingState>
    <StateCode>${stateCode}</StateCode>
    <PlaceOfSupply>${escapeXml(placeOfSupply)}</PlaceOfSupply>
    <PlaceOfSupplyCode>${posCode}</PlaceOfSupplyCode>
    <TaxType>${isIGST ? 'IGST' : 'CGST_SGST'}</TaxType>
    <SubTotal>${round2(inv.subtotal || 0)}</SubTotal>
    <TaxableAmount>${round2(inv.taxable_amount || 0)}</TaxableAmount>
    <CGSTTotal>${totalCGST}</CGSTTotal>
    <SGSTTotal>${totalSGST}</SGSTTotal>
    <IGSTTotal>${totalIGST}</IGSTTotal>
    <RoundOff>${roundOff}</RoundOff>
    <GrandTotal>${round2(inv.grand_total || 0)}</GrandTotal>
    <AmountPaid>${round2(inv.amount_paid || 0)}</AmountPaid>
    <Balance>${round2(inv.balance || 0)}</Balance>
    <PaymentStatus>${paymentStatus}</PaymentStatus>
    <PONumber>${escapeXml(inv.po_number || '')}</PONumber>
    <EwayBill>${escapeXml(inv.eway_bill || '')}</EwayBill>
    <Transport>${escapeXml(inv.transport || '')}</Transport>
    <VehicleNo>${escapeXml(inv.vehicle_no || '')}</VehicleNo>
    <Notes>${escapeXml(inv.notes || '')}</Notes>
    <ItemAllocations>${itemsXml}
    </ItemAllocations>
    <LedgerAllocations>
      <LedgerAllocation>
        <LedgerName>${clientName}</LedgerName>
        <Amount>${round2(inv.grand_total || 0)}</Amount>
        <DrCr>Dr</DrCr>
      </LedgerAllocation>
      <LedgerAllocation>
        <LedgerName>Sales Account</LedgerName>
        <Amount>${round2(inv.taxable_amount || 0)}</Amount>
        <DrCr>Cr</DrCr>
      </LedgerAllocation>${!isIGST ? `
      <LedgerAllocation>
        <LedgerName>CGST Output</LedgerName>
        <Amount>${totalCGST}</Amount>
        <DrCr>Cr</DrCr>
      </LedgerAllocation>
      <LedgerAllocation>
        <LedgerName>SGST Output</LedgerName>
        <Amount>${totalSGST}</Amount>
        <DrCr>Cr</DrCr>
      </LedgerAllocation>` : `
      <LedgerAllocation>
        <LedgerName>IGST Output</LedgerName>
        <Amount>${totalIGST}</Amount>
        <DrCr>Cr</DrCr>
      </LedgerAllocation>`}${roundOff !== 0 ? `
      <LedgerAllocation>
        <LedgerName>Round Off</LedgerName>
        <Amount>${Math.abs(roundOff)}</Amount>
        <DrCr>${roundOff > 0 ? 'Dr' : 'Cr'}</DrCr>
      </LedgerAllocation>` : ''}
    </LedgerAllocations>
  </VOUCHER>
</ABOREXPORT>`;

  return xml;
}

/**
 * Validate invoice data before export
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateForBusyExport(invoiceData) {
  const errors = [];
  const inv = invoiceData;

  if (!inv.invoice_number) errors.push('Invoice number is required');
  if (!inv.invoice_date) errors.push('Invoice date is required');
  if (!inv.client_name && !inv.client_id?.name) errors.push('Customer name is missing');

  // Validate items
  if (!inv.items || inv.items.length === 0) {
    errors.push('Invoice must have at least one item');
  } else {
    inv.items.forEach((item, idx) => {
      if (!item.hsn) errors.push(`Item ${idx + 1}: HSN code is missing`);
      else if (!/^[0-9]{4,8}$/.test(item.hsn)) errors.push(`Item ${idx + 1}: Invalid HSN code format`);
      if (!item.qty || item.qty <= 0) errors.push(`Item ${idx + 1}: Quantity must be greater than 0`);
      if (!item.rate || item.rate <= 0) errors.push(`Item ${idx + 1}: Rate must be greater than 0`);
    });
  }

  // Validate totals
  if (!inv.grand_total || inv.grand_total <= 0) errors.push('Grand total must be greater than 0');

  return { valid: errors.length === 0, errors };
}

module.exports = { generateBusyInvoiceXML, validateForBusyExport, escapeXml, formatBusyDate };
