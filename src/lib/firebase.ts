import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

console.log('[Firebase Config] Initializing with:', {
  apiKey: firebaseConfig.apiKey ? '✓ present' : '✗ missing',
  authDomain: firebaseConfig.authDomain || '✗ missing',
  projectId: firebaseConfig.projectId || '✗ missing',
  storageBucket: firebaseConfig.storageBucket || '✗ missing',
  messagingSenderId: firebaseConfig.messagingSenderId || '✗ missing',
  appId: firebaseConfig.appId ? '✓ present' : '✗ missing',
  measurementId: firebaseConfig.measurementId || '✗ missing',
})

export const app = initializeApp(firebaseConfig)
console.log('[Firebase] App initialized successfully')

export const auth = getAuth(app)
console.log('[Firebase Auth] Auth instance created')

