import { requireSupabase } from "./lib/supabase";

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;
let razorpayLoadPromise;

export function isPaymentMethodConfigured(paymentMethod) {
  return paymentMethod === "Cash on Service" || Boolean(RAZORPAY_KEY_ID);
}

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayLoadPromise) return razorpayLoadPromise;
  razorpayLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded."));
    document.head.appendChild(script);
  });
  return razorpayLoadPromise;
}

export async function createPayment({ bookingId, customerId, amount, paymentMethod }) {
  const client = requireSupabase();
  if (paymentMethod !== "Cash on Service" && !RAZORPAY_KEY_ID) {
    throw new Error("Payment configuration required. Choose Cash on Service or contact support.");
  }
  const status = "pending";
  const { data, error } = await client
    .from("payments")
    .insert({
      booking_id: bookingId,
      customer_id: customerId,
      amount,
      method: paymentMethod.toLowerCase().replaceAll(" ", "_"),
      status,
    })
    .select("*")
    .single();
  if (error) throw error;
  if (paymentMethod === "Cash on Service") return data;

  const { data: order, error: orderError } = await client.functions.invoke("homefix-payments", {
    body: { action: "create_order", payment_id: data.id },
  });
  if (orderError || order?.error) throw new Error(order?.error || orderError.message || "Unable to start payment.");
  await loadRazorpayCheckout();

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: RAZORPAY_KEY_ID,
      order_id: order.provider_order_id,
      amount: order.amount,
      currency: order.currency || "INR",
      handler: async (response) => {
        const { data: verified, error: verifyError } = await client.functions.invoke("homefix-payments", {
          body: { action: "verify_payment", payment_id: data.id, ...response },
        });
        if (verifyError || verified?.error || verified?.status !== "paid") {
          reject(new Error(verified?.error || verifyError?.message || "Payment verification failed."));
          return;
        }
        resolve({ ...data, ...verified });
      },
      modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
    });
    checkout.open();
  });
}


