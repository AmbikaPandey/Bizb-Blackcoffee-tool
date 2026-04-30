import { useState, useEffect } from 'react';
import { Pencil, Trash2, Eye, FolderKanban, TrendingUp, IndianRupee, Users } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import SearchBar from '../components/common/SearchBar';
import FilterDropdown from '../components/common/FilterDropdown';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageLoader from '../components/common/PageLoader';
import ActionMenu from '../components/common/ActionMenu';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';
import { uppercaseFormData } from '../utils/formTransform';

const emptyForm = { name: '', client_id: '', budget: '', start_date: '', end_date: '', status: 'Active' };

const formatDuration = (start, end) => {
    if (!start && !end) return '-';
    const parts = [];
    if (start) parts.push(new Date(start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
    if (end) parts.push(new Date(end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
    return parts.join(' – ');
};

export default function Projects() {
    const toast = useToast();
    const [projects, setProjects] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [viewTarget, setViewTarget] = useState(null);

    async function loadProjects() {
        try { setProjects(await api.getProjects()); }
        catch { toast('Failed to load projects', 'error'); }
        finally { setLoading(false); }
    }

    useEffect(() => {
        loadProjects();
        api.getClients().then(setClients).catch(() => { });
    }, []);

    const filtered = projects.filter((p) => {
        if (statusFilter && p.status !== statusFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!p.name?.toLowerCase().includes(q) && !p.code?.toLowerCase().includes(q) && !(p.client || '').toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const totalBudget = projects.reduce((s, p) => {
        if (p.status?.toLowerCase() === 'cancelled') return s;
        return s + (p.budget || 0);
    }, 0);
    const activeCount = projects.filter((p) => p.status?.toLowerCase() === 'active').length;
    const linkedClients = new Set(projects.filter((p) => p.client_id).map((p) => String(p.client_id))).size;

    function openCreate() {
        setEditTarget(null);
        setForm({ ...emptyForm });
        setShowModal(true);
    }

    function openEdit(p) {
        setEditTarget(p);
        setForm({
            name: p.name || '', client_id: p.client_id || '',
            budget: p.budget || '', start_date: p.start_date || '',
            end_date: p.end_date || '', status: p.status || 'Active',
        });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) { toast('Project name is required', 'error'); return; }
        setSaving(true);
        try {
            const data = uppercaseFormData({ ...form, budget: parseFloat(form.budget) || 0 });
            if (editTarget) {
                await api.updateProject(editTarget.id || editTarget._id, data);
                toast('Project updated');
            } else {
                await api.createProject(data);
                toast('Project created');
            }
            setShowModal(false);
            loadProjects();
        } catch (err) { toast(err.message || 'Failed to save project', 'error'); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            await api.deleteProject(deleteTarget.id || deleteTarget._id);
            toast('Project deleted');
            setDeleteTarget(null);
            loadProjects();
        } catch (err) { toast(err.message || 'Failed to delete project', 'error'); }
    }

    if (loading) return <PageLoader />;

    return (
        <div>
            <PageHeader title="Projects" subtitle="Manage projects and track profitability" buttonLabel="Add Project" onButtonClick={openCreate} />

            <div className="stats-grid stats-grid--4">
                <StatCard label="Total Projects" value={projects.length} icon={FolderKanban} variant="blue" />
                <StatCard label="Active Projects" value={activeCount} icon={TrendingUp} variant="green" />
                <StatCard label="Total Budget" value={formatCurrency(totalBudget)} icon={IndianRupee} variant="yellow" />
                <StatCard label="Clients Linked" value={linkedClients} icon={Users} variant="purple" />
            </div>

            <div className="page-card">
                <div className="page-card__toolbar">
                    <SearchBar placeholder="Search projects..." value={search} onChange={setSearch} />
                    <FilterDropdown label="All Status" options={['Active', 'On Hold', 'Completed', 'Cancelled']} value={statusFilter} onChange={setStatusFilter} />
                </div>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Client</th>
                                <th>Status</th>
                                <th className="text-right">Budget</th>
                                <th>Duration</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                        No projects found. Click "Add Project" to create one.
                                    </td>
                                </tr>
                            ) : filtered.map((p) => (
                                <tr key={p.id || p._id}>
                                    <td>
                                        <div className="font-medium">{p.name}</div>
                                        {p.code && <div className="text-muted" style={{ fontSize: '0.75rem' }}>Code: {p.code}</div>}
                                    </td>
                                    <td>{p.client || '-'}</td>
                                    <td><StatusBadge status={p.status} /></td>
                                    <td className="text-right">{formatCurrency(p.budget)}</td>
                                    <td>{formatDuration(p.start_date, p.end_date)}</td>
                                    <td>
                                        <ActionMenu actions={[
                                            { icon: <Eye size={15} />, label: 'View Details', onClick: () => setViewTarget(p) },
                                            { icon: <Pencil size={15} />, label: 'Edit', onClick: () => openEdit(p) },
                                            { divider: true },
                                            { icon: <Trash2 size={15} />, label: 'Delete', danger: true, onClick: () => setDeleteTarget(p) },
                                        ]} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View Project Detail Modal */}
            <Modal isOpen={!!viewTarget} onClose={() => setViewTarget(null)} title={viewTarget?.name || 'Project Details'}>
                {viewTarget && (
                    <div className="project-detail">
                        <div className="project-detail__row">
                            <span>Code</span><strong>{viewTarget.code || '-'}</strong>
                        </div>
                        <div className="project-detail__row">
                            <span>Client</span><strong>{viewTarget.client || '-'}</strong>
                        </div>
                        <div className="project-detail__row">
                            <span>Status</span><StatusBadge status={viewTarget.status} />
                        </div>
                        <div className="project-detail__row">
                            <span>Budget</span><strong>{formatCurrency(viewTarget.budget)}</strong>
                        </div>
                        <div className="project-detail__row">
                            <span>Spent</span><strong>{formatCurrency(viewTarget.spent)}</strong>
                        </div>
                        <div className="project-detail__row">
                            <span>Duration</span><strong>{formatDuration(viewTarget.start_date, viewTarget.end_date)}</strong>
                        </div>
                        {viewTarget.budget > 0 && (
                            <div className="project-detail__progress">
                                <div className="project-detail__progress-label">
                                    <span>Budget utilization</span>
                                    <span>{Math.round((viewTarget.spent / viewTarget.budget) * 100)}%</span>
                                </div>
                                <div className="project-detail__progress-bar-wrap">
                                    <div
                                        className={`project-detail__progress-bar ${viewTarget.spent / viewTarget.budget > 0.9 ? 'project-detail__progress-bar--danger' : ''}`}
                                        style={{ width: `${Math.min((viewTarget.spent / viewTarget.budget) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Edit Project' : 'New Project'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-group__label">Project Name *</label>
                        <input type="text" placeholder="Enter project name" className="form-group__input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Client</label>
                        <select className="form-group__input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                            <option value="">Select client (optional)</option>
                            {clients.map((c) => <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Budget</label>
                            <input type="number" step="0.01" min="0" placeholder="0.00" className="form-group__input" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Status</label>
                            <select className="form-group__input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                <option>Active</option><option>On Hold</option><option>Completed</option><option>Cancelled</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Start Date</label>
                            <input type="date" className="form-group__input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">End Date</label>
                            <input type="date" className="form-group__input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Saving...' : editTarget ? 'Update Project' : 'Create Project'}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog isOpen={!!deleteTarget} title="Delete Project" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
        </div>
    );
}
