import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Copy, ArrowRight, FileText } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import StatusBadge from '../components/common/StatusBadge';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { formatCurrency } from '../utils/currency';

export default function ViewQuote() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [convertOpen, setConvertOpen] = useState(false);

    const canManage = ['Super Admin', 'Admin', 'Sales Manager'].includes(user?.role);

    useEffect(() => {
        api.getQuote(id).then(setQuote).catch(err => showToast(err.message, 'error')).finally(() => setLoading(false));
    }, [id]);

    const handleDownload = async () => {
        try {
            const blob = await api.downloadQuotePdf(id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${quote.quote_number}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleRevise = async () => {
        try {
            const result = await api.reviseQuote(id);
            showToast(`Revision ${result.revision} created`);
            navigate(`/quotes/${result.id || result._id}`);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleConvert = async () => {
        try {
            const result = await api.convertQuoteToInvoice(id);
            showToast(`Converted to proforma invoice ${result.invoice_number}`);
            setConvertOpen(false);
            navigate(`/invoices/${result.id}`);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleStatusChange = async (status) => {
        try {
            await api.updateQuote(id, { status });
            setQuote(prev => ({ ...prev, status }));
            showToast(`Quote marked as ${status}`);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    if (loading) return <div className="page-loader">Loading...</div>;
    if (!quote) return <div className="page">Quote not found</div>;

    const client = quote.client_id || {};

    return (
        <div className="page view-quote-page">
            <div className="page__header">
                <button className="btn btn--ghost" onClick={() => navigate('/quotes')}><ArrowLeft size={16} /> Back</button>
                <div className="page__header-actions">
                    <button className="btn btn--ghost" onClick={handleDownload}><Download size={16} /> PDF</button>
                    {canManage && !['Converted', 'Revised'].includes(quote.status) && (
                        <button className="btn btn--ghost" onClick={handleRevise}><Copy size={16} /> Revise</button>
                    )}
                    {canManage && ['Draft', 'Sent', 'Accepted'].includes(quote.status) && (
                        <button className="btn btn--primary" onClick={() => setConvertOpen(true)}>
                            <ArrowRight size={16} /> Convert to Proforma
                        </button>
                    )}
                </div>
            </div>

            <div className="quote-detail">
                <div className="quote-detail__top">
                    <div>
                        <h2>{quote.quote_number}</h2>
                        <p className="text-muted">{quote.title}</p>
                        {quote.revision > 1 && <span className="badge">Revision {quote.revision}</span>}
                    </div>
                    <div className="text-right">
                        <StatusBadge status={quote.status} />
                        {canManage && quote.status === 'Draft' && (
                            <div className="mt-2">
                                <button className="btn btn--sm btn--ghost" onClick={() => handleStatusChange('Sent')}>Mark Sent</button>
                            </div>
                        )}
                        {canManage && quote.status === 'Sent' && (
                            <div className="mt-2">
                                <button className="btn btn--sm btn--success mr-1" onClick={() => handleStatusChange('Accepted')}>Accept</button>
                                <button className="btn btn--sm btn--danger" onClick={() => handleStatusChange('Rejected')}>Reject</button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="quote-detail__info">
                    <div>
                        <h4>Quote For</h4>
                        <p className="font-bold">{client.name || quote.client_name}</p>
                        <p className="text-muted">{[client.city, client.state].filter(Boolean).join(', ')}</p>
                        {client.gstin && <p className="text-muted">GSTIN: {client.gstin}</p>}
                    </div>
                    <div>
                        {quote.valid_until && <p><strong>Valid Until:</strong> {new Date(quote.valid_until).toLocaleDateString()}</p>}
                        {quote.costing_number && <p><strong>From Costing:</strong> {quote.costing_number}</p>}
                        {quote.converted_to_invoice_number && <p><strong>Invoice:</strong> {quote.converted_to_invoice_number}</p>}
                    </div>
                </div>

                {/* Items */}
                <table className="page__table mt-3">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Description</th>
                            <th>HSN</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Rate</th>
                            <th className="text-right">GST %</th>
                            <th className="text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(quote.items || []).map((item, idx) => (
                            <tr key={item._id || idx}>
                                <td>{idx + 1}</td>
                                <td>{item.description}</td>
                                <td>{item.hsn || '-'}</td>
                                <td className="text-right">{item.qty} {item.unit}</td>
                                <td className="text-right">{formatCurrency(item.rate)}</td>
                                <td className="text-right">{item.gst_pct}%</td>
                                <td className="text-right font-bold">{formatCurrency(item.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="quote-detail__summary">
                    <div className="summary-row"><span>Subtotal</span><span>{formatCurrency(quote.subtotal)}</span></div>
                    {quote.agency_service_charge > 0 && (
                        <div className="summary-row"><span>Agency Service Charge ({quote.agency_service_charge_pct}%)</span><span>{formatCurrency(quote.agency_service_charge)}</span></div>
                    )}
                    <div className="summary-row"><span>Tax</span><span>{formatCurrency(quote.tax_amount)}</span></div>
                    <div className="summary-row summary-row--total"><span>Grand Total</span><span>{formatCurrency(quote.grand_total)}</span></div>
                </div>

                {/* Revision History */}
                {quote.revisions?.length > 1 && (
                    <div className="mt-3">
                        <h4>Revision History</h4>
                        <div className="revision-list">
                            {quote.revisions.map(r => (
                                <div key={r.id} className={`revision-item ${String(r.id) === String(id) ? 'revision-item--active' : ''}`}
                                    onClick={() => navigate(`/quotes/${r.id}`)}>
                                    <span className="font-mono">{r.number}</span>
                                    <StatusBadge status={r.status} />
                                    <span className="text-muted">{new Date(r.date).toLocaleDateString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {quote.terms && (
                    <div className="mt-3">
                        <h4>Terms & Conditions</h4>
                        <pre className="text-muted" style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{quote.terms}</pre>
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={convertOpen}
                title="Convert to Proforma Invoice"
                message="This will create a proforma invoice from this quote. Continue?"
                onConfirm={handleConvert}
                onCancel={() => setConvertOpen(false)}
            />
        </div>
    );
}
