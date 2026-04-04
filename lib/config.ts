// ============================================================
//  CENTRAL BACKEND CONFIG
//  When your PC's IP changes, update ONLY this one file.
// ============================================================

import Constants from 'expo-constants';

// Static backend URL (update this when your PC's IP changes)
const STATIC_BACKEND_URL = 'http://192.168.0.112:3000';

// Backend port (default: 3000)
const BACKEND_PORT = 3000;

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
  const dynamicUrl = getLocalIP();
  const finalUrl = dynamicUrl || STATIC_BACKEND_URL;
  // console.log('[Config] Using backend URL:', finalUrl);
  return finalUrl;
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
    console.warn('Error getting backend URL, using static URL:', error);
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
  const testUrl = url || getBackendUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`${testUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
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
      return response.status < 500; // Any response means server is reachable
    } catch {
      return false;
    }
  }
}
