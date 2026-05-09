import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { IndianRupee, FileText, AlertTriangle, Clock, TrendingUp, Calendar, Users, Receipt } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import PageLoader from '../components/common/PageLoader';
import { api } from '../services/api';
import { formatCurrency, shortCurrency } from '../utils/currency';

const PIE_COLORS = ['#2d8659', '#2874a6', '#c27a1a', '#c0392b'];

const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Tab Components ──────────────────────────────

function AgeingReport() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getAgeingReport().then(setData).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <PageLoader />;
    if (!data) return <p className="text-center text-muted empty-message">Failed to load data</p>;

    const { buckets, totalOutstanding, clients } = data;
    const bucketLabels = [
        { key: 'current', label: 'Current', variant: 'green' },
        { key: '1_30', label: '1-30 Days', variant: 'yellow' },
        { key: '31_60', label: '31-60 Days', variant: 'orange' },
        { key: '61_90', label: '61-90 Days', variant: 'red' },
        { key: '90_plus', label: '90+ Days', variant: 'red' },
    ];

    return (
        <>
            <div className="reports__ageing-buckets">
                {bucketLabels.map((b) => (
                    <div key={b.key} className={`reports__bucket reports__bucket--${b.variant}`}>
                        <span className="reports__bucket-label">{b.label}</span>
                        <span className="reports__bucket-value">{formatCurrency(buckets[b.key])}</span>
                    </div>
                ))}
                <div className="reports__bucket reports__bucket--total">
                    <span className="reports__bucket-label">Total Outstanding</span>
                    <span className="reports__bucket-value">{formatCurrency(totalOutstanding)}</span>
                </div>
            </div>
            <div className="page-card">
                <h3 className="page-card__section-title">Client-wise Ageing</h3>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Client</th>
                                <th className="text-right">Current</th>
                                <th className="text-right">1-30 Days</th>
                                <th className="text-right">31-60 Days</th>
                                <th className="text-right">61-90 Days</th>
                                <th className="text-right">90+ Days</th>
                                <th className="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map((c, i) => (
                                <tr key={i}>
                                    <td className="font-medium">{c.client}</td>
                                    <td className="text-right">{c.current ? formatCurrency(c.current) : '-'}</td>
                                    <td className="text-right">{c['1_30'] ? formatCurrency(c['1_30']) : '-'}</td>
                                    <td className="text-right">{c['31_60'] ? formatCurrency(c['31_60']) : '-'}</td>
                                    <td className="text-right">{c['61_90'] ? formatCurrency(c['61_90']) : '-'}</td>
                                    <td className="text-right">{c['90_plus'] ? formatCurrency(c['90_plus']) : '-'}</td>
                                    <td className={`text-right font-medium${c.total > 0 ? ' balance-red' : ''}`}>{formatCurrency(c.total)}</td>
                                </tr>
                            ))}
                            {clients.length === 0 && (
                                <tr><td colSpan={7} className="text-center">No outstanding invoices</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

function GstSummary() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const fyStart = currentMonth >= 3 ? `${currentYear}-04-01` : `${currentYear - 1}-04-01`;
    const fyEnd = currentMonth >= 3 ? `${currentYear + 1}-03-31` : `${currentYear}-03-31`;
    const [from, setFrom] = useState(fyStart);
    const [to, setTo] = useState(fyEnd);

    useEffect(() => {
        setLoading(true);
        api.getGstSummary({ from, to }).then(setData).catch(console.error).finally(() => setLoading(false));
    }, [from, to]);

    if (loading) return <PageLoader />;
    if (!data) return <p className="text-center text-muted empty-message">Failed to load data</p>;

    return (
        <>
            <div className="reports__filters">
                <div className="form-group">
                    <label className="form-group__label">From</label>
                    <input type="date" className="form-group__input" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-group__label">To</label>
                    <input type="date" className="form-group__input" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
            </div>
            <div className="stats-grid stats-grid--4">
                <StatCard label="Taxable Amount" value={formatCurrency(data.totals.taxable)} icon={IndianRupee} variant="blue" />
                <StatCard label="CGST" value={formatCurrency(data.totals.cgst)} icon={IndianRupee} variant="teal" />
                <StatCard label="SGST" value={formatCurrency(data.totals.sgst)} icon={IndianRupee} variant="green" />
                <StatCard label="IGST" value={formatCurrency(data.totals.igst)} icon={IndianRupee} variant="orange" />
            </div>
            <div className="page-card">
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Date</th>
                                <th>Client</th>
                                <th>GSTIN</th>
                                <th className="text-right">Taxable</th>
                                <th className="text-right">CGST</th>
                                <th className="text-right">SGST</th>
                                <th className="text-right">IGST</th>
                                <th className="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map((r) => (
                                <tr key={r.id}>
                                    <td className="mono font-medium">{r.invoice_number}</td>
                                    <td>{formatDate(r.date)}</td>
                                    <td className="truncate-cell">{r.client}</td>
                                    <td className="mono">{r.gstin || '-'}</td>
                                    <td className="text-right">{formatCurrency(r.taxable)}</td>
                                    <td className="text-right">{r.cgst ? formatCurrency(r.cgst) : '-'}</td>
                                    <td className="text-right">{r.sgst ? formatCurrency(r.sgst) : '-'}</td>
                                    <td className="text-right">{r.igst ? formatCurrency(r.igst) : '-'}</td>
                                    <td className="text-right font-medium">{formatCurrency(r.total)}</td>
                                </tr>
                            ))}
                            {data.rows.length === 0 && (
                                <tr><td colSpan={9} className="text-center">No GST data for selected period</td></tr>
                            )}
                            {data.rows.length > 0 && (
                                <tr className="reports__totals-row">
                                    <td colSpan={4} className="font-medium">Totals</td>
                                    <td className="text-right font-medium">{formatCurrency(data.totals.taxable)}</td>
                                    <td className="text-right font-medium">{formatCurrency(data.totals.cgst)}</td>
                                    <td className="text-right font-medium">{formatCurrency(data.totals.sgst)}</td>
                                    <td className="text-right font-medium">{formatCurrency(data.totals.igst)}</td>
                                    <td className="text-right font-medium">{formatCurrency(data.totals.total)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

function ClientLedger() {
    const [clients, setClients] = useState([]);
    const [clientId, setClientId] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    useEffect(() => {
        api.getClients().then(setClients).catch(() => { });
    }, []);

    useEffect(() => {
        if (!clientId) { setData(null); return; }
        setLoading(true);
        const params = { client_id: clientId };
        if (from) params.from = from;
        if (to) params.to = to;
        api.getClientLedger(params).then(setData).catch(console.error).finally(() => setLoading(false));
    }, [clientId, from, to]);

    return (
        <>
            <div className="reports__filters">
                <div className="form-group form-group--wide">
                    <label className="form-group__label">Client *</label>
                    <select className="form-group__input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                        <option value="">Select client</option>
                        {clients.map((c) => <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-group__label">From</label>
                    <input type="date" className="form-group__input" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-group__label">To</label>
                    <input type="date" className="form-group__input" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
            </div>
            {!clientId && <p className="text-center text-muted empty-message">Select a client to view ledger</p>}
            {loading && <PageLoader />}
            {data && !loading && (
                <div className="page-card">
                    <div className="reports__ledger-summary">
                        <div className="reports__ledger-client">
                            <h3>{data.client.name}</h3>
                            {data.client.gstin && <span className="mono text-muted">GSTIN: {data.client.gstin}</span>}
                        </div>
                        <div className="reports__ledger-stats">
                            <div className="reports__ledger-stat">
                                <span className="reports__ledger-stat-label">Total Invoiced</span>
                                <span className="reports__ledger-stat-value">{formatCurrency(data.totalInvoiced)}</span>
                            </div>
                            <div className="reports__ledger-stat reports__ledger-stat--outstanding">
                                <span className="reports__ledger-stat-label">Outstanding</span>
                                <span className="reports__ledger-stat-value">{formatCurrency(data.outstanding)}</span>
                            </div>
                        </div>
                    </div>
                    <h4 className="card-section-title">Ledger Entries</h4>
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
                                {data.entries.map((e, i) => (
                                    <tr key={i}>
                                        <td>{formatDate(e.date)}</td>
                                        <td>{e.reference}</td>
                                        <td className="font-medium">{e.description}</td>
                                        <td className="text-right">{e.debit ? formatCurrency(e.debit) : '-'}</td>
                                        <td className="text-right text-success">{e.credit ? formatCurrency(e.credit) : '-'}</td>
                                        <td className={`text-right font-medium ${e.balance > 0 ? 'balance-red' : 'text-success'}`}>{formatCurrency(Math.abs(e.balance))}</td>
                                    </tr>
                                ))}
                                {data.entries.length === 0 && (
                                    <tr><td colSpan={6} className="text-center">No transactions found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}

function EmployeeReimbursements() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        api.getReimbursements().then(setData).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <PageLoader />;
    if (!data) return <p className="text-center text-muted empty-message">Failed to load data</p>;

    return (
        <>
            <div className="stats-grid stats-grid--4">
                <StatCard label="Total Expenses" value={formatCurrency(data.totals.total)} icon={IndianRupee} variant="blue" />
                <StatCard label="Pending" value={formatCurrency(data.totals.pending)} icon={Clock} variant="yellow" />
                <StatCard label="Reimbursed" value={formatCurrency(data.totals.reimbursed)} icon={IndianRupee} variant="green" />
                <StatCard label="Total Entries" value={data.totals.count} icon={FileText} variant="teal" />
            </div>
            <div className="page-card">
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th className="text-right">Total</th>
                                <th className="text-right">Pending</th>
                                <th className="text-right">Reimbursed</th>
                                <th className="text-right">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.employees.map((emp) => (
                                <>
                                    <tr key={emp.name} className="reports__expandable-row" onClick={() => setExpanded(expanded === emp.name ? null : emp.name)}>
                                        <td className="font-medium">{emp.name}</td>
                                        <td className="text-right font-medium">{formatCurrency(emp.totalAmount)}</td>
                                        <td className="text-right balance-red">{formatCurrency(emp.pending)}</td>
                                        <td className="text-right text-success">{formatCurrency(emp.approved)}</td>
                                        <td className="text-right">{emp.count}</td>
                                    </tr>
                                    {expanded === emp.name && emp.items.map((item) => (
                                        <tr key={item.id} className="reports__detail-row">
                                            <td className="indent-cell">{item.description}</td>
                                            <td className="text-right">{formatCurrency(item.amount)}</td>
                                            <td>{formatDate(item.date)}</td>
                                            <td><StatusBadge status={item.status} /></td>
                                            <td className="text-muted">{item.category}</td>
                                        </tr>
                                    ))}
                                </>
                            ))}
                            {data.employees.length === 0 && (
                                <tr><td colSpan={5} className="text-center">No expense data</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

// ── Main Reports Page ──────────────────────────────

const TABS = [
    { key: 'ageing', label: 'Ageing Report', icon: TrendingUp },
    { key: 'gst', label: 'GST Summary', icon: Receipt },
    { key: 'ledger', label: 'Client Ledger', icon: Calendar },
    { key: 'reimbursements', label: 'Employee Reimbursements', icon: Users },
];

export default function Reports() {
    const [tab, setTab] = useState('ageing');

    return (
        <div>
            <PageHeader title="Reports" subtitle="View ageing reports, GST summaries, and employee reimbursements" />

            <div className="tabs">
                {TABS.map((t) => (
                    <button key={t.key} onClick={() => setTab(t.key)} className={`tabs__btn ${tab === t.key ? 'tabs__btn--active' : ''}`}>
                        <t.icon size={16} /> {t.label}
                    </button>
                ))}
            </div>

            <div className="reports__content">
                {tab === 'ageing' && <AgeingReport />}
                {tab === 'gst' && <GstSummary />}
                {tab === 'ledger' && <ClientLedger />}
                {tab === 'reimbursements' && <EmployeeReimbursements />}
            </div>
        </div>
    );
}
