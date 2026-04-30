import { useState, useEffect } from 'react';
import { FileText, IndianRupee, AlertCircle, Calendar, Users, Clock, CheckCircle, Pencil, Trash2 } from 'lucide-react';
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
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';
import { uppercaseFormData } from '../utils/formTransform';

const CATEGORIES = ['Travel', 'Office Supplies', 'Software', 'Marketing', 'Food', 'Transportation', 'Utilities', 'Rent', 'Salary', 'Other'];
const emptyForm = { description: '', category: 'Other', amount: '', date: new Date().toISOString().slice(0, 10), paid_by: '', project_id: '', status: 'Pending' };

export default function Expenses() {
    const toast = useToast();
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [expenses, setExpenses] = useState([]);
    const [projects, setProjects] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);

    async function loadData() {
        try {
            const [expData, statsData, projData] = await Promise.all([
                api.getExpenses(), api.getExpenseStats(), api.getProjects()
            ]);
            setExpenses(expData);
            setStats(statsData);
            setProjects(projData);
        } catch { toast('Failed to load expenses', 'error'); }
        finally { setLoading(false); }
    }

    useEffect(() => { loadData(); }, []);

    const categories = [...new Set(expenses.map((e) => e.category).filter(Boolean))];
    const projectNames = [...new Set(expenses.map((e) => e.project).filter(Boolean))];

    const tabs = [
        { key: 'all', label: 'All Expenses', icon: null },
        { key: 'employee', label: 'Employee Paid', icon: Users },
        { key: 'pending', label: 'Pending Reimbursement', icon: Clock },
        { key: 'reimbursed', label: 'Reimbursed', icon: CheckCircle },
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
            status: exp.status || 'Pending',
        });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.description.trim() || !form.amount) { toast('Description and amount are required', 'error'); return; }
        setSaving(true);
        try {
            const data = uppercaseFormData({ ...form, amount: parseFloat(form.amount) || 0 });
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

    const filtered = expenses.filter((e) => {
        if (tab === 'pending' && e.status !== 'Pending') return false;
        if (tab === 'reimbursed' && e.status !== 'Reimbursed') return false;
        if (tab === 'employee' && !e.paid_by) return false;
        if (search && !(e.description || '').toLowerCase().includes(search.toLowerCase()) && !(e.paid_by || '').toLowerCase().includes(search.toLowerCase())) return false;
        if (categoryFilter && e.category !== categoryFilter) return false;
        if (projectFilter && e.project !== projectFilter) return false;
        return true;
    });

    if (loading) return <PageLoader />;

    return (
        <div>
            <PageHeader title="Expenses" subtitle="Track expenses and employee reimbursements" buttonLabel="Add Expense" onButtonClick={openCreate} />

            <div className="stats-grid stats-grid--4">
                <StatCard label="Total Expenses" value={stats.totalExpenses || 0} icon={FileText} variant="blue" />
                <StatCard label="Total Amount" value={formatCurrency(stats.totalAmount)} icon={IndianRupee} variant="yellow" />
                <div className="pending-stat">
                    <div className="pending-stat__inner">
                        <div className="pending-stat__icon">
                            <AlertCircle size={24} />
                        </div>
                        <div className="pending-stat__info">
                            <span className="label">Pending Reimbursements</span>
                            <span className="value">{formatCurrency(stats.pendingAmount)}</span>
                            <span className="sub">{stats.pendingCount || 0} expenses</span>
                        </div>
                    </div>
                </div>
                <StatCard label="This Month" value={formatCurrency(stats.thisMonth)} icon={Calendar} variant="teal" />
            </div>

            <div className="tabs">
                {tabs.map((t) => {
                    const TabIcon = t.icon;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`tabs__btn ${tab === t.key ? 'tabs__btn--active' : ''}`}
                        >
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
                </div>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Category</th>
                                <th>Paid By</th>
                                <th>Date</th>
                                <th className="text-right">Amount</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((exp) => (
                                <tr key={exp.id || exp._id}>
                                    <td className="font-medium">{exp.description}</td>
                                    <td>
                                        <span className={`category-badge category-badge--${(exp.category || '').toLowerCase()}`}>
                                            {exp.category}
                                        </span>
                                    </td>
                                    <td className="text-warning font-medium">{exp.paid_by || '-'}</td>
                                    <td>{exp.date}</td>
                                    <td className="text-right font-medium">{formatCurrency(exp.amount)}</td>
                                    <td><StatusBadge status={exp.status} /></td>
                                    <td>
                                        <ActionMenu actions={[
                                            { icon: <Pencil size={15} />, label: 'Edit', onClick: () => openEdit(exp) },
                                            { divider: true },
                                            { icon: <Trash2 size={15} />, label: 'Delete', danger: true, onClick: () => setDeleteTarget(exp) },
                                        ]} />
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} className="text-center">No expenses found</td></tr>
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
                            <select className="form-group__input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                <option>Pending</option><option>Approved</option><option>Reimbursed</option><option>Rejected</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Saving...' : editTarget ? 'Update Expense' : 'Add Expense'}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog isOpen={!!deleteTarget} title="Delete Expense" message={`Delete "${deleteTarget?.description}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
        </div>
    );
}
