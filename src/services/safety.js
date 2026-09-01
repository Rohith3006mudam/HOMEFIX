import { requireSupabase } from "../lib/supabase";

export async function reportSafetyIncident({ category, details, bookingId = null, rideId = null }) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Please sign in to report a safety concern.");
  if (!details?.trim()) throw new Error("Describe the safety concern before submitting.");

  const { data, error } = await client.from("safety_incidents").insert({
    reporter_id: authData.user.id,
    category: category || "other",
    details: details.trim(),
    booking_id: bookingId,
    ride_id: rideId,
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function listMySafetyIncidents() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return [];
  const { data, error } = await client.from("safety_incidents").select("*")
    .eq("reporter_id", authData.user.id).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}