import { useState, useEffect, useRef, useCallback } from 'react';
import { Building2, FileText, Landmark, Upload, X, Save, Pencil, XCircle, CircleCheck, CircleAlert } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import PageLoader from '../components/common/PageLoader';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { lookupPincode } from '../utils/pincodeLookup';
import { lookupIFSC } from '../utils/ifscLookup';
import { lookupGST, isValidGSTIN, extractPanFromGstin } from '../utils/gstLookup';
import { uppercaseFormData } from '../utils/formTransform';
import { validate, getHint, transform } from '../utils/validation';

const TABS = [
    { key: 'company', label: 'Company', icon: Building2 },
    { key: 'bank', label: 'Bank Details', icon: Landmark },
    { key: 'invoice', label: 'Invoice Settings', icon: FileText },
];

const INIT_COMPANY = {
    name: '', gstin: '', pan: '', address_line1: '', address_line2: '',
    city: '', state: '', pincode: '', state_code: '', phone: '', email: '', logo: '', signature: '',
};
const INIT_BANK = { bank: '', accountNo: '', ifsc: '', upi: '' };
const INIT_INVOICE = { prefix: 'BC', proforma_prefix: 'PI', receipt_prefix: 'REC', round_off: true, terms: '' };

function ValidatedField({ label, field, value, disabled, onChange, onSideEffect, type = 'text', fullWidth, maxLength }) {
    const [touched, setTouched] = useState(false);
    const result = touched && value ? validate(field, value) : { valid: true };
    const hint = getHint(field);
    const showError = touched && value && !result.valid;
    const showSuccess = touched && value && result.valid;

    const statusClass = showError ? 'vf--error' : showSuccess ? 'vf--success' : '';

    const handleChange = (e) => {
        const transformed = transform(field, e.target.value);
        onChange(transformed);
        if (!touched) setTouched(true);
        if (onSideEffect) onSideEffect(transformed);
    };

    return (
        <div className={`settings-card__field ${fullWidth ? 'settings-card__field--full' : ''}`}>
            <label>{label}</label>
            <div className={`vf ${statusClass}`}>
                <input
                    type={type}
                    value={value}
                    disabled={disabled}
                    maxLength={maxLength}
                    onChange={handleChange}
                    onBlur={() => setTouched(true)}
                    aria-invalid={showError || undefined}
                    aria-describedby={showError ? `${field}-error` : undefined}
                />
                {!disabled && showSuccess && <CircleCheck size={16} className="vf__icon vf__icon--success" aria-label="Valid" />}
                {!disabled && showError && <CircleAlert size={16} className="vf__icon vf__icon--error" aria-label="Invalid" />}
            </div>
            {!disabled && showError && <span className="vf__msg vf__msg--error" id={`${field}-error`} role="alert">{result.error}</span>}
            {!disabled && !showError && hint && <span className="vf__msg vf__msg--hint">{hint}</span>}
        </div>
    );
}

