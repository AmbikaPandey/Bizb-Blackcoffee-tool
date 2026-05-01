import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2, FileText, Copy, Download, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { formatCurrency } from '../utils/currency';

export default function Quotes() {
    const { user, isAdmin } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [deleteId, setDeleteId] = useState(null);
    const [convertId, setConvertId] = useState(null);

    const canCreate = ['Super Admin', 'Admin', 'Sales Manager'].includes(user?.role);

    const load = useCallback(async () => {
        try {
            const params = {};
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            setQuotes(await api.getQuotes(params));
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async () => {
        try {
            await api.deleteQuote(deleteId);
            showToast('Quote deleted');
            setDeleteId(null);
            load();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleRevise = async (id) => {
        try {
            const result = await api.reviseQuote(id);
            showToast(`Revision ${result.revision} created`);
            load();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleConvert = async () => {
        try {
            const result = await api.convertQuoteToInvoice(convertId);
            showToast(`Converted to proforma invoice ${result.invoice_number}`);
            setConvertId(null);
            load();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleDownloadPdf = async (id, quoteNumber) => {
        try {
            const blob = await api.downloadQuotePdf(id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${quoteNumber}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    if (loading) return <div className="page-loader">Loading...</div>;

    return (
        <div className="page quotes-page">
            <PageHeader
                title="Client Quotes"
                subtitle={`${quotes.length} quote${quotes.length !== 1 ? 's' : ''}`}
                actions={canCreate ? [{ label: 'New Quote', icon: Plus, onClick: () => navigate('/quotes/new') }] : []}
            />

            <div className="page__filters">
                <div className="search-bar">
                    <Search size={16} />
                    <input type="text" placeholder="Search quotes..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Revised">Revised</option>
                    <option value="Converted">Converted</option>
                </select>
            </div>

            <div className="page__table-wrap">
                <table className="page__table">
                    <thead>
                        <tr>
                            <th>Quote #</th>
                            <th>Rev</th>
                            <th>Title</th>
                            <th>Client</th>
                            <th>Status</th>
                            <th className="text-right">Total</th>
                            <th>From Costing</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quotes.length === 0 ? (
                            <tr><td colSpan={8} className="text-center">No quotes found</td></tr>
                        ) : quotes.map(q => (
                            <tr key={q.id || q._id}>
                                <td className="font-mono">{q.quote_number}</td>
                                <td className="text-center">{q.revision > 1 ? `R${q.revision}` : '-'}</td>
                                <td>{q.title}</td>
                                <td>{q.client_name}</td>
                                <td><StatusBadge status={q.status} /></td>
                                <td className="text-right font-bold">{formatCurrency(q.grand_total)}</td>
                                <td className="font-mono">{q.costing_number || '-'}</td>
                                <td>
                                    <div className="action-btns">
                                        <button className="btn-icon" title="View" onClick={() => navigate(`/quotes/${q.id || q._id}`)}>
                                            <Eye size={14} />
                                        </button>
                                        <button className="btn-icon" title="Download PDF" onClick={() => handleDownloadPdf(q.id || q._id, q.quote_number)}>
                                            <Download size={14} />
                                        </button>
                                        {canCreate && !['Converted', 'Revised'].includes(q.status) && (
                                            <button className="btn-icon" title="Create Revision" onClick={() => handleRevise(q.id || q._id)}>
                                                <Copy size={14} />
                                            </button>
                                        )}
                                        {canCreate && ['Draft', 'Sent', 'Accepted'].includes(q.status) && (
                                            <button className="btn-icon btn-icon--success" title="Convert to Proforma" onClick={() => setConvertId(q.id || q._id)}>
                                                <ArrowRight size={14} />
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button className="btn-icon btn-icon--danger" title="Delete" onClick={() => setDeleteId(q.id || q._id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog
                open={!!deleteId}
                title="Delete Quote"
                message="Are you sure? This cannot be undone."
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
            />

            <ConfirmDialog
                open={!!convertId}
                title="Convert to Proforma Invoice"
                message="This will create a proforma invoice and mark the quote as converted. Continue?"
                onConfirm={handleConvert}
                onCancel={() => setConvertId(null)}
            />
        </div>
    );
}
