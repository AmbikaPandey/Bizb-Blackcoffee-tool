import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Eye, Download, Pencil, Trash2 } from 'lucide-react';

export default function InvoiceActions({ onView, onEdit, onDelete, onDownload, disabled }) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, right: 0 });

    const calcPosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({
            top: rect.bottom + window.scrollY + 6,
            right: document.documentElement.clientWidth - rect.right - window.scrollX,
        });
    }, []);

    useEffect(() => {
        if (!open) return;
        calcPosition();
        const handler = (e) => {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target) &&
                menuRef.current && !menuRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        };
        const onScroll = () => setOpen(false);
        document.addEventListener('mousedown', handler);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('mousedown', handler);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [open, calcPosition]);

    const handleAction = (fn) => {
        setOpen(false);
        fn?.();
    };

    const menu = open ? createPortal(
        <div
            className="invoice-actions__menu"
            ref={menuRef}
            style={{
                position: 'absolute',
                top: pos.top,
                right: pos.right,
            }}
        >
            <button className="invoice-actions__item" onClick={() => handleAction(onView)}>
                <Eye size={15} />
                <span>View</span>
            </button>
            <button className="invoice-actions__item" onClick={() => handleAction(onDownload)}>
                <Download size={15} />
                <span>Download PDF</span>
            </button>
            <button className="invoice-actions__item" onClick={() => handleAction(onEdit)}>
                <Pencil size={15} />
                <span>Edit</span>
            </button>
            <div className="invoice-actions__divider" />
            <button className="invoice-actions__item invoice-actions__item--danger" onClick={() => handleAction(onDelete)}>
                <Trash2 size={15} />
                <span>Delete</span>
            </button>
        </div>,
        document.body
    ) : null;

    return (
        <div className="invoice-actions">
            <button
                ref={triggerRef}
                className={`invoice-actions__trigger ${open ? 'invoice-actions__trigger--active' : ''}`}
                onClick={() => setOpen((v) => !v)}
                disabled={disabled}
                aria-label="Invoice actions"
            >
                <MoreVertical size={16} />
            </button>
            {menu}
        </div>
    );
}
