/**
 * Transform form data to uppercase before submission.
 * Skips email fields and password fields.
 */
const EMAIL_KEYS = ['email', 'e_mail'];
const SKIP_KEYS = ['password', 'pass', 'token', 'status', '_id', 'id', 'client_id', 'project_id', 'invoice_id'];

export function uppercaseFormData(data) {
    if (!data || typeof data !== 'object') return data;
    const result = {};
    for (const [key, value] of Object.entries(data)) {
        const k = key.toLowerCase();
        if (typeof value === 'string' && !EMAIL_KEYS.some(e => k.includes(e)) && !SKIP_KEYS.some(s => k.includes(s))) {
            result[key] = value.toUpperCase();
        } else {
            result[key] = value;
        }
    }
    return result;
}
