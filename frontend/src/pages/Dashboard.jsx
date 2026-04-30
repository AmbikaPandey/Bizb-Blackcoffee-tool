import { useState, useEffect } from 'react';
import { Users, FileText, TrendingUp, IndianRupee, AlertCircle, ArrowRight, FolderKanban } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
import PageLoader from '../components/common/PageLoader';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, shortCurrency } from '../utils/currency';

export default function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [monthly, setMonthly] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([api.getDashboardStats(), api.getMonthlyReport()])
            .then(([s, m]) => { setStats(s); setMonthly(m); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <PageLoader />;

    return (
        <div className="dashboard">
            <PageHeader title="Dashboard" subtitle="Welcome back! Here's your business overview." buttonLabel="New Invoice" onButtonClick={() => navigate('/invoices/new')} />

            <div className="stats-grid stats-grid--4">
                <StatCard label="Total Clients" value={stats?.totalClients || 0} icon={Users} variant="blue" />
                <StatCard label="Total Invoices" value={stats?.totalInvoices || 0} icon={FileText} variant="teal" />
                <StatCard label="Total Revenue" value={formatCurrency(stats?.totalRevenue)} icon={IndianRupee} variant="green" />
                <StatCard label="Active Projects" value={stats?.activeProjects || 0} icon={FolderKanban} variant="purple" />
            </div>

            <div className="stats-grid stats-grid--4">
                <StatCard label="Outstanding" value={formatCurrency(stats?.outstanding)} icon={IndianRupee} variant="orange" />
                <StatCard label="This Month Revenue" value={formatCurrency(stats?.thisMonthRevenue)} icon={TrendingUp} variant="green" />
                <StatCard label="This Month Collections" value={formatCurrency(stats?.thisMonthCollections)} icon={IndianRupee} variant="teal" />
                <StatCard label="Overdue Invoices" value={stats?.overdueInvoices || 0} icon={AlertCircle} variant="red" />
            </div>

            {/* Monthly Revenue Chart */}
            <div className="dashboard__section dashboard__chart-section">
                <div className="dashboard__section-header">
                    <h3>Monthly Overview ({new Date().getFullYear()})</h3>
                </div>
                <div className="dashboard__chart">
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={monthly} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e8e2db)" />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-secondary, #5a524c)' }} />
                            <YAxis tickFormatter={shortCurrency} tick={{ fontSize: 12, fill: 'var(--text-secondary, #5a524c)' }} />
                            <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e8e2db)', borderRadius: '8px' }} />
                            <Legend />
                            <Bar dataKey="invoiced" name="Invoiced" fill="#c8956c" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="collected" name="Collected" fill="#2d8659" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expenses" name="Expenses" fill="#c0392b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="dashboard__tables">
                <div className="dashboard__section">
                    <div className="dashboard__section-header">
                        <h3>Recent Invoices</h3>
                        <button className="dashboard__section-link" onClick={() => navigate('/invoices')}>
                            View All <ArrowRight size={16} />
                        </button>
                    </div>
                    <table className="dashboard__table">
                        <thead>
                            <tr>
                                <th>Invoice</th>
                                <th>Client</th>
                                <th className="amount-right">Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(stats?.recentInvoices || []).map((inv) => (
                                <tr key={inv.id} className="clickable-row" onClick={() => navigate(`/invoices/${inv.id}`)}>
                                    <td className="mono">{inv.invoice_number}</td>
                                    <td className="truncate-cell">{inv.client}</td>
                                    <td className="amount-right">{formatCurrency(inv.amount)}</td>
                                    <td><StatusBadge status={inv.status} /></td>
                                </tr>
                            ))}
                            {(!stats?.recentInvoices || stats.recentInvoices.length === 0) && (
                                <tr><td colSpan={4} className="text-center">No invoices yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="dashboard__section">
                    <div className="dashboard__section-header">
                        <h3>Pending Payments</h3>
                        <button className="dashboard__section-link" onClick={() => navigate('/payments')}>
                            View All <ArrowRight size={16} />
                        </button>
                    </div>
                    <table className="dashboard__table">
                        <thead>
                            <tr>
                                <th>Client</th>
                                <th>Due Date</th>
                                <th>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(stats?.pendingPayments || []).map((p) => (
                                <tr key={p.id} className="clickable-row" onClick={() => navigate(`/invoices/${p.id}`)}>
                                    <td className="truncate-cell">{p.client}</td>
                                    <td>{p.dueDate || '-'}</td>
                                    <td className="balance-red">{formatCurrency(p.balance)}</td>
                                </tr>
                            ))}
                            {(!stats?.pendingPayments || stats.pendingPayments.length === 0) && (
                                <tr><td colSpan={3} className="text-center">No pending payments</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="dashboard__section">
                <div className="dashboard__section-header">
                    <h3>Recent Transactions</h3>
                    <button className="dashboard__section-link" onClick={() => navigate('/payments')}>
                        View All <ArrowRight size={16} />
                    </button>
                </div>
                <table className="dashboard__table">
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Invoice</th>
                            <th>Date</th>
                            <th>Method</th>
                            <th className="amount-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(stats?.recentTransactions || []).map((t) => (
                            <tr key={t.id}>
                                <td className="truncate-cell">{t.client}</td>
                                <td className="mono">{t.invoiceNo || '-'}</td>
                                <td>{t.date}</td>
                                <td>{t.method}</td>
                                <td className="amount-right text-success font-medium">{formatCurrency(t.amount)}</td>
                            </tr>
                        ))}
                        {(!stats?.recentTransactions || stats.recentTransactions.length === 0) && (
                            <tr><td colSpan={5} className="text-center">No transactions yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
