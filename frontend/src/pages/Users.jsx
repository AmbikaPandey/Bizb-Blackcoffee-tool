import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Pencil, Trash2, KeyRound, ToggleLeft, ToggleRight } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import ActionMenu from '../components/common/ActionMenu';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { uppercaseFormData } from '../utils/formTransform';

const emptyForm = { username: '', email: '', password: '', role: 'Admin' };

export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [passwordModal, setPasswordModal] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const loadUsers = () => {
        api.getUsers().then(setUsers).catch(() => { });
    };

    useEffect(() => { loadUsers(); }, []);

    const openAddModal = () => {
        setEditingUser(null);
        setForm(emptyForm);
        setError('');
        setShowModal(true);
    };

    const openEditModal = (u) => {
        setEditingUser(u);
        setForm({ username: u.username, email: u.email, password: '', role: u.role });
        setError('');
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username || !form.email || (!editingUser && !form.password)) {
            setError(editingUser ? 'Username and email are required' : 'Username, email and password are required');
            return;
        }
        setError('');
        setSaving(true);
        try {
            const data = uppercaseFormData(form);
            if (editingUser) {
                await api.updateUser(editingUser.id, { username: data.username, email: data.email, role: data.role });
            } else {
                await api.register(data);
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
            <PageHeader title="Users" subtitle="Manage user accounts and permissions"
                buttonLabel="Add User" onButtonClick={openAddModal} />

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
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                        No users found. Click "Add User" to create one.
                                    </td>
                                </tr>
                            ) : users.map((u) => {
                                const isSelf = u.id === currentUser?.id;
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
                                                { icon: <Pencil size={15} />, label: 'Edit', onClick: () => openEditModal(u) },
                                                { icon: <KeyRound size={15} />, label: 'Reset Password', onClick: () => { setPasswordModal(u); setNewPassword(''); setError(''); } },
                                                { icon: u.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />, label: u.is_active ? 'Deactivate' : 'Activate', onClick: () => handleToggleActive(u) },
                                                { divider: true },
                                                { icon: <Trash2 size={15} />, label: 'Delete', danger: true, onClick: () => handleDelete(u) },
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
                    {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '0.75rem', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</div>}
                    <div className="form-group">
                        <label className="form-group__label">Username *</label>
                        <input type="text" placeholder="Enter username" className="form-group__input"
                            value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Email *</label>
                        <input type="email" placeholder="user@blackcoffee.in" className="form-group__input"
                            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
                            onChange={(e) => setForm({ ...form, role: e.target.value })}>
                            <option value="Admin">Admin</option>
                            <option value="User">User</option>
                        </select>
                    </div>
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
                    {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '0.75rem', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</div>}
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
