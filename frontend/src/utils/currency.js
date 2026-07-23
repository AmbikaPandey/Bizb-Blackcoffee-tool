/**
 * Shared currency formatting utility — INR (₹) with en-IN locale.
 */
export function formatCurrency(val) {
    const n = Math.max(0, Number(val || 0));
    return '₹' + n.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

export function shortCurrency(val) {
    const n = Math.max(0, Number(val || 0));
    if (n >= 1e7) return '₹' + (n / 1e7).toFixed(1) + 'Cr';
    if (n >= 1e5) return '₹' + (n / 1e5).toFixed(1) + 'L';
    if (n >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'K';
    return '₹' + n.toFixed(0);
}
