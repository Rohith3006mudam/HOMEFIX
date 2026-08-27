import { requireSupabase, supabase } from "../lib/supabase";

// Writes the signed-in professional's current position for a specific
// active booking. Silently requires auth; callers should only invoke this
// while the professional has explicitly enabled "share live location" for
// a job that is actually in progress (see useLiveLocation + ProfessionalDashboard).
export async function writeMyLocation({ bookingId, latitude, longitude, accuracy, heading, speed }) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Please sign in to share your location.");

  const { error } = await client.from("employee_locations").insert({
    employee_id: authData.user.id,
    booking_id: bookingId || null,
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    heading: heading ?? null,
    speed: speed ?? null,
    is_online: true,
  });
  if (error) throw error;
}

// Subscribes the customer's tracking screen to realtime location pings for
// the professional assigned to `bookingId`. Returns an unsubscribe function.
export function subscribeToBookingLocation(bookingId, onUpdate) {
  if (!supabase || !bookingId) return () => {};
  const channel = supabase
    .channel(`homefix-location-${bookingId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "employee_locations", filter: `booking_id=eq.${bookingId}` },
      (payload) => onUpdate(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
