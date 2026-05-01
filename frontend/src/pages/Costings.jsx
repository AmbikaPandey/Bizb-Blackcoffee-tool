import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Edit2, Trash2, FileCheck, ChevronDown } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { formatCurrency } from '../utils/currency';

export default function Costings() {
    const { user, isAdmin } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [costings, setCostings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [deleteId, setDeleteId] = useState(null);

    const canSeeVendorCosts = ['Super Admin', 'Admin'].includes(user?.role);
    const canCreate = ['Super Admin', 'Admin', 'Sales Manager'].includes(user?.role);

    const load = useCallback(async () => {
        try {
            const params = {};
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            const data = await api.getCostings(params);
            setCostings(data);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async () => {
        try {
            await api.deleteCosting(deleteId);
            showToast('Costing deleted');
            setDeleteId(null);
            load();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleGenerateQuote = async (id) => {
        try {
            const result = await api.createQuoteFromCosting(id);
            showToast(`Quote ${result.quote_number || ''} generated!`, 'success');
            navigate('/quotes');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    if (loading) return <div className="page-loader">Loading...</div>;

    return (
        <div className="page costings-page">
            <PageHeader
                title="Internal Costings"
                subtitle={`${costings.length} costing${costings.length !== 1 ? 's' : ''}`}
                actions={canCreate ? [{ label: 'New Costing', icon: Plus, onClick: () => navigate('/costings/new') }] : []}
            />

            <div className="page__filters">
                <div className="search-bar">
                    <Search size={16} />
                    <input type="text" placeholder="Search costings..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="Draft">Draft</option>
                    <option value="Approved">Approved</option>
                    <option value="Quoted">Quoted</option>
                    <option value="Converted">Converted</option>
                </select>
            </div>

            <div className="page__table-wrap">
                <table className="page__table">
                    <thead>
                        <tr>
                            <th>Costing #</th>
                            <th>Title</th>
                            <th>Client</th>
                            <th>Status</th>
                            {canSeeVendorCosts && <th className="text-right">Vendor Cost</th>}
                            <th className="text-right">Selling Total</th>
                            {canSeeVendorCosts && <th className="text-right">Profit</th>}
                            {canSeeVendorCosts && <th className="text-right">Margin %</th>}
                            <th className="text-right">Grand Total</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {costings.length === 0 ? (
                            <tr><td colSpan={canSeeVendorCosts ? 10 : 6} className="text-center">No costings found</td></tr>
                        ) : costings.map(c => (
                            <tr key={c.id || c._id}>
                                <td className="font-mono">{c.costing_number}</td>
                                <td>{c.title}</td>
                                <td>{c.client_name}</td>
                                <td><StatusBadge status={c.status} /></td>
                                {canSeeVendorCosts && <td className="text-right">{formatCurrency(c.subtotal_vendor)}</td>}
                                <td className="text-right">{formatCurrency(c.subtotal_selling)}</td>
                                {canSeeVendorCosts && <td className="text-right text-success">{formatCurrency(c.total_profit)}</td>}
                                {canSeeVendorCosts && <td className="text-right">{c.profit_margin_pct?.toFixed(1)}%</td>}
                                <td className="text-right font-bold">{formatCurrency(c.grand_total)}</td>
                                <td>
                                    <div className="action-btns">
                                        {canCreate && c.status === 'Draft' && (
                                            <button className="btn-icon" title="Edit" onClick={() => navigate(`/costings/${c.id || c._id}/edit`)}>
                                                <Edit2 size={14} />
                                            </button>
                                        )}
                                        {canCreate && (c.status === 'Draft' || c.status === 'Approved') && (
                                            <button className="btn-icon btn-icon--success" title="Generate Quote" onClick={() => handleGenerateQuote(c.id || c._id)}>
                                                <FileCheck size={14} />
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button className="btn-icon btn-icon--danger" title="Delete" onClick={() => setDeleteId(c.id || c._id)}>
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
                title="Delete Costing"
                message="Are you sure? This cannot be undone."
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
}
