"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "./auth-provider";

type AuthModalProps = {
  onClose: () => void;
};

export function AuthModal({ onClose }: AuthModalProps) {
  const { user, signIn, signUp, signOut, isConfigured, loading: checkingSession } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { needsConfirmation } = await signUp(email, password);
        setIsSignUp(false);
        if (needsConfirmation) {
          setMessage("Check your inbox and spam folder for a confirmation link, then return here to sign in. If you already have an account, sign in with your existing password. Signing up again does not change it.");
        }
      } else {
        await signIn(email, password);
      }
      setPassword("");
      setShowPassword(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Authentication failed";
      setError(detail === "Invalid login credentials"
        ? "The email or password is incorrect. Use your existing account password; creating the account again will not change it."
        : detail);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setLoading(true);
    try {
      await signOut();
      setMessage("You have signed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <h2 id="auth-title">{user ? "Your account" : isSignUp ? "Create account" : "Sign in"}</h2>
        {checkingSession ? <p role="status">Checking your session…</p> : user ? (
          <>
            <p role="status">Signed in as <strong>{user.email}</strong></p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <form onSubmit={(e) => { e.preventDefault(); onClose(); }}>
              <button type="submit">Continue designing</button>
            </form>
            <p className="auth-switch"><button type="button" disabled={loading} onClick={handleSignOut}>{loading ? "Signing out…" : "Sign out"}</button></p>
          </>
        ) : !isConfigured ? <p role="alert">Accounts are temporarily unavailable. Please try again later.</p> : <>
        <p>{isSignUp ? "Sign up to save your designs to the cloud" : "Sign in to access your saved designs"}</p>
        {message && <p role="status">{message}</p>}
        <form onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="auth-password"><span>Password</span></label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              style={{ flex: 1, minWidth: 0 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isSignUp ? 6 : undefined}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              disabled={loading}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              aria-controls="auth-password"
              disabled={loading}
              onClick={() => setShowPassword((visible) => !visible)}
              style={{ background: "transparent", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", color: "var(--brand-dark)", font: "inherit", cursor: "pointer" }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
            </div>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" disabled={loading} onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); setPassword(""); setShowPassword(false); }}>
            {isSignUp ? "Sign in" : "Create one"}
          </button>
        </p>
        </>}
      </div>
    </div>
  );
}
