import { supabase, requireSupabase } from "../lib/supabase";

// ---- Indian mobile number handling -------------------------------------

// Accepts "9876543210", "+919876543210", "919876543210", "91 98765 43210", etc.
// Returns the canonical "+91XXXXXXXXXX" form, or null if not a valid Indian mobile.
export function normalizeIndianPhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  let core = digits;
  if (core.length === 12 && core.startsWith("91")) core = core.slice(2);
  if (core.length === 11 && core.startsWith("0")) core = core.slice(1);
  if (core.length !== 10 || !/^[6-9]/.test(core)) return null;
  return `+91${core}`;
}

export function isValidIndianPhone(input) {
  return normalizeIndianPhone(input) !== null;
}

// ---- Email + password -----------------------------------------------------

export async function signUpWithPassword({ email, password, fullName, phone }) {
  const client = requireSupabase();
  const normalizedPhone = phone ? normalizeIndianPhone(phone) : null;
  if (phone && !normalizedPhone) throw new Error("Enter a valid 10-digit Indian mobile number.");
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || "", phone: normalizedPhone || "" } },
  });
  if (error) throw error;
  if (!data.session) {
    throw new Error("Account created. Please check your email to confirm your account, then sign in.");
  }
  return data;
}

export async function signInWithPassword({ email, password }) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email) {
  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/profile`,
  });
  if (error) throw error;
}

// ---- Mobile OTP -------------------------------------------------------

const RESEND_COOLDOWN_MS = 30_000;
let lastOtpSentAt = 0;

export async function sendPhoneOtp(phone) {
  const client = requireSupabase();
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) throw new Error("Enter a valid 10-digit Indian mobile number.");
  const now = Date.now();
  if (now - lastOtpSentAt < RESEND_COOLDOWN_MS) {
    throw new Error("Please wait before requesting another OTP.");
  }
  const { error } = await client.auth.signInWithOtp({ phone: normalizedPhone });
  if (error) {
    const message = error.message || "Unable to send OTP.";
    if (/unsupported phone provider|phone provider/i.test(message)) {
      throw new Error("Mobile OTP is not configured. Use email and password, or ask an administrator to enable a Supabase phone provider.");
    }
    throw error;
  }
  lastOtpSentAt = now;
  return normalizedPhone;
}

export async function verifyPhoneOtp(phone, token) {
  const client = requireSupabase();
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) throw new Error("Enter a valid 10-digit Indian mobile number.");
  if (!/^\d{6}$/.test(token)) throw new Error("Enter the 6-digit OTP.");
  const { data, error } = await client.auth.verifyOtp({ phone: normalizedPhone, token, type: "sms" });
  if (error) {
    const message = error.message || "Invalid or expired OTP.";
    if (/unsupported phone provider|phone provider/i.test(message)) {
      throw new Error("Mobile OTP is not configured. Use email and password, or ask an administrator to enable a Supabase phone provider.");
    }
    throw error;
  }
  if (!data.session) throw new Error("Invalid or expired OTP.");
  return data;
}

// ---- Session / profile -------------------------------------------------

export async function getSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

// Loads the caller's own profile row, creating it if the signup trigger
// has not run yet (e.g. accounts created before the profiles table existed).
export async function getOrCreateProfile(authUser) {
  const client = requireSupabase();
  const { data: existing, error: readError } = await client
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;

  const { data: created, error: createError } = await client
    .from("profiles")
    .insert({
      id: authUser.id,
      full_name: authUser.user_metadata?.full_name || "",
      phone: authUser.user_metadata?.phone || authUser.phone || "",
      email: authUser.email || "",
      role: "customer",
    })
    .select("*")
    .single();
  if (createError) throw createError;
  return created;
}

export async function updateOwnProfile(userId, changes) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .update({ full_name: changes.full_name, phone: changes.phone, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ---- Employee signup / access request ----------------------------------------

// Customers can request to become employees (creates profile with pending approval)
export async function requestEmployeeAccess({ fullName, phone, services, experience, serviceArea }) {
  const client = requireSupabase();
  const { data, error } = await client
    .rpc("request_employee_access", {
      requested_full_name: fullName || null,
      requested_phone: phone ? normalizeIndianPhone(phone) : null,
      requested_services: services || [],
      requested_experience: experience || 0,
      requested_service_area: serviceArea || null,
    })
    .single();
  if (error) throw error;
  return data;
}

export async function requestDriverAccess({ vehicleType, vehicleNumber }) {
  const client = requireSupabase();
  if (!['bike', 'auto'].includes(vehicleType)) throw new Error("Choose Bike or Auto.");
  if (!vehicleNumber.trim()) throw new Error("Enter your vehicle number.");
  const { data, error } = await client
    .rpc("request_driver_access", {
      requested_vehicle_type: vehicleType,
      requested_vehicle_number: vehicleNumber.trim(),
    })
    .single();
  if (error) throw error;
  return data;
}

// Fetch current user's actual role from database (not frontend/localStorage)
export async function getActualUserRole() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("role, approval_status")
    .eq("id", authData.user.id)
    .single();
  if (error) throw error;
  return data;
}

// Admin only: get list of pending employee applications
export async function getPendingEmployees() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("role", "employee")
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Admin only: approve an employee
export async function approveEmployee(employeeId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .update({ approval_status: "approved", updated_at: new Date().toISOString() })
    .eq("id", employeeId)
    .eq("role", "employee")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Admin only: reject an employee
export async function rejectEmployee(employeeId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .update({ approval_status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", employeeId)
    .eq("role", "employee")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
