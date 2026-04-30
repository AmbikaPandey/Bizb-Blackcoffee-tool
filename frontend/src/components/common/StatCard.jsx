export default function StatCard({ label, value, icon: Icon, variant = 'blue' }) {
    return (
        <div className="stat-card">
            <div className="stat-card__info">
                <p className="stat-card__label">{label}</p>
                <p className="stat-card__value">{value}</p>
            </div>
            {Icon && (
                <div className={`stat-card__icon stat-card__icon--${variant}`}>
                    <Icon size={24} />
                </div>
            )}
        </div>
    );
}
