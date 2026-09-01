import { useMemo } from "react";
import { MapPin } from "lucide-react";
import GoogleMap from "../../GoogleMap";

const HAS_MAPS_KEY = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

// Haversine distance in km between two {latitude, longitude} points.
function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Reusable live-tracking view: shows a real Google map with customer +
// employee markers when VITE_GOOGLE_MAPS_API_KEY is configured, and a clean
// "map unavailable" fallback otherwise so the page never crashes/blanks.
export default function LiveTrackingMap({ customerLocation, employeeLocation, employeeName, status, updatedAt }) {
  const distance = useMemo(() => distanceKm(customerLocation, employeeLocation), [customerLocation, employeeLocation]);

  if (!HAS_MAPS_KEY) {
    return (
      <div className="map-placeholder">
        <MapPin size={28} />
        <b>Map unavailable</b>
        <small>Add VITE_GOOGLE_MAPS_API_KEY to enable live map tracking.</small>
      </div>
    );
  }

  return (
    <div className="live-tracking-map">
      <GoogleMap
        center={employeeLocation || customerLocation}
        pickup={employeeLocation ? { lat: employeeLocation.latitude ?? employeeLocation.lat, lng: employeeLocation.longitude ?? employeeLocation.lng } : undefined}
        destination={customerLocation ? { lat: customerLocation.latitude ?? customerLocation.lat, lng: customerLocation.longitude ?? customerLocation.lng } : undefined}
        driver={employeeLocation ? { lat: employeeLocation.latitude ?? employeeLocation.lat, lng: employeeLocation.longitude ?? employeeLocation.lng } : undefined}
      />
      <div className="tracking-meta">
        {employeeName && <span><b>{employeeName}</b> {status ? `· ${status}` : ""}</span>}
        {distance != null && <span>{distance.toFixed(1)} km away</span>}
        {updatedAt && <span>Updated {new Date(updatedAt).toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
