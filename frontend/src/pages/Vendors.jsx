import { useState, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageLoader from '../components/common/PageLoader';
import ActionMenu from '../components/common/ActionMenu';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { lookupPincode } from '../utils/pincodeLookup';
import { uppercaseFormData } from '../utils/formTransform';

const emptyForm = { name: '', gstin: '', contact: '', pincode: '', city: '', phone: '', email: '', state: '' };

export default function Vendors() {
    const toast = useToast();
    const [search, setSearch] = useState('');
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);

    async function loadVendors() {
        try { setVendors(await api.getVendors()); }
        catch { toast('Failed to load vendors', 'error'); }
        finally { setLoading(false); }
    }

    useEffect(() => { loadVendors(); }, []);

    function openCreate() {
        setEditTarget(null);
        setForm({ ...emptyForm });
        setShowModal(true);
    }

    function openEdit(v) {
        setEditTarget(v);
        setForm({ name: v.name || '', gstin: v.gstin || '', contact: v.contact || '', pincode: v.pincode || '', city: v.city || '', phone: v.phone || '', email: v.email || '', state: v.state || '' });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) { toast('Vendor name is required', 'error'); return; }
        setSaving(true);
        try {
            const data = uppercaseFormData(form);
            if (editTarget) {
                await api.updateVendor(editTarget.id || editTarget._id, data);
                toast('Vendor updated');
            } else {
                await api.createVendor(data);
                toast('Vendor created');
            }
            setShowModal(false);
            loadVendors();
        } catch (err) { toast(err.message || 'Failed to save vendor', 'error'); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            await api.deleteVendor(deleteTarget.id || deleteTarget._id);
            toast('Vendor deleted');
            setDeleteTarget(null);
            loadVendors();
        } catch (err) { toast(err.message || 'Failed to delete vendor', 'error'); }
    }

    const filtered = vendors.filter((v) =>
        (v.name || '').toLowerCase().includes(search.toLowerCase()) || (v.city || '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <PageLoader />;

    return (
        <div>
            <PageHeader title="Vendors" subtitle="Manage your vendor directory" buttonLabel="Add Vendor" onButtonClick={openCreate} />

            <div className="page-card">
                <div className="page-card__toolbar">
                    <SearchBar placeholder="Search vendors by name or city..." value={search} onChange={setSearch} />
                </div>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Vendor Name</th>
                                <th>GSTIN</th>
                                <th>Contact</th>
                                <th>City</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((v) => (
                                <tr key={v.id || v._id}>
                                    <td className="font-medium">{v.name}</td>
                                    <td className="mono">{v.gstin || '-'}</td>
                                    <td>{v.contact || '-'}</td>
                                    <td>{v.city || '-'}</td>
                                    <td>{v.phone || '-'}</td>
                                    <td className="text-primary">{v.email || '-'}</td>
                                    <td>
                                        <ActionMenu actions={[
                                            { icon: <Pencil size={15} />, label: 'Edit', onClick: () => openEdit(v) },
                                            { divider: true },
                                            { icon: <Trash2 size={15} />, label: 'Delete', danger: true, onClick: () => setDeleteTarget(v) },
                                        ]} />
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} className="text-center">No vendors found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Edit Vendor' : 'Add Vendor'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-group__label">Vendor Name *</label>
                        <input type="text" placeholder="Enter vendor name" className="form-group__input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">GSTIN</label>
                            <input type="text" placeholder="22AAAAA0000A1Z5" className="form-group__input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Contact Person</label>
                            <input type="text" placeholder="Contact name" className="form-group__input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Email</label>
                            <input type="email" placeholder="vendor@example.com" className="form-group__input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Phone</label>
                            <input type="tel" placeholder="9876543210" className="form-group__input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-row form-row--3">
                        <div className="form-group">
                            <label className="form-group__label">Pincode</label>
                            <input type="text" placeholder="110001" className="form-group__input" value={form.pincode} maxLength={6} onChange={async (e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                setForm((prev) => ({ ...prev, pincode: val }));
                                if (val.length === 6) {
                                    const info = await lookupPincode(val);
                                    if (info) setForm((prev) => ({ ...prev, city: info.city, state: info.state }));
                                }
                            }} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">City</label>
                            <input type="text" placeholder="City" className="form-group__input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">State</label>
                            <input type="text" placeholder="State" className="form-group__input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Saving...' : editTarget ? 'Update Vendor' : 'Save Vendor'}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog isOpen={!!deleteTarget} title="Delete Vendor" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
        </div>
    );
}
