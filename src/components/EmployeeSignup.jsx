import React, { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { signUpWithPassword, requestEmployeeAccess } from "../services/auth";
import "./auth.css";

export default function EmployeeSignup({ onBack, onAuthenticated }) {
  const [mode, setMode] = useState("signup"); // "signup" or "request-access"
  const [step, setStep] = useState(1);
  
  // Signup fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  
  // Access request fields
  const [services, setServices] = useState([]);
  const [experience, setExperience] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [success, setSuccess] = useState(false);

  const serviceOptions = [
    "Plumbing", "Electrical", "Cleaning", "AC Service",
    "Appliance Repair", "Carpentry", "Painting", "Pest Control"
  ];

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!fullName.trim()) return setError("Enter your full name.");
    if (!email.trim()) return setError("Enter your email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    setBusy(true);
    try {
      // Sign up as customer first
      await signUpWithPassword({ email, password, fullName, phone });
      setInfo("Account created! Now complete your professional profile.");
      setStep(2);
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (services.length === 0) return setError("Select at least one service category.");
    if (!serviceArea.trim()) return setError("Enter your service area.");

    setBusy(true);
    try {
      await requestEmployeeAccess({
        fullName,
        phone,
        services,
        experience: parseInt(experience) || 0,
        serviceArea,
      });
      setSuccess(true);
      setInfo("Application submitted! You'll be notified once it's reviewed.");
      setTimeout(() => {
        onAuthenticated();
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to submit application");
    } finally {
      setBusy(false);
    }
  };

  const toggleService = (service) => {
    setServices(prev => 
      prev.includes(service) 
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  if (success) {
    return (
      <main className="center-page auth-page">
        <div className="auth-container">
          <div className="auth-content">
            <div className="success-icon"><CheckCircle2 size={40} /></div>
            <span className="eyebrow">APPLICATION SUBMITTED</span>
            <h1>Thanks for applying!</h1>
            <p>Your professional account request has been submitted for review.</p>
            <p className="lead">Our admin team will review your qualifications and approve your account within 24-48 hours.</p>
            <p>You'll receive an email notification once your account is activated.</p>
            <button className="primary-btn" onClick={() => window.location.href = "/"}>
              Return to home
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="center-page auth-page">
      <div className="auth-container">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <div className="auth-content">
          <span className="eyebrow">BECOME A PROFESSIONAL</span>
          <h1>{step === 1 ? "Create Account" : "Professional Profile"}</h1>
          <p className="lead">
            {step === 1 
              ? "Join HOMEFIX and start earning from home"
              : "Tell us about your professional expertise"}
          </p>

          {step === 1 ? (
            <form onSubmit={handleSignup}>
              <label>
                Full name
                <input 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </label>
              <label>
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
                Phone (optional)
                <input 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                />
              </label>
              <label>
                Password
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </label>
              <label>
                Confirm password
                <input 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </label>
              <button type="submit" className="primary-btn wide" disabled={busy}>
                {busy ? "Creating..." : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequestAccess}>
              <label>
                <b>Service categories you offer</b>
                <div className="checkbox-group">
                  {serviceOptions.map(service => (
                    <label key={service} className="checkbox-label">
                      <input 
                        type="checkbox"
                        checked={services.includes(service)}
                        onChange={() => toggleService(service)}
                      />
                      {service}
                    </label>
                  ))}
                </div>
              </label>

              <label>
                Years of experience
                <select value={experience} onChange={(e) => setExperience(e.target.value)}>
                  <option value="">Select experience level</option>
                  <option value="0">Just starting</option>
                  <option value="1">1-2 years</option>
                  <option value="3">3-5 years</option>
                  <option value="6">6-10 years</option>
                  <option value="11">10+ years</option>
                </select>
              </label>

              <label>
                Service area / locations
                <input 
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                  placeholder="e.g., Mumbai Central, Downtown LA"
                  required
                />
              </label>

              <button type="submit" className="primary-btn wide" disabled={busy}>
                {busy ? "Submitting..." : "Submit Application"}
              </button>
            </form>
          )}

          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-success">{info}</div>}
        </div>
      </div>
    </main>
  );
}
