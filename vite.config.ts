import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:* https://apis.google.com https://accounts.google.com",
        "frame-src https://accounts.google.com https://*.firebaseapp.com https://*.google.com",
        "connect-src 'self' http://localhost:* http://127.0.0.1:* https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
        "img-src 'self' data: https://*.googleusercontent.com",
        "style-src 'self' 'unsafe-inline'",
      ].join('; '),
    },
  },
})
