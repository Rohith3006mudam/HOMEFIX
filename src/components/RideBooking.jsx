import { useState, useEffect } from "react";
import { MapPin, ArrowRight, DollarSign, AlertCircle, Clock } from "lucide-react";

export default function RideBooking({ rideType, onBack, onConfirm, onEstimate }) {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [fare, setFare] = useState(null);
  const [duration, setDuration] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("location");

  // Get current location
  const useCurrentLocation = (type = "pickup") => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (type === "pickup") {
          setPickupCoords({ lat: latitude, lng: longitude });
          setPickup("📍 Current Location");
        } else {
          setDropoffCoords({ lat: latitude, lng: longitude });
          setDropoff("📍 Current Location");
        }
        setLoading(false);
      },
      (error) => {
        setError("Could not access location. Please enter manually.");
        setLoading(false);
      }
    );
  };

  // Estimate fare
  const estimateFare = async () => {
    if (!pickupCoords || !dropoffCoords) {
      setError("Please enter both locations");
      return;
    }
    setLoading(true);
    try {
      // Calculate basic distance
      const R = 6371;
      const dLat = ((dropoffCoords.lat - pickupCoords.lat) * Math.PI) / 180;
      const dLon = ((dropoffCoords.lng - pickupCoords.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((pickupCoords.lat * Math.PI) / 180) *
        Math.cos((dropoffCoords.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      const baseFare = rideType === "bike" ? 20 : 40;
      const perKmRate = rideType === "bike" ? 15 : 25;
      const calculatedFare = baseFare + distance * perKmRate;
      const duration = Math.ceil(distance * 2);

      setFare(Math.round(calculatedFare));
      setDuration(duration);
      setStep("confirm");
    } catch (err) {
      setError("Could not calculate fare. Try again.");
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
        <h2>{rideType === "bike" ? "🏍️ Bike Ride" : "🚗 Auto Ride"}</h2>
      </header>

      <div className="wizard-content">
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {step === "location" && (
          <div className="booking-step">
            <h3>Where are you going?</h3>

            <div className="form-group">
              <label>📍 Pickup Location</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="Enter pickup address"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => useCurrentLocation("pickup")}
                  disabled={loading}
                >
                  📍
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>📍 Dropoff Location</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="Enter destination"
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => useCurrentLocation("dropoff")}
                  disabled={loading}
                >
                  📍
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={estimateFare}
              disabled={loading || !pickup || !dropoff}
            >
              {loading ? "Calculating..." : "Continue"}
            </button>
          </div>
        )}

        {step === "confirm" && (
          <div className="booking-step">
            <h3>Ride Summary</h3>

            <div className="ride-summary">
              <div className="route-box">
                <p>
                  <MapPin size={18} /> {pickup}
                </p>
                <div className="route-line"></div>
                <p>
                  <MapPin size={18} /> {dropoff}
                </p>
              </div>

              <div className="fare-box">
                <div className="fare-item">
                  <span>Estimated Fare</span>
                  <strong className="fare-amount">₹{fare}</strong>
                </div>
                <div className="fare-item">
                  <span>Estimated Time</span>
                  <strong>{duration} min</strong>
                </div>
              </div>

              <p className="fare-note">
                Actual fare may vary based on traffic and route
              </p>

              <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep("location")}
                >
                  Change Location
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    onConfirm?.({
                      pickup,
                      dropoff,
                      pickupCoords,
                      dropoffCoords,
                      fare,
                      duration,
                    });
                  }}
                >
                  Confirm Ride
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
