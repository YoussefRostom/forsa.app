/**
 * Robust normalization for Auth IDs on the backend.
 * Extracts only digits to match the frontend standard.
 */
export function normalizePhoneForTwilio(phone: string): string {
    if (!phone) return "";

    // Extract and return only digits
    return phone.replace(/\D/g, "");
}
