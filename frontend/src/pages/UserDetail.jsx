import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, CreditCard, Receipt, MapPin, Phone, Mail, Shield, ShieldCheck } from 'lucide-react';
import PageLoader from '../components/common/PageLoader';
import StatusBadge from '../components/common/StatusBadge';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';

const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

function maskAccount(num) {
    if (!num || num.length < 4) return num || '-';
    return '●'.repeat(num.length - 4) + num.slice(-4);
}

export default function UserDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getUser(id)
            .then(setUser)
            .catch(() => { toast('Failed to load user', 'error'); navigate('/users'); })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <PageLoader />;
    if (!user) return null;

    const bank = user.bank_details || {};
    const reimbursements = user.reimbursements || [];

    return (
        <div className="user-detail">
            <button className="user-detail__back" onClick={() => navigate('/users')}>
                <ArrowLeft size={18} /> Back to Users
            </button>

            <div className="user-detail__top">
                <div className="user-detail__card">
                    <h3 className="user-detail__card-title"><User size={18} /> User Details</h3>

                    <div className="user-detail__header">
                        <div className="user-detail__avatar">{user.username?.charAt(0)?.toUpperCase()}</div>
                        <div>
                            <h2 className="user-detail__name">{user.username}</h2>
                            <span className={`role-cell ${user.role === 'Admin' ? 'role-cell--admin' : ''}`}>
                                {user.role === 'Admin' ? <ShieldCheck size={14} /> : <Shield size={14} />}
                                {user.role}
                            </span>
                        </div>
                    </div>

                    <div className="user-detail__info-grid">
                        {user.email && (
                            <div className="user-detail__info-row">
                                <Mail size={14} />
                                <span>Email</span>
                                <strong>{user.email}</strong>
                            </div>
                        )}
                        {user.contact_number && (
                            <div className="user-detail__info-row">
                                <Phone size={14} />
                                <span>Contact</span>
                                <strong>{user.contact_number}</strong>
                            </div>
                        )}
                        {user.employee_code && (
                            <div className="user-detail__info-row">
                                <span></span>
                                <span>Employee Code</span>
                                <strong className="mono">{user.employee_code}</strong>
                            </div>
                        )}
                        {user.designation && (
                            <div className="user-detail__info-row">
                                <span></span>
                                <span>Designation</span>
                                <strong>{user.designation}</strong>
                            </div>
                        )}
                        {user.pan && (
                            <div className="user-detail__info-row">
                                <span></span>
                                <span>PAN</span>
                                <strong className="mono">{user.pan}</strong>
                            </div>
                        )}
                        {user.address && (
                            <div className="user-detail__info-row">
                                <MapPin size={14} />
                                <span>Address</span>
                                <strong>{user.address}</strong>
                            </div>
                        )}
                    </div>

                    <div className="user-detail__meta">
                        <p><strong>Status:</strong> <StatusBadge status={user.is_active ? 'Active' : 'Inactive'} /></p>
                        <p><strong>Created:</strong> {formatDate(user.createdAt)}</p>
                    </div>
                </div>

                <div className="user-detail__card">
                    <h3 className="user-detail__card-title"><CreditCard size={18} /> Bank Details</h3>
                    {bank.account_number ? (
                        <div className="user-detail__bank">
                            <div className="user-detail__bank-row">
                                <span>Account Number</span>
                                <strong>{maskAccount(bank.account_number)}</strong>
                            </div>
                            {bank.ifsc_code && (
                                <div className="user-detail__bank-row">
                                    <span>IFSC Code</span>
                                    <strong className="mono">{bank.ifsc_code}</strong>
                                </div>
                            )}
                            {bank.bank_name && (
                                <div className="user-detail__bank-row">
                                    <span>Bank Name</span>
                                    <strong>{bank.bank_name}</strong>
                                </div>
                            )}
                            {bank.branch_name && (
                                <div className="user-detail__bank-row">
                                    <span>Branch</span>
                                    <strong>{bank.branch_name}</strong>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="user-detail__empty">No bank details added</p>
                    )}
                </div>
            </div>

            {/* Reimbursement History */}
            <div className="user-detail__reimbursement-card">
                <h3 className="user-detail__card-title"><Receipt size={18} /> Reimbursement History</h3>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Project</th>
                                <th>Category</th>
                                <th className="text-right">Amount</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th>Approved By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reimbursements.map((r) => (
                                <tr key={r.id}>
                                    <td>{r.date}</td>
                                    <td className="font-medium">{r.description}</td>
                                    <td>{r.project || '-'}</td>
                                    <td>{r.category || '-'}</td>
                                    <td className="text-right font-medium">{formatCurrency(r.amount)}</td>
                                    <td><StatusBadge status={r.status} /></td>
                                    <td>
                                        {r.status === 'Approved' && (
                                            <StatusBadge status={r.payment_status === 'Paid' ? 'Paid' : 'Unpaid'} />
                                        )}
                                        {r.status !== 'Approved' && '-'}
                                    </td>
                                    <td>{r.approved_by_name || '-'}</td>
                                </tr>
                            ))}
                            {reimbursements.length === 0 && (
                                <tr><td colSpan={8} className="text-center">No reimbursement history</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
