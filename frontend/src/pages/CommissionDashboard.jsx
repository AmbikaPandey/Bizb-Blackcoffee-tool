import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Percent, Settings, BarChart3 } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/common/Toast';
import PageHeader from '../components/common/PageHeader';
import { formatCurrency } from '../utils/currency';

export default function CommissionDashboard() {
    const { showToast } = useToast();
    const [profitData, setProfitData] = useState(null);
    const [markupData, setMarkupData] = useState(null);
    const [agencyData, setAgencyData] = useState(null);
    const [settings, setSettings] = useState({ agency_default_pct: 15, min_markup_pct: 10, max_markup_pct: 100 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [profit, markup, agency, commSettings] = await Promise.all([
                    api.getProfitSummary(),
                    api.getVendorMarkup(),
                    api.getAgencyCharges(),
                    api.getCommissionSettings(),
                ]);
                setProfitData(profit);
                setMarkupData(markup);
                setAgencyData(agency);
                setSettings(commSettings);
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await api.saveCommissionSettings(settings);
            showToast('Commission settings saved');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-loader">Loading...</div>;

    // Aggregate totals from costing status data
    const costingTotals = (profitData?.costingsByStatus || []).reduce((acc, s) => ({
        count: acc.count + s.count,
        vendorCost: acc.vendorCost + s.totalVendorCost,
        selling: acc.selling + s.totalSelling,
        markup: acc.markup + s.totalMarkup,
        agencyCharge: acc.agencyCharge + s.totalAgencyCharge,
        profit: acc.profit + s.totalProfit,
        revenue: acc.revenue + s.totalGrandTotal,
    }), { count: 0, vendorCost: 0, selling: 0, markup: 0, agencyCharge: 0, profit: 0, revenue: 0 });

    return (
        <div className="page commission-page">
            <PageHeader title="Commission & Profit Dashboard" subtitle="Vendor markup tracking, agency charges & margins" />

            {/* Tabs */}
            <div className="tab-bar">
                <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                    <BarChart3 size={14} /> Overview
                </button>
                <button className={`tab-btn ${activeTab === 'markup' ? 'active' : ''}`} onClick={() => setActiveTab('markup')}>
                    <TrendingUp size={14} /> Vendor Markup
                </button>
                <button className={`tab-btn ${activeTab === 'agency' ? 'active' : ''}`} onClick={() => setActiveTab('agency')}>
                    <Percent size={14} /> Agency Charges
                </button>
                <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                    <Settings size={14} /> Settings
                </button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="commission-overview">
                    <div className="stat-grid">
                        <div className="stat-card stat-card--primary">
                            <div className="stat-card__value">{formatCurrency(costingTotals.revenue)}</div>
                            <div className="stat-card__label">Total Revenue</div>
                        </div>
                        <div className="stat-card stat-card--success">
                            <div className="stat-card__value">{formatCurrency(costingTotals.profit)}</div>
                            <div className="stat-card__label">Total Profit</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card__value">{formatCurrency(costingTotals.markup)}</div>
                            <div className="stat-card__label">Total Markup</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card__value">{formatCurrency(costingTotals.agencyCharge)}</div>
                            <div className="stat-card__label">Agency Charges</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card__value">{costingTotals.revenue > 0 ? ((costingTotals.profit / costingTotals.revenue) * 100).toFixed(1) : 0}%</div>
                            <div className="stat-card__label">Overall Margin</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card__value">{costingTotals.count}</div>
                            <div className="stat-card__label">Total Costings</div>
                        </div>
                    </div>

                    {/* Monthly Profit Trend */}
                    {profitData?.monthlyProfit?.length > 0 && (
                        <div className="mt-3">
                            <h3>Monthly Profit Trend</h3>
                            <div className="page__table-wrap">
                                <table className="page__table">
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th className="text-right">Revenue</th>
                                            <th className="text-right">Vendor Cost</th>
                                            <th className="text-right">Markup</th>
                                            <th className="text-right">Agency Charge</th>
                                            <th className="text-right">Profit</th>
                                            <th className="text-right">Costings</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {profitData.monthlyProfit.map(m => (
                                            <tr key={m._id}>
                                                <td>{m._id}</td>
                                                <td className="text-right">{formatCurrency(m.revenue)}</td>
                                                <td className="text-right">{formatCurrency(m.vendorCost)}</td>
                                                <td className="text-right">{formatCurrency(m.markup)}</td>
                                                <td className="text-right">{formatCurrency(m.agencyCharge)}</td>
                                                <td className="text-right text-success font-bold">{formatCurrency(m.profit)}</td>
                                                <td className="text-right">{m.count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Costings by Status */}
                    <div className="mt-3">
                        <h3>Costings by Status</h3>
                        <div className="status-cards">
                            {(profitData?.costingsByStatus || []).map(s => (
                                <div key={s._id} className="status-card">
                                    <div className="status-card__status">{s._id}</div>
                                    <div className="status-card__count">{s.count}</div>
                                    <div className="status-card__detail">Revenue: {formatCurrency(s.totalGrandTotal)}</div>
                                    <div className="status-card__detail">Profit: {formatCurrency(s.totalProfit)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Vendor Markup Tab */}
            {activeTab === 'markup' && markupData && (
                <div>
                    <div className="stat-grid stat-grid--sm">
                        <div className="stat-card"><div className="stat-card__value">{markupData.summary.totalItems}</div><div className="stat-card__label">Items Tracked</div></div>
                        <div className="stat-card"><div className="stat-card__value">{formatCurrency(markupData.summary.totalVendorCost)}</div><div className="stat-card__label">Vendor Cost</div></div>
                        <div className="stat-card"><div className="stat-card__value">{formatCurrency(markupData.summary.totalProfit)}</div><div className="stat-card__label">Markup Profit</div></div>
                        <div className="stat-card"><div className="stat-card__value">{markupData.summary.avgMarkupPct}%</div><div className="stat-card__label">Avg Markup</div></div>
                    </div>

                    <div className="page__table-wrap mt-3">
                        <table className="page__table">
                            <thead>
                                <tr>
                                    <th>Costing #</th>
                                    <th>Client</th>
                                    <th>Description</th>
                                    <th className="text-right">Vendor Cost</th>
                                    <th className="text-right">Markup %</th>
                                    <th className="text-right">Selling Rate</th>
                                    <th className="text-right">Qty</th>
                                    <th className="text-right">Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {markupData.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="font-mono">{item.costing_number}</td>
                                        <td>{item.client_name}</td>
                                        <td>{item.description}</td>
                                        <td className="text-right">{formatCurrency(item.vendor_cost)}</td>
                                        <td className="text-right">{item.markup_pct}%</td>
                                        <td className="text-right">{formatCurrency(item.selling_rate)}</td>
                                        <td className="text-right">{item.qty}</td>
                                        <td className="text-right text-success font-bold">{formatCurrency(item.profit)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Agency Charges Tab */}
            {activeTab === 'agency' && agencyData && (
                <div>
                    <div className="stat-grid stat-grid--sm">
                        <div className="stat-card"><div className="stat-card__value">{agencyData.summary.totalCostings}</div><div className="stat-card__label">Costings</div></div>
                        <div className="stat-card"><div className="stat-card__value">{formatCurrency(agencyData.summary.totalAgencyCharge)}</div><div className="stat-card__label">Total Agency Charges</div></div>
                        <div className="stat-card"><div className="stat-card__value">{formatCurrency(agencyData.summary.totalMarkup)}</div><div className="stat-card__label">Total Markup</div></div>
                        <div className="stat-card"><div className="stat-card__value">{formatCurrency(agencyData.summary.totalProfit)}</div><div className="stat-card__label">Total Profit</div></div>
                    </div>

                    <div className="page__table-wrap mt-3">
                        <table className="page__table">
                            <thead>
                                <tr>
                                    <th>Costing #</th>
                                    <th>Client</th>
                                    <th>Title</th>
                                    <th className="text-right">Selling Total</th>
                                    <th className="text-right">Agency %</th>
                                    <th className="text-right">Agency Charge</th>
                                    <th className="text-right">Markup</th>
                                    <th className="text-right">Total Profit</th>
                                    <th className="text-right">Margin %</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agencyData.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="font-mono">{item.costing_number}</td>
                                        <td>{item.client_name}</td>
                                        <td>{item.title}</td>
                                        <td className="text-right">{formatCurrency(item.subtotal_selling)}</td>
                                        <td className="text-right">{item.agency_pct}%</td>
                                        <td className="text-right">{formatCurrency(item.agency_charge)}</td>
                                        <td className="text-right">{formatCurrency(item.total_markup)}</td>
                                        <td className="text-right text-success font-bold">{formatCurrency(item.total_profit)}</td>
                                        <td className="text-right">{item.profit_margin_pct?.toFixed(1)}%</td>
                                        <td>{item.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="commission-settings">
                    <h3>Commission Settings</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Default Agency Service Charge %</label>
                            <input type="number" min="0" step="0.5" value={settings.agency_default_pct}
                                onChange={e => setSettings(s => ({ ...s, agency_default_pct: e.target.value }))} />
                            <small className="text-muted">Applied to new costings by default (editable per costing)</small>
                        </div>
                        <div className="form-group">
                            <label>Min Markup %</label>
                            <input type="number" min="0" step="0.5" value={settings.min_markup_pct}
                                onChange={e => setSettings(s => ({ ...s, min_markup_pct: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Max Markup %</label>
                            <input type="number" min="0" step="0.5" value={settings.max_markup_pct}
                                onChange={e => setSettings(s => ({ ...s, max_markup_pct: e.target.value }))} />
                        </div>
                    </div>
                    <button className="btn btn--primary mt-2" onClick={handleSaveSettings} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            )}
        </div>
    );
}
