import { CheckCircle } from 'lucide-react';

const statusMap = {
    Sent: 'sent',
    Paid: 'paid',
    Overdue: 'overdue',
    Draft: 'draft',
    Pending: 'pending',
    Reimbursed: 'reimbursed',
    Approved: 'approved',
    Rejected: 'rejected',
    Unpaid: 'unpaid',
    'In Progress': 'in-progress',
    Completed: 'completed',
    'On Hold': 'on-hold',
    Active: 'active',
    Inactive: 'inactive',
    Cancelled: 'cancelled',
    'Partially Paid': 'partially-paid',
};

const showCheck = ['Reimbursed', 'Paid', 'Completed', 'Approved'];

const normalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

export default function StatusBadge({ status }) {
    const normalized = normalize(status);
    const modifier = statusMap[normalized] || statusMap[status] || 'draft';
    return (
        <span className={`status-badge status-badge--${modifier}`}>
            {showCheck.includes(normalized) && <CheckCircle size={12} />}
            {status}
        </span>
    );
}
