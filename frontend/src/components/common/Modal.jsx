import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;

    return (
        <div className="modal__overlay">
            <div className="modal__backdrop" onClick={onClose} />
            <div className="modal__container">
                <div className="modal__header">
                    <h2>{title}</h2>
                    <button className="modal__close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal__body">
                    {children}
                </div>
            </div>
        </div>
    );
}
