import { requireSupabase } from "../lib/supabase";

// public.support_tickets (see migration 001): user_id, booking_id, category,
// subject, message, status, priority.
export async function createSupportTicket({ category, subject, message, bookingId }) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Please sign in to contact support.");
  const { data, error } = await client
    .from("support_tickets")
    .insert({
      user_id: authData.user.id,
      category: category || "other",
      subject: subject || null,
      message,
      booking_id: bookingId || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listMySupportTickets() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return [];
  const { data, error } = await client
    .from("support_tickets")
    .select("*")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
