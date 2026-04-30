const RULES = {
    gstin: {
        pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        hint: 'e.g., 07AANCB3150C1Z1',
        error: 'Invalid GSTIN format (15 chars, e.g., 07AANCB3150C1Z1)',
        transform: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15),
    },
    pan: {
        pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
        hint: 'e.g., AANCB3150C',
        error: 'Invalid PAN format (10 chars, e.g., AANCB3150C)',
        transform: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10),
    },
    email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        hint: 'e.g., info@company.com',
        error: 'Invalid email address',
        transform: (v) => v.trim(),
    },
    phone: {
        pattern: /^[6-9]\d{9}$/,
        hint: '10-digit mobile number',
        error: 'Invalid phone number (10 digits starting with 6-9)',
        transform: (v) => v.replace(/\D/g, '').slice(0, 10),
    },
    ifsc: {
        pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/,
        hint: 'e.g., ICIC0005897',
        error: 'Invalid IFSC code (11 chars, e.g., ICIC0005897)',
        transform: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11),
    },
    pincode: {
        pattern: /^\d{6}$/,
        hint: '6-digit pincode',
        error: 'Invalid pincode (must be 6 digits)',
        transform: (v) => v.replace(/\D/g, '').slice(0, 6),
    },
    accountNo: {
        pattern: /^\d{9,18}$/,
        hint: '9 to 18 digit account number',
        error: 'Invalid account number (9-18 digits)',
        transform: (v) => v.replace(/\D/g, '').slice(0, 18),
    },
    upi: {
        pattern: /^[\w.-]+@[\w]+$/,
        hint: 'e.g., business@icici',
        error: 'Invalid UPI ID (e.g., name@bank)',
        transform: (v) => v.trim().toLowerCase(),
    },
};

export function validate(field, value) {
    const rule = RULES[field];
    if (!rule) return { valid: true };
    if (!value || value.length === 0) return { valid: true };
    return {
        valid: rule.pattern.test(value),
        error: rule.error,
    };
}

export function getHint(field) {
    return RULES[field]?.hint || '';
}

export function transform(field, value) {
    const rule = RULES[field];
    return rule?.transform ? rule.transform(value) : value;
}
