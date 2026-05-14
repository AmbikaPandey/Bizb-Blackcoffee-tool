import { useState, useEffect } from 'react';
import { Eye, Pencil, Trash2, Loader2, MapPin } from 'lucide-react';
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
import { validate, transform } from '../utils/validation';
import { lookupGST, isValidGSTIN } from '../utils/gstLookup';

const emptyForm = { name: '', gstin: '', email: '', phone: '', contact: '', address: '', pincode: '', city: '', state: '', latitude: '', longitude: '' };

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
    const [pincodeLoading, setPincodeLoading] = useState(false);
    const [gstLoading, setGstLoading] = useState(false);
    const [errors, setErrors] = useState({});

    async function loadClients() {
        try { setClients(await api.getClients()); }
        catch { toast('Failed to load clients', 'error'); }
        finally { setLoading(false); }
    }

    useEffect(() => { loadClients(); }, []);

    function openCreate() {
        setEditTarget(null);
        setForm({ ...emptyForm });
        setErrors({});
        setShowModal(true);
    }

    function openEdit(c) {
        setEditTarget(c);
        setForm({ name: c.name || '', gstin: c.gstin || '', email: c.email || '', phone: c.phone || '', contact: c.contact || '', address: c.address || '', pincode: c.pincode || '', city: c.city || '', state: c.state || '', latitude: c.latitude || '', longitude: c.longitude || '' });
        setErrors({});
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) { toast('Client name is required', 'error'); return; }
        if (form.pincode && !/^\d{6}$/.test(form.pincode)) { toast('Pincode must be 6 digits', 'error'); return; }
        const phoneErr = form.phone ? validate('phone', form.phone) : { valid: true };
        const gstErr = form.gstin ? validate('gstin', form.gstin) : { valid: true };
        if (!phoneErr.valid) { toast(phoneErr.error, 'error'); return; }
        if (!gstErr.valid) { toast(gstErr.error, 'error'); return; }
        setSaving(true);
        try {
            const data = uppercaseFormData({
                ...form,
                latitude: form.latitude ? Number.parseFloat(form.latitude) : null,
                longitude: form.longitude ? Number.parseFloat(form.longitude) : null,
            });
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
                                            ...(client.latitude && client.longitude ? [{ icon: <MapPin size={15} />, label: 'Locate on Map', onClick: () => window.open(`https://www.google.com/maps?q=${client.latitude},${client.longitude}`, '_blank') }] : []),
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
                            <div className="input-with-spinner">
                                <input type="text" placeholder="22AAAAA0000A1Z5" className={`form-group__input${errors.gstin ? ' form-group__input--error' : ''}`} value={form.gstin}
                                    onChange={(e) => {
                                        const val = transform('gstin', e.target.value);
                                        setForm({ ...form, gstin: val });
                                        if (val && !validate('gstin', val).valid) setErrors(p => ({ ...p, gstin: 'Invalid GSTIN format' }));
                                        else setErrors(p => ({ ...p, gstin: '' }));
                                    }}
                                    onBlur={async () => {
                                        if (!form.gstin || !isValidGSTIN(form.gstin)) return;
                                        setGstLoading(true);
                                        const info = await lookupGST(form.gstin);
                                        setGstLoading(false);
                                        if (info) {
                                            const pincode = info.pincode || form.pincode;
                                            setForm(prev => ({
                                                ...prev,
                                                name: info.name || prev.name,
                                                address: info.address || prev.address,
                                                state: info.state || prev.state,
                                                pincode,
                                                city: info.city || prev.city,
                                            }));
                                            // Trigger pincode lookup for lat/lng if pincode was filled
                                            if (pincode && pincode.length === 6) {
                                                setPincodeLoading(true);
                                                const pInfo = await lookupPincode(pincode);
                                                setPincodeLoading(false);
                                                if (pInfo) {
                                                    setForm(prev => ({
                                                        ...prev,
                                                        city: prev.city || pInfo.city,
                                                        state: prev.state || pInfo.state,
                                                        latitude: pInfo.latitude || prev.latitude,
                                                        longitude: pInfo.longitude || prev.longitude,
                                                    }));
                                                }
                                            }
                                        }
                                    }}
                                />
                                {gstLoading && <Loader2 size={16} className="spin input-with-spinner__spinner" />}
                            </div>
                            {errors.gstin && <span className="form-group__error">{errors.gstin}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Email</label>
                            <input type="email" placeholder="client@example.com" className="form-group__input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Phone</label>
                            <input type="tel" placeholder="9876543210" className={`form-group__input${errors.phone ? ' form-group__input--error' : ''}`} value={form.phone} maxLength={10}
                                onChange={(e) => {
                                    const val = transform('phone', e.target.value);
                                    setForm({ ...form, phone: val });
                                    if (val && !validate('phone', val).valid) setErrors(p => ({ ...p, phone: 'Must be 10 digits starting with 6-9' }));
                                    else setErrors(p => ({ ...p, phone: '' }));
                                }}
                            />
                            {errors.phone && <span className="form-group__error">{errors.phone}</span>}
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
                            <div className="input-with-spinner">
                                <input type="text" placeholder="110001" className="form-group__input" value={form.pincode} maxLength={6} onChange={async (e) => {
                                    const val = e.target.value.replaceAll(/\D/g, '').slice(0, 6);
                                    setForm((prev) => ({ ...prev, pincode: val }));
                                    if (val.length === 6) {
                                        setPincodeLoading(true);
                                        const info = await lookupPincode(val);
                                        setPincodeLoading(false);
                                        if (info) setForm((prev) => ({ ...prev, city: info.city, state: info.state, latitude: info.latitude || prev.latitude, longitude: info.longitude || prev.longitude }));
                                    }
                                }} />
                                {pincodeLoading && <Loader2 size={16} className="spin input-with-spinner__spinner" />}
                            </div>
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
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Latitude</label>
                            <input type="number" step="any" placeholder="Auto-filled from pincode" className="form-group__input" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Longitude</label>
                            <input type="number" step="any" placeholder="Auto-filled from pincode" className="form-group__input" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
                        </div>
                    </div>
                    {form.latitude && form.longitude && (
                        <div className="map-link-wrapper">
                            <button type="button" className="btn-cancel btn-map-link" onClick={() => window.open(`https://www.google.com/maps?q=${form.latitude},${form.longitude}`, '_blank')}>
                                <MapPin size={14} /> Locate on Map
                            </button>
                        </div>
                    )}
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={saving || pincodeLoading}>{saving ? 'Saving...' : editTarget ? 'Update Client' : 'Save Client'}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog isOpen={!!deleteTarget} title="Delete Client" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
        </div>
    );
}
