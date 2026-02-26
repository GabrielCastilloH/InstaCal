import { initializeApp } from 'firebase/app'
import { initializeAuth, indexedDBLocalPersistence } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const app = initializeApp(firebaseConfig)

// Use initializeAuth (not getAuth) so persistence is set synchronously at startup —
// avoids a race where signInWithCredential saves to localStorage before setPersistence
// switches to indexedDB, causing the session to vanish on the next popup open.
export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
})

