import { useState, useEffect } from 'react';
import { FileText, IndianRupee, AlertCircle, Calendar, Users, Clock, CheckCircle, Pencil, Trash2, Download, XCircle, Check } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import FilterDropdown from '../components/common/FilterDropdown';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageLoader from '../components/common/PageLoader';
import ActionMenu from '../components/common/ActionMenu';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';

const CATEGORIES = ['Travel', 'Office Supplies', 'Software', 'Marketing', 'Food', 'Transportation', 'Utilities', 'Rent', 'Salary', 'Other'];
const emptyForm = { description: '', category: 'Other', amount: '', date: new Date().toISOString().slice(0, 10), paid_by: '', project_id: '', status: 'Pending', notes: '', invoice_number: '' };

export default function Expenses() {
    const toast = useToast();
    const { isAdmin, isExecutive, user: currentUser, can } = useAuth();
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [expenses, setExpenses] = useState([]);
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [invoiceValue, setInvoiceValue] = useState('');
    const [reimbursementTarget, setReimbursementTarget] = useState(null);
    const [reimbursementForm, setReimbursementForm] = useState({ payment_status: 'Paid', payment_date: new Date().toISOString().slice(0, 10), paid_from_account: '' });

    async function loadData() {
        try {
            const promises = [api.getExpenses(), api.getProjects()];
            if (!isExecutive) {
                promises.push(api.getExpenseStats());
                promises.push(api.getUsers());
            }
            const results = await Promise.all(promises);
            setExpenses(results[0]);
            setProjects(results[1]);
            if (results[2]) setStats(results[2]);
            if (results[3]) setUsers(results[3]);
        } catch { toast('Failed to load expenses', 'error'); }
        finally { setLoading(false); }
    }

    useEffect(() => { loadData(); }, []);

    const categories = [...new Set(expenses.map((e) => e.category).filter(Boolean))];
    const projectNames = [...new Set(expenses.map((e) => e.project).filter(Boolean))];
    const submitterNames = [...new Set(expenses.map((e) => e.submitted_by_name).filter(Boolean))];

    const tabs = [
        { key: 'all', label: 'All Expenses', icon: null },
        { key: 'employee', label: 'Employee Paid', icon: Users },
        { key: 'pending', label: 'Pending', icon: Clock },
        { key: 'approved', label: 'Approved', icon: CheckCircle },
    ];

    function openCreate() {
        setEditTarget(null);
        setForm({ ...emptyForm });
        setShowModal(true);
    }

    function openEdit(exp) {
        setEditTarget(exp);
        setForm({
            description: exp.description || '', category: exp.category || 'Other',
            amount: exp.amount || '', date: exp.date || '',
            paid_by: exp.paid_by || '', project_id: exp.project_id || '',
            status: exp.status || 'Pending', invoice_number: exp.invoice_number || '',
            notes: exp.notes || '',
        });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.description.trim() || !form.amount) { toast('Description and amount are required', 'error'); return; }
        if (isExecutive && !form.project_id) { toast('Project is required', 'error'); return; }
        setSaving(true);
        try {
            const data = { ...form, amount: parseFloat(form.amount) || 0 };
            if (editTarget) {
                await api.updateExpense(editTarget.id || editTarget._id, data);
                toast('Expense updated');
            } else {
                await api.createExpense(data);
                toast('Expense created');
            }
            setShowModal(false);
            loadData();
        } catch (err) { toast(err.message || 'Failed to save expense', 'error'); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            await api.deleteExpense(deleteTarget.id || deleteTarget._id);
            toast('Expense deleted');
            setDeleteTarget(null);
            loadData();
        } catch (err) { toast(err.message || 'Failed to delete expense', 'error'); }
    }

    async function handleStatusChange(exp, newStatus) {
        try {
            await api.updateExpense(exp.id || exp._id, { status: newStatus });
            toast(`Expense ${newStatus.toLowerCase()}`);
            loadData();
        } catch (err) { toast(err.message || 'Failed to update status', 'error'); }
    }

    async function handleInvoiceSave(exp) {
        try {
            await api.updateExpense(exp.id || exp._id, { invoice_number: invoiceValue });
            toast('Invoice number updated');
            setEditingInvoice(null);
            loadData();
        } catch (err) { toast(err.message || 'Failed to update', 'error'); }
    }

    async function handleReimbursement(e) {
        e.preventDefault();
        if (!reimbursementTarget) return;
        setSaving(true);
        try {
            await api.updateExpense(reimbursementTarget.id || reimbursementTarget._id, reimbursementForm);
            toast('Reimbursement updated');
            setReimbursementTarget(null);
            loadData();
        } catch (err) { toast(err.message || 'Failed to update', 'error'); }
        finally { setSaving(false); }
    }

    async function handleExportCSV() {
        try {
            const token = localStorage.getItem('bizb_token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/expenses/export/csv`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'expenses.csv';
            a.click();
            URL.revokeObjectURL(url);
            toast('CSV exported');
        } catch (err) { toast(err.message || 'Failed to export', 'error'); }
    }

    const filtered = expenses.filter((e) => {
        if (tab === 'pending' && e.status !== 'Pending') return false;
        if (tab === 'approved' && e.status !== 'Approved') return false;
        if (tab === 'employee' && !e.paid_by) return false;
        if (search && !(e.description || '').toLowerCase().includes(search.toLowerCase()) && !(e.paid_by || '').toLowerCase().includes(search.toLowerCase())) return false;
        if (categoryFilter && e.category !== categoryFilter) return false;
        if (projectFilter && e.project !== projectFilter) return false;
        if (statusFilter && e.status !== statusFilter) return false;
        if (userFilter && e.submitted_by_name !== userFilter) return false;
        return true;
    });

    if (loading) return <PageLoader />;

    return (
        <div>
            <PageHeader title="Expenses" subtitle="Track expenses and employee reimbursements" buttonLabel="Add Expense" onButtonClick={openCreate}
                actions={can('expenses', 'export') ? <button className="btn-export" onClick={handleExportCSV}><Download size={15} /> Export CSV</button> : null} />

            {!isExecutive && (
                <div className="stats-grid stats-grid--4">
                    <StatCard label="Total Expenses" value={stats.totalExpenses || 0} icon={FileText} variant="blue" />
                    <StatCard label="Total Amount" value={formatCurrency(stats.totalAmount)} icon={IndianRupee} variant="yellow" />
                    <div className="pending-stat">
                        <div className="pending-stat__inner">
                            <div className="pending-stat__icon"><AlertCircle size={24} /></div>
                            <div className="pending-stat__info">
                                <span className="label">Pending Reimbursements</span>
                                <span className="value">{formatCurrency(stats.pendingAmount)}</span>
                                <span className="sub">{stats.pendingCount || 0} expenses</span>
                            </div>
                        </div>
                    </div>
                    <StatCard label="This Month" value={formatCurrency(stats.thisMonth)} icon={Calendar} variant="teal" />
                </div>
            )}

            <div className="tabs">
                {tabs.map((t) => {
                    const TabIcon = t.icon;
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)} className={`tabs__btn ${tab === t.key ? 'tabs__btn--active' : ''}`}>
                            {TabIcon && <TabIcon size={16} />}
                            {t.label}
                        </button>
                    );
                })}
            </div>

            <div className="page-card">
                <div className="page-card__toolbar">
                    <SearchBar placeholder="Search expenses, paid by..." value={search} onChange={setSearch} />
                    <FilterDropdown label="All Categories" options={categories} value={categoryFilter} onChange={setCategoryFilter} />
                    <FilterDropdown label="All Projects" options={projectNames} value={projectFilter} onChange={setProjectFilter} />
                    <FilterDropdown label="All Status" options={['Pending', 'Approved', 'Rejected']} value={statusFilter} onChange={setStatusFilter} />
                    {!isExecutive && <FilterDropdown label="All Users" options={submitterNames} value={userFilter} onChange={setUserFilter} />}
                </div>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Category</th>
                                {!isExecutive && <th>Submitted By</th>}
                                <th>Project</th>
                                <th>Invoice No</th>
                                <th>Date</th>
                                <th className="text-right">Amount</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((exp) => {
                                const expId = exp.id || exp._id;
                                return (
                                    <tr key={expId}>
                                        <td className="font-medium">{exp.description}</td>
                                        <td>
                                            <span className={`category-badge category-badge--${(exp.category || '').toLowerCase().replace(/\s/g, '')}`}>
                                                {exp.category}
                                            </span>
                                        </td>
                                        {!isExecutive && <td>{exp.submitted_by_name || '-'}</td>}
                                        <td>{exp.project || '-'}</td>
                                        <td>
                                            {editingInvoice === expId ? (
                                                <div className="inline-edit">
                                                    <input type="text" className="inline-edit__input" value={invoiceValue} onChange={(e) => setInvoiceValue(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleInvoiceSave(exp); if (e.key === 'Escape') setEditingInvoice(null); }} />
                                                    <button className="inline-edit__btn inline-edit__btn--save" onClick={() => handleInvoiceSave(exp)}><Check size={14} /></button>
                                                    <button className="inline-edit__btn inline-edit__btn--cancel" onClick={() => setEditingInvoice(null)}><XCircle size={14} /></button>
                                                </div>
                                            ) : (
                                                <span className="invoice-no-cell">
                                                    {exp.invoice_number || '-'}
                                                    {isAdmin && (
                                                        <button className="invoice-no-cell__edit" onClick={() => { setEditingInvoice(expId); setInvoiceValue(exp.invoice_number || ''); }} title="Edit Invoice Number">
                                                            <Pencil size={12} />
                                                        </button>
                                                    )}
                                                </span>
                                            )}
                                        </td>
                                        <td>{exp.date}</td>
                                        <td className="text-right font-medium">{formatCurrency(exp.amount)}</td>
                                        <td><StatusBadge status={exp.status} /></td>
                                        <td>
                                            {exp.status === 'Approved' ? (
                                                isAdmin ? (
                                                    <button
                                                        className={`payment-badge payment-badge--${(exp.payment_status || 'unpaid').toLowerCase()}`}
                                                        onClick={() => { setReimbursementTarget(exp); setReimbursementForm({ payment_status: exp.payment_status || 'Unpaid', payment_date: exp.payment_date || new Date().toISOString().slice(0, 10), paid_from_account: exp.paid_from_account || '' }); }}
                                                    >
                                                        {exp.payment_status || 'Unpaid'}
                                                    </button>
                                                ) : (
                                                    <span className={`payment-badge payment-badge--${(exp.payment_status || 'unpaid').toLowerCase()}`}>
                                                        {exp.payment_status || 'Unpaid'}
                                                    </span>
                                                )
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <ActionMenu actions={[
                                                ...(isAdmin && exp.status === 'Pending' ? [
                                                    { icon: <CheckCircle size={15} />, label: 'Approve', onClick: () => handleStatusChange(exp, 'Approved') },
                                                    { icon: <XCircle size={15} />, label: 'Reject', danger: true, onClick: () => handleStatusChange(exp, 'Rejected') },
                                                    { divider: true },
                                                ] : []),
                                                { icon: <Pencil size={15} />, label: 'Edit', onClick: () => openEdit(exp) },
                                                ...(isAdmin ? [{ divider: true }, { icon: <Trash2 size={15} />, label: 'Delete', danger: true, onClick: () => setDeleteTarget(exp) }] : []),
                                            ]} />
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={isAdmin ? 10 : isExecutive ? 8 : 9} className="text-center">No expenses found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Edit Expense' : 'Add Expense'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-group__label">Description *</label>
                        <input type="text" placeholder="Expense description" className="form-group__input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Category</label>
                            <select className="form-group__input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Amount *</label>
                            <input type="number" step="0.01" min="0" placeholder="0.00" className="form-group__input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Date</label>
                            <input type="date" className="form-group__input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Paid By</label>
                            <input type="text" placeholder="Employee name" className="form-group__input" value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Project</label>
                            <select className="form-group__input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                                <option value="">No project</option>
                                {projects.map((p) => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Status</label>
                            <select className="form-group__input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={!isAdmin}>
                                <option>Pending</option><option>Approved</option><option>Rejected</option>
                            </select>
                        </div>
                    </div>
                    {isAdmin && (
                        <div className="form-group">
                            <label className="form-group__label">Invoice Number</label>
                            <input type="text" placeholder="INV-001" className="form-group__input" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-group__label">Notes</label>
                        <input type="text" placeholder="Additional notes" className="form-group__input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Saving...' : editTarget ? 'Update Expense' : 'Add Expense'}</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!reimbursementTarget} onClose={() => setReimbursementTarget(null)} title="Reimbursement Payment">
                <form onSubmit={handleReimbursement}>
                    <div className="form-group">
                        <label className="form-group__label">Expense</label>
                        <input type="text" className="form-group__input" value={reimbursementTarget?.description || ''} disabled />
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Amount</label>
                        <input type="text" className="form-group__input" value={formatCurrency(reimbursementTarget?.amount)} disabled />
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Payment Status</label>
                            <select className="form-group__input" value={reimbursementForm.payment_status} onChange={(e) => setReimbursementForm({ ...reimbursementForm, payment_status: e.target.value })}>
                                <option>Unpaid</option><option>Paid</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Payment Date</label>
                            <input type="date" className="form-group__input" value={reimbursementForm.payment_date} onChange={(e) => setReimbursementForm({ ...reimbursementForm, payment_date: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Paid From Account</label>
                        <input type="text" placeholder="Account details" className="form-group__input" value={reimbursementForm.paid_from_account} onChange={(e) => setReimbursementForm({ ...reimbursementForm, paid_from_account: e.target.value })} />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setReimbursementTarget(null)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Saving...' : 'Update Payment'}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog isOpen={!!deleteTarget} title="Delete Expense" message={`Delete "${deleteTarget?.description}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
        </div>
    );
}
