import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ isOpen, title, message, confirmLabel, onConfirm, onCancel, loading }) {
    if (!isOpen) return null;

    return (
        <div className="confirm-dialog__overlay">
            <div className="confirm-dialog__backdrop" onClick={onCancel} />
            <div className="confirm-dialog">
                <div className="confirm-dialog__icon">
                    <AlertTriangle size={28} />
                </div>
                <h3 className="confirm-dialog__title">{title || 'Are you sure?'}</h3>
                <p className="confirm-dialog__message">{message}</p>
                <div className="confirm-dialog__actions">
                    <button className="confirm-dialog__cancel" onClick={onCancel} disabled={loading}>
                        Cancel
                    </button>
                    <button className="confirm-dialog__confirm" onClick={onConfirm} disabled={loading}>
                        {loading ? 'Deleting...' : (confirmLabel || 'Delete')}
                    </button>
                </div>
            </div>
        </div>
    );
}
