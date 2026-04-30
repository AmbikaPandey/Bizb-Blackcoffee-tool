import { ChevronDown } from 'lucide-react';

export default function FilterDropdown({ label, options = [], value, onChange }) {
    return (
        <div className="filter-dropdown">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="filter-dropdown__select"
            >
                <option value="">{label}</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
            <ChevronDown size={16} className="filter-dropdown__chevron" />
        </div>
    );
}
