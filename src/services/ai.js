import { requireSupabase } from "../lib/supabase";

// Calls the Supabase Edge Function (supabase/functions/homefix-ai, see
// AI_EDGE_FUNCTION.ts). The provider API key stays server-side as a Supabase
// secret; the browser only ever sees the reply text.
export async function askHomefixAI(message, context = {}) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke("homefix-ai", {
    body: { message, context },
  });
  if (error) throw new Error(error.message || "AI assistant is unavailable right now.");
  if (data?.error) throw new Error(data.error);
  return data?.reply || "I could not generate a response.";
}
