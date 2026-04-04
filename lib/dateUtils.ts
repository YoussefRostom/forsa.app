/**
 * Format a Firestore timestamp for display.
 * - Detects serverTimestamp placeholder ({ _methodName: 'serverTimestamp' })
 * - Returns "Pending..." for unresolved timestamps (avoids "Invalid date")
 * - Validates timestamp types before parsing
 * - Handles edge cases without throwing
 */
export function formatTimestamp(
  timestamp: unknown,
  options?: { withTime?: boolean; fallback?: string }
): string {
  const fallback = options?.fallback ?? 'Pending...';
  const withTime = options?.withTime ?? false;

  if (timestamp == null) return options?.fallback ?? 'Unknown';

  try {
    // Firestore serverTimestamp placeholder (before doc is fully written)
    if (typeof timestamp === 'object' && timestamp !== null) {
      const obj = timestamp as Record<string, unknown>;
      if (obj._methodName === 'serverTimestamp') return fallback;
      if ('serverTimestamp' in obj) return fallback;
    }

    let date: Date;

    if (typeof (timestamp as any).toDate === 'function') {
      date = (timestamp as any).toDate();
    } else if (typeof (timestamp as any)?.seconds === 'number') {
      date = new Date((timestamp as any).seconds * 1000);
    } else if (typeof (timestamp as any)?._seconds === 'number') {
      date = new Date((timestamp as any)._seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number' && !isNaN(timestamp)) {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'object') {
      return fallback;
    } else {
      date = new Date(timestamp as any);
    }

    if (isNaN(date.getTime())) return fallback;

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);

    if (withTime) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    return `${day}/${month}/${year}`;
  } catch {
    return fallback;
  }
}
