import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export default function ActionMenu({ actions = [] }) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, right: 0 });

    const calcPosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const menuHeight = (actions.filter(a => !a.divider).length * 36) + (actions.filter(a => a.divider).length * 9) + 16;
        const spaceBelow = window.innerHeight - rect.bottom;
        const openAbove = spaceBelow < menuHeight + 10;

        setPos({
            top: openAbove
                ? rect.top + window.scrollY - menuHeight - 6
                : rect.bottom + window.scrollY + 6,
            right: document.documentElement.clientWidth - rect.right - window.scrollX,
        });
    }, [actions]);

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
        <div className="invoice-actions__menu" ref={menuRef} style={{ position: 'absolute', top: pos.top, right: pos.right }}>
            {actions.map((action, i) =>
                action.divider ? (
                    <div key={i} className="invoice-actions__divider" />
                ) : (
                    <button
                        key={i}
                        className={`invoice-actions__item ${action.danger ? 'invoice-actions__item--danger' : ''}`}
                        onClick={() => handleAction(action.onClick)}
                    >
                        {action.icon}
                        <span>{action.label}</span>
                    </button>
                )
            )}
        </div>,
        document.body
    ) : null;

    return (
        <div className="invoice-actions">
            <button
                ref={triggerRef}
                className={`invoice-actions__trigger ${open ? 'invoice-actions__trigger--active' : ''}`}
                onClick={() => setOpen((v) => !v)}
                aria-label="Actions"
            >
                <MoreVertical size={16} />
            </button>
            {menu}
        </div>
    );
}