export default function Settings() {
    const toast = useToast();
    const [tab, setTab] = useState('company');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const logoInputRef = useRef(null);
    const signatureInputRef = useRef(null);

    const [company, setCompany] = useState(INIT_COMPANY);
    const [bank, setBank] = useState(INIT_BANK);
    const [invoice, setInvoice] = useState(INIT_INVOICE);

    const snapshot = useRef({ company: INIT_COMPANY, bank: INIT_BANK, invoice: INIT_INVOICE });

    useEffect(() => {
        api.getSettings().then((data) => {
            const c = { ...INIT_COMPANY, ...data.company };
            const b = { ...INIT_BANK, ...data.bank };
            const i = { ...INIT_INVOICE, ...data.invoice };
            setCompany(c);
            setBank(b);
            setInvoice(i);
            snapshot.current = { company: c, bank: b, invoice: i };
        }).catch(() => toast('Failed to load settings', 'error')).finally(() => setLoading(false));
    }, []);

    const handleEdit = useCallback(() => {
        snapshot.current = { company, bank, invoice };
        setEditing(true);
    }, [company, bank, invoice]);

    const handleCancel = useCallback(() => {
        setCompany(snapshot.current.company);
        setBank(snapshot.current.bank);
        setInvoice(snapshot.current.invoice);
        setEditing(false);
    }, []);

    const handleLogoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 500 * 1024) { toast('Logo must be under 500KB', 'error'); return; }
        const reader = new FileReader();
        reader.onload = () => setCompany((prev) => ({ ...prev, logo: reader.result }));
        reader.readAsDataURL(file);
    };

    const handleSignatureUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
        if (!allowed.includes(file.type)) { toast('Signature must be PNG, JPG, JPEG, or SVG', 'error'); return; }
        if (file.size > 200 * 1024) { toast('Signature must be under 200KB', 'error'); return; }
        const reader = new FileReader();
        reader.onload = () => setCompany((prev) => ({ ...prev, signature: reader.result }));
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const hasValidationErrors = () => {
        const checks = [
            company.gstin && !validate('gstin', company.gstin).valid,
            company.pan && !validate('pan', company.pan).valid,
            company.email && !validate('email', company.email).valid,
            company.phone && !validate('phone', company.phone).valid,
            company.pincode && !validate('pincode', company.pincode).valid,
            bank.ifsc && !validate('ifsc', bank.ifsc).valid,
            bank.accountNo && !validate('accountNo', bank.accountNo).valid,
            bank.upi && !validate('upi', bank.upi).valid,
        ];
        return checks.some(Boolean);
    };

    const handleSave = async () => {
        if (hasValidationErrors()) {
            toast('Please fix validation errors before saving', 'error');
            return;
        }
        setSaving(true);
        try {
            await api.saveSettings({ company: uppercaseFormData(company), bank: uppercaseFormData(bank), invoice });
            snapshot.current = { company, bank, invoice };
            toast('Settings saved successfully');
            setEditing(false);
        } catch {
            toast('Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const year = new Date().getFullYear();
    const invoicePreview = `${invoice.prefix}/${year}/00001`;
    const disabled = !editing;

    if (loading) return <PageLoader />;

    const headerActions = editing ? (
        <button className="btn-edit btn-edit--cancel" onClick={handleCancel}>
            <XCircle size={16} /> Cancel
        </button>
    ) : (
        <button className="btn-edit" onClick={handleEdit}>
            <Pencil size={16} /> Edit
        </button>
    );

    return (
        <div className={editing ? 'settings-page--editing' : undefined}>
            <PageHeader
                title="Settings"
                subtitle="Manage company and invoice settings"
                actions={headerActions}
                buttonLabel={editing ? (saving ? 'Saving...' : 'Save Changes') : null}
                buttonIcon={<Save size={16} />}
                onButtonClick={editing ? handleSave : undefined}
            />

            <div className="tabs">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setTab(key)} className={`tabs__btn ${tab === key ? 'tabs__btn--active' : ''}`}>
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            {/* ── Company Tab ────────────────────────────── */}
            {tab === 'company' && (
                <div className="settings-card">
                    <div className="settings-card__header">
                        <h3>Company Information</h3>
                        <p>Your business details that appear on invoices</p>
                    </div>

                    <div className="settings-card__body">
                        {editing && (
                            <>
                                {company.logo && (
                                    <div className="settings-card__logo-wrap">
                                        <img src={company.logo} alt="Logo" className="settings-card__logo-img" />
                                        <button type="button" className="settings-card__logo-remove" onClick={() => setCompany({ ...company, logo: '' })}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                                <button type="button" className="settings-card__upload-btn" onClick={() => logoInputRef.current?.click()}>
                                    <Upload size={16} /> {company.logo ? 'Change Logo' : 'Upload Logo'}
                                </button>
                                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleLogoUpload} />
                            </>
                        )}
                        {!editing && company.logo && (
                            <img src={company.logo} alt="Logo" className="settings-card__logo-img" />
                        )}

                        {/* ── Digital Signature ── */}
                        <div className="settings-card__sig-section">
                            <label className="settings-card__sig-label">Digital Signature</label>
                            {company.signature ? (
                                <div className="settings-card__sig-wrap">
                                    <img src={company.signature} alt="Signature" className="settings-card__sig-img" />
                                    {editing && (
                                        <div className="settings-card__sig-actions">
                                            <button type="button" className="settings-card__upload-btn" onClick={() => signatureInputRef.current?.click()}>
                                                <Upload size={14} /> Replace Signature
                                            </button>
                                            <button type="button" className="settings-card__logo-remove" onClick={() => setCompany((prev) => ({ ...prev, signature: '' }))}>
                                                <X size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                            {!company.signature && editing && (
                                <button type="button" className="settings-card__upload-btn" onClick={() => signatureInputRef.current?.click()}>
                                    <Upload size={14} /> Upload Signature
                                </button>
                            )}
                            {!company.signature && !editing && (
                                <p className="settings-card__sig-empty">No signature uploaded</p>
                            )}
                            <input ref={signatureInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" hidden onChange={handleSignatureUpload} />
                            {editing && <p className="settings-card__sig-hint">PNG, JPG, JPEG or SVG · max 200 KB · appears on invoices</p>}
                        </div>

                        <div className="settings-card__field settings-card__field--full">
                            <label>Company Name</label>
                            <input type="text" value={company.name} disabled={disabled} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
                        </div>
                        <div className="settings-card__row">
                            <ValidatedField label="GSTIN" field="gstin" value={company.gstin} disabled={disabled} maxLength={15}
                                onChange={(v) => setCompany((prev) => ({ ...prev, gstin: v }))}
                                onSideEffect={async (v) => {
                                    if (v.length === 15 && isValidGSTIN(v)) {
                                        const info = await lookupGST(v);
                                        if (info) {
                                            setCompany((prev) => ({
                                                ...prev,
                                                name: info.name || prev.name,
                                                pan: info.pan || extractPanFromGstin(v) || prev.pan,
                                                address_line1: info.address || prev.address_line1,
                                                city: info.city || prev.city,
                                                state: info.state || prev.state,
                                                pincode: info.pincode || prev.pincode,
                                                state_code: info.state_code || v.substring(0, 2),
                                            }));
                                        }
                                    }
                                }} />
                            <ValidatedField label="PAN" field="pan" value={company.pan} disabled={disabled} maxLength={10}
                                onChange={(v) => setCompany((prev) => ({ ...prev, pan: v }))} />
                        </div>
                        <div className="settings-card__field settings-card__field--full">
                            <label>Address Line 1</label>
                            <input type="text" value={company.address_line1} disabled={disabled} onChange={(e) => setCompany({ ...company, address_line1: e.target.value })} />
                        </div>
                        <div className="settings-card__field settings-card__field--full">
                            <label>Address Line 2</label>
                            <input type="text" value={company.address_line2} disabled={disabled} onChange={(e) => setCompany({ ...company, address_line2: e.target.value })} />
                        </div>
                        <div className="settings-card__row">
                            <div className="settings-card__field">
                                <label>City</label>
                                <input type="text" value={company.city} disabled={disabled} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
                            </div>
                            <div className="settings-card__field">
                                <label>State</label>
                                <input type="text" value={company.state} disabled={disabled} onChange={(e) => setCompany({ ...company, state: e.target.value })} />
                            </div>
                        </div>
                        <div className="settings-card__row">
                            <ValidatedField label="Pincode" field="pincode" value={company.pincode} disabled={disabled} maxLength={6}
                                onChange={(v) => setCompany((prev) => ({ ...prev, pincode: v }))}
                                onSideEffect={async (v) => {
                                    if (v.length === 6) {
                                        const info = await lookupPincode(v);
                                        if (info) setCompany((prev) => ({ ...prev, city: info.city, state: info.state, state_code: info.state_code }));
                                    }
                                }} />
                            <div className="settings-card__field">
                                <label>State Code</label>
                                <input type="text" value={company.state_code} disabled={disabled} onChange={(e) => setCompany({ ...company, state_code: e.target.value })} />
                            </div>
                        </div>
                        <div className="settings-card__row">
                            <ValidatedField label="Phone" field="phone" type="tel" value={company.phone} disabled={disabled} maxLength={10}
                                onChange={(v) => setCompany((prev) => ({ ...prev, phone: v }))} />
                            <ValidatedField label="Email" field="email" type="email" value={company.email} disabled={disabled}
                                onChange={(v) => setCompany((prev) => ({ ...prev, email: v }))} />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Bank Details Tab ───────────────────────── */}
            {tab === 'bank' && (
                <div className="settings-card">
                    <div className="settings-card__header">
                        <h3>Bank Account Details</h3>
                        <p>Payment details shown on invoices</p>
                    </div>
                    <div className="settings-card__body">
                        <div className="settings-card__field settings-card__field--full">
                            <label>Bank Name & Branch</label>
                            <input type="text" value={bank.bank} disabled={disabled} onChange={(e) => setBank({ ...bank, bank: e.target.value })} />
                        </div>
                        <div className="settings-card__row">
                            <ValidatedField label="Account Number" field="accountNo" value={bank.accountNo} disabled={disabled} maxLength={18}
                                onChange={(v) => setBank((prev) => ({ ...prev, accountNo: v }))} />
                            <ValidatedField label="IFSC Code" field="ifsc" value={bank.ifsc} disabled={disabled} maxLength={11}
                                onChange={(v) => setBank((prev) => ({ ...prev, ifsc: v }))}
                                onSideEffect={async (v) => {
                                    if (v.length === 11) {
                                        const info = await lookupIFSC(v);
                                        if (info) setBank((prev) => ({ ...prev, bank: info.bank }));
                                    }
                                }} />
                        </div>
                        <ValidatedField label="UPI ID" field="upi" value={bank.upi} disabled={disabled} fullWidth
                            onChange={(v) => setBank((prev) => ({ ...prev, upi: v }))} />
                    </div>
                </div>
            )}

            {/* ── Invoice Settings Tab ───────────────────── */}
            {tab === 'invoice' && (
                <>
                    <div className="settings-card">
                        <div className="settings-card__header">
                            <h3>Invoice Numbering</h3>
                            <p>Configure invoice number prefixes</p>
                        </div>
                        <div className="settings-card__body">
                            <div className="settings-card__row settings-card__row--3">
                                <div className="settings-card__field">
                                    <label>Invoice Prefix</label>
                                    <input type="text" value={invoice.prefix} disabled={disabled} onChange={(e) => setInvoice({ ...invoice, prefix: e.target.value })} />
                                </div>
                                <div className="settings-card__field">
                                    <label>Proforma Prefix</label>
                                    <input type="text" value={invoice.proforma_prefix} disabled={disabled} onChange={(e) => setInvoice({ ...invoice, proforma_prefix: e.target.value })} />
                                </div>
                                <div className="settings-card__field">
                                    <label>Receipt Prefix</label>
                                    <input type="text" value={invoice.receipt_prefix} disabled={disabled} onChange={(e) => setInvoice({ ...invoice, receipt_prefix: e.target.value })} />
                                </div>
                            </div>
                            <div className="settings-card__preview">
                                <strong>Preview:</strong> {invoicePreview}
                            </div>
                        </div>
                    </div>

                    <div className="settings-card">
                        <div className="settings-card__header">
                            <h3>Invoice Options</h3>
                        </div>
                        <div className="settings-card__body">
                            <div className="settings-card__toggle-row">
                                <div>
                                    <strong>Round Off Total</strong>
                                    <p>Automatically round invoice totals to nearest rupee</p>
                                </div>
                                <label className="settings-toggle">
                                    <input type="checkbox" checked={invoice.round_off} disabled={disabled} onChange={(e) => setInvoice({ ...invoice, round_off: e.target.checked })} />
                                    <span className="settings-toggle__track" />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="settings-card">
                        <div className="settings-card__header">
                            <h3>Payment Terms</h3>
                            <p>These will appear on all invoices by default</p>
                        </div>
                        <div className="settings-card__body">
                            <div className="settings-card__field settings-card__field--full">
                                <textarea rows={5} value={invoice.terms} disabled={disabled} onChange={(e) => setInvoice({ ...invoice, terms: e.target.value })} placeholder="Enter default terms and conditions..." />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
