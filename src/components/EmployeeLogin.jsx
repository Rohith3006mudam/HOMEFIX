import React, { useState } from "react";
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { signInWithPassword, sendPasswordReset } from "../services/auth";
import "./auth.css";

export default function EmployeeLogin({ onBack, onAuthenticated, onSignupClick }) {
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
      setInfo("Signing you in...");
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
    <main className="center-page auth-page">
      <div className="auth-container">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <div className="auth-content">
          <span className="eyebrow">HOMEFIX PROFESSIONAL</span>
          <h1>Professional Login</h1>
          <p className="lead">Sign in to your professional dashboard and accept jobs.</p>

          {forgotPasswordMode ? (
            <form onSubmit={handleForgotPassword}>
              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
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
                <Mail size={18} />
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
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
                    placeholder="Enter your password"
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
              <button type="submit" className="primary-btn wide" disabled={busy}>
                {busy ? "Signing in..." : "Sign In"}
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

          <div className="auth-divider">or</div>
          <button className="secondary-btn wide" onClick={onSignupClick}>
            Request professional access
          </button>
          <p className="auth-footer">
            Need an account? <button className="text-btn" onClick={onSignupClick}>Apply to join</button>
          </p>
        </div>
      </div>
    </main>
  );
}
