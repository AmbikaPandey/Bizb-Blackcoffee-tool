import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageLoader from '../components/common/PageLoader';
import ActionMenu from '../components/common/ActionMenu';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';

export default function Payments() {
    const toast = useToast();
    const [search, setSearch] = useState('');
    const [payments, setPayments] = useState([]);
    const [clients, setClients] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [form, setForm] = useState({ client_id: '', invoice_id: '', amount: '', date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer', reference: '', notes: '' });
    const [saving, setSaving] = useState(false);

    async function loadPayments() {
        try {
            const data = await api.getPayments();
            setPayments(data);
        } catch (err) { console.error(err); }
    }

    useEffect(() => {
        Promise.all([
            loadPayments(),
            api.getClients().then(setClients).catch(() => { }),
            api.getInvoices().then(setInvoices).catch(() => { }),
        ]).finally(() => setLoading(false));
    }, []);

    const clientInvoices = form.client_id
        ? invoices.filter((inv) => inv.client_id === form.client_id && inv.status !== 'Paid' && inv.status !== 'Cancelled')
        : [];

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.client_id || !form.amount || !form.date) {
            toast('Client, amount, and date are required', 'error');
            return;
        }
        setSaving(true);
        try {
            await api.createPayment({
                client_id: form.client_id,
                invoice_id: form.invoice_id || null,
                amount: parseFloat(form.amount),
                date: form.date,
                method: form.method,
                reference: form.reference,
                notes: form.notes,
            });
            toast('Payment recorded');
            setShowModal(false);
            setForm({ client_id: '', invoice_id: '', amount: '', date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer', reference: '', notes: '' });
            await loadPayments();
        } catch (err) {
            toast(err.message || 'Failed to record payment', 'error');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!deleteConfirm) return;
        try {
            await api.deletePayment(deleteConfirm.id || deleteConfirm._id);
            toast('Payment deleted');
            setDeleteConfirm(null);
            await loadPayments();
        } catch (err) {
            toast(err.message || 'Failed to delete payment', 'error');
        }
    }

    const filtered = payments.filter((p) =>
        (p.client || '').toLowerCase().includes(search.toLowerCase()) || (p.reference || '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <PageLoader />;

    return (
        <div>
            <PageHeader title="Payments" subtitle="Track and manage payment records" buttonLabel="Record Payment" onButtonClick={() => setShowModal(true)} />

            <div className="page-card">
                <div className="page-card__toolbar">
                    <SearchBar placeholder="Search by client or reference..." value={search} onChange={setSearch} />
                </div>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Client</th>
                                <th>Invoice #</th>
                                <th>Date</th>
                                <th className="text-right">Amount</th>
                                <th>Method</th>
                                <th>Reference</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p) => (
                                <tr key={p.id || p._id}>
                                    <td className="font-medium">{p.client}</td>
                                    <td className="mono">{p.invoiceNo || '-'}</td>
                                    <td>{p.date}</td>
                                    <td className="text-right font-medium text-success">{formatCurrency(p.amount)}</td>
                                    <td>{p.method}</td>
                                    <td className="mono">{p.reference || '-'}</td>
                                    <td>
                                        <ActionMenu actions={[
                                            { icon: <Trash2 size={15} />, label: 'Delete', danger: true, onClick: () => setDeleteConfirm(p) },
                                        ]} />
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} className="text-center">No payments found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Record Payment Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Payment">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-group__label">Client *</label>
                        <select className="form-group__input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value, invoice_id: '' })} required>
                            <option value="">Select client</option>
                            {clients.map((c) => <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>)}
                        </select>
                    </div>
                    {clientInvoices.length > 0 && (
                        <div className="form-group">
                            <label className="form-group__label">Link to Invoice (optional)</label>
                            <select className="form-group__input" value={form.invoice_id} onChange={(e) => {
                                const invId = e.target.value;
                                const inv = clientInvoices.find((i) => (i.id || i._id) === invId);
                                setForm({ ...form, invoice_id: invId, amount: inv ? (inv.balance || inv.grand_total) : '' });
                            }}>
                                <option value="">No specific invoice</option>
                                {clientInvoices.map((inv) => (
                                    <option key={inv.id || inv._id} value={inv.id || inv._id}>
                                        {inv.invoice_number} — Balance: {formatCurrency(inv.balance || inv.grand_total)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Amount *</label>
                            <input type="number" step="0.01" min="0.01" placeholder="0.00" className="form-group__input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Date *</label>
                            <input type="date" className="form-group__input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Payment Method</label>
                            <select className="form-group__input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
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
                            <input type="text" placeholder="e.g. TXN123456" className="form-group__input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Notes</label>
                        <textarea rows={2} placeholder="Optional notes" className="form-group__textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Recording...' : 'Record Payment'}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                isOpen={!!deleteConfirm}
                title="Delete Payment"
                message={`Delete payment of ${formatCurrency(deleteConfirm?.amount)} for ${deleteConfirm?.client}?`}
                confirmLabel="Delete"
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirm(null)}
            />
        </div>
    );
}
