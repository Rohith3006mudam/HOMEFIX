import { requireSupabase, supabase } from "../lib/supabase";

// Converts a display slot like "03:00 PM - 05:00 PM" into a PostgreSQL
// TIME value using the slot's start time, e.g. "15:00:00".
export function timeSlotToPostgresTime(slot) {
  const start = String(slot || "").split("-")[0].trim();
  const match = start.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) throw new Error(`Invalid booking time slot: ${slot}`);
  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3].toUpperCase();
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (meridiem === "PM" && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:${minute}:00`;
}

// public.bookings actual columns (verified against the live database):
// id, customer_id (uuid), service, mobile, address, booking_date (date),
// booking_time (time), status (text), created_at.
export async function createBooking({ service, mobile, address, bookingDate, timeSlot }) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const authUser = authData.user;
  if (!authUser) throw new Error("Please sign in to confirm your booking.");

  const payload = {
    customer_id: authUser.id, // uuid, never stringified
    service,
    mobile,
    address,
    booking_date: bookingDate, // already YYYY-MM-DD
    booking_time: timeSlotToPostgresTime(timeSlot),
    status: "PENDING",
  };

  console.log("[HOMEFIX] Booking submit started");
  console.log("[HOMEFIX] Booking payload:", payload);

  const { data, error } = await client.from("bookings").insert(payload).select("*").single();
  if (error) {
    console.error("[HOMEFIX] Booking error:", error);
    throw error;
  }
  console.log("[HOMEFIX] Booking created:", data);
  return data;
}

export async function listMyBookings() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Please sign in to view your bookings.");
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("customer_id", authData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function cancelMyBooking(id) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Please sign in to cancel a booking.");
  const { data, error } = await client
    .from("bookings")
    .update({ status: "CANCELLED" })
    .eq("id", id)
    .eq("customer_id", authData.user.id)
    .in("status", ["PENDING", "CONFIRMED"])
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export function subscribeToMyBookings(customerId, onChange) {
  if (!supabase || !customerId) return () => {};
  const channel = supabase
    .channel(`homefix-bookings-${customerId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bookings", filter: `customer_id=eq.${customerId}` },
      onChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
