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

function formatShortDate(d) {
    if (!d) return '';
    const date = new Date(d);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${(date.getFullYear() % 100).toString().padStart(2, '0')}`;
}

function fmtNum(n) {
    return Number(n || 0).toLocaleString('en-IN');
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

    if (loading) return <div className="page-loading">Loading invoice...</div>;
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
                {/* Header */}
                <div className="view-invoice__doc-header">
                    <div className="view-invoice__doc-company">
                        {company.logo ? (
                            <img src={company.logo} alt="Logo" className="view-invoice__doc-logo-img" />
                        ) : (
                            <>
                                <div className="view-invoice__doc-logo">
                                    <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
                                        <rect width="40" height="40" rx="8" fill="#E53935" />
                                        <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="bold" fontFamily="Arial, sans-serif">B</text>
                                    </svg>
                                </div>
                                <div className="view-invoice__doc-company-text">
                                    <strong>{company.name || 'Company Name'}</strong>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* GSTIN + INVOICE Title Row */}
                <div className="view-invoice__doc-title-row">
                    <span className="view-invoice__doc-gstin-text">GSTIN: {company.gstin}</span>
                    <h2 className="view-invoice__doc-title">{invoice.type === 'proforma' ? 'PROFORMA INVOICE' : 'INVOICE'}</h2>
                    <span className="view-invoice__doc-original">Original Copy</span>
                </div>

                {/* Bill To + Invoice Details */}
                <div className="view-invoice__doc-details">
                    <div className="view-invoice__doc-billto">
                        <div className="view-invoice__doc-billto-label">BILL TO</div>
                        <div className="view-invoice__doc-billto-body">
                            <h4>{invoice.client_name || 'COMPANY NAME'}</h4>
                            <p>{invoice.client_address || 'Address Line 1'}</p>
                            {invoice.client_city && <p>{invoice.client_city}{invoice.client_state ? `, ${invoice.client_state}` : ''}</p>}
                            <p>{invoice.client_state || 'State'} - {invoice.client_pincode || 'Pincode'}</p>
                            <br />
                            <p className='highlight'>GSTIN: {invoice.client_gstin || ''}</p>
                            <p>Contact Person: {invoice.contact_person?.name || invoice.client_contact || ''}</p>
                            {invoice.contact_person?.phone && <p>Phone: {invoice.contact_person.phone}</p>}
                        </div>
                    </div>
                    <div className="view-invoice__doc-info-panel">
                        <div className="view-invoice__doc-info-col">
                            <div className="view-invoice__doc-info-row">
                                <span className="view-invoice__doc-info-label">{invoice.type === 'proforma' ? 'PI No.' : 'Invoice No.'}</span>
                                <span className="view-invoice__doc-info-sep">:</span>
                                <strong>{invoice.invoice_number}</strong>
                            </div>
                            <div className="view-invoice__doc-info-row">
                                <span className="view-invoice__doc-info-label">Dated</span>
                                <span className="view-invoice__doc-info-sep">:</span>
                                <strong>{formatShortDate(invoice.invoice_date)}</strong>
                            </div>
                            <div className="view-invoice__doc-info-row">
                                <span className="view-invoice__doc-info-label">P.O. No.</span>
                                <span className="view-invoice__doc-info-sep">:</span>
                                <strong>{invoice.po_number || ''}</strong>
                            </div>
                            <div className="view-invoice__doc-info-row">
                                <span className="view-invoice__doc-info-label">P.O. Date</span>
                                <span className="view-invoice__doc-info-sep">:</span>
                                <strong>{invoice.po_date ? formatShortDate(invoice.po_date) : ''}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="view-invoice__doc-items">
                    <table>
                        <thead>
                            <tr>
                                <th className="text-center col-sr">Sr.No.</th>
                                <th className="col-desc">Description</th>
                                <th className="text-center col-hsn">HSN/SAC</th>
                                <th className="text-center col-qty">Qty</th>
                                <th className="text-right col-rate">Rate</th>
                                <th className="text-right col-igst">IGST</th>
                                <th className="text-right col-amt">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, i) => {
                                const qty = parseFloat(item.qty) || 0;
                                const rate = parseFloat(item.rate) || 0;
                                const taxPct = parseFloat(item.tax_pct) || 0;
                                const taxAmt = (qty * rate * taxPct) / 100;
                                return (
                                    <tr key={item.id || i}>
                                        <td className="text-center">{i + 1}</td>
                                        <td>
                                            <span className="item-name">{item.product_name || item.description}</span>
                                            {item.product_name && item.description && (
                                                <span className="item-desc">{item.description}</span>
                                            )}
                                        </td>
                                        <td className="text-center">{item.hsn || '-'}</td>
                                        <td className="text-center">{qty}</td>
                                        <td className="text-right">{fmtNum(rate)}</td>
                                        <td className="text-right">{fmtNum(taxAmt)}</td>
                                        <td className="text-right">{fmtNum(item.amount)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mid Section: Note + Tax Table | Subtotal + Total */}
                <div className="view-invoice__doc-mid">
                    <div className="view-invoice__doc-mid-left">
                        {invoice.notes && (
                            <div className="view-invoice__doc-note">
                                <strong>Note:</strong> {invoice.notes}
                            </div>
                        )}
                        <table className="view-invoice__doc-tax-table">
                            <thead>
                                <tr>
                                    <th>Tax<br />Rate</th>
                                    <th>Taxable<br />Amount</th>
                                    <th>{taxType === 'IGST' ? 'IGST' : 'CGST'}<br />@ {items[0]?.tax_pct || 18}%</th>
                                    <th>Total<br />Tax</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>{items[0]?.tax_pct || 18}%</td>
                                    <td>{subtotal.toFixed(2)}</td>
                                    <td>{taxableAmount.toFixed(2)}</td>
                                    <td>{taxableAmount.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="view-invoice__doc-mid-right">
                        <div className="view-invoice__doc-summary">
                            <div className="view-invoice__doc-summary-row">
                                <span>Subtotal</span>
                                <strong>{fmtNum(subtotal)}</strong>
                            </div>
                            {taxType === 'IGST' ? (
                                <div className="view-invoice__doc-summary-row">
                                    <span>IGST @{items[0]?.tax_pct || 18}%</span>
                                    <strong>{fmtNum(taxableAmount)}</strong>
                                </div>
                            ) : (
                                <>
                                    <div className="view-invoice__doc-summary-row">
                                        <span>CGST @{(items[0]?.tax_pct || 18) / 2}%</span>
                                        <strong>{fmtNum(taxableAmount / 2)}</strong>
                                    </div>
                                    <div className="view-invoice__doc-summary-row">
                                        <span>SGST @{(items[0]?.tax_pct || 18) / 2}%</span>
                                        <strong>{fmtNum(taxableAmount / 2)}</strong>
                                    </div>
                                </>
                            )}
                            {roundOff !== 0 && (
                                <div className="view-invoice__doc-summary-row">
                                    <span>Round Off</span>
                                    <strong>{fmtNum(roundOff)}</strong>
                                </div>
                            )}
                            <div className="view-invoice__doc-total-row">
                                <span>TOTAL</span>
                                <strong>{fmtNum(Math.round(grandTotal))}</strong>
                            </div>
                            {(invoice.amount_paid > 0) && (
                                <div className="view-invoice__doc-summary-row view-invoice__doc-summary-row--paid">
                                    <span>Amount Paid</span>
                                    <strong className="text-success">-{fmtNum(invoice.amount_paid)}</strong>
                                </div>
                            )}
                            {(invoice.balance > 0 && invoice.amount_paid > 0) && (
                                <div className="view-invoice__doc-summary-row view-invoice__doc-summary-row--balance">
                                    <span>Balance Due</span>
                                    <strong className="balance-red">{fmtNum(invoice.balance)}</strong>
                                </div>
                            )}
                        </div>
                        <div className="view-invoice__doc-words">
                            {numberToWords(Math.round(grandTotal)).replace('Rupees ', '')}<br />Rupees Only
                        </div>
                    </div>
                </div>

                {/* Bank Details + Signatory */}
                <div className="view-invoice__doc-bank-sign">
                    <div className="view-invoice__doc-bank">
                        <span className="view-invoice__doc-bank-heading">Bank Details:</span>
                        <p className="view-invoice__doc-bank-name">{company.name}</p>
                        {bank.accountNo && <p>A/c No.: {bank.accountNo}</p>}
                        {bank.ifsc && <p>IFSC: {bank.ifsc}</p>}
                        {bank.bank && <p>{bank.bank}</p>}
                        {bank.upi && <p>UPI: {bank.upi}</p>}
                    </div>
                    <div className="view-invoice__doc-signatory">
                        <p className="view-invoice__doc-sign-for">For <strong>{company.name}</strong></p>
                        {(company.signature || true) && (
                            <img
                                src={company.signature || '/signature.png'}
                                alt="Digital Signature"
                                className="view-invoice__doc-sign-img"
                            />
                        )}
                        <p className="view-invoice__doc-sign-label">Authorised Signatory</p>
                    </div>
                </div>

                {/* Payment Terms */}
                {invoice.terms && (
                    <div className="view-invoice__doc-terms">
                        <strong>Payment Terms:</strong>
                        {invoice.terms.split('\n').map((line, i) => (
                            <p key={i}>{line}</p>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className="view-invoice__doc-footer">
                    <div className="view-invoice__doc-footer-item">
                        <span className="view-invoice__doc-footer-icon">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="#E53935"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" /></svg>
                        </span>
                        <span><strong>Registered Office:</strong><br />{buildCompanyAddress(company)}</span>
                    </div>
                    <div className="view-invoice__doc-footer-item">
                        <span className="view-invoice__doc-footer-icon">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="#E53935"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z" /></svg>
                        </span>
                        <span>{company.phone}</span>
                    </div>
                    <div className="view-invoice__doc-footer-item">
                        <span className="view-invoice__doc-footer-icon">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="#E53935"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
                        </span>
                        <span>{company.email}</span>
                    </div>
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
