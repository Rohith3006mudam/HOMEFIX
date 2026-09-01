import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function hmacSha256(message: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
  const razorpaySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !razorpayKeyId || !razorpaySecret) {
    return json({ error: "Payment configuration required." }, 503);
  }

  const authorization = request.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const body = await request.json();
  const paymentId = body.payment_id;
  if (typeof paymentId !== "string") return json({ error: "payment_id is required" }, 400);

  const { data: payment, error: paymentError } = await adminClient
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("customer_id", user.id)
    .single();
  if (paymentError || !payment) return json({ error: "Payment not found" }, 404);

  if (body.action === "create_order") {
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpaySecret}`)}`,
      },
      body: JSON.stringify({ amount: Math.round(Number(payment.amount) * 100), currency: payment.currency || "INR", receipt: payment.id }),
    });
    const order = await orderResponse.json();
    if (!orderResponse.ok) return json({ error: order?.error?.description || "Unable to create payment order." }, orderResponse.status);
    await adminClient.from("payments").update({ provider: "razorpay", provider_order_id: order.id, status: "processing", updated_at: new Date().toISOString() }).eq("id", payment.id);
    return json({ provider_order_id: order.id, amount: order.amount, currency: order.currency });
  }

  if (body.action === "verify_payment") {
    if (![body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature].every((value) => typeof value === "string")) {
      return json({ error: "Incomplete payment response." }, 400);
    }
    if (body.razorpay_order_id !== payment.provider_order_id) return json({ error: "Payment order mismatch." }, 400);
    const expected = await hmacSha256(`${body.razorpay_order_id}|${body.razorpay_payment_id}`, razorpaySecret);
    if (expected !== body.razorpay_signature) return json({ error: "Payment signature verification failed." }, 400);
    const { error: updateError } = await adminClient.from("payments").update({
      status: "paid", provider_payment_id: body.razorpay_payment_id, provider_signature: body.razorpay_signature, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
    if (updateError) return json({ error: "Unable to record verified payment." }, 500);
    return json({ status: "paid", provider_payment_id: body.razorpay_payment_id });
  }

  return json({ error: "Unknown payment action." }, 400);
});