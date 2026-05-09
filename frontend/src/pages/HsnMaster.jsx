import { useState, useEffect, useRef } from 'react';
import { Pencil, Trash2, Upload, Download, ToggleLeft, ToggleRight } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import FilterDropdown from '../components/common/FilterDropdown';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageLoader from '../components/common/PageLoader';
import StatusBadge from '../components/common/StatusBadge';
import ActionMenu from '../components/common/ActionMenu';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const HSN_RE = /^[0-9]{4,8}$/;
const emptyForm = { code: '', type: 'HSN', keywords: '', gstRate: '18' };

export default function HsnMaster() {
    const toast = useToast();
    const { can } = useAuth();
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState('');
    const [importing, setImporting] = useState(false);
    const fileRef = useRef(null);

    const canCreate = can('hsnMaster', 'create');
    const canEdit = can('hsnMaster', 'edit');
    const canDelete = can('hsnMaster', 'delete');

    const LIMIT = 50;

    async function load() {
        try {
            const params = { page, limit: LIMIT };
            if (search) params.q = search;
            if (typeFilter) params.type = typeFilter;
            if (statusFilter) params.status = statusFilter;
            const data = await api.getHsnMaster(params);
            setItems(data.results);
            setTotal(data.total);
        } catch { toast('Failed to load HSN/SAC codes', 'error'); }
        finally { setLoading(false); }
    }

    useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter]);
    useEffect(() => { setLoading(true); load(); }, [page, search, typeFilter, statusFilter]);

    function openCreate() {
        setEditTarget(null);
        setForm({ ...emptyForm });
        setFieldErrors({});
        setShowModal(true);
    }

    function openEdit(item) {
        setEditTarget(item);
        setForm({
            code: item.code,
            type: item.type,
            keywords: item.keywords?.join(', ') || '',
            gstRate: String(item.gstRate),
        });
        setFieldErrors({});
        setShowModal(true);
    }

    function validate() {
        const errs = {};
        if (!form.code) errs.code = 'Required';
        else if (!HSN_RE.test(form.code)) errs.code = 'Must be 4-8 digits';
        if (!form.type) errs.type = 'Required';
        const kw = form.keywords.split(',').map(k => k.trim()).filter(Boolean);
        if (kw.length === 0) errs.keywords = 'At least one keyword';
        const rate = parseFloat(form.gstRate);
        if (isNaN(rate) || rate < 0 || rate > 100) errs.gstRate = 'Must be 0-100';
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            const payload = {
                code: form.code.trim(),
                type: form.type,
                keywords: form.keywords,
                gstRate: parseFloat(form.gstRate),
            };
            if (editTarget) {
                await api.updateHsnMaster(editTarget._id, payload);
                toast('HSN/SAC code updated');
            } else {
                await api.createHsnMaster(payload);
                toast('HSN/SAC code created');
            }
            setShowModal(false);
            load();
        } catch (err) {
            toast(err.message || 'Save failed', 'error');
        } finally { setSaving(false); }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            await api.deleteHsnMaster(deleteTarget._id);
            toast('Deleted');
            setDeleteTarget(null);
            load();
        } catch (err) { toast(err.message || 'Delete failed', 'error'); }
    }

    async function toggleStatus(item) {
        try {
            await api.updateHsnMaster(item._id, { isActive: !item.isActive });
            toast(item.isActive ? 'Disabled' : 'Enabled');
            load();
        } catch (err) { toast(err.message || 'Update failed', 'error'); }
    }

    // ── Export CSV ──
    function exportCSV() {
        const header = 'Code,Type,Keywords,GST Rate,Status';
        const rows = items.map(i =>
            `"${i.code}","${i.type}","${(i.keywords || []).join('; ')}",${i.gstRate},${i.isActive ? 'Active' : 'Inactive'}`
        );
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'hsn-sac-master.csv'; a.click();
        URL.revokeObjectURL(url);
    }

    // ── Import CSV ──
    function handleFileUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setImportText(ev.target.result);
            setShowImport(true);
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    async function doImport() {
        setImporting(true);
        try {
            const lines = importText.split('\n').filter(l => l.trim());
            // Skip header if it looks like one
            const startIdx = /^code/i.test(lines[0]) ? 1 : 0;
            const records = [];
            for (let i = startIdx; i < lines.length; i++) {
                const parts = parseCSVLine(lines[i]);
                if (parts.length >= 3) {
                    records.push({
                        code: parts[0]?.trim(),
                        type: parts[1]?.trim() || 'HSN',
                        keywords: parts[2]?.trim(),
                        gstRate: parts[3]?.trim() || '18',
                    });
                }
            }
            if (records.length === 0) {
                toast('No valid records found', 'error');
                return;
            }
            const result = await api.importHsnMaster(records);
            toast(`Imported ${result.imported}, skipped ${result.skipped}`);
            if (result.errors?.length) {
                result.errors.forEach(e => toast(e, 'error'));
            }
            setShowImport(false);
            setImportText('');
            load();
        } catch (err) { toast(err.message || 'Import failed', 'error'); }
        finally { setImporting(false); }
    }

    // Simple CSV line parser (handles quoted fields)
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQuotes = !inQuotes; continue; }
            if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
            current += ch;
        }
        result.push(current);
        return result;
    }

    const totalPages = Math.ceil(total / LIMIT);

    if (loading) return <PageLoader />;

    return (
        <div>
            <PageHeader
                title="HSN/SAC Master"
                subtitle="Manage HSN & SAC codes with keywords and GST rates"
                buttonLabel={canCreate ? 'Add HSN/SAC' : undefined}
                onButtonClick={canCreate ? openCreate : undefined}
            />

            <div className="page-card">
                {/* Toolbar */}
                <div className="page-card__toolbar">
                    <SearchBar value={search} onChange={setSearch} placeholder="Search code or keyword..." />
                    <FilterDropdown label="All Types" options={['HSN', 'SAC']} value={typeFilter} onChange={setTypeFilter} />
                    <FilterDropdown label="All Status" options={['active', 'inactive']} value={statusFilter} onChange={setStatusFilter} />
                    <button className="btn btn--sm btn--outline" onClick={exportCSV} title="Export CSV">
                        <Download size={14} /> Export
                    </button>
                    {canCreate && (
                        <>
                            <input type="file" accept=".csv,.txt" ref={fileRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                            <button className="btn btn--sm btn--outline" onClick={() => fileRef.current?.click()} title="Import CSV">
                                <Upload size={14} /> Import
                            </button>
                        </>
                    )}
                </div>

                {/* Table */}
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Type</th>
                                <th>Keywords</th>
                                <th>GST %</th>
                                <th>Status</th>
                                {(canEdit || canDelete) && <th className="text-center">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr><td colSpan={6} className="text-center text-muted">No HSN/SAC codes found</td></tr>
                            ) : items.map(item => (
                                <tr key={item._id}>
                                    <td><span className="hsn-code-badge">{item.code}</span></td>
                                    <td><span className={`type-badge type-badge--${item.type.toLowerCase()}`}>{item.type}</span></td>
                                    <td>
                                        <div className="keyword-tags">
                                            {(item.keywords || []).map((kw, i) => (
                                                <span key={i} className="keyword-tag">{kw}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td><span className={`gst-badge gst-badge--${item.gstRate}`}>{item.gstRate}%</span></td>
                                    <td>
                                        <StatusBadge status={item.isActive ? 'Active' : 'Inactive'} />
                                    </td>
                                    {(canEdit || canDelete) && (
                                        <td className="text-center">
                                            <ActionMenu actions={[
                                                ...(canEdit ? [
                                                    { label: 'Edit', icon: <Pencil size={15} />, onClick: () => openEdit(item) },
                                                    { label: item.isActive ? 'Disable' : 'Enable', icon: item.isActive ? <ToggleLeft size={15} /> : <ToggleRight size={15} />, onClick: () => toggleStatus(item) },
                                                ] : []),
                                                ...(canDelete ? [
                                                    { label: 'Delete', icon: <Trash2 size={15} />, onClick: () => setDeleteTarget(item), danger: true },
                                                ] : []),
                                            ]} />
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button className="btn btn--sm btn--outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                    <span className="pagination__info">Page {page} of {totalPages} ({total} records)</span>
                    <button className="btn btn--sm btn--outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
            )}

            {/* Add/Edit Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Edit HSN/SAC' : 'Add HSN/SAC'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">HSN/SAC Code *</label>
                            <input className={`form-group__input${fieldErrors.code ? ' form-group__input--error' : ''}`}
                                value={form.code} onChange={e => setForm({ ...form, code: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                                placeholder="e.g. 8471" maxLength={8} />
                            {fieldErrors.code && <span className="form-group__error">{fieldErrors.code}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Type *</label>
                            <select className={`form-group__input${fieldErrors.type ? ' form-group__input--error' : ''}`}
                                value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                                <option value="HSN">HSN</option>
                                <option value="SAC">SAC</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">GST Rate (%) *</label>
                            <select className={`form-group__input${fieldErrors.gstRate ? ' form-group__input--error' : ''}`}
                                value={form.gstRate} onChange={e => setForm({ ...form, gstRate: e.target.value })}>
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                            </select>
                            {fieldErrors.gstRate && <span className="form-group__error">{fieldErrors.gstRate}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Keywords * <span className="form-hint">(comma separated)</span></label>
                            <input className={`form-group__input${fieldErrors.keywords ? ' form-group__input--error' : ''}`}
                                value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })}
                                placeholder="e.g. Laptop, Computer, Desktop" />
                            {fieldErrors.keywords && <span className="form-group__error">{fieldErrors.keywords}</span>}
                        </div>
                    </div>

                    {form.keywords && (
                        <div className="keyword-preview">
                            {form.keywords.split(',').map(k => k.trim()).filter(Boolean).map((kw, i) => (
                                <span key={i} className="keyword-tag">{kw}</span>
                            ))}
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={saving}>
                            {saving ? 'Saving...' : editTarget ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Import Modal */}
            <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import HSN/SAC Codes">
                <form onSubmit={e => { e.preventDefault(); doImport(); }}>
                    <p className="text-muted" style={{ marginBottom: '12px' }}>
                        CSV format: <code>Code, Type, Keywords, GST Rate</code><br />
                        Example: <code>8471, HSN, &quot;Laptop, Computer, Desktop&quot;, 18</code>
                    </p>
                    <div className="form-group">
                        <textarea className="form-group__textarea" rows={10} value={importText}
                            onChange={e => setImportText(e.target.value)}
                            placeholder="Paste CSV data here..." />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setShowImport(false)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={importing || !importText.trim()}>
                            {importing ? 'Importing...' : 'Import'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirm */}
            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Delete HSN/SAC Code"
                message={`Delete ${deleteTarget?.code}? This cannot be undone.`}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
