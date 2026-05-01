import { useState, useEffect } from 'react';
import { Eye, Pencil, Trash2, Loader2, IndianRupee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageLoader from '../components/common/PageLoader';
import ActionMenu from '../components/common/ActionMenu';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';
import { lookupPincode } from '../utils/pincodeLookup';
import { lookupIFSC } from '../utils/ifscLookup';
import { uppercaseFormData } from '../utils/formTransform';
import { validate, transform } from '../utils/validation';
import { lookupGST, isValidGSTIN, extractPanFromGstin } from '../utils/gstLookup';

const emptyForm = {
    name: '', gstin: '', pan: '', contact: '', pincode: '', city: '', phone: '', email: '', state: '', address: '',
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
    const [paymentVendor, setPaymentVendor] = useState(null);
    const [vendorPayments, setVendorPayments] = useState([]);
    const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'Bank Transfer', reference: '', notes: '' });
    const [paymentSaving, setPaymentSaving] = useState(false);

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

    async function openPayments(v) {
        setPaymentVendor(v);
        setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'Bank Transfer', reference: '', notes: '' });
        try {
            const data = await api.getVendorPayments(v.id || v._id);
            setVendorPayments(data.payments || []);
        } catch { setVendorPayments([]); }
    }

    async function handleAddPayment(e) {
        e.preventDefault();
        if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) { toast('Amount must be positive', 'error'); return; }
        setPaymentSaving(true);
        try {
            await api.addVendorPayment(paymentVendor.id || paymentVendor._id, { ...paymentForm, amount: parseFloat(paymentForm.amount) });
            toast('Payment recorded');
            const data = await api.getVendorPayments(paymentVendor.id || paymentVendor._id);
            setVendorPayments(data.payments || []);
            setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'Bank Transfer', reference: '', notes: '' });
            loadVendors();
        } catch (err) { toast(err.message || 'Failed to record payment', 'error'); }
        finally { setPaymentSaving(false); }
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
                                <th className="text-right">Total Paid</th>
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
                                    <td className="text-right">{formatCurrency(v.total_paid || 0)}</td>
                                    <td>
                                        <ActionMenu actions={[
                                            { icon: <Eye size={15} />, label: 'View Details', onClick: () => navigate(`/vendors/${v.id || v._id}`) },
                                            { icon: <IndianRupee size={15} />, label: 'Payments', onClick: () => openPayments(v) },
                                            { icon: <Pencil size={15} />, label: 'Edit', onClick: () => openEdit(v) },
                                            { divider: true },
                                            { icon: <Trash2 size={15} />, label: 'Delete', danger: true, onClick: () => setDeleteTarget(v) },
                                        ]} />
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={8} className="text-center">No vendors found</td></tr>
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
                            <div style={{ position: 'relative' }}>
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
                                            setForm(prev => ({
                                                ...prev,
                                                name: info.name || prev.name,
                                                address: info.address || prev.address,
                                                state: info.state || prev.state,
                                                pan: info.pan || extractPanFromGstin(prev.gstin) || prev.pan,
                                                pincode: info.pincode || prev.pincode,
                                            }));
                                        }
                                    }}
                                />
                                {gstLoading && <Loader2 size={16} className="spin" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />}
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
                    <h4 style={{ margin: '1rem 0 0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>Bank Details</h4>
                    <div className="form-group">
                        <label className="form-group__label">Account Number</label>
                        <input type="text" placeholder="Account number" className="form-group__input"
                            value={form.bank_details?.account_number || ''} onChange={(e) => setForm({ ...form, bank_details: { ...form.bank_details, account_number: e.target.value.replace(/\D/g, '').slice(0, 18) } })} />
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">IFSC Code</label>
                            <div style={{ position: 'relative' }}>
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
                                {ifscLoading && <Loader2 size={16} className="spin" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />}
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

            {/* Vendor Payments Modal */}
            <Modal isOpen={!!paymentVendor} onClose={() => setPaymentVendor(null)} title={`Payments — ${paymentVendor?.name || ''}`}>
                {vendorPayments.length > 0 && (
                    <div className="page-card__table" style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '1rem' }}>
                        <table>
                            <thead>
                                <tr><th>Date</th><th>Mode</th><th>Reference</th><th className="text-right">Amount</th></tr>
                            </thead>
                            <tbody>
                                {vendorPayments.map((p, i) => (
                                    <tr key={p._id || i}>
                                        <td>{p.date}</td>
                                        <td>{p.mode}</td>
                                        <td>{p.reference || '-'}</td>
                                        <td className="text-right">{formatCurrency(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {vendorPayments.length === 0 && <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>No payments recorded yet.</p>}
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0.5rem 0' }}>Record New Payment</h4>
                <form onSubmit={handleAddPayment}>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Amount *</label>
                            <input type="number" step="0.01" min="0.01" placeholder="0.00" className="form-group__input" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Date *</label>
                            <input type="date" className="form-group__input" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} required />
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Mode</label>
                            <select className="form-group__input" value={paymentForm.mode} onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })}>
                                <option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>UPI</option><option>Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Reference</label>
                            <input type="text" placeholder="Transaction ref" className="form-group__input" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setPaymentVendor(null)}>Close</button>
                        <button type="submit" className="btn-save" disabled={paymentSaving}>{paymentSaving ? 'Saving...' : 'Record Payment'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
