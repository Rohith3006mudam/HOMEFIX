import { requireSupabase } from "../lib/supabase";

// ============================================================================
// ADMIN SERVICES: Employee Management, Bookings, Services, Users
// ============================================================================

// Get all customers
export async function getAllCustomers() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("role", "customer")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Get every profile (all roles) for the admin Users screen, with search.
export async function getAllUsers({ search } = {}) {
  const client = requireSupabase();
  let query = client.from("profiles").select("*").order("created_at", { ascending: false });
  // Strip PostgREST filter-syntax characters so search input can't break/alter the .or() filter.
  const safeSearch = search ? search.replace(/[,()]/g, "").trim() : "";
  if (safeSearch) query = query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Suspend/reactivate any profile (admin override), regardless of role.
export async function setUserApprovalStatus(userId, approvalStatus) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .update({ approval_status: approvalStatus, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Get all employees (approved)
export async function getAllEmployees() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("role", "employee")
    .eq("approval_status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Get employee profile details
export async function getEmployeeDetails(employeeId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", employeeId)
    .single();
  if (error) throw error;
  return data;
}

// Suspend an employee account
export async function suspendEmployee(employeeId, reason) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .update({ 
      approval_status: "suspended",
      updated_at: new Date().toISOString()
    })
    .eq("id", employeeId)
    .eq("role", "employee")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Reactivate a suspended employee
export async function reactivateEmployee(employeeId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .update({ 
      approval_status: "approved",
      updated_at: new Date().toISOString()
    })
    .eq("id", employeeId)
    .eq("role", "employee")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ============================================================================
// BOOKING MANAGEMENT
// ============================================================================

// Get all bookings
export async function getAllBookings(filters = {}) {
  const client = requireSupabase();
  let query = client.from("bookings").select("*");

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters.professionalId) query = query.eq("professional_id", filters.professionalId);

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Manually assign an employee to a booking
export async function assignEmployeeToBooking(bookingId, employeeId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("bookings")
    .update({
      professional_id: employeeId,
      status: "ASSIGNED",
      updated_at: new Date().toISOString()
    })
    .eq("id", bookingId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Reassign booking to a different employee
export async function reassignBooking(bookingId, newEmployeeId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("bookings")
    .update({
      professional_id: newEmployeeId,
      updated_at: new Date().toISOString()
    })
    .eq("id", bookingId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Cancel a booking (admin override)
export async function cancelBookingAdmin(bookingId, reason) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("bookings")
    .update({
      status: "CANCELLED",
      updated_at: new Date().toISOString()
    })
    .eq("id", bookingId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ============================================================================
// SERVICE MANAGEMENT
// ============================================================================

// Get all service categories
export async function getAllServiceCategories() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("service_categories")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Create a new service category
export async function createServiceCategory(name, description, displayOrder = 0) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("service_categories")
    .insert({
      name,
      description,
      display_order: displayOrder,
      active: true
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Update a service category
export async function updateServiceCategory(categoryId, updates) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("service_categories")
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq("id", categoryId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Deactivate service category
export async function deactivateServiceCategory(categoryId) {
  return updateServiceCategory(categoryId, { active: false });
}

// Get all services
export async function getAllServices() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("services")
    .select("*, service_categories(name)")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Create a new service
export async function createService(categoryId, name, description, basePrice, durationMinutes = 120) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("services")
    .insert({
      category_id: categoryId,
      name,
      description,
      base_price: basePrice,
      duration_minutes: durationMinutes,
      active: true
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Update a service
export async function updateService(serviceId, updates) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("services")
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq("id", serviceId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Deactivate a service
export async function deactivateService(serviceId) {
  return updateService(serviceId, { active: false });
}

// ============================================================================
// ANALYTICS / REPORTING
// ============================================================================

// Get platform statistics
export async function getPlatformStats() {
  const client = requireSupabase();

  // Total customers
  const customersResult = await client
    .from("profiles")
    .select("id", { count: "exact" })
    .eq("role", "customer");

  // Total employees (approved)
  const employeesResult = await client
    .from("profiles")
    .select("id", { count: "exact" })
    .eq("role", "employee")
    .eq("approval_status", "approved");

  const pendingEmployeesResult = await client
    .from("profiles")
    .select("id", { count: "exact" })
    .eq("role", "employee")
    .eq("approval_status", "pending");

  const driversResult = await client
    .from("profiles")
    .select("id", { count: "exact" })
    .eq("role", "driver")
    .eq("approval_status", "approved");

  const pendingDriversResult = await client
    .from("profiles")
    .select("id", { count: "exact" })
    .eq("role", "driver")
    .eq("approval_status", "pending");

  const onlineWorkersResult = await client
    .from("profiles")
    .select("id", { count: "exact" })
    .eq("is_online", true);

  // Total bookings
  const bookingsResult = await client
    .from("bookings")
    .select("id, amount", { count: "exact" });

  const today = new Date().toISOString().slice(0, 10);
  const todayBookingsResult = await client
    .from("bookings")
    .select("id", { count: "exact" })
    .eq("booking_date", today);

  const completed = await client
    .from("bookings")
    .select("amount")
    .eq("status", "COMPLETED");

  const ridesResult = await client.from("rides").select("id, fare_estimate, actual_fare", { count: "exact" });
  const activeRidesResult = await client
    .from("rides")
    .select("id", { count: "exact" })
    .in("status", ["requested", "searching_driver", "driver_assigned", "driver_arriving", "driver_arrived", "trip_started"]);

  const completedRides = (ridesResult.data || []).filter((r) => r.actual_fare != null);
  const bookingRevenue = (completed.data || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const rideRevenue = completedRides.reduce((sum, r) => sum + (Number(r.actual_fare) || 0), 0);

  const openTicketsResult = await client
    .from("support_tickets")
    .select("id", { count: "exact" })
    .in("status", ["open", "in_progress"]);

  return {
    totalCustomers: customersResult.count || 0,
    totalEmployees: employeesResult.count || 0,
    pendingEmployees: pendingEmployeesResult.count || 0,
    totalDrivers: driversResult.count || 0,
    pendingDrivers: pendingDriversResult.count || 0,
    onlineWorkers: onlineWorkersResult.count || 0,
    totalBookings: bookingsResult.count || 0,
    todayBookings: todayBookingsResult.count || 0,
    totalRevenue: bookingRevenue + rideRevenue,
    completedBookings: completed.data?.length || 0,
    totalRides: ridesResult.count || 0,
    activeRides: activeRidesResult.count || 0,
    openSupportTickets: openTicketsResult.count || 0,
  };
}

// ============================================================================
// DRIVER MANAGEMENT
// ============================================================================

// Every driver profile (all approval statuses), merged with the extended
// driver_profiles row (vehicle type, online status, documents, etc.).
export async function getAllDrivers() {
  const client = requireSupabase();
  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("*")
    .eq("role", "driver")
    .order("created_at", { ascending: false });
  if (profilesError) throw profilesError;
  if (!profiles?.length) return [];

  const ids = profiles.map((p) => p.id);
  const { data: driverProfiles, error: driverError } = await client
    .from("driver_profiles")
    .select("*")
    .in("id", ids);
  if (driverError) throw driverError;

  const byId = new Map((driverProfiles || []).map((row) => [row.id, row]));
  return profiles.map((profile) => ({ ...profile, driver_profile: byId.get(profile.id) || null }));
}

export async function approveDriver(driverId) {
  const client = requireSupabase();
  await client.from("driver_profiles").update({ approval_status: "approved" }).eq("id", driverId);
  const { data, error } = await client
    .from("profiles")
    .update({ approval_status: "approved", updated_at: new Date().toISOString() })
    .eq("id", driverId)
    .eq("role", "driver")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function rejectDriver(driverId) {
  const client = requireSupabase();
  await client.from("driver_profiles").update({ approval_status: "rejected" }).eq("id", driverId);
  const { data, error } = await client
    .from("profiles")
    .update({ approval_status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", driverId)
    .eq("role", "driver")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function suspendDriver(driverId) {
  const client = requireSupabase();
  await client.from("driver_profiles").update({ approval_status: "suspended" }).eq("id", driverId);
  const { data, error } = await client
    .from("profiles")
    .update({ approval_status: "suspended", updated_at: new Date().toISOString() })
    .eq("id", driverId)
    .eq("role", "driver")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ============================================================================
// PAYMENTS
// ============================================================================

export async function getAllPaymentsAdmin(filters = {}) {
  const client = requireSupabase();
  let query = client.from("payments").select("*");
  if (filters.status) query = query.eq("status", filters.status);
  query = query.order("created_at", { ascending: false }).limit(200);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

export async function getAllSupportTicketsAdmin(filters = {}) {
  const client = requireSupabase();
  let query = client.from("support_tickets").select("*");
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  query = query.order("created_at", { ascending: false }).limit(200);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function updateSupportTicketAdmin(ticketId, updates) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("support_tickets")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", ticketId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ============================================================================
// PLATFORM SETTINGS (see migration 007_platform_settings.sql)
// ============================================================================

export async function getPlatformSettings() {
  const client = requireSupabase();
  const { data, error } = await client.from("platform_settings").select("*").order("key", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertPlatformSetting(key, value) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Get active jobs on map (for live operations)
export async function getActiveJobs() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("bookings")
    .select("id, service, professional_id, customer_id, address, booking_date, status")
    .in("status", ["ASSIGNED", "ON_THE_WAY", "SERVICE_STARTED"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Get employee location for a specific booking
export async function getEmployeeLocationForBooking(bookingId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("employee_locations")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  // Return null if no data, don't throw on empty
  if (error && error.code !== "PGRST116") throw error;
  return data;
}
