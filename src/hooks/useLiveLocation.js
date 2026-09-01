import { useCallback, useRef, useState } from "react";

// Real device geolocation via navigator.geolocation.watchPosition(), gated
// entirely behind explicit user action (call startTracking() from a click
// handler). Updates are throttled so callers (e.g. an employee location
// writer) don't flood Supabase with a row per GPS tick.
export function useLiveLocation({ throttleMs = 7000 } = {}) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef(null);
  const lastEmitRef = useRef(0);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("This device/browser does not support location access.");
      return;
    }
    if (watchIdRef.current != null) return; // already tracking

    setError("");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (Date.now() - position.timestamp > 30000) {
          setError("Location is stale. Move to an area with a stronger GPS signal.");
          return;
        }
        const now = Date.now();
        if (now - lastEmitRef.current < throttleMs) return;
        lastEmitRef.current = now;
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          updatedAt: now,
        });
      },
      (geoError) => {
        const messages = {
          1: "Location permission is required to share your current location.",
          2: "Your location is currently unavailable. Try again when GPS is available.",
          3: "Location request timed out. Try again in an area with better signal.",
        };
        setError(messages[geoError.code] || geoError.message || "Unable to access your location.");
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    setIsTracking(true);
  }, [throttleMs, stopTracking]);

  return { location, error, isTracking, startTracking, stopTracking };
}
