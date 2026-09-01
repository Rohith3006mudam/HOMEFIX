import { useState } from "react";
import { Car, AlertCircle } from "lucide-react";
import { createBooking } from "../services/bookings";

export default function CarMechanicBooking({ onBack, onSuccess, notify }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    carBrand: "",
    carModel: "",
    registrationNumber: "",
    problem: "",
    date: new Date().toISOString().split("T")[0],
    time: "10:00",
    address: "",
    phone: "",
    name: "",
  });

  const serviceTypes = [
    "Car Breakdown",
    "Battery Issue",
    "Tyre Puncture",
    "Engine Problem",
    "AC Service",
    "Oil Change",
    "Brake Service",
    "General Service",
    "Emergency Roadside Assistance",
  ];

  const carBrands = [
    "Maruti Suzuki",
    "Hyundai",
    "Mahindra",
    "Tata",
    "Honda",
    "Toyota",
    "Volkswagen",
    "Skoda",
    "Kia",
    "Other",
  ];

  const handleInputChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (step === 0 && !form.carBrand) {
      setError("Please select car brand");
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
      setError("Please enter name and phone");
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
        service: "Car Mechanic - " + form.problem,
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
        <h2>🚗 Car Mechanic</h2>
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
            <h3>What's your car brand?</h3>
            <div className="service-grid">
              {carBrands.map((brand) => (
                <button
                  key={brand}
                  className={`service-option ${form.carBrand === brand ? "selected" : ""}`}
                  onClick={() => handleInputChange("carBrand", brand)}
                >
                  {brand}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
              Next
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="booking-step">
            <h3>What's the problem?</h3>
            <input
              type="text"
              placeholder="e.g., Swift, Fortuner, Creta"
              value={form.carModel}
              onChange={(e) => handleInputChange("carModel", e.target.value)}
            />
            <input
              type="text"
              placeholder="Registration Number (Optional)"
              value={form.registrationNumber}
              onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
            />
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
              placeholder="Describe the issue..."
              value={form.problem}
              onChange={(e) => handleInputChange("problem", e.target.value)}
              rows="3"
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
            <h3>Service Location</h3>
            <input
              type="text"
              placeholder="Full address"
              value={form.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => notify("Location detected")}
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
            <h3>Schedule Service</h3>
            <input
              type="date"
              value={form.date}
              onChange={(e) => handleInputChange("date", e.target.value)}
            />
            <input
              type="time"
              value={form.time}
              onChange={(e) => handleInputChange("time", e.target.value)}
            />
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
            <h3>Your Details</h3>
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
              <p><strong>Car:</strong> {form.carBrand} {form.carModel}</p>
              <p><strong>Registration:</strong> {form.registrationNumber || "Not provided"}</p>
              <p><strong>Issue:</strong> {form.problem.substring(0, 50)}...</p>
              <p><strong>When:</strong> {form.date} at {form.time}</p>
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
