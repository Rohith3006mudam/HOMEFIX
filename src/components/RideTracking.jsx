import { useState, useEffect } from "react";
import { MapPin, Phone, Star, Clock, DollarSign, AlertCircle, X } from "lucide-react";
import { getRideById, subscribeToRideUpdates, subscribeToRideLocation, cancelRide } from "../services/rides";
import LiveTrackingMap from "./maps/LiveTrackingMap";

export default function RideTracking({ rideId, onBack }) {
  const [ride, setRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!rideId) {
      setError("Ride not found");
      setLoading(false);
      return undefined;
    }
    let mounted = true;
    let unsubscribe = () => {};
    const loadRide = async () => {
      try {
        setLoading(true);
        const data = await getRideById(rideId);
        if (!mounted) return;
        setRide(data);
        unsubscribe = subscribeToRideUpdates(rideId, (payload) => {
          if (payload.new && mounted) setRide(payload.new);
        });
      } catch (err) {
        if (mounted) setError(err.message || "Could not load ride");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadRide();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [rideId]);

  // Subscribe to location updates
  useEffect(() => {
    if (!rideId) return;
    const unsubscribe = subscribeToRideLocation(rideId, (payload) => {
      if (payload.new) {
        setDriverLocation({
          lat: payload.new.latitude,
          lng: payload.new.longitude,
        });
      }
    });
    return () => unsubscribe();
  }, [rideId]);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this ride?")) return;
    try {
      setCancelling(true);
      await cancelRide(rideId, "Customer cancelled");
      onBack?.();
    } catch (err) {
      setError(err.message || "Could not cancel ride");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="center-page">
        <div style={{ textAlign: "center" }}>
          <h2>Loading ride details...</h2>
        </div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="center-page">
        <div className="alert alert-error">
          <AlertCircle size={24} />
          <p>{error || "Ride not found"}</p>
          <button className="btn btn-primary" onClick={onBack}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const getStatusMessage = () => {
    const statuses = {
      requested: "Finding a driver...",
      searching_driver: "Searching for a driver nearby...",
      driver_assigned: "Driver assigned! Heading to you...",
      driver_arriving: "Driver is on the way",
      driver_arrived: "Driver has arrived at pickup",
      trip_started: "Trip in progress",
      trip_completed: "Trip completed",
      cancelled: "Ride cancelled",
    };
    return statuses[ride.status] || "Loading...";
  };

  const isActive = !["trip_completed", "cancelled"].includes(ride.status);

  return (
    <div className="tracking-page">
      <header className="tracking-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h1>Ride Tracking</h1>
        <div></div>
      </header>

      <main className="tracking-main">
        {/* Status Card */}
        <div className="status-card">
          <div className="status-badge">{getStatusMessage()}</div>

          {/* Driver Info */}
          {ride.driver && ride.status !== "requested" && ride.status !== "searching_driver" && (
            <div className="driver-info">
              <div className="driver-header">
                <div className="driver-avatar">
                  {ride.driver.profile_photo_url ? (
                    <img src={ride.driver.profile_photo_url} alt="Driver" />
                  ) : (
                    <span>{ride.driver.full_name?.charAt(0) || "D"}</span>
                  )}
                </div>
                <div className="driver-details">
                  <h3>{ride.driver.full_name}</h3>
                  <div className="driver-rating">
                    <Star size={16} fill="#FFB800" /> {ride.driver.average_rating?.toFixed(1) || "4.5"}
                  </div>
                </div>
                <button className="icon-button" onClick={() => alert(`Calling ${ride.driver.full_name}...`)}>
                  <Phone size={24} />
                </button>
              </div>
            </div>
          )}

          {/* Locations */}
          <div className="route-display">
            <div className="location-row">
              <MapPin size={18} className="pickup-icon" />
              <div>
                <small>Pickup</small>
                <p>{ride.pickup_address}</p>
              </div>
            </div>
            <div className="route-indicator">
              <div className="dot"></div>
              <div className="line"></div>
              <div className="dot"></div>
            </div>
            <div className="location-row">
              <MapPin size={18} className="dropoff-icon" />
              <div>
                <small>Destination</small>
                <p>{ride.dropoff_address}</p>
              </div>
            </div>
          </div>

          {/* Fare Info */}
          <div className="fare-info">
            <div className="fare-item">
              <DollarSign size={18} />
              <span>Fare Estimate</span>
              <strong>₹{ride.fare_estimate}</strong>
            </div>
            {ride.estimated_duration_minutes && (
              <div className="fare-item">
                <Clock size={18} />
                <span>Est. Duration</span>
                <strong>{ride.estimated_duration_minutes} min</strong>
              </div>
            )}
          </div>

          {/* Cancel Button */}
          {isActive && (
            <button
              className="btn btn-danger"
              onClick={handleCancel}
              disabled={cancelling}
              style={{ width: "100%" }}
            >
              <X size={18} />
              {cancelling ? "Cancelling..." : "Cancel Ride"}
            </button>
          )}
        </div>

        <LiveTrackingMap
          customerLocation={{ latitude: ride.pickup_latitude, longitude: ride.pickup_longitude }}
          employeeLocation={driverLocation}
          employeeName={ride.driver?.full_name}
          status={getStatusMessage()}
        />
      </main>
    </div>
  );
}
