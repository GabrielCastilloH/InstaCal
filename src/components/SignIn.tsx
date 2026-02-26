import { useState } from "react";
import { signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../lib/firebase";
import { setGoogleCalendarToken } from "../services/auth";
import logoLarge from "../assets/logo-large.svg";
import "./SignIn.css";

interface SignInProps {
  onSuccess?: () => void;
}

function GoogleLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function SignIn({ onSuccess }: SignInProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSignIn() {
    setStatus("loading");
    setErrorMessage(undefined);

    try {
      const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string;
      if (!clientId)
        throw new Error("Google OAuth Client ID is not configured.");

      const redirectUrl = chrome.identity.getRedirectURL();
      console.log('[SignIn] Redirect URL:', redirectUrl);
      const scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.events",
      ];

      const authUrl = new URL("https://accounts.google.com/o/oauth2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("response_type", "token");
      authUrl.searchParams.set("redirect_uri", redirectUrl);
      authUrl.searchParams.set("scope", scopes.join(" "));

      const responseUrl = await new Promise<string>((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          { url: authUrl.toString(), interactive: true },
          (redirectResponse) => {
            if (chrome.runtime.lastError || !redirectResponse) {
              reject(
                new Error(
                  chrome.runtime.lastError?.message ?? "Auth cancelled",
                ),
              );
            } else {
              resolve(redirectResponse);
            }
          },
        );
      });

      const hashParams = new URLSearchParams(
        new URL(responseUrl).hash.slice(1),
      );
      const accessToken = hashParams.get("access_token");
      if (!accessToken) throw new Error("No access token in response.");

      const credential = GoogleAuthProvider.credential(null, accessToken);
      const result = await signInWithCredential(auth, credential);

      if (result.user) {
        await setGoogleCalendarToken(accessToken);
        onSuccess?.();
      }
    } catch (err) {
      setStatus("error");
      const message = err instanceof Error ? err.message : "Sign in failed";
      setErrorMessage(message);
    }
  }

  return (
    <div className="signin-container">
      <div className="signin-header">
        <img src={logoLarge} alt="InstaCal" className="signin-logo" />
      </div>

      <div className="signin-body">
        <h2 className="signin-heading">Sign in to Get Starated</h2>
        <p className="signin-description">
          Add events to your calendar with natural language input.
        </p>

        <button
          className="signin-google-btn"
          disabled={status === "loading"}
          onClick={handleSignIn}
        >
          <GoogleLogo />
          <span>
            {status === "loading" ? "Signing in…" : "Continue with Google"}
          </span>
        </button>

        {status === "error" && (
          <p className="signin-error">
            {errorMessage ?? "Something went wrong."}
          </p>
        )}

        <p className="signin-privacy">
          InstaCal will request access to your Google Calendar to create events
          on your behalf.
        </p>
      </div>
    </div>
  );
}
