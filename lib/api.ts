// This file is kept for backward compatibility but is deprecated
// All API calls should now use Firebase directly
// Import from lib/firebase.ts instead

export const API_BASE = ''; // No longer used
export async function fetchWithTimeout() {
  throw new Error('Backend API calls are deprecated. Use Firebase instead.');
}
