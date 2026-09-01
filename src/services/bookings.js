import { requireSupabase, supabase } from "../lib/supabase";
import { notifySafe } from "./notifications";

// Converts the manually selected booking time into a PostgreSQL TIME value.
// Accepts a 24-hour "HH:MM" value from <input type="time"> (current UI), and
// still supports the legacy "hh:mm AM/PM - hh:mm AM/PM" slot format for any
// bookings created before the manual time picker was introduced.
export function timeSlotToPostgresTime(slot) {
  const raw = String(slot || "").trim();
  const plain24h = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (plain24h) {
    const hour = Number(plain24h[1]);
    if (hour > 23) throw new Error(`Invalid booking time: ${slot}`);
    return `${String(hour).padStart(2, "0")}:${plain24h[2]}:00`;
  }
  const start = raw.split("-")[0].trim();
  const match = start.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) throw new Error(`Invalid booking time: ${slot}`);
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

  const { data, error } = await client.from("bookings").insert(payload).select("*").single();
  if (error) {
    console.error("[HOMEFIX] Booking error:", error);
    throw error;
  }
  await notifySafe({
    userId: authUser.id,
    type: "booking_created",
    title: "Booking confirmed",
    message: `Your ${service} booking on ${bookingDate} is confirmed.`,
    bookingId: data.id,
  });
  return data;
}

// Employee: bookings currently or previously assigned to the signed-in professional.
export async function getMyAssignedBookings() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Please sign in to view your jobs.");
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("professional_id", authData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listMyBookings() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Please sign in to view your bookings.");
  const { data, error } = await client
    .from("bookings")
    .select("*, professional:profiles!bookings_professional_id_fkey(full_name, phone, profile_photo_url, average_rating)")
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
  if (data?.professional_id) {
    await notifySafe({
      userId: data.professional_id,
      type: "booking_cancelled",
      title: "Booking cancelled",
      message: `The customer cancelled the ${data.service} booking.`,
      bookingId: data.id,
    });
  }
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

// Employee: Accept a job assigned to them (atomic operation)
export async function acceptJob(bookingId) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Please sign in to accept a job.");

  // Use RPC to ensure atomic job acceptance (no double-accepts)
  const { data, error } = await client
    .from("bookings")
    .update({
      professional_id: authData.user.id,
      status: "ASSIGNED",
      updated_at: new Date().toISOString()
    })
    .eq("id", bookingId)
    .eq("professional_id", null) // Only accept if not already assigned
    .eq("status", "PENDING")
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("This job was already accepted by another professional.");
  if (data.customer_id) {
    await notifySafe({
      userId: data.customer_id,
      type: "employee_assigned",
      title: "Professional assigned",
      message: `A HOMEFIX professional accepted your ${data.service} booking.`,
      bookingId: data.id,
    });
  }
  return data;
}

// Employee: Update job status (from ASSIGNED -> ON_THE_WAY -> SERVICE_STARTED -> COMPLETED)
export async function updateJobStatus(bookingId, newStatus) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Please sign in.");

  const validStatuses = ["ON_THE_WAY", "SERVICE_STARTED", "COMPLETED"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error("Invalid status update.");
  }

  const { data, error } = await client
    .from("bookings")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", bookingId)
    .eq("professional_id", authData.user.id) // Only professional assigned can update
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("You are not assigned to this job.");
  const statusMessages = {
    ON_THE_WAY: ["employee_arriving", "Professional on the way", "Your professional is on the way."],
    SERVICE_STARTED: ["service_started", "Service started", "Your service has started."],
    COMPLETED: ["service_completed", "Service completed", "Your service is complete."],
  };
  const notice = statusMessages[newStatus];
  if (notice && data.customer_id) {
    await notifySafe({ userId: data.customer_id, type: notice[0], title: notice[1], message: notice[2], bookingId: data.id });
  }
  return data;
}

// Get list of available jobs for employee (PENDING bookings in their service area)
export async function getAvailableJobs() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("status", "PENDING")
    .is("professional_id", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

// Subscribe to incoming job requests for an employee
export function subscribeToJobRequests(onChange) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`homefix-jobs-available`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "bookings", filter: "status=eq.PENDING" },
      onChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
