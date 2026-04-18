// ============================================================
//  CENTRAL BACKEND CONFIG
//  When your PC's IP changes, update ONLY this one file.
// ============================================================

import Constants from 'expo-constants';

const ENV_BACKEND_URL = typeof process.env.EXPO_PUBLIC_BACKEND_URL === 'string'
  ? process.env.EXPO_PUBLIC_BACKEND_URL.trim()
  : '';

const BACKEND_CONFIG_ERROR = 'EXPO_PUBLIC_BACKEND_URL is required outside development.';
const BACKEND_UNAVAILABLE_ERROR_CODE = 'backend-unavailable';
const isDevelopmentRuntime = __DEV__;

// Static backend URL fallback when runtime host detection is unavailable.
const STATIC_BACKEND_URL = ENV_BACKEND_URL || (isDevelopmentRuntime ? 'http://192.168.1.31:3000' : '');

// Backend port (default: 3000)
const BACKEND_PORT = 3000;
let cachedBackendUrl: string | null = null;

/**
 * Get the local network IP address dynamically from Expo dev server
 * Tries multiple methods to detect the IP address
 * Falls back to static URL if unable to detect
 */
function getLocalIP(): string | null {
  try {
    // Method 1: Try Constants.debuggerHost (most reliable in dev mode)
    const debuggerHost = Constants.debuggerHost;
    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && isValidIP(ip)) {
        // console.log('[Config] Detected IP from debuggerHost:', ip);
        return `http://${ip}:${BACKEND_PORT}`;
      }
    }
    
    // Method 2: Try manifest debuggerHost
    if (__DEV__) {
      const manifest = Constants.manifest as any;
      if (manifest?.debuggerHost) {
        const ip = manifest.debuggerHost.split(':')[0];
        if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && isValidIP(ip)) {
          // console.log('[Config] Detected IP from manifest:', ip);
          return `http://${ip}:${BACKEND_PORT}`;
        }
      }
    }
    
    // Method 3: Try Constants.expoConfig?.hostUri
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && isValidIP(ip)) {
        // console.log('[Config] Detected IP from hostUri:', ip);
        return `http://${ip}:${BACKEND_PORT}`;
      }
    }
    
    // Method 4: Try Constants.manifest2?.extra?.expoGo?.debuggerHost
    const manifest2 = Constants.manifest2 as any;
    if (manifest2?.extra?.expoGo?.debuggerHost) {
      const ip = manifest2.extra.expoGo.debuggerHost.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && isValidIP(ip)) {
        // console.log('[Config] Detected IP from manifest2:', ip);
        return `http://${ip}:${BACKEND_PORT}`;
      }
    }
  } catch (error) {
    console.warn('[Config] Could not detect local IP dynamically:', error);
  }
  
  return null;
}

/**
 * Validate if string is a valid IP address format
 */
function isValidIP(ip: string): boolean {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) return false;
  
  // Check each octet is between 0-255
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Get backend URL - uses dynamic IP detection if available, falls back to static URL
 * This function is called at runtime, so it will always get the latest IP
 */
export function getBackendUrl(): string {
  if (cachedBackendUrl) {
    return cachedBackendUrl;
  }

  const dynamicUrl = isDevelopmentRuntime ? getLocalIP() : null;
  const finalUrl = dynamicUrl || STATIC_BACKEND_URL;
  if (!finalUrl) {
    throw new Error(BACKEND_CONFIG_ERROR);
  }
  // console.log('[Config] Using backend URL:', finalUrl);
  return finalUrl;
}

export function getBackendUrlCandidates(): string[] {
  const candidates = [
    cachedBackendUrl,
    isDevelopmentRuntime ? getLocalIP() : null,
    STATIC_BACKEND_URL,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return [...new Set(candidates.map((value) => value.trim()))];
}

export function rememberWorkingBackendUrl(url: string): void {
  if (typeof url === 'string' && url.trim().length > 0) {
    cachedBackendUrl = url.trim();
  }
}

export function isBackendConfigured(): boolean {
  return Boolean(cachedBackendUrl || STATIC_BACKEND_URL || (isDevelopmentRuntime ? getLocalIP() : null));
}

export function createBackendFeatureUnavailableError(featureName: string): Error {
  const error = new Error(`${featureName} are unavailable in this app build because no production backend is configured yet.`);
  (error as Error & { code?: string }).code = BACKEND_UNAVAILABLE_ERROR_CODE;
  return error;
}

export function isBackendFeatureUnavailableError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: string }).code === BACKEND_UNAVAILABLE_ERROR_CODE
  );
}

/**
 * Static backend URL export (for backward compatibility)
 * Uses dynamic IP detection if available, otherwise uses static URL
 * 
 * Note: This is evaluated at module load time. For runtime IP detection,
 * use getBackendUrl() function instead.
 */
export const BACKEND_URL = (() => {
  try {
    return getBackendUrl();
  } catch (error) {
    console.warn('Error getting backend URL:', error);
    return STATIC_BACKEND_URL;
  }
})();

/**
 * Get the current backend IP address (without port)
 * Returns null if unable to detect
 */
export function getBackendIP(): string | null {
  const url = getBackendUrl();
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // Fallback: try to extract IP from URL string
    const match = url.match(/http:\/\/([^:]+)/);
    return match ? match[1] : null;
  }
}

/**
 * Test if backend is reachable at the given URL
 * Useful for connection validation before making API calls
 */
export async function testBackendConnection(url?: string): Promise<boolean> {
  let testUrl = url;

  if (!testUrl) {
    try {
      testUrl = getBackendUrl();
    } catch {
      return false;
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`${testUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    if (response.ok) {
      rememberWorkingBackendUrl(testUrl);
    }
    return response.ok;
  } catch (error) {
    // If /health endpoint doesn't exist, try root endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${testUrl}/`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      if (response.status < 500) {
        rememberWorkingBackendUrl(testUrl);
      }
      return response.status < 500; // Any response means server is reachable
    } catch {
      return false;
    }
  }
}
