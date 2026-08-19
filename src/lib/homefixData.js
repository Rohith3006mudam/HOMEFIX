import { supabase, isSupabaseConfigured, requireSupabase } from "./supabaseClient";

export { isSupabaseConfigured, supabase };

export async function signIn({ email, password }) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp({ email, password, fullName, phone }) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone, role: "customer" } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentProfile(userId) {
  const client = requireSupabase();
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function listServices() {
  const client = requireSupabase();
  const { data, error } = await client.from("services").select("*").eq("active", true).order("name");
  if (error) throw error;
  return data;
}

export async function listCustomerBookings(customerId) {
  const client = requireSupabase();
  const { data, error } = await client.from("bookings").select("*, services(*), employees(*), addresses(*)").eq("customer_id", customerId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createBooking(booking) {
  const client = requireSupabase();
  const { data, error } = await client.from("bookings").insert(booking).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateBookingStatus(id, bookingStatus, trackingStatus = bookingStatus) {
  const client = requireSupabase();
  const { data, error } = await client.from("bookings").update({ booking_status: bookingStatus, tracking_status: trackingStatus, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function createPayment(payment) {
  const client = requireSupabase();
  const { data, error } = await client.from("payments").insert(payment).select("*").single();
  if (error) throw error;
  return data;
}

export function subscribeToBookings(customerId, onChange) {
  if (!supabase) return () => {};
  const channel = supabase.channel(`homefix-bookings-${customerId}`).on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `customer_id=eq.${customerId}` }, onChange).subscribe();
  return () => supabase.removeChannel(channel);
}
