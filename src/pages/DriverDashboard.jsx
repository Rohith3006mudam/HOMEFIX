import { useState, useEffect } from "react";
import { Bike, Car, MapPin, Phone, User, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useLiveLocation } from "../hooks/useLiveLocation";
import { getDriverProfile, setDriverOnlineStatus, getAvailableRideRequests, acceptRide, updateRideStatus, getMyDriverRides, getTodayDriverRides, writeDriverLocation } from "../services/rides";

export default function DriverDashboard() {
  const auth = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [driverProfile, setDriverProfile] = useState(null);
  const [availableRides, setAvailableRides] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [currentRide, setCurrentRide] = useState(null);
  const [tab, setTab] = useState("available");
  const location = useLiveLocation({ throttleMs: 7000 });

  // Load driver profile on mount
  useEffect(() => {
    loadDriverProfile();
  }, []);

  // Refresh available rides when online status changes
  useEffect(() => {
    if (isOnline) {
      loadAvailableRides();
      const interval = setInterval(loadAvailableRides, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [isOnline]);

  // Load driver earnings
  useEffect(() => {
    if (tab === "earnings") {
      loadTodayEarnings();
    }
  }, [tab]);

  useEffect(() => {
    if (!location.location || !currentRide) return;
    writeDriverLocation({
      rideId: currentRide.id,
      latitude: location.location.latitude,
      longitude: location.location.longitude,
      accuracy: location.location.accuracy,
      heading: location.location.heading,
      speed: location.location.speed,
    }).catch((err) => console.warn("[HOMEFIX] Driver location share failed:", err.message));
  }, [location.location, currentRide?.id]);

  useEffect(() => {
    if (!currentRide && location.isTracking) location.stopTracking();
  }, [currentRide, location.isTracking, location.stopTracking]);

  const loadDriverProfile = async () => {
    try {
      setLoading(true);
      const profile = await getDriverProfile();
      setDriverProfile(profile);
      setIsOnline(profile?.is_online || false);

      // Also load current/recent rides
      const rides = await getMyDriverRides();
      setMyRides(rides);

      // Check for active ride
      const activeRide = rides.find((r) => ["driver_assigned", "driver_arriving", "driver_arrived", "trip_started"].includes(r.status));
      if (activeRide) {
        setCurrentRide(activeRide);
      }
    } catch (err) {
      console.error("Failed to load driver profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableRides = async () => {
    if (!isOnline) return;
    try {
      const rides = await getAvailableRideRequests();
      setAvailableRides(rides);
    } catch (err) {
      console.error("Failed to load available rides:", err);
    }
  };

  const loadTodayEarnings = async () => {
    try {
      const rides = await getTodayDriverRides();
      const total = rides.reduce((sum, r) => sum + (r.actual_fare || 0), 0);
      setTodayEarnings(total);
    } catch (err) {
      console.error("Failed to load earnings:", err);
    }
  };

  const handleToggleOnline = async () => {
    try {
      await setDriverOnlineStatus(!isOnline);
      setIsOnline(!isOnline);
      if (!isOnline) {
        loadAvailableRides();
      }
    } catch (err) {
      console.error("Failed to toggle online status:", err);
    }
  };

  const handleAcceptRide = async (rideId) => {
    try {
      const ride = await acceptRide(rideId);
      setCurrentRide(ride);
      setTab("active");
      loadAvailableRides();
    } catch (err) {
      alert(err.message || "Failed to accept ride");
    }
  };

  const handleUpdateRideStatus = async (rideId, status) => {
    try {
      const ride = await updateRideStatus(rideId, status);
      if (status === "trip_completed") {
        setCurrentRide(null);
        loadTodayEarnings();
      } else {
        setCurrentRide(ride);
      }
    } catch (err) {
      alert(err.message || "Failed to update ride");
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="center-page">
        <div style={{ textAlign: "center" }}>
          <h2>Please sign in</h2>
          <p>Driver portal requires authentication</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="center-page">
        <div style={{ textAlign: "center" }}>
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!driverProfile) {
    return (
      <div className="center-page">
        <div className="alert alert-error">
          <p>Driver profile not found</p>
          <small>Please complete your driver profile setup</small>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>HOMEFIX Driver</h1>
          <button
            className="icon-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Online Status Card */}
        <div className="driver-status-card">
          <div className="status-info">
            <div className="vehicle-badge">
              {driverProfile.vehicle_type === "bike" ? <Bike size={24} /> : <Car size={24} />}
              <span>{driverProfile.vehicle_type === "bike" ? "Bike" : "Auto"}</span>
            </div>
            <div>
              <p className="status-label">{isOnline ? "Online" : "Offline"}</p>
              <p className="status-detail">
                {driverProfile.vehicle_registration_number || "Vehicle pending"}
              </p>
            </div>
          </div>
          <button
            className={`btn ${isOnline ? "btn-danger" : "btn-success"}`}
            onClick={handleToggleOnline}
          >
            {isOnline ? "GO OFFLINE" : "GO ONLINE"}
          </button>
        </div>

        {/* Current Ride Alert */}
        {currentRide && (
          <div className="alert alert-info">
            <h3>Active Ride</h3>
            <p>Pickup: {currentRide.pickup_address}</p>
            <p>Destination: {currentRide.dropoff_address}</p>
            <p>Status: {currentRide.status.replace(/_/g, " ").toUpperCase()}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="tab-navigation">
          <button
            className={`tab-btn ${tab === "available" ? "active" : ""}`}
            onClick={() => setTab("available")}
          >
            Available Requests ({availableRides.length})
          </button>
          <button
            className={`tab-btn ${tab === "active" ? "active" : ""}`}
            onClick={() => setTab("active")}
          >
            Active
          </button>
          <button
            className={`tab-btn ${tab === "earnings" ? "active" : ""}`}
            onClick={() => setTab("earnings")}
          >
            Earnings
          </button>
        </div>

        {/* Available Rides */}
        {tab === "available" && (
          <div className="rides-list">
            {!isOnline ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <p>Go online to receive ride requests</p>
              </div>
            ) : availableRides.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <p>No available rides at the moment</p>
              </div>
            ) : (
              availableRides.map((ride) => (
                <div key={ride.id} className="ride-card">
                  <div className="ride-header">
                    <h3>{ride.ride_type === "bike" ? "Bike Ride" : "Auto Ride"}</h3>
                    <span className="fare-badge">₹{ride.fare_estimate}</span>
                  </div>
                  <div className="ride-details">
                    <p>
                      <MapPin size={16} />
                      <strong>Pickup:</strong> {ride.pickup_address}
                    </p>
                    <p>
                      <MapPin size={16} />
                      <strong>Destination:</strong> {ride.dropoff_address}
                    </p>
                    <p>
                      <Phone size={16} />
                      <strong>Customer:</strong> {ride.customer?.full_name || "Unknown"}
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAcceptRide(ride.id)}
                  >
                    Accept Ride
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Active Ride */}
        {tab === "active" && (
          <div className="rides-list">
            {!currentRide ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <p>No active rides</p>
              </div>
            ) : (
              <div className="ride-card ride-card-active">
                <div className="ride-header">
                  <h3>Active Ride</h3>
                  <span className="status-badge">
                    {currentRide.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
                <div className="ride-details">
                  <p>
                    <MapPin size={16} />
                    <strong>Pickup:</strong> {currentRide.pickup_address}
                  </p>
                  <p>
                    <MapPin size={16} />
                    <strong>Destination:</strong> {currentRide.dropoff_address}
                  </p>
                  <p>
                    <Phone size={16} />
                    <strong>Customer:</strong> {currentRide.customer?.full_name || "Unknown"}
                  </p>
                  <p>
                    <strong>Fare:</strong> ₹{currentRide.fare_estimate}
                  </p>
                </div>

                <div className="ride-actions">
                  {location.error && <p className="error-text">{location.error}</p>}
                  <button
                    className={`btn ${location.isTracking ? "btn-danger" : "btn-secondary"}`}
                    onClick={() => (location.isTracking ? location.stopTracking() : location.startTracking())}
                  >
                    <MapPin size={16} />
                    {location.isTracking ? "Stop location sharing" : "Share live location"}
                  </button>
                </div>

                <div className="ride-actions">
                  {currentRide.status === "driver_assigned" && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleUpdateRideStatus(currentRide.id, "driver_arriving")}
                    >
                      Start Heading to Pickup
                    </button>
                  )}
                  {currentRide.status === "driver_arriving" && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleUpdateRideStatus(currentRide.id, "driver_arrived")}
                    >
                      Arrived at Pickup
                    </button>
                  )}
                  {currentRide.status === "driver_arrived" && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleUpdateRideStatus(currentRide.id, "trip_started")}
                    >
                      Start Trip
                    </button>
                  )}
                  {currentRide.status === "trip_started" && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleUpdateRideStatus(currentRide.id, "trip_completed")}
                    >
                      Complete Trip
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Earnings */}
        {tab === "earnings" && (
          <div className="earnings-section">
            <div className="stat-card">
              <h3>Today's Earnings</h3>
              <p className="stat-value">₹{todayEarnings}</p>
              <small>From {myRides.filter((r) => r.status === "trip_completed").length} completed rides</small>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav">
        <button className={`nav-btn ${tab === "available" ? "active" : ""}`} onClick={() => setTab("available")}>
          <Bike size={24} />
          <span>Requests</span>
        </button>
        <button className={`nav-btn ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>
          <MapPin size={24} />
          <span>Active</span>
        </button>
        <button className={`nav-btn ${tab === "earnings" ? "active" : ""}`} onClick={() => setTab("earnings")}>
          <Phone size={24} />
          <span>Earnings</span>
        </button>
      </nav>
    </div>
  );
}
