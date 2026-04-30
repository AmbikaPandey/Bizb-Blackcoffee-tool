import { Plus } from 'lucide-react';

export default function PageHeader({ title, subtitle, buttonLabel, onButtonClick, buttonIcon, actions }) {
    return (
        <div className="page-header">
            <div className="page-header__info">
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
            </div>
            <div className="page-header__actions">
                {actions}
                {buttonLabel && (
                    <button className="page-header__action" onClick={onButtonClick}>
                        {buttonIcon || <Plus size={18} />}
                        {buttonLabel}
                    </button>
                )}
            </div>
        </div>
    );
}
