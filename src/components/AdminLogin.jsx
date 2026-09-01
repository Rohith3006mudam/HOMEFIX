import React, { useState } from "react";
import { Lock, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { signInWithPassword, sendPasswordReset } from "../services/auth";
import "./auth.css";

export default function AdminLogin({ onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim() || !password) {
      return setError("Please enter your email and password.");
    }
    setBusy(true);
    try {
      await signInWithPassword({ email, password });
      setInfo("Verifying admin access...");
      setTimeout(onAuthenticated, 500);
    } catch (err) {
      setError(err.message || "Sign in failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim()) {
      return setError("Please enter your email address.");
    }
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setInfo("Password reset email sent. Check your inbox.");
      setForgotPasswordMode(false);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message || "Unable to send reset email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="center-page auth-page admin-login">
      <div className="auth-container admin-container">
        <div className="auth-content">
          <div className="admin-header">
            <ShieldAlert size={40} />
            <span className="eyebrow">HOMEFIX ADMIN</span>
            <h1>Admin Portal</h1>
            <p className="lead">Secure administrative access required</p>
          </div>

          {forgotPasswordMode ? (
            <form onSubmit={handleForgotPassword}>
              <label>
                Admin email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@homefix.com"
                  required
                />
              </label>
              <button type="submit" className="primary-btn wide" disabled={busy}>
                {busy ? "Sending..." : "Send reset link"}
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={() => setForgotPasswordMode(false)}
              >
                Back to login
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignIn}>
              <label>
                <Lock size={18} />
                Admin Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@homefix.com"
                  required
                />
              </label>
              <label>
                <Lock size={18} />
                Password
                <div className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Admin password"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <button type="submit" className="primary-btn wide danger" disabled={busy}>
                {busy ? "Authenticating..." : "Admin Login"}
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={() => setForgotPasswordMode(true)}
              >
                Forgot password?
              </button>
            </form>
          )}

          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-success">{info}</div>}

          <div className="admin-notice">
            <ShieldAlert size={16} />
            <small>
              This is a secure admin-only portal. Unauthorized access attempts are logged.
            </small>
          </div>
        </div>
      </div>
    </main>
  );
}
