import React, { useState, useEffect } from "react";
import { Package, DollarSign, CheckCircle2, Clock, AlertCircle, Users, Car, Bike } from "lucide-react";
import { getPendingEmployees, approveEmployee, rejectEmployee } from "../services/auth";
import {
  getAllUsers, setUserApprovalStatus, getAllEmployees, suspendEmployee, reactivateEmployee,
  getAllDrivers, approveDriver, rejectDriver, suspendDriver,
  getAllBookings, cancelBookingAdmin,
  getAllServiceCategories, getAllServices, createService, updateService, deactivateService,
  getAllPaymentsAdmin, getAllSupportTicketsAdmin, updateSupportTicketAdmin,
  getPlatformSettings, upsertPlatformSetting, getPlatformStats,
} from "../services/admin";
import { getAllRidesAdmin } from "../services/rides";
import AIAssistant from "../components/AIAssistant";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "users", label: "Users" },
  { id: "employees", label: "Employees" },
  { id: "drivers", label: "Drivers" },
  { id: "bookings", label: "Bookings" },
  { id: "rides", label: "Rides" },
  { id: "services", label: "Services" },
  { id: "payments", label: "Payments" },
  { id: "support", label: "Support" },
  { id: "settings", label: "Settings" },
];

export default function AdminDashboard({ profile, initialTab, onTabChange }) {
  const [activeTab, setActiveTab] = useState(initialTab && TABS.some((t) => t.id === initialTab) ? initialTab : "dashboard");
  const [stats, setStats] = useState(null);
  const [pendingEmployees, setPendingEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const changeTab = (next) => {
    setActiveTab(next);
    onTabChange?.(next);
  };

  const loadOverview = async () => {
    setLoading(true);
    setError("");
    try {
      const [statsData, pendingData] = await Promise.all([getPlatformStats(), getPendingEmployees()]);
      setStats(statsData);
      setPendingEmployees(pendingData || []);
    } catch (err) {
      setError(err.message || "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOverview(); }, []);

  const handleApproveEmployee = async (employeeId) => {
    try {
      await approveEmployee(employeeId);
      setPendingEmployees((prev) => prev.filter((e) => e.id !== employeeId));
    } catch (err) {
      setError(err.message || "Failed to approve employee");
    }
  };

  const handleRejectEmployee = async (employeeId) => {
    try {
      await rejectEmployee(employeeId);
      setPendingEmployees((prev) => prev.filter((e) => e.id !== employeeId));
    } catch (err) {
      setError(err.message || "Failed to reject employee");
    }
  };

  return (
    <main className="content-section page-content admin-dashboard">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">OPERATIONS CENTER</span>
          <h1>Admin Dashboard</h1>
          <p>Platform overview and management, {profile?.full_name || "Admin"}.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {stats && (
        <div className="stat-grid four">
          <StatCard icon={<Users size={22} />} label="Customers" value={stats.totalCustomers} />
          <StatCard icon={<Users size={22} />} label="Employees" value={stats.totalEmployees} />
          <StatCard icon={<Car size={22} />} label="Drivers" value={stats.totalDrivers} />
          <StatCard icon={<Package size={22} />} label="Total bookings" value={stats.totalBookings} />
          <StatCard icon={<Clock size={22} />} label="Today's bookings" value={stats.todayBookings} />
          <StatCard icon={<Bike size={22} />} label="Active rides" value={stats.activeRides} />
          <StatCard icon={<CheckCircle2 size={22} />} label="Online workers" value={stats.onlineWorkers} />
          <StatCard icon={<DollarSign size={22} />} label="Revenue" value={money(stats.totalRevenue)} />
        </div>
      )}

      {(pendingEmployees.length > 0 || stats?.pendingDrivers > 0 || stats?.openSupportTickets > 0) && (
        <div className="alert-card">
          <AlertCircle size={20} />
          <div>
            <b>
              {pendingEmployees.length} employee approval(s), {stats?.pendingDrivers || 0} driver approval(s),{" "}
              {stats?.openSupportTickets || 0} open support ticket(s)
            </b>
            <p>Review pending items in the Employees, Drivers and Support tabs.</p>
          </div>
        </div>
      )}

      <div className="tab-navigation">
        {TABS.map((t) => (
          <button key={t.id} className={activeTab === t.id ? "active" : ""} onClick={() => changeTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {loading && <p className="loading-text">Loading...</p>}

      {activeTab === "dashboard" && !loading && (
        <section className="admin-section">
          <h2>Platform overview</h2>
          <div className="cards-grid">
            <div className="info-card">
              <h3>Approvals pending</h3>
              <p>Employees: {pendingEmployees.length}</p>
              <p>Drivers: {stats?.pendingDrivers || 0}</p>
            </div>
            <div className="info-card">
              <h3>Support</h3>
              <p>Open tickets: {stats?.openSupportTickets || 0}</p>
              <p>Completed bookings: {stats?.completedBookings || 0}</p>
            </div>
          </div>
        </section>
      )}

      {activeTab === "users" && <UsersTab />}
      {activeTab === "employees" && (
        <EmployeesTab
          pendingEmployees={pendingEmployees}
          onApprove={handleApproveEmployee}
          onReject={handleRejectEmployee}
        />
      )}
      {activeTab === "drivers" && <DriversTab />}
      {activeTab === "bookings" && <BookingsTab />}
      {activeTab === "rides" && <RidesTab />}
      {activeTab === "services" && <ServicesTab />}
      {activeTab === "payments" && <PaymentsTab />}
      {activeTab === "support" && <SupportTab />}
      {activeTab === "settings" && <SettingsTab />}

      <AIAssistant role="admin" profile={profile} />
    </main>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <small className="stat-label">{label}</small>
        <div className="stat-value">{value}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Users tab: search across all roles, view profile, activate/deactivate.
// ---------------------------------------------------------------------
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (term) => {
    setLoading(true);
    setError("");
    try {
      setUsers(await getAllUsers({ search: term }));
    } catch (err) {
      setError(err.message || "Unable to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(""); }, []);

  const toggleStatus = async (user) => {
    const next = user.approval_status === "suspended" ? "approved" : "suspended";
    try {
      await setUserApprovalStatus(user.id, next);
      setUsers((prev) => prev.map((row) => (row.id === user.id ? { ...row, approval_status: next } : row)));
    } catch (err) {
      setError(err.message || "Unable to update user");
    }
  };

  return (
    <section className="admin-section">
      <h2>All users</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="filters-row">
        <input
          placeholder="Search by name, email or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
        />
        <button className="btn-approve" onClick={() => load(search)}>Search</button>
      </div>
      {loading ? <p className="loading-text">Loading...</p> : users.length ? (
        <div className="table-responsive">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><b>{user.full_name || "-"}</b></td>
                  <td>{user.email}</td>
                  <td>{user.phone}</td>
                  <td>{user.role}</td>
                  <td><span className={`status-badge ${user.approval_status}`}>{user.approval_status}</span></td>
                  <td><small>{new Date(user.created_at).toLocaleDateString()}</small></td>
                  <td className="actions">
                    {user.role !== "admin" && (
                      <button className={user.approval_status === "suspended" ? "btn-approve" : "btn-suspend"} onClick={() => toggleStatus(user)}>
                        {user.approval_status === "suspended" ? "Reactivate" : "Suspend"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-text">No users found.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------
// Employees tab: pending approvals + approved employee roster.
// ---------------------------------------------------------------------
function EmployeesTab({ pendingEmployees, onApprove, onReject }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setEmployees(await getAllEmployees());
    } catch (err) {
      setError(err.message || "Unable to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (employee) => {
    try {
      if (employee.approval_status === "suspended") await reactivateEmployee(employee.id);
      else await suspendEmployee(employee.id);
      load();
    } catch (err) {
      setError(err.message || "Unable to update employee");
    }
  };

  return (
    <section className="admin-section">
      <h2>Employee management</h2>
      {error && <div className="error-banner">{error}</div>}

      <h3>Pending applications ({pendingEmployees.length})</h3>
      {pendingEmployees.length ? (
        <div className="table-responsive">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Applied</th><th>Actions</th></tr></thead>
            <tbody>
              {pendingEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td><b>{emp.full_name}</b></td><td>{emp.email}</td><td>{emp.phone}</td>
                  <td><small>{new Date(emp.created_at).toLocaleDateString()}</small></td>
                  <td className="actions">
                    <button className="btn-approve" onClick={() => onApprove(emp.id)}>Approve</button>
                    <button className="btn-reject" onClick={() => onReject(emp.id)}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-text">No pending employee applications.</p>}

      <h3 style={{ marginTop: 24 }}>Approved employees ({employees.length})</h3>
      {loading ? <p className="loading-text">Loading...</p> : employees.length ? (
        <div className="table-responsive">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Rating</th><th>Jobs</th><th>Online</th><th>Actions</th></tr></thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td><b>{emp.full_name}</b></td><td>{emp.email}</td>
                  <td>{Number(emp.average_rating || 5).toFixed(1)}</td>
                  <td>{emp.total_jobs || 0}</td>
                  <td>{emp.is_online ? "Online" : "Offline"}</td>
                  <td className="actions">
                    <button className={emp.approval_status === "suspended" ? "btn-approve" : "btn-suspend"} onClick={() => toggle(emp)}>
                      {emp.approval_status === "suspended" ? "Reactivate" : "Suspend"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-text">No approved employees yet.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------
// Drivers tab
// ---------------------------------------------------------------------
function DriversTab() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setDrivers(await getAllDrivers());
    } catch (err) {
      setError(err.message || "Unable to load drivers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (driver, action) => {
    try {
      if (action === "approve") await approveDriver(driver.id);
      if (action === "reject") await rejectDriver(driver.id);
      if (action === "suspend") await suspendDriver(driver.id);
      load();
    } catch (err) {
      setError(err.message || "Unable to update driver");
    }
  };

  return (
    <section className="admin-section">
      <h2>Driver management</h2>
      {error && <div className="error-banner">{error}</div>}
      {loading ? <p className="loading-text">Loading...</p> : drivers.length ? (
        <div className="table-responsive">
          <table>
            <thead><tr><th>Name</th><th>Vehicle</th><th>Online</th><th>Status</th><th>Documents</th><th>Actions</th></tr></thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td><b>{driver.full_name}</b><br /><small>{driver.email}</small></td>
                  <td>{driver.driver_profile?.vehicle_type || "-"}</td>
                  <td>{driver.driver_profile?.is_online ? "Online" : "Offline"}</td>
                  <td><span className={`status-badge ${driver.approval_status}`}>{driver.approval_status}</span></td>
                  <td>{driver.driver_profile?.license_number ? "Submitted" : "Missing"}</td>
                  <td className="actions">
                    {driver.approval_status === "pending" && (
                      <>
                        <button className="btn-approve" onClick={() => act(driver, "approve")}>Approve</button>
                        <button className="btn-reject" onClick={() => act(driver, "reject")}>Reject</button>
                      </>
                    )}
                    {driver.approval_status === "approved" && (
                      <button className="btn-suspend" onClick={() => act(driver, "suspend")}>Suspend</button>
                    )}
                    {driver.approval_status === "suspended" && (
                      <button className="btn-approve" onClick={() => act(driver, "approve")}>Reactivate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-text">No drivers have signed up yet.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------
// Bookings tab
// ---------------------------------------------------------------------
function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (statusFilter) => {
    setLoading(true);
    try {
      setBookings(await getAllBookings(statusFilter ? { status: statusFilter } : {}));
    } catch (err) {
      setError(err.message || "Unable to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(""); }, []);

  const cancel = async (booking) => {
    if (!window.confirm(`Cancel booking ${booking.id}?`)) return;
    try {
      await cancelBookingAdmin(booking.id);
      load(status);
    } catch (err) {
      setError(err.message || "Unable to cancel booking");
    }
  };

  return (
    <section className="admin-section">
      <h2>All bookings</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="filters-row">
        <select value={status} onChange={(e) => { setStatus(e.target.value); load(e.target.value); }}>
          <option value="">All statuses</option>
          {["PENDING", "ASSIGNED", "ON_THE_WAY", "SERVICE_STARTED", "COMPLETED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {loading ? <p className="loading-text">Loading...</p> : bookings.length ? (
        <div className="table-responsive">
          <table>
            <thead><tr><th>Booking</th><th>Service</th><th>Date/Time</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td><small>{booking.id}</small></td>
                  <td>{booking.service}</td>
                  <td>{booking.booking_date} {booking.booking_time}</td>
                  <td>{money(booking.amount)}</td>
                  <td><span className={`status-badge ${booking.status?.toLowerCase()}`}>{booking.status}</span></td>
                  <td className="actions">
                    {!["COMPLETED", "CANCELLED"].includes(booking.status) && (
                      <button className="btn-reject" onClick={() => cancel(booking)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-text">No bookings match this filter.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------
// Rides tab
// ---------------------------------------------------------------------
function RidesTab() {
  const [rides, setRides] = useState([]);
  const [status, setStatus] = useState("");
  const [rideType, setRideType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (s, t) => {
    setLoading(true);
    try {
      setRides(await getAllRidesAdmin({ status: s || undefined, rideType: t || undefined }));
    } catch (err) {
      setError(err.message || "Unable to load rides");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load("", ""); }, []);

  return (
    <section className="admin-section">
      <h2>Bike / Auto rides</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="filters-row">
        <select value={rideType} onChange={(e) => { setRideType(e.target.value); load(status, e.target.value); }}>
          <option value="">Bike + Auto</option>
          <option value="bike">Bike</option>
          <option value="auto">Auto</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); load(e.target.value, rideType); }}>
          <option value="">All statuses</option>
          {["requested", "searching_driver", "driver_assigned", "driver_arriving", "driver_arrived", "trip_started", "trip_completed", "cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {loading ? <p className="loading-text">Loading...</p> : rides.length ? (
        <div className="table-responsive">
          <table>
            <thead><tr><th>Ride</th><th>Type</th><th>Pickup</th><th>Dropoff</th><th>Fare</th><th>Status</th></tr></thead>
            <tbody>
              {rides.map((ride) => (
                <tr key={ride.id}>
                  <td><small>{ride.id}</small></td>
                  <td>{ride.ride_type}</td>
                  <td><small>{ride.pickup_address}</small></td>
                  <td><small>{ride.dropoff_address}</small></td>
                  <td>{money(ride.actual_fare ?? ride.fare_estimate)}</td>
                  <td><span className="status-badge">{ride.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-text">No rides match this filter.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------
// Services tab
// ---------------------------------------------------------------------
function ServicesTab() {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ categoryId: "", name: "", description: "", basePrice: "", durationMinutes: 120 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [cats, svcs] = await Promise.all([getAllServiceCategories(), getAllServices()]);
      setCategories(cats);
      setServices(svcs);
    } catch (err) {
      setError(err.message || "Unable to load services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.categoryId || !form.name || !form.basePrice) return setError("Category, name and price are required.");
    try {
      await createService(form.categoryId, form.name, form.description, Number(form.basePrice), Number(form.durationMinutes) || 120);
      setForm({ categoryId: "", name: "", description: "", basePrice: "", durationMinutes: 120 });
      load();
    } catch (err) {
      setError(err.message || "Unable to create service");
    }
  };

  const toggleActive = async (service) => {
    try {
      if (service.active) await deactivateService(service.id);
      else await updateService(service.id, { active: true });
      load();
    } catch (err) {
      setError(err.message || "Unable to update service");
    }
  };

  return (
    <section className="admin-section">
      <h2>Service catalogue</h2>
      {error && <div className="error-banner">{error}</div>}

      <form className="settings-grid" onSubmit={submit} style={{ marginBottom: 24 }}>
        <label>Category
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label>Base price (₹)<input type="number" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} /></label>
        <label>Duration (minutes)<input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} /></label>
        <button className="primary-btn" type="submit">Add service</button>
      </form>

      {loading ? <p className="loading-text">Loading...</p> : services.length ? (
        <div className="table-responsive">
          <table>
            <thead><tr><th>Service</th><th>Category</th><th>Price</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td><b>{service.name}</b><br /><small>{service.description}</small></td>
                  <td>{service.service_categories?.name || "-"}</td>
                  <td>{money(service.base_price)}</td>
                  <td>{service.duration_minutes} min</td>
                  <td><span className={`status-badge ${service.active ? "approved" : "suspended"}`}>{service.active ? "Active" : "Inactive"}</span></td>
                  <td className="actions">
                    <button className={service.active ? "btn-suspend" : "btn-approve"} onClick={() => toggleActive(service)}>
                      {service.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-text">No services yet. Add one above.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------
// Payments tab
// ---------------------------------------------------------------------
function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (s) => {
    setLoading(true);
    try {
      setPayments(await getAllPaymentsAdmin(s ? { status: s } : {}));
    } catch (err) {
      setError(err.message || "Unable to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(""); }, []);

  return (
    <section className="admin-section">
      <h2>Payments</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="filters-row">
        <select value={status} onChange={(e) => { setStatus(e.target.value); load(e.target.value); }}>
          <option value="">All statuses</option>
          {["pending", "completed", "failed", "refunded"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <p className="loading-text">Loading...</p> : payments.length ? (
        <div className="table-responsive">
          <table>
            <thead><tr><th>Payment</th><th>Booking</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td><small>{payment.id}</small></td>
                  <td><small>{payment.booking_id}</small></td>
                  <td>{money(payment.amount)}</td>
                  <td>{payment.method}</td>
                  <td><span className={`status-badge ${payment.status}`}>{payment.status}</span></td>
                  <td><small>{new Date(payment.created_at).toLocaleDateString()}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-text">No payment records yet.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------
// Support tab
// ---------------------------------------------------------------------
function SupportTab() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setTickets(await getAllSupportTicketsAdmin());
    } catch (err) {
      setError(err.message || "Unable to load support tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = async (ticket, changes) => {
    try {
      await updateSupportTicketAdmin(ticket.id, changes);
      load();
    } catch (err) {
      setError(err.message || "Unable to update ticket");
    }
  };

  return (
    <section className="admin-section">
      <h2>Support tickets</h2>
      {error && <div className="error-banner">{error}</div>}
      {loading ? <p className="loading-text">Loading...</p> : tickets.length ? (
        <div className="table-responsive">
          <table>
            <thead><tr><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td><b>{ticket.subject || "(no subject)"}</b><br /><small>{ticket.message}</small></td>
                  <td>{ticket.category}</td>
                  <td>
                    <select value={ticket.priority} onChange={(e) => update(ticket, { priority: e.target.value })}>
                      {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={ticket.status} onChange={(e) => update(ticket, { status: e.target.value })}>
                      {["open", "in_progress", "resolved", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><small>{new Date(ticket.created_at).toLocaleDateString()}</small></td>
                  <td className="actions">
                    {ticket.status !== "resolved" && (
                      <button className="btn-approve" onClick={() => update(ticket, { status: "resolved" })}>Resolve</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-text">No support tickets yet.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------
function SettingsTab() {
  const [settings, setSettings] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await getPlatformSettings();
      const map = {};
      rows.forEach((row) => { map[row.key] = row.value; });
      setSettings(map);
    } catch (err) {
      setError(err.message || "Unable to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (key, rawValue) => {
    setMessage("");
    try {
      let value = rawValue;
      if (!Number.isNaN(Number(rawValue)) && rawValue.trim() !== "") value = Number(rawValue);
      await upsertPlatformSetting(key, value);
      setMessage(`Saved ${key}.`);
    } catch (err) {
      setError(err.message || "Unable to save setting");
    }
  };

  const FIELDS = [
    ["business_hours_start", "Business hours start (HH:MM)"],
    ["business_hours_end", "Business hours end (HH:MM)"],
    ["cancellation_window_hours", "Cancellation window (hours)"],
    ["service_fee_percent", "Service fee (%)"],
  ];

  return (
    <section className="admin-section">
      <h2>Platform settings</h2>
      {error && <div className="error-banner">{error}</div>}
      {message && <p className="empty-text">{message}</p>}
      {loading ? <p className="loading-text">Loading...</p> : (
        <div className="settings-grid">
          {FIELDS.map(([key, label]) => (
            <label key={key}>
              {label}
              <SettingInput initial={settings[key]} onSave={(value) => save(key, value)} />
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

function SettingInput({ initial, onSave }) {
  const [value, setValue] = useState(typeof initial === "string" ? initial.replace(/"/g, "") : initial ?? "");
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <button className="btn-approve" onClick={() => onSave(String(value))}>Save</button>
    </div>
  );
}
