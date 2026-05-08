import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, CreditCard, Printer, Download, X, Check, FileUp } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';

const DEFAULT_COMPANY = {
    name: '', gstin: '', address_line1: '', address_line2: '',
    city: '', state: '', pincode: '', phone: '', email: '', logo: '',
};

// Reverse map: state name → GST state code
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

    const rounded = Math.round(num);
    return 'Rupees ' + convert(rounded) + ' Only';
}

export default function ViewInvoice() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const invoiceRef = useRef(null);

    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [company, setCompany] = useState(DEFAULT_COMPANY);
    const [bank, setBank] = useState({});
    const [payments, setPayments] = useState([]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer', reference: '', notes: '' });
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [busyExporting, setBusyExporting] = useState(false);

    async function loadInvoice() {
        try {
            const inv = await api.getInvoice(id);
            setInvoice(inv);
        } catch {
            toast('Failed to load invoice', 'error');
            navigate('/invoices');
        }
    }

    async function loadPayments() {
        try {
            const p = await api.getPayments({ invoice_id: id });
            setPayments(p);
        } catch { /* ignore */ }
    }

    useEffect(() => {
        Promise.all([
            loadInvoice(),
            loadPayments(),
            api.getSettings().then((s) => {
                if (s.company) setCompany({ ...DEFAULT_COMPANY, ...s.company });
                if (s.bank) setBank(s.bank);
            }).catch(() => { }),
        ]).finally(() => setLoading(false));
    }, [id]);

    const handleStatusChange = async (newStatus) => {
        setActionLoading(true);
        try {
            await api.updateInvoiceStatus(id, newStatus);
            setInvoice((prev) => ({ ...prev, status: newStatus }));
            toast(`Invoice marked as ${newStatus}`);
            setCancelConfirm(false);
        } catch (err) {
            toast(err.message || 'Failed to update status', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePrint = async () => {
        if (!invoice) return;
        try {
            const blob = await api.printInvoicePdf(id);
            const url = window.URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.addEventListener('load', () => {
                    printWindow.print();
                });
            }
        } catch (err) {
            toast(err.message || 'Failed to generate print PDF', 'error');
        }
    };

    const handleDownloadPdf = async () => {
        if (!invoice || pdfLoading) return;
        setPdfLoading(true);
        try {
            const blob = await api.downloadInvoicePdf(id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Invoice-${invoice.invoice_number || 'draft'}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast('PDF downloaded');
        } catch (err) {
            toast(err.message || 'Failed to download PDF', 'error');
        } finally {
            setPdfLoading(false);
        }
    };

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
            toast('Enter a valid amount', 'error');
            return;
        }
        setPaymentLoading(true);
        try {
            await api.createPayment({
                client_id: invoice.client_id,
                invoice_id: id,
                amount: parseFloat(paymentForm.amount),
                date: paymentForm.date,
                method: paymentForm.method,
                reference: paymentForm.reference,
                notes: paymentForm.notes,
            });
            toast('Payment recorded successfully');
            setShowPaymentModal(false);
            setPaymentForm({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer', reference: '', notes: '' });
            await Promise.all([loadInvoice(), loadPayments()]);
        } catch (err) {
            toast(err.message || 'Failed to record payment', 'error');
        } finally {
            setPaymentLoading(false);
        }
    };

    const handleExportBusy = async () => {
        if (busyExporting) return;
        setBusyExporting(true);
        try {
            const result = await api.exportToBusy(id);
            toast(`Exported to BUSY: ${result.referenceNo}`);
            setInvoice(prev => ({ ...prev, busySynced: true, busySyncDate: new Date().toISOString(), busyReferenceNo: result.referenceNo }));
        } catch (err) {
            toast(err.message || 'Export to BUSY failed', 'error');
        } finally {
            setBusyExporting(false);
        }
    };

    const handleDownloadBusyXml = async () => {
        try {
            const blob = await api.downloadBusyXml(id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `INV_${invoice.invoice_number || 'draft'}.xml`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast('XML downloaded');
        } catch (err) {
            toast(err.message || 'Failed to download XML', 'error');
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading invoice...</div>;
    if (!invoice) return null;

    const items = invoice.items || [];
    const taxType = invoice.tax_type || 'IGST';
    const subtotal = invoice.subtotal || 0;
    const taxableAmount = invoice.taxable_amount || 0;
    const grandTotal = invoice.grand_total || 0;
    const roundOff = Math.round(grandTotal) - grandTotal;

    return (
        <div className="view-invoice">
            {/* Top Bar */}
            <div className="view-invoice__topbar">
                <div className="view-invoice__topbar-left">
                    <button className="view-invoice__back" onClick={() => navigate('/invoices')}>
                        <ArrowLeft size={18} /> Back
                    </button>
                    <div className="view-invoice__topbar-info">
                        <h1>{invoice.invoice_number}</h1>
                        <StatusBadge status={invoice.status} />
                    </div>
                </div>
                <div className="view-invoice__topbar-actions">
                    <button className="view-invoice__action-btn" onClick={() => navigate(`/invoices/${id}/edit`)}>
                        <Pencil size={16} /> Edit
                    </button>
                    <button className="view-invoice__action-btn" onClick={() => { setPaymentForm((f) => ({ ...f, amount: invoice.balance || '' })); setShowPaymentModal(true); }} disabled={invoice.status === 'Paid' || invoice.status === 'Cancelled'}>
                        <CreditCard size={16} /> Record Payment
                    </button>
                    <button className="view-invoice__action-btn" onClick={handlePrint}>
                        <Printer size={16} /> Print
                    </button>
                    <button className="view-invoice__action-btn view-invoice__action-btn--primary" onClick={handleDownloadPdf} disabled={pdfLoading}>
                        <Download size={16} /> {pdfLoading ? 'Generating...' : 'Download PDF'}
                    </button>
                    <button className="view-invoice__action-btn" onClick={handleExportBusy} disabled={busyExporting}>
                        <FileUp size={16} /> {busyExporting ? 'Exporting...' : 'Export to BUSY'}
                    </button>
                    {invoice.busySynced && (
                        <button className="view-invoice__action-btn" onClick={handleDownloadBusyXml}>
                            <Download size={16} /> XML
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            {invoice.status !== 'Cancelled' && (
                <div className="view-invoice__quick-actions">
                    <span>Quick Actions:</span>
                    {invoice.status === 'Draft' && (
                        <button className="view-invoice__sent-btn" onClick={() => handleStatusChange('Sent')} disabled={actionLoading}>
                            <Check size={14} /> Mark as Sent
                        </button>
                    )}
                    <button className="view-invoice__cancel-btn" onClick={() => setCancelConfirm(true)}>
                        <X size={14} /> Cancel Invoice
                    </button>
                </div>
            )}

            {/* BUSY Sync Status */}
            {(invoice.busySynced || invoice.busySyncError) && (
                <div className={`view-invoice__busy-status ${invoice.busySynced ? 'view-invoice__busy-status--synced' : 'view-invoice__busy-status--failed'}`}>
                    <FileUp size={16} />
                    <div className="view-invoice__busy-info">
                        <strong>{invoice.busySynced ? 'Exported to BUSY' : 'BUSY Export Failed'}</strong>
                        {invoice.busySyncDate && <span>Synced: {new Date(invoice.busySyncDate).toLocaleString('en-IN')}</span>}
                        {invoice.busyReferenceNo && <span>Ref: {invoice.busyReferenceNo}</span>}
                        {invoice.busySyncError && <span className="view-invoice__busy-error">{invoice.busySyncError}</span>}
                    </div>
                    {invoice.busySynced && (
                        <button className="view-invoice__busy-download" onClick={handleDownloadBusyXml}>
                            <Download size={14} /> Download XML
                        </button>
                    )}
                    {invoice.busySyncError && (
                        <button className="view-invoice__busy-retry" onClick={handleExportBusy} disabled={busyExporting}>
                            <FileUp size={14} /> Retry
                        </button>
                    )}
                </div>
            )}

            {/* Invoice Document */}
            <div className="view-invoice__document" ref={invoiceRef}>
                <div className="view-invoice__doc-accent" />

                {/* Header */}
                <div className="view-invoice__doc-header">
                    <div className="view-invoice__doc-company">
                        {company.logo ? (
                            <img src={company.logo} alt="Logo" className="view-invoice__doc-logo-img" />
                        ) : (
                            <>
                                <div className="view-invoice__doc-logo">B</div>
                                <div className="view-invoice__doc-company-text">
                                    <strong>BLACKCOFFEE</strong>
                                    <small>COMMUNICATION <em>agency</em></small>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="view-invoice__doc-type">
                        <h2 className="view-invoice__doc-type-label">{invoice.type === 'proforma' ? 'PROFORMA INVOICE' : 'TAX INVOICE'}</h2>
                        <span className="view-invoice__doc-copy">Original Copy</span>
                        <div className="view-invoice__doc-meta-boxes">
                            <div className="view-invoice__doc-meta-box">
                                <span>INVOICE NO.</span>
                                <strong>{invoice.invoice_number}</strong>
                            </div>
                            <div className="view-invoice__doc-meta-box">
                                <span>DATE</span>
                                <strong>{formatDate(invoice.invoice_date)}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                {/* GSTIN */}
                <div className="view-invoice__doc-gstin">
                    <strong>GSTIN:</strong> {company.gstin}
                </div>

                {/* Bill To + Supply Details */}
                <div className="view-invoice__doc-parties">
                    <div className="view-invoice__doc-party">
                        <div className="view-invoice__doc-party-body">
                            <h4>M/S {invoice.client_name}</h4>
                            {invoice.client_address && <p>{invoice.client_address}</p>}
                            {invoice.client_city && <p>{invoice.client_city}{invoice.client_state ? `, ${invoice.client_state}` : ''}{invoice.client_pincode ? ` - ${invoice.client_pincode}` : ''}</p>}
                            {invoice.client_gstin && <p>GSTIN: {invoice.client_gstin}</p>}
                            {invoice.client_phone && <p>Phone: {invoice.client_phone}</p>}
                        </div>
                    </div>
                    <div className="view-invoice__doc-party">
                        <div className="view-invoice__doc-party-body view-invoice__doc-transport">
                            <div><strong>Place of Supply:</strong> <span>{formatPlaceOfSupply(invoice.place_of_supply)}</span></div>
                            <div><strong>Reverse Charge:</strong> <span>No</span></div>
                            <div><strong>Transport:</strong> <span>{invoice.transport || '-'}</span></div>
                            <div><strong>Vehicle No.:</strong> <span>{invoice.vehicle_no || '-'}</span></div>
                            <div><strong>GR/RR No.:</strong> <span>{invoice.gr_rr_no || '-'}</span></div>
                            <div><strong>E-Way Bill:</strong> <span>{invoice.eway_bill || '-'}</span></div>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="view-invoice__doc-items">
                    <table>
                        <thead>
                            <tr>
                                <th className="text-center">Sr.<br />No.</th>
                                <th>Description</th>
                                <th className="text-center">HSN/SAC<br />Code</th>
                                <th className="text-center">Qty</th>
                                <th className="text-right">Rate</th>
                                <th className="text-right">Taxable</th>
                                <th className="text-center">GST</th>
                                <th className="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, i) => {
                                const qty = parseFloat(item.qty) || 0;
                                const rate = parseFloat(item.rate) || 0;
                                const discPct = parseFloat(item.discount_pct) || 0;
                                const taxPct = parseFloat(item.tax_pct) || 0;
                                const lineTotal = qty * rate;
                                const afterDiscount = lineTotal - lineTotal * (discPct / 100);
                                return (
                                    <tr key={item.id || i}>
                                        <td className="text-center">{i + 1}</td>
                                        <td className="font-medium">{item.product_name || item.description}</td>
                                        <td className="text-center">{item.hsn || '-'}</td>
                                        <td className="text-center">{qty}</td>
                                        <td className="text-right">{formatCurrency(rate)}</td>
                                        <td className="text-right">{formatCurrency(afterDiscount)}</td>
                                        <td className="text-center">{taxPct}%</td>
                                        <td className="text-right">{formatCurrency(item.amount)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Bottom Section */}
                <div className="view-invoice__doc-bottom">
                    <div className="view-invoice__doc-bottom-left">
                        {/* Amount in Words */}
                        <div className="view-invoice__doc-words">
                            <span>AMOUNT IN WORDS</span>
                            <strong>{numberToWords(Math.round(grandTotal))}</strong>
                        </div>

                        {/* Payment Terms */}
                        {invoice.terms && (
                            <div className="view-invoice__doc-terms">
                                <strong>Payment Terms</strong>
                                <p>{invoice.terms}</p>
                            </div>
                        )}

                        {/* Bank Details */}
                        <div className="view-invoice__doc-bank">
                            <strong>BANK DETAILS</strong>
                            <p><strong>{company.name}</strong></p>
                            {bank.bank && <p>Bank: {bank.bank}</p>}
                            {bank.accountNo && <p>A/C No: {bank.accountNo}</p>}
                            {bank.ifsc && <p>IFSC: {bank.ifsc}</p>}
                            {bank.upi && <p>UPI: {bank.upi}</p>}
                        </div>
                    </div>

                    <div className="view-invoice__doc-bottom-right">
                        <div className="view-invoice__doc-summary">
                            <div className="view-invoice__doc-summary-row">
                                <span>Subtotal</span>
                                <strong><span className="view-invoice__bullet">&#9632;</span> {formatCurrency(subtotal)}</strong>
                            </div>
                            {taxType === 'IGST' ? (
                                <div className="view-invoice__doc-summary-row">
                                    <span>IGST ({items[0]?.tax_pct || 18}%)</span>
                                    <strong><span className="view-invoice__bullet">&#9632;</span> {formatCurrency(taxableAmount)}</strong>
                                </div>
                            ) : (
                                <>
                                    <div className="view-invoice__doc-summary-row">
                                        <span>CGST ({(items[0]?.tax_pct || 18) / 2}%)</span>
                                        <strong><span className="view-invoice__bullet">&#9632;</span> {formatCurrency(taxableAmount / 2)}</strong>
                                    </div>
                                    <div className="view-invoice__doc-summary-row">
                                        <span>SGST ({(items[0]?.tax_pct || 18) / 2}%)</span>
                                        <strong><span className="view-invoice__bullet">&#9632;</span> {formatCurrency(taxableAmount / 2)}</strong>
                                    </div>
                                </>
                            )}
                            {roundOff !== 0 && (
                                <div className="view-invoice__doc-summary-row">
                                    <span>Round Off</span>
                                    <strong>{formatCurrency(roundOff)}</strong>
                                </div>
                            )}
                            <div className="view-invoice__doc-grand-total">
                                <span>GRAND TOTAL</span>
                                <strong><span className="view-invoice__bullet">&#9632;</span> {formatCurrency(Math.round(grandTotal))}</strong>
                            </div>
                            {(invoice.amount_paid > 0) && (
                                <div className="view-invoice__doc-summary-row view-invoice__doc-summary-row--paid">
                                    <span>Amount Paid</span>
                                    <strong className="text-success">{formatCurrency(invoice.amount_paid)}</strong>
                                </div>
                            )}
                            {(invoice.balance > 0 && invoice.amount_paid > 0) && (
                                <div className="view-invoice__doc-summary-row view-invoice__doc-summary-row--balance">
                                    <span>Balance Due</span>
                                    <strong className="balance-red">{formatCurrency(invoice.balance)}</strong>
                                </div>
                            )}
                        </div>
                        <div className="view-invoice__doc-signatory">
                            <p>For {company.name}</p>
                            <span>Authorised Signatory</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="view-invoice__doc-footer">
                    Registered Office: {buildCompanyAddress(company)} | m: {company.phone} | e: {company.email}
                </div>
            </div>

            {/* Payment History */}
            {payments.length > 0 && (
                <div className="view-invoice__payments">
                    <h3>Payment History</h3>
                    <table className="dashboard__table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Method</th>
                                <th>Reference</th>
                                <th className="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((p) => (
                                <tr key={p.id || p._id}>
                                    <td>{p.date}</td>
                                    <td>{p.method}</td>
                                    <td className="mono">{p.reference || '-'}</td>
                                    <td className="text-right text-success font-medium">{formatCurrency(p.amount)}</td>
                                </tr>
                            ))}
                            <tr className="view-invoice__payments-total">
                                <td colSpan={3}><strong>Total Paid</strong></td>
                                <td className="text-right"><strong>{formatCurrency(invoice.amount_paid)}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Record Payment Modal */}
            <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment">
                <form onSubmit={handleRecordPayment}>
                    <div className="view-invoice__payment-info">
                        <div><span>Invoice:</span> <strong>{invoice.invoice_number}</strong></div>
                        <div><span>Grand Total:</span> <strong>{formatCurrency(grandTotal)}</strong></div>
                        <div><span>Already Paid:</span> <strong className="text-success">{formatCurrency(invoice.amount_paid)}</strong></div>
                        <div><span>Balance Due:</span> <strong className="balance-red">{formatCurrency(invoice.balance)}</strong></div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Amount *</label>
                            <input type="number" step="0.01" min="0.01" max={invoice.balance} placeholder="0.00" className="form-group__input" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Date *</label>
                            <input type="date" className="form-group__input" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} required />
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Payment Method</label>
                            <select className="form-group__input" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                                <option>Bank Transfer</option>
                                <option>Cash</option>
                                <option>UPI</option>
                                <option>Cheque</option>
                                <option>Card</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Reference / Transaction ID</label>
                            <input type="text" placeholder="e.g. TXN123456" className="form-group__input" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Notes</label>
                        <textarea rows={2} placeholder="Optional notes" className="form-group__textarea" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={paymentLoading}>
                            {paymentLoading ? 'Recording...' : 'Record Payment'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                isOpen={cancelConfirm}
                title="Cancel Invoice"
                message={`Are you sure you want to cancel invoice ${invoice.invoice_number}?`}
                confirmLabel="Cancel Invoice"
                onConfirm={() => handleStatusChange('Cancelled')}
                onCancel={() => setCancelConfirm(false)}
                loading={actionLoading}
            />
        </div>
    );
}
