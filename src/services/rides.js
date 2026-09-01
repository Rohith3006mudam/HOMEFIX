import { requireSupabase } from "../lib/supabase";
import { notifySafe } from "./notifications";

// =====================================================================
// RIDE MANAGEMENT CORE FUNCTIONS
// =====================================================================

/**
 * Customer: create a new ride request (bike/auto). Inserts into public.rides
 * with status "searching_driver" so drivers immediately see it via
 * getAvailableRideRequests(). This is the real persistence step the
 * RideBooking UI's onConfirm callback must call.
 */
export async function requestRide({
  rideType, pickup, pickupCoords, dropoff, dropoffCoords, fare, duration,
}) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Please sign in to request a ride.");
  if (!pickupCoords || !dropoffCoords) throw new Error("Pickup and dropoff locations are required.");

  const { data, error } = await client
    .from("rides")
    .insert({
      customer_id: authData.user.id,
      ride_type: rideType,
      pickup_address: pickup,
      pickup_latitude: pickupCoords.lat,
      pickup_longitude: pickupCoords.lng,
      dropoff_address: dropoff,
      dropoff_latitude: dropoffCoords.lat,
      dropoff_longitude: dropoffCoords.lng,
      estimated_duration_minutes: duration || null,
      fare_estimate: fare || null,
      status: "searching_driver",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Get available ride requests for a driver
 */
export async function getAvailableRideRequests() {
  const client = requireSupabase();
  const { data: authData } = await client.auth.getSession();
  if (!authData?.session?.user?.id) throw new Error("Not authenticated");

  const { data, error } = await client
    .from("rides")
    .select("*")
    .eq("status", "searching_driver")
    .limit(10);

  if (error) throw error;
  return data || [];
}

/**
 * Accept a ride request (driver) - ATOMIC
 */
export async function acceptRide(rideId) {
  const client = requireSupabase();
  const { data: authData } = await client.auth.getSession();
  if (!authData?.session?.user?.id) throw new Error("Not authenticated");

  const { data, error } = await client
    .from("rides")
    .update({
      driver_id: authData.session.user.id,
      status: "driver_assigned",
      driver_assigned_at: new Date().toISOString(),
    })
    .eq("id", rideId)
    .eq("status", "searching_driver")
    .is("driver_id", null)
    .select()
    .single();

  if (error) throw new Error("Ride already accepted or invalid");
  await notifySafe({
    userId: data.customer_id,
    type: "ride_accepted",
    title: "Driver assigned",
    message: "A driver accepted your ride request.",
  });
  return data;
}

/**
 * Update ride status
 */
export async function updateRideStatus(rideId, newStatus) {
  const client = requireSupabase();
  const { data: authData } = await client.auth.getSession();
  if (!authData?.session?.user?.id) throw new Error("Not authenticated");

  const updates = { status: newStatus };
  if (newStatus === "trip_started") updates.trip_started_at = new Date().toISOString();
  if (newStatus === "trip_completed") updates.trip_completed_at = new Date().toISOString();

  const { data, error } = await client
    .from("rides")
    .update(updates)
    .eq("id", rideId)
    .eq("driver_id", authData.session.user.id)
    .select()
    .single();

  if (error) throw error;
  const statusMessages = {
    driver_arriving: ["driver_arriving", "Driver is arriving", "Your driver is on the way to pickup."],
    trip_started: ["ride_started", "Ride started", "Your ride has started."],
    trip_completed: ["ride_completed", "Ride completed", "Your ride is complete."],
  };
  const notice = statusMessages[newStatus];
  if (notice && data.customer_id) {
    await notifySafe({ userId: data.customer_id, type: notice[0], title: notice[1], message: notice[2] });
  }
  return data;
}

/**
 * Get my driver rides
 */
export async function getMyDriverRides() {
  const client = requireSupabase();
  const { data: authData } = await client.auth.getSession();
  if (!authData?.session?.user?.id) throw new Error("Not authenticated");

  const { data, error } = await client
    .from("rides")
    .select("*")
    .eq("driver_id", authData.session.user.id)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get today's driver rides for earnings
 */
export async function getTodayDriverRides() {
  const client = requireSupabase();
  const { data: authData } = await client.auth.getSession();
  if (!authData?.session?.user?.id) throw new Error("Not authenticated");

  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await client
    .from("rides")
    .select("*")
    .eq("driver_id", authData.session.user.id)
    .eq("status", "trip_completed")
    .gte("trip_completed_at", `${today}T00:00:00`);

  if (error) throw error;
  return data || [];
}

/**
 * Get ride by ID
 */
export async function getRideById(rideId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("rides")
    .select("*")
    .eq("id", rideId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get my rides (customer)
 */
export async function getMyRides() {
  const client = requireSupabase();
  const { data: authData } = await client.auth.getSession();
  if (!authData?.session?.user?.id) throw new Error("Not authenticated");

  const { data, error } = await client
    .from("rides")
    .select("*")
    .eq("customer_id", authData.session.user.id)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Cancel ride
 */
export async function cancelRide(rideId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("rides")
    .update({ status: "cancelled" })
    .eq("id", rideId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Subscribe to ride updates (Realtime)
 */
export function subscribeToRideUpdates(rideId, onUpdate) {
  const client = requireSupabase();
  const subscription = client
    .channel(`ride:${rideId}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "rides",
      filter: `id=eq.${rideId}`,
    }, onUpdate)
    .subscribe();

  return () => subscription.unsubscribe();
}

/**
 * Subscribe to driver location updates (Realtime)
 */
export function subscribeToRideLocation(rideId, onUpdate) {
  const client = requireSupabase();
  const subscription = client
    .channel(`ride-location:${rideId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "driver_locations",
      filter: `ride_id=eq.${rideId}`,
    }, onUpdate)
    .subscribe();

  return () => subscription.unsubscribe();
}

/**
 * Get driver profile
 */
export async function getDriverProfile() {
  const client = requireSupabase();
  const { data: authData } = await client.auth.getSession();
  if (!authData?.session?.user?.id) throw new Error("Not authenticated");

  const { data, error } = await client
    .from("driver_profiles")
    .select("*")
    .eq("id", authData.session.user.id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

/**
 * Set driver online/offline status
 */
export async function setDriverOnlineStatus(isOnline) {
  const client = requireSupabase();
  const { data: authData } = await client.auth.getSession();
  if (!authData?.session?.user?.id) throw new Error("Not authenticated");

  const { data, error } = await client
    .from("driver_profiles")
    .update({ is_online: isOnline })
    .eq("id", authData.session.user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Persist a driver GPS ping for an active ride after the driver explicitly
 * enables browser location sharing. The profile snapshot supports nearby
 * driver operations while the append-only rows feed customer Realtime tracking.
 */
export async function writeDriverLocation({ rideId, latitude, longitude, accuracy, heading, speed }) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const driverId = authData.user?.id;
  if (!driverId) throw new Error("Please sign in to share your location.");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("A valid GPS location is required.");
  }

  const { error: locationError } = await client.from("driver_locations").insert({
    driver_id: driverId,
    ride_id: rideId || null,
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    heading: heading ?? null,
    speed: speed ?? null,
  });
  if (locationError) throw locationError;

  const { error: profileError } = await client
    .from("driver_profiles")
    .update({
      current_latitude: latitude,
      current_longitude: longitude,
      last_location_at: new Date().toISOString(),
    })
    .eq("id", driverId);
  if (profileError) throw profileError;
}

/**
 * Calculate fare based on distance and ride type
 * Bike: ₹20 base + ₹15/km
 * Auto: ₹40 base + ₹25/km
 */
export function calculateFare(distanceKm, rideType) {
  const baseFare = rideType === "bike" ? 20 : 40;
  const perKmRate = rideType === "bike" ? 15 : 25;
  return Math.round(baseFare + distanceKm * perKmRate);
}

/**
 * Get all active rides (admin)
 */
export async function getAllActiveRides() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("rides")
    .select("*")
    .in("status", ["driver_arriving", "driver_arrived", "trip_started"]);

  if (error) throw error;
  return data || [];
}

/**
 * Get every ride for the admin Rides screen, with optional status/type filters.
 */
export async function getAllRidesAdmin(filters = {}) {
  const client = requireSupabase();
  let query = client.from("rides").select("*");
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.rideType) query = query.eq("ride_type", filters.rideType);
  query = query.order("requested_at", { ascending: false }).limit(200);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
