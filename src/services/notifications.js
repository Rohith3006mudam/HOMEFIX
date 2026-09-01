import { requireSupabase, supabase } from "../lib/supabase";

// Thin wrapper around public.notifications (see migration 001). Failures are
// swallowed by callers via best-effort helpers so a notification bug never
// blocks the underlying booking/ride/approval action itself.
export async function sendNotification({ userId, type, title, message, bookingId }) {
  const client = requireSupabase();
  const { error } = await client.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message: message || null,
    booking_id: bookingId || null,
  });
  if (error) throw error;
}

// Best-effort variant: logs but never throws, for use inside booking/ride/
// approval flows where a notification failure must not roll back the action.
export async function notifySafe(args) {
  try {
    await sendNotification(args);
  } catch (error) {
    console.warn("[HOMEFIX] Notification not sent:", error.message);
  }
}

export async function listMyNotifications() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return [];
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(id) {
  const client = requireSupabase();
  const { error } = await client.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export function subscribeToMyNotifications(userId, onInsert) {
  if (!supabase || !userId) return () => {};
  const channel = supabase
    .channel(`homefix-notifications-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
