import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Firebase configuration from google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyBA8WR-NLreilHeMJZgtASgk_EO1tRyMmY",
  authDomain: "forsa-2923d.firebaseapp.com",
  projectId: "forsa-2923d",
  storageBucket: "forsa-2923d.firebasestorage.app",
  messagingSenderId: "522700743019",
  appId: "1:522700743019:web:1f38d45f9e4e874e3a6c2e",
  measurementId: "G-342ND9RX83"
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} else {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };

