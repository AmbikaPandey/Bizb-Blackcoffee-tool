import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { searchHSN, fetchHSNDetails } from '../../utils/hsnLookup';

/**
 * Reusable HSN/SAC Autocomplete component
 * Props:
 *   value       - current HSN code value
 *   onChange    - called with (hsnCode) on input change
 *   onSelect    - called with full HSN object { hsnCode, productName, gstRate, category, description, type }
 *   placeholder - input placeholder
 *   disabled    - disable the input
 */
export default function HsnAutocomplete({ value = '', onChange, onSelect, placeholder = 'HSN/SAC', disabled = false, error = false }) {
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const wrapperRef = useRef(null);
    const debounceRef = useRef(null);
    const blurRef = useRef(null);
    const inputRef = useRef(null);

    // Sync external value changes
    useEffect(() => { setQuery(value); }, [value]);

    // Cleanup timers on unmount
    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (blurRef.current) clearTimeout(blurRef.current);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Debounced search
    const doSearch = useCallback((term) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!term || term.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            const data = await searchHSN(term, 10);
            setResults(data);
            setOpen(data.length > 0);
            setActiveIdx(-1);
            setLoading(false);
        }, 300);
    }, []);

    const handleChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        onChange?.(val);
        doSearch(val);
    };

    const handleSelect = (item) => {
        setQuery(item.hsnCode);
        setOpen(false);
        onChange?.(item.hsnCode);
        onSelect?.(item);
    };

    // Fetch full details when user leaves the field with a valid code
    const handleBlur = () => {
        if (blurRef.current) clearTimeout(blurRef.current);
        blurRef.current = setTimeout(() => {
            setOpen(false);
            if (query && /^[0-9]{4,8}$/.test(query)) {
                fetchHSNDetails(query).then(details => {
                    if (details) onSelect?.(details);
                });
            }
        }, 200);
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (!open || results.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx((prev) => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx((prev) => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            handleSelect(results[activeIdx]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    const isInvalid = error || (query && query.length >= 4 && !/^[0-9]{4,8}$/.test(query));

    return (
        <div className="hsn-autocomplete" ref={wrapperRef}>
            <div className="hsn-autocomplete__input-wrap">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (results.length > 0) setOpen(true); }}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={isInvalid ? 'hsn-autocomplete__input--invalid' : ''}
                    autoComplete="off"
                />
                {loading && <Loader2 size={14} className="hsn-autocomplete__spinner" />}
            </div>

            {open && results.length > 0 && (
                <ul className="hsn-autocomplete__dropdown">
                    {results.map((item, idx) => (
                        <li
                            key={item.hsnCode + idx}
                            className={`hsn-autocomplete__item ${idx === activeIdx ? 'hsn-autocomplete__item--active' : ''}`}
                            onMouseDown={() => handleSelect(item)}
                            onMouseEnter={() => setActiveIdx(idx)}
                        >
                            <span className="hsn-autocomplete__code">{item.hsnCode}</span>
                            <span className="hsn-autocomplete__name">{item.productName}</span>
                            <span className={`hsn-autocomplete__gst gst-badge gst-badge--${item.gstRate}`}>
                                {item.gstRate}%
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
