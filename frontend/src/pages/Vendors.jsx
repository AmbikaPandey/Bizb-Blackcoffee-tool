import { useState, useEffect } from 'react';
import { Eye, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageLoader from '../components/common/PageLoader';
import ActionMenu from '../components/common/ActionMenu';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { lookupPincode } from '../utils/pincodeLookup';
import { lookupIFSC } from '../utils/ifscLookup';
import { uppercaseFormData } from '../utils/formTransform';
import { validate, transform } from '../utils/validation';
import { lookupGST, isValidGSTIN, extractPanFromGstin } from '../utils/gstLookup';

const emptyForm = {
    name: '', gstin: '', pan: '', contact: '', contact1: '', contact2: '', pincode: '', city: '', phone: '', email: '', state: '', address: '',
    bank_details: { account_number: '', ifsc_code: '', bank_name: '', branch_name: '', bank_address: '' },
};

export default function Vendors() {
    const toast = useToast();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [gstLoading, setGstLoading] = useState(false);
    const [ifscLoading, setIfscLoading] = useState(false);

    async function loadVendors() {
        try { setVendors(await api.getVendors()); }
        catch { toast('Failed to load vendors', 'error'); }
        finally { setLoading(false); }
    }

    useEffect(() => { loadVendors(); }, []);

    function openCreate() {
        setEditTarget(null);
        setForm({ ...emptyForm });
        setErrors({});
        setShowModal(true);
    }

    function openEdit(v) {
        setEditTarget(v);
        setForm({
            name: v.name || '', gstin: v.gstin || '', pan: v.pan || '', contact: v.contact || '',
            contact1: v.contact1 || '', contact2: v.contact2 || '',
            pincode: v.pincode || '', city: v.city || '', phone: v.phone || '', email: v.email || '',
            state: v.state || '', address: v.address || '',
            bank_details: v.bank_details || { account_number: '', ifsc_code: '', bank_name: '', branch_name: '', bank_address: '' },
        });
        setErrors({});
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) { toast('Vendor name is required', 'error'); return; }
        if (form.phone && !validate('phone', form.phone).valid) { toast('Invalid phone number (10 digits starting with 6-9)', 'error'); return; }
        if (form.contact1 && !validate('phone', form.contact1).valid) { toast('Invalid Contact 1 (10 digits starting with 6-9)', 'error'); return; }
        if (form.contact2 && !validate('phone', form.contact2).valid) { toast('Invalid Contact 2 (10 digits starting with 6-9)', 'error'); return; }
        if (form.pan && !validate('pan', form.pan).valid) { toast('Invalid PAN format', 'error'); return; }
        if (form.gstin && !validate('gstin', form.gstin).valid) { toast('Invalid GSTIN format', 'error'); return; }
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
                                            { icon: <Eye size={15} />, label: 'View Details', onClick: () => navigate(`/vendors/${v.id || v._id}`) },
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
                            <div className="input-with-spinner">
                                <input type="text" placeholder="22AAAAA0000A1Z5" className={`form-group__input${errors.gstin ? ' form-group__input--error' : ''}`} value={form.gstin}
                                    onChange={(e) => {
                                        const val = transform('gstin', e.target.value);
                                        setForm({ ...form, gstin: val });
                                        if (val && !validate('gstin', val).valid) setErrors(p => ({ ...p, gstin: 'Invalid GSTIN' }));
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
                                                pan: info.pan || extractPanFromGstin(prev.gstin) || prev.pan,
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
                            <label className="form-group__label">PAN</label>
                            <input type="text" placeholder="AAAAA9999A" className={`form-group__input${errors.pan ? ' form-group__input--error' : ''}`} value={form.pan} maxLength={10}
                                onChange={(e) => {
                                    const val = transform('pan', e.target.value);
                                    setForm({ ...form, pan: val });
                                    if (val && !validate('pan', val).valid) setErrors(p => ({ ...p, pan: 'Invalid PAN' }));
                                    else setErrors(p => ({ ...p, pan: '' }));
                                }}
                            />
                            {errors.pan && <span className="form-group__error">{errors.pan}</span>}
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Contact Person</label>
                            <input type="text" placeholder="Contact name" className="form-group__input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Email</label>
                            <input type="email" placeholder="vendor@example.com" className="form-group__input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        </div>
                    </div>
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
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Contact 1 (Primary)</label>
                            <input type="tel" placeholder="9876543210" className={`form-group__input${errors.contact1 ? ' form-group__input--error' : ''}`} value={form.contact1} maxLength={10}
                                onChange={(e) => {
                                    const val = transform('phone', e.target.value);
                                    setForm({ ...form, contact1: val });
                                    if (val && !validate('phone', val).valid) setErrors(p => ({ ...p, contact1: 'Must be 10 digits starting with 6-9' }));
                                    else setErrors(p => ({ ...p, contact1: '' }));
                                }}
                            />
                            {errors.contact1 && <span className="form-group__error">{errors.contact1}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Contact 2 (Secondary)</label>
                            <input type="tel" placeholder="9876543210" className={`form-group__input${errors.contact2 ? ' form-group__input--error' : ''}`} value={form.contact2} maxLength={10}
                                onChange={(e) => {
                                    const val = transform('phone', e.target.value);
                                    setForm({ ...form, contact2: val });
                                    if (val && !validate('phone', val).valid) setErrors(p => ({ ...p, contact2: 'Must be 10 digits starting with 6-9' }));
                                    else setErrors(p => ({ ...p, contact2: '' }));
                                }}
                            />
                            {errors.contact2 && <span className="form-group__error">{errors.contact2}</span>}
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
                    <h4 className="form-section-title">Vendor Bank Details</h4>
                    <div className="form-group">
                        <label className="form-group__label">Account Number</label>
                        <input type="text" placeholder="Account number" className="form-group__input"
                            value={form.bank_details?.account_number || ''} onChange={(e) => setForm({ ...form, bank_details: { ...form.bank_details, account_number: e.target.value.replace(/\D/g, '').slice(0, 18) } })} />
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">IFSC Code</label>
                            <div className="input-with-spinner">
                                <input type="text" placeholder="e.g. SBIN0001234" className={`form-group__input${errors.ifsc ? ' form-group__input--error' : ''}`}
                                    maxLength={11}
                                    value={form.bank_details?.ifsc_code || ''}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
                                        setForm({ ...form, bank_details: { ...form.bank_details, ifsc_code: val } });
                                        setErrors(p => ({ ...p, ifsc: '' }));
                                    }}
                                    onBlur={async () => {
                                        const ifsc = form.bank_details?.ifsc_code;
                                        if (!ifsc || ifsc.length !== 11) return;
                                        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc)) { setErrors(p => ({ ...p, ifsc: 'Invalid IFSC format' })); return; }
                                        setIfscLoading(true);
                                        const info = await lookupIFSC(ifsc);
                                        setIfscLoading(false);
                                        if (info) {
                                            setForm(prev => ({ ...prev, bank_details: { ...prev.bank_details, bank_name: info.bank_name, branch_name: info.branch_name, bank_address: info.bank_address } }));
                                        } else {
                                            setErrors(p => ({ ...p, ifsc: 'IFSC not found' }));
                                        }
                                    }}
                                />
                                {ifscLoading && <Loader2 size={16} className="spin input-with-spinner__spinner" />}
                            </div>
                            {errors.ifsc && <span className="form-group__error">{errors.ifsc}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Bank Name</label>
                            <input type="text" placeholder="Auto-filled from IFSC" className="form-group__input"
                                value={form.bank_details?.bank_name || ''} onChange={(e) => setForm({ ...form, bank_details: { ...form.bank_details, bank_name: e.target.value } })} />
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Branch Name</label>
                            <input type="text" placeholder="Auto-filled from IFSC" className="form-group__input"
                                value={form.bank_details?.branch_name || ''} onChange={(e) => setForm({ ...form, bank_details: { ...form.bank_details, branch_name: e.target.value } })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Branch Address</label>
                            <input type="text" placeholder="Auto-filled from IFSC" className="form-group__input"
                                value={form.bank_details?.bank_address || ''} onChange={(e) => setForm({ ...form, bank_details: { ...form.bank_details, bank_address: e.target.value } })} />
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
