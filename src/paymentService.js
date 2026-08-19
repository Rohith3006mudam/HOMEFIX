const PAYMENT_KEY = "homefix_payments";

const readPayments = () => {
  try {
    return JSON.parse(localStorage.getItem(PAYMENT_KEY)) || [];
  } catch {
    return [];
  }
};

const savePayments = (payments) => localStorage.setItem(PAYMENT_KEY, JSON.stringify(payments));

export const createPayment = ({ bookingId, customerId = null, amount, paymentMethod }) => {
  const paymentStatus = paymentMethod === "Cash on Service" ? "PENDING" : "PAID";
  const payment = {
    id: `PAY${Date.now().toString().slice(-8)}`,
    transactionId: paymentMethod === "Cash on Service" ? null : `TXN${Date.now().toString().slice(-8)}`,
    bookingId,
    customerId,
    amount,
    paymentMethod,
    method: paymentMethod,
    paymentStatus,
    status: paymentStatus,
    refundStatus: "NOT_REQUESTED",
    createdAt: new Date().toISOString(),
  };
  savePayments([payment, ...readPayments()]);
  return payment;
};

export const retryMockPayment = (payment) => createPayment({ ...payment, paymentMethod: payment.paymentMethod || "Card" });
export const getPayments = readPayments;
