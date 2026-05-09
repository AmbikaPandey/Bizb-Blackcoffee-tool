import { useState, useEffect, useRef } from 'react';
import { Shield, ShieldCheck, Eye, Pencil, Trash2, KeyRound, ToggleLeft, ToggleRight, Loader2, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import ActionMenu from '../components/common/ActionMenu';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { lookupIFSC } from '../utils/ifscLookup';
import { validate, transform } from '../utils/validation';
import { MODULES, ALL_ACTIONS, getPresetForRole, buildDefaultPermissions } from '../utils/permissions';

const emptyForm = {
    username: '', email: '', password: '', role: 'Executive', pan: '',
    contact_number: '', address: '', employee_code: '', designation: '',
    pincode: '', office_branch: '',
    bank_details: { account_number: '', ifsc_code: '', bank_name: '', branch_name: '', bank_address: '' },
    permissions: getPresetForRole('Executive'),
};

export default function UsersPage() {
    const { user: currentUser, isAdmin, can } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [passwordModal, setPasswordModal] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [ifscLoading, setIfscLoading] = useState(false);
    const [ifscError, setIfscError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [permExpanded, setPermExpanded] = useState(false);
    const permBodyRef = useRef(null);

    const canCreate = can('users', 'create');
    const canEdit = can('users', 'edit');
    const canDelete = can('users', 'delete');
    const isSelf = (u) => u.id === currentUser?.id || u._id === currentUser?.id;
    const editingSelf = editingUser && isSelf(editingUser);
    const readOnlyForSelf = editingSelf && !isAdmin;

    const loadUsers = () => {
        api.getUsers().then(setUsers).catch(() => { });
    };

    useEffect(() => { loadUsers(); }, []);

    const openAddModal = () => {
        setEditingUser(null);
        setForm(emptyForm);
        setError('');
        setFieldErrors({});
        setShowModal(true);
    };

    const openEditModal = (u) => {
        setEditingUser(u);
        setForm({
            username: u.username, email: u.email, password: '', role: u.role, pan: u.pan || '',
            contact_number: u.contact_number || '', address: u.address || '',
            employee_code: u.employee_code || '', designation: u.designation || '',
            pincode: u.pincode || '', office_branch: u.office_branch || '',
            bank_details: u.bank_details || { account_number: '', ifsc_code: '', bank_name: '', branch_name: '', bank_address: '' },
            permissions: u.permissions || getPresetForRole(u.role),
        });
        setError('');
        setFieldErrors({});
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username || !form.email || (!editingUser && !form.password)) {
            setError(editingUser ? 'Username and email are required' : 'Username, email and password are required');
            return;
        }
        if (form.contact_number && !validate('phone', form.contact_number).valid) {
            setError('Invalid phone number (10 digits starting with 6-9)');
            return;
        }
        if (form.pan && !validate('pan', form.pan).valid) {
            setError('Invalid PAN format (AAAAA9999A)');
            return;
        }
        if (form.pincode && !validate('pincode', form.pincode).valid) {
            setError('Invalid pincode (must be 6 digits)');
            return;
        }
        setError('');
        setSaving(true);
        try {
            const submitData = { ...form, employee_code: form.employee_code ? `BC-${form.employee_code.replace(/^BC-/, '')}` : '' };
            if (editingUser) {
                const { password, ...data } = submitData;
                await api.updateUser(editingUser.id, data);
            } else {
                await api.createUser(submitData);
            }
            setShowModal(false);
            setForm(emptyForm);
            setEditingUser(null);
            loadUsers();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (u) => {
        try {
            await api.updateUser(u.id, { is_active: !u.is_active });
            loadUsers();
        } catch { }
    };

    const handleDelete = async (u) => {
        if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
        try {
            await api.deleteUser(u.id);
            loadUsers();
        } catch (err) {
            alert(err.message);
        }
    };

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        if (!newPassword || newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        setError('');
        setSaving(true);
        try {
            await api.updateUserPassword(passwordModal.id, newPassword);
            setPasswordModal(null);
            setNewPassword('');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <PageHeader title="Users" subtitle={canCreate ? "Manage user accounts and permissions" : "Your profile"}
                buttonLabel={canCreate ? "Add User" : undefined} onButtonClick={canCreate ? openAddModal : undefined} />

            <div className="page-card users-table">
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">
                                        No users found. Click "Add User" to create one.
                                    </td>
                                </tr>
                            ) : users.map((u) => {

                                return (
                                    <tr key={u.id}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="user-cell__avatar">{u.username.charAt(0)}</div>
                                                <span className="user-cell__name">{u.username}</span>
                                            </div>
                                        </td>
                                        <td>{u.email}</td>
                                        <td>
                                            <span className={`role-cell ${u.role === 'Admin' ? 'role-cell--admin' : ''}`}>
                                                {u.role === 'Admin' ? <ShieldCheck size={14} /> : <Shield size={14} />}
                                                {u.role}
                                            </span>
                                        </td>
                                        <td><StatusBadge status={u.is_active ? 'Active' : 'Inactive'} /></td>
                                        <td>
                                            <ActionMenu actions={[
                                                { icon: <Eye size={15} />, label: 'View Details', onClick: () => navigate(`/users/${u.id}`) },
                                                ...((canEdit || isSelf(u)) ? [
                                                    { icon: <Pencil size={15} />, label: 'Edit', onClick: () => openEditModal(u) },
                                                    { icon: <KeyRound size={15} />, label: 'Reset Password', onClick: () => { setPasswordModal(u); setNewPassword(''); setError(''); } },
                                                ] : []),
                                                ...(isAdmin ? [
                                                    { icon: u.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />, label: u.is_active ? 'Deactivate' : 'Activate', onClick: () => handleToggleActive(u) },
                                                ] : []),
                                                ...(canDelete && !isSelf(u) ? [{ divider: true }, { icon: <Trash2 size={15} />, label: 'Delete', danger: true, onClick: () => handleDelete(u) }] : []),
                                            ]} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add / Edit User Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)}
                title={editingUser ? 'Edit User' : 'Add New User'}>
                <form onSubmit={handleSubmit}>
                    {error && <div className="form-error-banner">{error}</div>}
                    <div className="form-group">
                        <label className="form-group__label">Username *</label>
                        <input type="text" placeholder="Enter username" className="form-group__input"
                            value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                            disabled={readOnlyForSelf} />
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Email *</label>
                        <input type="email" placeholder="user@blackcoffee.agency" className="form-group__input"
                            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                            disabled={readOnlyForSelf} />
                    </div>
                    {!editingUser && (
                        <div className="form-group">
                            <label className="form-group__label">Password *</label>
                            <input type="password" placeholder="Enter password" className="form-group__input"
                                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-group__label">Role</label>
                        <select className="form-group__select" value={form.role}
                            onChange={(e) => {
                                const newRole = e.target.value;
                                const newPerms = newRole === 'Custom' ? form.permissions : getPresetForRole(newRole);
                                setForm({ ...form, role: newRole, permissions: newPerms });
                            }}
                            disabled={!isAdmin || readOnlyForSelf}>
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Executive">Executive</option>
                            <option value="Staff">Staff</option>
                            <option value="Custom">Custom</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Contact Number</label>
                        <input type="text" placeholder="9876543210" className={`form-group__input${fieldErrors.phone ? ' form-group__input--error' : ''}`}
                            value={form.contact_number} maxLength={10}
                            onChange={(e) => {
                                const val = transform('phone', e.target.value);
                                setForm({ ...form, contact_number: val });
                                if (val && !validate('phone', val).valid) setFieldErrors(p => ({ ...p, phone: 'Must be 10 digits starting with 6-9' }));
                                else setFieldErrors(p => ({ ...p, phone: '' }));
                            }} />
                        {fieldErrors.phone && <span className="form-group__error">{fieldErrors.phone}</span>}
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Designation</label>
                        <input type="text" placeholder="e.g. Software Engineer" className="form-group__input"
                            value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Employee Code</label>
                        <div className="input-prefix-group">
                            <span className="input-prefix-group__prefix">BC-</span>
                            <input type="text" placeholder="Auto-generated" className="form-group__input"
                                value={form.employee_code.replace(/^BC-/, '')} onChange={(e) => setForm({ ...form, employee_code: e.target.value.replace(/^BC-/, '') })}
                                disabled={readOnlyForSelf} />
                        </div>
                        <span className="form-hint">Leave empty for auto-generation</span>
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">PAN</label>
                        <input type="text" placeholder="AAAAA9999A" className={`form-group__input${fieldErrors.pan ? ' form-group__input--error' : ''}`}
                            value={form.pan} maxLength={10}
                            onChange={(e) => {
                                const val = transform('pan', e.target.value);
                                setForm({ ...form, pan: val });
                                if (val && !validate('pan', val).valid) setFieldErrors(p => ({ ...p, pan: 'Invalid PAN format' }));
                                else setFieldErrors(p => ({ ...p, pan: '' }));
                            }} />
                        {fieldErrors.pan && <span className="form-group__error">{fieldErrors.pan}</span>}
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Address</label>
                        <input type="text" placeholder="Full address" className="form-group__input"
                            value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Pincode</label>
                            <input type="text" placeholder="110001" className={`form-group__input${fieldErrors.pincode ? ' form-group__input--error' : ''}`}
                                value={form.pincode} maxLength={6}
                                onChange={(e) => {
                                    const val = transform('pincode', e.target.value);
                                    setForm({ ...form, pincode: val });
                                    if (val && !validate('pincode', val).valid) setFieldErrors(p => ({ ...p, pincode: 'Must be 6 digits' }));
                                    else setFieldErrors(p => ({ ...p, pincode: '' }));
                                }} />
                            {fieldErrors.pincode && <span className="form-group__error">{fieldErrors.pincode}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Office Branch</label>
                            <select className="form-group__select"
                                value={form.office_branch} onChange={(e) => setForm({ ...form, office_branch: e.target.value })}>
                                <option value="">Select Branch</option>
                                <option value="Delhi">Delhi</option>
                            </select>
                        </div>
                    </div>
                    <h4 className="form-section-title">Employee Bank Details</h4>
                    <div className="form-group">
                        <label className="form-group__label">Account Number</label>
                        <input type="text" placeholder="Account number" className="form-group__input"
                            value={form.bank_details?.account_number || ''} onChange={(e) => setForm({ ...form, bank_details: { ...form.bank_details, account_number: e.target.value } })} />
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">IFSC Code</label>
                            <div className="input-with-spinner">
                                <input type="text" placeholder="e.g. SBIN0001234" className="form-group__input"
                                    maxLength={11}
                                    value={form.bank_details?.ifsc_code || ''}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase().replaceAll(/[^A-Z0-9]/g, '').slice(0, 11);
                                        setForm({ ...form, bank_details: { ...form.bank_details, ifsc_code: val } });
                                        setIfscError('');
                                    }}
                                    onBlur={async () => {
                                        const ifsc = form.bank_details?.ifsc_code;
                                        if (ifsc?.length !== 11) return;
                                        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc)) {
                                            setIfscError('Invalid IFSC format');
                                            return;
                                        }
                                        setIfscLoading(true);
                                        setIfscError('');
                                        const info = await lookupIFSC(ifsc);
                                        setIfscLoading(false);
                                        if (info) {
                                            setForm(prev => ({ ...prev, bank_details: { ...prev.bank_details, bank_name: info.bank_name, branch_name: info.branch_name, bank_address: info.bank_address } }));
                                        } else {
                                            setIfscError('IFSC not found');
                                        }
                                    }}
                                />
                                {ifscLoading && <Loader2 size={16} className="spin input-with-spinner__spinner" />}
                            </div>
                            {ifscError && <span className="field-error">{ifscError}</span>}
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

                    {/* Permission Matrix — visible for Admin editing non-Admin users */}
                    {isAdmin && form.role !== 'Admin' && (
                        <div className={`permission-matrix ${permExpanded ? 'permission-matrix--expanded' : ''}`}>
                            <button type="button" className="permission-matrix__toggle" onClick={() => setPermExpanded(!permExpanded)}>
                                <div className="permission-matrix__toggle-left">
                                    <Shield size={18} />
                                    <span className="permission-matrix__title">Permissions</span>
                                    <span className="permission-matrix__badge">
                                        {Object.entries(form.permissions || {}).reduce((n, [, acts]) => n + Object.values(acts).filter(Boolean).length, 0)} active
                                    </span>
                                </div>
                                <ChevronDown size={18} className="permission-matrix__chevron" />
                            </button>
                            <div className="permission-matrix__body" ref={permBodyRef}
                                style={{ maxHeight: permExpanded ? permBodyRef.current?.scrollHeight + 'px' : '0' }}>
                                <div className="permission-matrix__toolbar">
                                    <button type="button" className="btn-link" onClick={() => setForm({ ...form, permissions: buildDefaultPermissions(true) })}>Select All</button>
                                    <button type="button" className="btn-link" onClick={() => setForm({ ...form, permissions: buildDefaultPermissions(false) })}>Clear All</button>
                                </div>
                                <div className="permission-matrix__table-wrap">
                                    <table className="permission-matrix__table">
                                        <thead>
                                            <tr>
                                                <th>Module</th>
                                                {ALL_ACTIONS.map(a => <th key={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(MODULES).map(([mod, def]) => (
                                                <tr key={mod}>
                                                    <td className="permission-matrix__module">{def.label}</td>
                                                    {ALL_ACTIONS.map(action => (
                                                        <td key={action} className="permission-matrix__check">
                                                            {def.actions.includes(action) ? (
                                                                <input type="checkbox" checked={!!form.permissions?.[mod]?.[action]}
                                                                    onChange={(e) => {
                                                                        const perms = { ...form.permissions };
                                                                        perms[mod] = { ...perms[mod], [action]: e.target.checked };
                                                                        setForm({ ...form, permissions: perms, role: 'Custom' });
                                                                    }}
                                                                />
                                                            ) : <span className="permission-matrix__na">—</span>}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={saving}>
                            {saving ? 'Saving...' : editingUser ? 'Update User' : 'Add User'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Reset Password Modal */}
            <Modal isOpen={!!passwordModal} onClose={() => setPasswordModal(null)}
                title={`Reset Password — ${passwordModal?.username}`}>
                <form onSubmit={handlePasswordReset}>
                    {error && <div className="form-error-banner">{error}</div>}
                    <div className="form-group">
                        <label className="form-group__label">New Password *</label>
                        <input type="password" placeholder="Min 6 characters" className="form-group__input"
                            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setPasswordModal(null)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={saving}>
                            {saving ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
