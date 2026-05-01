import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, FolderKanban } from 'lucide-react';
import PageLoader from '../components/common/PageLoader';
import StatusBadge from '../components/common/StatusBadge';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';

const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function ClientDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        api.getClient(id)
            .then(setClient)
            .catch(() => { toast('Failed to load client', 'error'); navigate('/clients'); })
            .finally(() => setLoading(false));
        api.getProjects().then(all => setProjects(all.filter(p => String(p.client_id) === id))).catch(() => { });
    }, [id]);

    if (loading) return <PageLoader />;
    if (!client) return null;

    const ledger = client.ledger || [];

    return (
        <div className="client-detail">
            <button className="client-detail__back" onClick={() => navigate('/clients')}>
                <ArrowLeft size={18} /> Back to Clients
            </button>

            <div className="client-detail__top">
                <div className="client-detail__card">
                    <h3 className="client-detail__card-title"><Building2 size={18} /> Client Details</h3>
                    <h2 className="client-detail__name">{client.name}</h2>
                    {client.gstin && <p className="client-detail__gstin">GSTIN: <span className="mono">{client.gstin}</span></p>}
                    {(client.address || client.city || client.state) && (
                        <div className="client-detail__address">
                            <MapPin size={14} />
                            <div>
                                {client.address && <span>{client.address}</span>}
                                {(client.city || client.state || client.pincode) && (
                                    <span>{[client.city, client.state, client.pincode].filter(Boolean).join(', ')}</span>
                                )}
                            </div>
                        </div>
                    )}
                    {(client.phone || client.email || client.contact) && (
                        <div className="client-detail__contact">
                            {client.contact && <p><strong>Contact:</strong> {client.contact}</p>}
                            {client.phone && <p><strong>Phone:</strong> {client.phone}</p>}
                            {client.email && <p><strong>Email:</strong> {client.email}</p>}
                        </div>
                    )}
                </div>

                <div className="client-detail__ledger-card">
                    <h3 className="client-detail__card-title">Client Ledger</h3>
                    <div className="page-card__table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Reference</th>
                                    <th>Description</th>
                                    <th className="text-right">Debit</th>
                                    <th className="text-right">Credit</th>
                                    <th className="text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.map((e, i) => (
                                    <tr key={i}>
                                        <td>{formatDate(e.date)}</td>
                                        <td>{e.reference}</td>
                                        <td className="font-medium">{e.description}</td>
                                        <td className="text-right">{e.debit ? formatCurrency(e.debit) : '-'}</td>
                                        <td className="text-right text-success">{e.credit ? formatCurrency(e.credit) : '-'}</td>
                                        <td className={`text-right font-medium${e.balance > 0 ? ' balance-red' : ''}`}>{formatCurrency(Math.abs(e.balance))}</td>
                                    </tr>
                                ))}
                                {ledger.length === 0 && (
                                    <tr><td colSpan={6} className="text-center">No transactions found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="client-detail__summary-card">
                <h3 className="client-detail__card-title"><FolderKanban size={18} /> Linked Projects</h3>
                {projects.length > 0 ? (
                    <div className="page-card__table">
                        <table>
                            <thead>
                                <tr><th>Project</th><th>Status</th><th className="text-right">Budget</th><th className="text-right">Revenue</th></tr>
                            </thead>
                            <tbody>
                                {projects.map(p => (
                                    <tr key={p.id || p._id} style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
                                        <td className="font-medium">{p.name}{p.code ? ` (${p.code})` : ''}</td>
                                        <td><StatusBadge status={p.status} /></td>
                                        <td className="text-right">{formatCurrency(p.budget)}</td>
                                        <td className="text-right">{formatCurrency(p.revenue || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No projects linked to this client.</p>}
            </div>

            <div className="client-detail__summary-card">
                <h3 className="client-detail__card-title">Account Summary</h3>
                <div className="client-detail__summary-row">
                    <span className="client-detail__summary-label">Total Invoiced</span>
                    <span className="client-detail__summary-value">{formatCurrency(client.totalInvoiced)}</span>
                </div>
                <div className="client-detail__summary-row">
                    <span className="client-detail__summary-label">Total Paid</span>
                    <span className="client-detail__summary-value text-success">{formatCurrency(client.totalPaid)}</span>
                </div>
                <hr className="client-detail__divider" />
                <div className="client-detail__summary-row">
                    <span className="client-detail__summary-label client-detail__summary-label--bold">Outstanding</span>
                    <span className={`client-detail__summary-value client-detail__summary-value--bold${client.outstanding > 0 ? ' balance-red' : ''}`}>{formatCurrency(client.outstanding)}</span>
                </div>
            </div>
        </div>
    );
}
