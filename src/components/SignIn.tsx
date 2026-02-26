import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
import { setGoogleCalendarToken } from '../services/auth'
import logoLarge from '../assets/logo-large.svg'
import './SignIn.css'

interface SignInProps {
  onSuccess?: () => void
}

export default function SignIn({ onSuccess }: SignInProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  async function handleSignIn() {
    setStatus('loading')
    setErrorMessage(undefined)

    try {
      const result = await signInWithPopup(auth, googleProvider)
      if (result?.user) {
        const cred = result as { credential?: { accessToken?: string } }
        const accessToken = cred.credential?.accessToken
        if (typeof accessToken === 'string') {
          await setGoogleCalendarToken(accessToken)
        }
        onSuccess?.()
      }
    } catch (err) {
      setStatus('error')
      const message = err instanceof Error ? err.message : 'Sign in failed'
      setErrorMessage(message)
    }
  }

  return (
    <div className="signin-container">
      <img src={logoLarge} alt="InstaCal" className="signin-logo" />
      <div className="signin-content">
        <h2 className="signin-subheading">Sign in to Continue</h2>
        <button
          className="signin-btn"
          disabled={status === 'loading'}
          onClick={handleSignIn}
        >
          {status === 'loading' ? 'Signing in…' : 'Sign in with Google'}
        </button>
        {status === 'error' && (
          <p className="signin-error">{errorMessage ?? 'Something went wrong.'}</p>
        )}
      </div>
    </div>
  )
}
