import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Activity } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/common/Toast';
import PageHeader from '../components/common/PageHeader';

export default function AuditTrail() {
    const { showToast } = useToast();
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ entity: '', action: '', from: '', to: '' });

    const load = useCallback(async () => {
        try {
            const params = {};
            if (filters.entity) params.entity = filters.entity;
            if (filters.action) params.action = filters.action;
            if (filters.from) params.from = filters.from;
            if (filters.to) params.to = filters.to;
            const [logsData, statsData] = await Promise.all([
                api.getAuditLogs(params),
                api.getAuditStats(),
            ]);
            setLogs(logsData);
            setStats(statsData);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="page-loader">Loading...</div>;

    return (
        <div className="page audit-page">
            <PageHeader title="Audit Trail" subtitle="Activity logs and audit history" />

            {stats && (
                <div className="audit-stats">
                    <div className="stat-card"><div className="stat-card__value">{stats.todayCount}</div><div className="stat-card__label">Today</div></div>
                    <div className="stat-card"><div className="stat-card__value">{stats.weekCount}</div><div className="stat-card__label">This Week</div></div>
                    <div className="stat-card"><div className="stat-card__value">{stats.totalCount}</div><div className="stat-card__label">Total</div></div>
                </div>
            )}

            <div className="page__filters">
                <select className="filter-select" value={filters.entity} onChange={e => setFilters(f => ({ ...f, entity: e.target.value }))}>
                    <option value="">All Entities</option>
                    <option value="User">User</option>
                    <option value="Expense">Expense</option>
                    <option value="Project">Project</option>
                    <option value="Costing">Costing</option>
                    <option value="Quote">Quote</option>
                    <option value="Invoice">Invoice</option>
                </select>
                <input type="text" placeholder="Filter by action..." value={filters.action}
                    onChange={e => setFilters(f => ({ ...f, action: e.target.value }))} className="filter-input" />
                <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className="filter-input" />
                <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className="filter-input" />
            </div>

            <div className="audit-timeline">
                {logs.length === 0 ? (
                    <p className="text-center text-muted">No audit logs found</p>
                ) : logs.map(log => (
                    <div key={log.id} className="audit-entry">
                        <div className="audit-entry__icon"><Activity size={14} /></div>
                        <div className="audit-entry__content">
                            <div className="audit-entry__header">
                                <span className="audit-entry__action">{log.action}</span>
                                <span className="audit-entry__entity">{log.entity}</span>
                                <span className="audit-entry__time">{new Date(log.created_at).toLocaleString()}</span>
                            </div>
                            <p className="audit-entry__details">{log.details}</p>
                            <p className="audit-entry__user">
                                by <strong>{log.performed_by_name}</strong>
                                {log.performed_by_role && <span className="text-muted"> ({log.performed_by_role})</span>}
                                {log.ip_address && <span className="text-muted"> from {log.ip_address}</span>}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
