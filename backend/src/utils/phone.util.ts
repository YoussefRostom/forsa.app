/**
 * Robust normalization for Auth IDs on the backend.
 * Produces a Firebase-compatible E.164-like phone number string.
 */
export function normalizePhoneForTwilio(phone: string): string {
    if (!phone) return '';

    const trimmed = phone.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('+')) {
        return `+${trimmed.slice(1).replace(/\D/g, '')}`;
    }

    if (trimmed.startsWith('00')) {
        return `+${trimmed.slice(2).replace(/\D/g, '')}`;
    }

    return `+${trimmed.replace(/\D/g, '')}`;
}
