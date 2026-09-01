import { useState } from "react";
import { Bike, Upload, MapPin, Calendar, Clock, AlertCircle } from "lucide-react";
import { createBooking } from "../services/bookings";
import { useAuth } from "../hooks/useAuth";

export default function BikeMechanicBooking({ onBack, onSuccess, notify }) {
  const auth = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    bikeModel: "",
    problem: "",
    date: new Date().toISOString().split("T")[0],
    time: "10:00",
    address: "",
    phone: "",
    name: "",
  });

  const serviceTypes = [
    "Bike Puncture",
    "Bike Breakdown",
    "Battery Issue",
    "Engine Issue",
    "Oil Change",
    "Chain Repair",
    "Brake Repair",
    "Tyre Replacement",
    "General Servicing",
    "Emergency Mechanic",
  ];

  const handleInputChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (step === 0 && !form.bikeModel) {
      setError("Please select or enter bike model");
      return;
    }
    if (step === 1 && !form.problem) {
      setError("Please describe the problem");
      return;
    }
    if (step === 2 && !form.address) {
      setError("Please enter address");
      return;
    }
    if (step === 3 && (!form.name || !form.phone)) {
      setError("Please enter your name and phone number");
      return;
    }
    setError("");
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const bookingData = {
        service: "Bike Mechanic - " + form.problem,
        mobile: form.phone.replace(/\D/g, ""),
        address: form.address,
        bookingDate: form.date,
        bookingTime: form.time,
      };
      await createBooking(bookingData);
      notify("Mechanic request submitted! We'll find a technician for you.");
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="booking-wizard">
      <header className="wizard-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h2>🏍️ Bike Mechanic</h2>
        <div className="wizard-progress" style={{ width: `${((step + 1) / 4) * 100}%` }}></div>
      </header>

      <div className="wizard-content">
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {step === 0 && (
          <div className="booking-step">
            <h3>What's your bike model?</h3>
            <input
              type="text"
              placeholder="e.g., Hero Honda, Bajaj Pulsar, Royal Enfield"
              value={form.bikeModel}
              onChange={(e) => handleInputChange("bikeModel", e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
              Next
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="booking-step">
            <h3>What's the problem?</h3>
            <div className="service-grid">
              {serviceTypes.map((type) => (
                <button
                  key={type}
                  className={`service-option ${form.problem === type ? "selected" : ""}`}
                  onClick={() => handleInputChange("problem", type)}
                >
                  {type}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Describe the issue in detail..."
              value={form.problem}
              onChange={(e) => handleInputChange("problem", e.target.value)}
              rows="4"
            />
            <div style={{ display: "flex", gap: "1rem" }}>
              <button className="btn btn-secondary" onClick={() => setStep(0)}>
                Back
              </button>
              <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="booking-step">
            <h3>Where should we visit?</h3>
            <div className="form-group">
              <label>
                <MapPin size={18} /> Service Location
              </label>
              <input
                type="text"
                placeholder="Full address"
                value={form.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(() => {
                    notify("Location detected");
                  });
                }
              }}
            >
              📍 Use Current Location
            </button>
            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="booking-step">
            <h3>When should we visit?</h3>
            <div className="form-group">
              <label>
                <Calendar size={18} /> Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => handleInputChange("date", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>
                <Clock size={18} /> Time
              </label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => handleInputChange("time", e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>
                Back
              </button>
              <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
                Next
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="booking-step">
            <h3>Your Contact Details</h3>
            <input
              type="text"
              placeholder="Full Name"
              value={form.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={form.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
            />
            <div className="booking-summary">
              <h4>Summary</h4>
              <p><strong>Bike:</strong> {form.bikeModel}</p>
              <p><strong>Issue:</strong> {form.problem.substring(0, 50)}...</p>
              <p><strong>Date & Time:</strong> {form.date} at {form.time}</p>
              <p><strong>Location:</strong> {form.address}</p>
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button className="btn btn-secondary" onClick={() => setStep(3)}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Submitting..." : "Confirm Request"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
