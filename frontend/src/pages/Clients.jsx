import { useState, useEffect } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import ActionMenu from '../components/common/ActionMenu';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageLoader from '../components/common/PageLoader';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { lookupPincode } from '../utils/pincodeLookup';
import { formatCurrency } from '../utils/currency';
import { uppercaseFormData } from '../utils/formTransform';

const emptyForm = { name: '', gstin: '', email: '', phone: '', contact: '', address: '', pincode: '', city: '', state: '' };

export default function Clients() {
    const toast = useToast();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);

    async function loadClients() {
        try { setClients(await api.getClients()); }
        catch { toast('Failed to load clients', 'error'); }
        finally { setLoading(false); }
    }

    useEffect(() => { loadClients(); }, []);

    function openCreate() {
        setEditTarget(null);
        setForm({ ...emptyForm });
        setShowModal(true);
    }

    function openEdit(c) {
        setEditTarget(c);
        setForm({ name: c.name || '', gstin: c.gstin || '', email: c.email || '', phone: c.phone || '', contact: c.contact || '', address: c.address || '', pincode: c.pincode || '', city: c.city || '', state: c.state || '' });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) { toast('Client name is required', 'error'); return; }
        setSaving(true);
        try {
            const data = uppercaseFormData(form);
            if (editTarget) {
                await api.updateClient(editTarget.id || editTarget._id, data);
                toast('Client updated');
            } else {
                await api.createClient(data);
                toast('Client created');
            }
            setShowModal(false);
            loadClients();
        } catch (err) { toast(err.message || 'Failed to save client', 'error'); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            await api.deleteClient(deleteTarget.id || deleteTarget._id);
            toast('Client deleted');
            setDeleteTarget(null);
            loadClients();
        } catch (err) { toast(err.message || 'Failed to delete client', 'error'); }
    }

    const filtered = clients.filter((c) =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        (c.gstin || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.city || '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <PageLoader />;

    return (
        <div>
            <PageHeader title="Clients" subtitle="Manage your client database" buttonLabel="Add Client" onButtonClick={openCreate} />

            <div className="page-card">
                <div className="page-card__toolbar">
                    <SearchBar placeholder="Search clients by name, GSTIN, or city..." value={search} onChange={setSearch} />
                </div>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Client Name</th>
                                <th>GSTIN</th>
                                <th>Contact</th>
                                <th>City</th>
                                <th className="text-right">Outstanding</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((client) => (
                                <tr key={client.id || client._id}>
                                    <td className="font-medium">{client.name}</td>
                                    <td className="mono">{client.gstin || '-'}</td>
                                    <td>{client.contact || '-'}</td>
                                    <td>{client.city || '-'}</td>
                                    <td className={`text-right font-medium ${client.outstanding > 0 ? 'balance-red' : ''}`}>
                                        {formatCurrency(client.outstanding)}
                                    </td>
                                    <td>
                                        <ActionMenu actions={[
                                            { icon: <Eye size={15} />, label: 'View Details', onClick: () => navigate(`/clients/${client.id || client._id}`) },
                                            { icon: <Pencil size={15} />, label: 'Edit', onClick: () => openEdit(client) },
                                            { divider: true },
                                            { icon: <Trash2 size={15} />, label: 'Delete', danger: true, onClick: () => setDeleteTarget(client) },
                                        ]} />
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} className="text-center">No clients found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Edit Client' : 'Add New Client'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-group__label">Client Name *</label>
                        <input type="text" placeholder="Enter client name" className="form-group__input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">GSTIN</label>
                            <input type="text" placeholder="22AAAAA0000A1Z5" className="form-group__input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Email</label>
                            <input type="email" placeholder="client@example.com" className="form-group__input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Phone</label>
                            <input type="tel" placeholder="9876543210" className="form-group__input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Contact Person</label>
                            <input type="text" placeholder="Contact name" className="form-group__input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Address</label>
                        <input type="text" placeholder="Street address" className="form-group__input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
                        <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Saving...' : editTarget ? 'Update Client' : 'Save Client'}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog isOpen={!!deleteTarget} title="Delete Client" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
        </div>
    );
}
