import './env';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';

const isProductionLike = process.env.NODE_ENV === 'production';

// Firebase Admin initialization
if (!admin.apps.length) {
  try {
    let serviceAccount: any = null;
    let initialized = false;

    // Option 1: Try environment variable first (FIREBASE_SERVICE_ACCOUNT_KEY as JSON string)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY from environment:', parseError);
        throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format. Must be valid JSON.');
      }
    }
    // Option 2: Try service account file in multiple locations
    else {
      // Check multiple possible locations for the service account file
      const possiblePaths = [
        path.join(__dirname, 'serviceAccountKey.json'), // src/config/serviceAccountKey.json (when running from source)
        path.join(process.cwd(), 'serviceAccountKey.json'), // backend/serviceAccountKey.json
        path.join(process.cwd(), 'src', 'config', 'serviceAccountKey.json'), // backend/src/config/serviceAccountKey.json
      ];

      let serviceAccountPath: string | null = null;
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          serviceAccountPath = filePath;
          break;
        }
      }

      if (serviceAccountPath) {
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      } else {
        // Option 3: Try Application Default Credentials only outside production.
        if (isProductionLike) {
          throw new Error(
            'Firebase service account not found. Production requires explicit Firebase Admin credentials via FIREBASE_SERVICE_ACCOUNT_KEY or a serviceAccountKey.json file.'
          );
        }

        try {
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
          });
          initialized = true;
        } catch {
          throw new Error(
            'Firebase service account not found. Please provide one of the following:\n' +
            '1. Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable (JSON string)\n' +
            '2. Place serviceAccountKey.json in one of these locations:\n' +
            '   - ' + path.join(process.cwd(), 'serviceAccountKey.json') + '\n' +
            '   - ' + path.join(process.cwd(), 'src', 'config', 'serviceAccountKey.json') + '\n' +
            '3. Configure Application Default Credentials (for GCP environments)'
          );
        }
      }
    }

    // Initialize with service account if we have one and haven't initialized yet
    if (serviceAccount && !initialized) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

// Export Firestore DB and Auth
export const db = getFirestore();
export const auth: admin.auth.Auth = admin.auth();
export default admin;
