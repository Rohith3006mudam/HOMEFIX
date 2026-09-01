// Router wrapper for HOMEFIX application
// Handles all page routing based on URL path and user role

import { useAuth } from "../hooks/useAuth";
import DriverLogin from "../components/DriverLogin";
import DriverDashboard from "../pages/DriverDashboard";
import RideBooking from "../components/RideBooking";
import RideTracking from "../components/RideTracking";
import BikeMechanicBooking from "../components/BikeMechanicBooking";
import CarMechanicBooking from "../components/CarMechanicBooking";

export default function HomeFixRouter({ page, go, requireAuth, notify, activeId, onRideComplete }) {
  const auth = useAuth();

  // DRIVER ROUTES
  if (page === "driver-login") {
    return (
      <DriverLogin
        onSuccess={() => {
          notify("Welcome, driver!");
          go("driver-dashboard");
        }}
      />
    );
  }

  if (page === "driver-dashboard") {
    if (!auth.isAuthenticated) {
      return (
        <div className="center-page">
          <div className="alert alert-error">
            <p>Please sign in as a driver</p>
            <button className="btn btn-primary" onClick={() => go("driver-login")}>
              Driver Login
            </button>
          </div>
        </div>
      );
    }
    return <DriverDashboard />;
  }

  // RIDE ROUTES
  if (page === "ride-booking-bike") {
    requireAuth("ride-booking-bike");
    return (
      <RideBooking
        rideType="bike"
        onBack={() => go("home")}
        onConfirm={(rideData) => {
          // TODO: Save ride, show confirmation
          notify("Ride request sent! Finding a driver...");
          go("home");
        }}
      />
    );
  }

  if (page === "ride-booking-auto") {
    requireAuth("ride-booking-auto");
    return (
      <RideBooking
        rideType="auto"
        onBack={() => go("home")}
        onConfirm={(rideData) => {
          notify("Ride request sent! Finding a driver...");
          go("home");
        }}
      />
    );
  }

  if (page === "ride-tracking") {
    return (
      <RideTracking
        rideId={activeId}
        onBack={() => go("home")}
      />
    );
  }

  // MECHANIC ROUTES
  if (page === "bike-mechanic") {
    requireAuth("bike-mechanic");
    return (
      <BikeMechanicBooking
        onBack={() => go("home")}
        onSuccess={() => {
          go("home");
        }}
        notify={notify}
      />
    );
  }

  if (page === "car-mechanic") {
    requireAuth("car-mechanic");
    return (
      <CarMechanicBooking
        onBack={() => go("home")}
        onSuccess={() => {
          go("home");
        }}
        notify={notify}
      />
    );
  }

  // If page not matched here, let parent handle it
  return null;
}
