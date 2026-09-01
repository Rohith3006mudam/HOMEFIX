import { useState } from "react";
import { LogIn, AlertCircle, Eye, EyeOff, Plus } from "lucide-react";
import { requestDriverAccess, signInWithPassword, signUpWithPassword } from "../services/auth";

export default function DriverLogin({ onSuccess, onSwitchToSignup }) {
  const [step, setStep] = useState("login"); // login, signup
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [vehicleType, setVehicleType] = useState("bike");
  const [vehicleNumber, setVehicleNumber] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithPassword({ email: loginEmail, password: loginPassword });
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Please enter your full name");
      return;
    }
    if (!signupEmail.trim()) {
      setError("Please enter your email");
      return;
    }
    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (signupPassword !== signupConfirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      // First create account as driver (will default to customer, need to update role in DB)
      await signUpWithPassword({
        email: signupEmail,
        password: signupPassword,
        fullName,
        phone: "",
      });
      // Then switch to profile creation
      setStep("profile");
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDriverProfile = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestDriverAccess({ vehicleType, vehicleNumber });
      setStep("submitted");
    } catch (err) {
      setError(err.message || "Unable to submit driver application.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "login") {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-icon">🚗</div>
              <h1>Driver Login</h1>
              <p>Access your driver account</p>
            </div>

            {error && (
              <div className="alert alert-error">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                <LogIn size={18} />
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="auth-divider">OR</div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep("signup")}
              disabled={loading}
            >
              <Plus size={18} />
              Apply to Join as Driver
            </button>

            <p className="auth-footer">
              By logging in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "profile") {
    return (
      <div className="auth-page"><div className="auth-container"><div className="auth-card">
        <div className="auth-header"><div className="auth-icon">🚗</div><h1>Driver vehicle</h1><p>Submit your vehicle details for approval</p></div>
        {error && <div className="alert alert-error"><AlertCircle size={18} />{error}</div>}
        <form onSubmit={handleDriverProfile}>
          <div className="form-group"><label>Vehicle type</label><select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} disabled={loading}><option value="bike">Bike</option><option value="auto">Auto</option></select></div>
          <div className="form-group"><label>Vehicle number</label><input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())} placeholder="Vehicle registration number" disabled={loading} required /></div>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Submitting..." : "Submit for approval"}</button>
        </form>
      </div></div></div>
    );
  }

  if (step === "submitted") {
    return (
      <div className="auth-page"><div className="auth-container"><div className="auth-card"><div className="auth-header"><div className="auth-icon">✓</div><h1>Application submitted</h1><p>Your driver account is pending administrator approval.</p></div><button className="btn btn-primary" onClick={() => onSuccess?.()}>Continue</button></div></div></div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-icon">🚗</div>
            <h1>Become a Driver</h1>
            <p>Join HOMEFIX and earn money</p>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleSignup}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Your Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={signupConfirm}
                onChange={(e) => setSignupConfirm(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Plus size={18} />
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <button
            type="button"
            className="btn btn-text"
            onClick={() => setStep("login")}
            disabled={loading}
          >
            Back to Login
          </button>

          <p className="auth-footer">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
