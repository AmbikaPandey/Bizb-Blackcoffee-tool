import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import FilterDropdown from '../components/common/FilterDropdown';
import StatusBadge from '../components/common/StatusBadge';
import InvoiceActions from '../components/common/InvoiceActions';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageLoader from '../components/common/PageLoader';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';

const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Invoices() {
    const navigate = useNavigate();
    const toast = useToast();
    const [invoices, setInvoices] = useState([]);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('tax');
    const [statusFilter, setStatusFilter] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [clients, setClients] = useState([]);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState(null);

    useEffect(() => {
        setLoading(true);
        api.getInvoices({ type: tab }).then(setInvoices).catch(() => { toast('Failed to load invoices', 'error'); setInvoices([]); }).finally(() => setLoading(false));
    }, [tab]);

    useEffect(() => {
        api.getClients().then(setClients).catch(() => { });
    }, []);

    const filtered = invoices.filter((inv) => {
        if (statusFilter && inv.status !== statusFilter) return false;
        if (clientFilter && inv.client_name !== clientFilter) return false;
        if (search && !inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) && !inv.client_name?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const clientNames = [...new Set(clients.map((c) => c.name))];

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.deleteInvoice(deleteTarget.id);
            setInvoices((prev) => prev.filter((inv) => inv.id !== deleteTarget.id));
            toast(`Invoice ${deleteTarget.invoice_number} deleted`);
        } catch (err) {
            toast(err.message || 'Failed to delete invoice', 'error');
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    const handleDownloadPdf = async (inv) => {
        if (downloadingId) return;
        setDownloadingId(inv.id);
        try {
            const blob = await api.downloadInvoicePdf(inv.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Invoice-${inv.invoice_number || 'draft'}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast('PDF downloaded');
        } catch (err) {
            toast(err.message || 'Failed to download PDF', 'error');
        } finally {
            setDownloadingId(null);
        }
    };

    if (loading) return <PageLoader />;

    return (
        <div>
            <PageHeader title="Invoices" subtitle="Manage tax and proforma invoices" buttonLabel="New Invoice" onButtonClick={() => navigate('/invoices/new')} />

            <div className="tabs">
                {['tax', 'proforma'].map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`tabs__btn ${tab === t ? 'tabs__btn--active' : ''}`}
                    >
                        {t === 'tax' ? 'Tax Invoices' : 'Proforma Invoices'}
                    </button>
                ))}
            </div>

            <div className="page-card">
                <div className="page-card__toolbar">
                    <SearchBar placeholder="Search by invoice number or client..." value={search} onChange={setSearch} />
                    <FilterDropdown label="All Status" options={['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled']} value={statusFilter} onChange={setStatusFilter} />
                    <FilterDropdown label="All Clients" options={clientNames} value={clientFilter} onChange={setClientFilter} />
                </div>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Client</th>
                                <th>Date</th>
                                <th>Due Date</th>
                                <th className="text-right">Amount</th>
                                <th className="text-right">Balance</th>
                                <th>Status</th>
                                <th style={{ width: 40 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                        No invoices found. Click "New Invoice" to create one.
                                    </td>
                                </tr>
                            ) : filtered.map((inv) => (
                                <tr key={inv.id}>
                                    <td className="font-medium">{inv.invoice_number}</td>
                                    <td className="truncate-cell">{inv.client_name}</td>
                                    <td>{formatDate(inv.invoice_date)}</td>
                                    <td>{formatDate(inv.due_date)}</td>
                                    <td className="text-right">{formatCurrency(inv.grand_total)}</td>
                                    <td className={`text-right font-medium ${inv.balance > 0 ? 'balance-red' : ''}`}>
                                        {formatCurrency(inv.balance ?? inv.grand_total)}
                                    </td>
                                    <td><StatusBadge status={inv.status} /></td>
                                    <td>
                                        <InvoiceActions
                                            onView={() => navigate(`/invoices/${inv.id}`)}
                                            onEdit={() => navigate(`/invoices/${inv.id}/edit`)}
                                            onDelete={() => setDeleteTarget(inv)}
                                            onDownload={() => handleDownloadPdf(inv)}
                                            disabled={downloadingId === inv.id}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Delete Invoice"
                message={`Are you sure you want to delete invoice ${deleteTarget?.invoice_number}? This action cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
                loading={deleting}
            />
        </div>
    );
}
