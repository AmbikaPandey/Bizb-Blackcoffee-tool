import { Search } from 'lucide-react';

export default function SearchBar({ placeholder = 'Search...', value, onChange }) {
    return (
        <div className="search-bar">
            <Search size={18} className="search-bar__icon" />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="search-bar__input"
            />
        </div>
    );
}
