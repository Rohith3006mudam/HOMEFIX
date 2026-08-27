import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  isValidIndianPhone,
  sendPasswordReset,
  sendPhoneOtp,
  signInWithPassword,
  signUpWithPassword,
  verifyPhoneOtp,
} from "../services/auth";
import "./auth.css";

const RESEND_SECONDS = 30;

export default function AuthModal({ close, onAuthenticated }) {
  const [method, setMethod] = useState("password"); // "password" | "otp"
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const isSignup = mode === "signup";

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");
    if (isSignup) {
      if (!fullName.trim()) return setError("Enter your full name.");
      if (phone && !isValidIndianPhone(phone)) return setError("Enter a valid 10-digit Indian mobile number.");
      if (password.length < 6) return setError("Password must be at least 6 characters.");
      if (password !== confirmPassword) return setError("Passwords do not match.");
    }
    if (!email.trim()) return setError("Enter your email address.");
    if (!password) return setError("Enter your password.");

    setBusy(true);
    try {
      if (isSignup) {
        await signUpWithPassword({ email, password, fullName, phone });
        setInfo("Account created. Signing you in...");
      } else {
        await signInWithPassword({ email, password });
      }
      onAuthenticated();
    } catch (submissionError) {
      setError(submissionError.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setInfo("");
    if (!email.trim()) return setError("Enter your email address first.");
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setInfo("Password reset email sent.");
    } catch (resetError) {
      setError(resetError.message || "Unable to send reset email.");
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async () => {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await sendPhoneOtp(phone);
      setOtpSent(true);
      setCooldown(RESEND_SECONDS);
      setInfo("OTP sent to your mobile number.");
    } catch (otpError) {
      setError(otpError.message || "Unable to send OTP.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit OTP.");
    setBusy(true);
    try {
      await verifyPhoneOtp(phone, otp);
      onAuthenticated();
    } catch (verifyError) {
      setError(verifyError.message || "Invalid or expired OTP.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal login-modal">
        <button className="modal-close" onClick={close} aria-label="Close">
          <X />
        </button>
        <span className="eyebrow">HOMEFIX ACCOUNT</span>
        <h2>{method === "otp" ? "Sign in with mobile OTP" : isSignup ? "Create your account" : "Sign in to continue"}</h2>

        <div className="role-tabs">
          <button type="button" className={method === "password" ? "selected" : ""} onClick={() => { setMethod("password"); setError(""); setInfo(""); }}>
            Email &amp; password
          </button>
          <button type="button" className={method === "otp" ? "selected" : ""} onClick={() => { setMethod("otp"); setOtpSent(false); setError(""); setInfo(""); }}>
            Mobile OTP
          </button>
        </div>

        {method === "password" && (
          <form onSubmit={handlePasswordSubmit}>
            {isSignup && (
              <label>
                Full name
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
              </label>
            )}
            {isSignup && (
              <label>
                Mobile number
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/[^\d+ ]/g, ""))}
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                />
              </label>
            )}
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
            </label>
            {isSignup && (
              <label>
                Confirm password
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required />
              </label>
            )}
            <button type="submit" className="primary-btn wide" disabled={busy}>
              {busy ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
            </button>
          </form>
        )}

        {method === "otp" && (
          <form onSubmit={handleVerifyOtp}>
            <label>
              Mobile number
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/[^\d+ ]/g, ""))}
                placeholder="10-digit mobile"
                inputMode="numeric"
                disabled={otpSent}
                required
              />
            </label>
            {!otpSent && (
              <button type="button" className="primary-btn wide" onClick={handleSendOtp} disabled={busy}>
                {busy ? "Sending..." : "Send OTP"}
              </button>
            )}
            {otpSent && (
              <>
                <label>
                  6-digit OTP
                  <input
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    required
                  />
                </label>
                <button type="submit" className="primary-btn wide" disabled={busy}>
                  {busy ? "Verifying..." : "Verify OTP"}
                </button>
                <button type="button" className="text-btn" onClick={handleSendOtp} disabled={busy || cooldown > 0}>
                  {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
                </button>
              </>
            )}
          </form>
        )}

        {error && <p className="auth-message auth-error" role="alert">{error}</p>}
        {info && !error && <p className="auth-message" role="status">{info}</p>}

        {method === "password" && (
          <>
            <button className="text-btn" onClick={() => { setMode(isSignup ? "login" : "signup"); setError(""); setInfo(""); }}>
              {isSignup ? "Already have an account? Sign in" : "Create a customer account"}
            </button>
            {!isSignup && (
              <button className="text-btn" onClick={handleForgotPassword} disabled={busy}>
                Forgot password?
              </button>
            )}
          </>
        )}
        <small className="demo-note">Your password is never stored by HOMEFIX. Supabase Auth manages your session.</small>
      </div>
    </div>
  );
}
