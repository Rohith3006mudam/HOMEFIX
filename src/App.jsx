import { useEffect, useMemo, useState } from "react";
import "./extra.css";
import "./dashboards.css";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, CreditCard,
  Download, LocateFixed, LogOut, MapPin, Menu, MessageCircle, Package, Pencil, Phone,
  Printer, Search, ShieldCheck, ShieldAlert, Star, User, Users, WalletCards, X, Zap,
} from "lucide-react";
import { isSupabaseConfigured } from "./lib/supabase";
import { useAuth } from "./hooks/useAuth";
import { updateOwnProfile } from "./services/auth";
import { cancelMyBooking, createBooking, listMyBookings, subscribeToMyBookings } from "./services/bookings";
import { createPayment, isPaymentMethodConfigured } from "./paymentService";
import AuthModal from "./components/AuthModal";
import AdminLogin from "./components/AdminLogin";
import EmployeeLogin from "./components/EmployeeLogin";
import LiveTrackingMap from "./components/maps/LiveTrackingMap";
import GoogleMap from "./GoogleMap";
import { listServices } from "./services/catalog";
import { subscribeToBookingLocation, writeMyLocation } from "./services/employeeLocation";
import { useLiveLocation } from "./hooks/useLiveLocation";
import DriverLogin from "./components/DriverLogin";
import DriverDashboard from "./pages/DriverDashboard";
import RideBooking from "./components/RideBooking";
import RideTracking from "./components/RideTracking";
import BikeMechanicBooking from "./components/BikeMechanicBooking";
import CarMechanicBooking from "./components/CarMechanicBooking";
import { requestRide as createRideRequest } from "./services/rides";
import AdminDashboardPage from "./pages/AdminDashboard";
import EmployeeDashboardPage from "./pages/EmployeeDashboard";
import AIAssistant from "./components/AIAssistant";
import NotificationBell from "./components/NotificationBell";
import { createSupportTicket } from "./services/support";

// ---------------------------------------------------------------------
// Static fallback service catalogue used only when the database catalogue
// has not yet been populated.
// ---------------------------------------------------------------------

const img = {
  plumbing: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=900&q=80",
  electrical: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80",
  cleaning: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80",
  ac: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80",
  appliance: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=900&q=80",
  carpentry: "https://images.unsplash.com/photo-1601058268499-e52658b8bb88?auto=format&fit=crop&w=900&q=80",
  painting: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=80",
  pest: "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=900&q=80",
  bathroom: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80",
  purifier: "https://images.unsplash.com/photo-1500989145603-8e7ef71d639e?auto=format&fit=crop&w=900&q=80",
  washing: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=900&q=80",
  refrigerator: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=900&q=80",
};

const SERVICES = [
  ["plumbing", "Plumbing", "Leaks, taps, pipes and bathroom repairs", 199],
  ["electrical", "Electrical", "Switches, wiring, fans and safe repairs", 249],
  ["cleaning", "Home Cleaning", "Deep cleaning for a fresher home", 399],
  ["ac", "AC Repair", "Cooling service, gas refill and repair", 349],
  ["appliance", "Appliance Repair", "Reliable repairs for everyday appliances", 299],
  ["painting", "Painting", "Beautiful finishes for every room", 599],
  ["carpentry", "Carpentry", "Furniture assembly and woodwork", 299],
  ["pest", "Pest Control", "Targeted protection for your home", 499],
  ["bathroom", "Bathroom Cleaning", "Hygienic bathroom deep cleaning", 299],
  ["purifier", "Water Purifier", "Filter replacement and servicing", 249],
  ["washing", "Washing Machine Repair", "Fast diagnosis and expert repair", 299],
  ["refrigerator", "Refrigerator Repair", "Cooling and compressor service", 349],
].map(([id, name, description, price]) => ({ id, name, description, price, image: img[id], active: true }));

const STATUSES = ["PENDING", "CONFIRMED", "ASSIGNED", "ON_THE_WAY", "SERVICE_STARTED", "COMPLETED", "CANCELLED"];
const STATUS_LABELS = {
  PENDING: "Pending", CONFIRMED: "Confirmed", ASSIGNED: "Professional Assigned",
  ON_THE_WAY: "On The Way", SERVICE_STARTED: "Service Started", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const normalizeStatus = (value) => (STATUSES.includes(value) ? value : "PENDING");
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const dateToday = () => new Date().toISOString().slice(0, 10);
// Business hours for manually selected booking time (24-hour clock).
const BUSINESS_HOURS_START = "07:00";
const BUSINESS_HOURS_END = "21:00";
const isWithinBusinessHours = (time) => Boolean(time) && time >= BUSINESS_HOURS_START && time <= BUSINESS_HOURS_END;
const formatTimeDisplay = (time) => {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  let hour = Number(match[1]);
  const meridiem = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${match[2]} ${meridiem}`;
};

const pageFromPath = () => {
  const path = window.location.pathname;
  if (path === "/login" || path === "/customer/login") return "login";
  if (path === "/employee/login") return "employee-login";
  if (path === "/admin/login") return "admin-login";
  if (path === "/driver/login") return "driver-login";
  if (path === "/services") return "services";
  if (path.startsWith("/service/") || path === "/booking") return "booking";
  if (path === "/confirmation") return "confirmation";
  if (path === "/orders") return "orders";
  if (path.startsWith("/orders/")) return "order-details";
  if (path.startsWith("/track/")) return "tracking";
  if (path === "/profile") return "profile";
  if (path.startsWith("/employee/")) return "professional";
  if (path.startsWith("/admin/")) return "admin";
  if (path.startsWith("/driver/dashboard")) return "driver-dashboard";
  if (path === "/rides/bike") return "ride-booking-bike";
  if (path === "/rides/auto") return "ride-booking-auto";
  if (path.startsWith("/ride/")) return "ride-tracking";
  if (path === "/mechanics/bike") return "bike-mechanic";
  if (path === "/mechanics/car") return "car-mechanic";
  if (path === "/access-denied") return "access-denied";
  if (path === "/support") return "support";
  return "home";
};

// /admin/<tab> and /employee/<tab> deep-link to the matching dashboard tab.
const ADMIN_TABS = ["dashboard", "users", "employees", "drivers", "bookings", "rides", "services", "payments", "support", "settings"];
const EMPLOYEE_TAB_ALIASES = { jobs: "jobs", rides: "history", profile: "profile" };

const adminTabFromPath = () => {
  const segment = window.location.pathname.split("/")[2];
  return ADMIN_TABS.includes(segment) ? segment : "dashboard";
};

const employeeTabFromPath = () => {
  const segment = window.location.pathname.split("/")[2];
  return EMPLOYEE_TAB_ALIASES[segment] || "jobs";
};

const routeFor = (page, activeId) => ({
  home: "/", login: "/login", "employee-login": "/employee/login", "admin-login": "/admin/login",
  "driver-login": "/driver/login", "driver-dashboard": "/driver/dashboard",
  services: "/services", booking: "/booking", confirmation: "/confirmation",
  orders: "/orders", "order-details": activeId ? `/orders/${activeId}` : "/orders",
  tracking: activeId ? `/track/${activeId}` : "/orders", profile: "/profile",
  professional: "/employee/dashboard", admin: "/admin/dashboard", support: "/support", "access-denied": "/access-denied",
  "ride-booking-bike": "/rides/bike", "ride-booking-auto": "/rides/auto",
  "ride-tracking": activeId ? `/ride/${activeId}` : "/",
  "bike-mechanic": "/mechanics/bike", "car-mechanic": "/mechanics/car",
}[page] || "/");

// ---------------------------------------------------------------------
// Top-level app: gates on Supabase configuration, then wires the single
// useAuth() session/profile source of truth into every page.
// ---------------------------------------------------------------------

export default function App() {
  if (!isSupabaseConfigured) return <ConfigurationRequired />;
  return <AuthenticatedApp />;
}

function ConfigurationRequired() {
  return (
    <div className="app-shell">
      <main className="center-page">
        <div className="confirmation">
          <div className="success-icon"><ShieldAlert size={30} /></div>
          <span className="eyebrow">SETUP REQUIRED</span>
          <h1>HOMEFIX database is not configured.</h1>
          <p>
            Add <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_PUBLISHABLE_KEY</b> to <code>.env.local</code>,
            then restart the dev server.
          </p>
        </div>
      </main>
    </div>
  );
}

function AuthenticatedApp() {
  const auth = useAuth();
  const [page, setPage] = useState(pageFromPath);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);

  const [services, setServices] = useState(SERVICES);
  // Prefer the live Supabase catalogue; silently keep the built-in list if
  // the services table isn't populated/migrated yet (see listServices()).
  useEffect(() => {
    let cancelled = false;
    listServices().then((rows) => {
      if (!cancelled && rows) setServices(rows);
    });
    return () => { cancelled = true; };
  }, []);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");

  const [selectedService, setSelectedService] = useState(null);
  const [active, setActive] = useState(null);
  const [bookingStep, setBookingStep] = useState(0);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [bookingForm, setBookingForm] = useState(createEmptyBookingForm());

  function createEmptyBookingForm() {
    return {
      quantity: 1, date: dateToday(), time: "10:00", name: "", phone: "", email: "",
      address: "", landmark: "", city: "", pincode: "", notes: "", coupon: "", payment: "Cash on Service",
    };
  }

  const notify = (message) => setToast(message);
  const go = (next, opts = {}) => {
    setPage(next);
    setMobileOpen(false);
    const target = routeFor(next, opts.activeId ?? active?.id);
    if (window.location.pathname !== target) window.history.pushState({}, "", target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load "My Orders" fresh from Supabase whenever the customer opens that page.
  useEffect(() => {
    if (!auth.isAuthenticated || page !== "orders") return;
    let cancelled = false;
    setBookingsLoading(true);
    setBookingsError("");
    listMyBookings()
      .then((rows) => {
        if (cancelled) return;
        setBookings(rows.map(mapRemoteBooking));
      })
      .catch((error) => {
        console.error("[HOMEFIX] Booking load error:", error);
        if (!cancelled) setBookingsError(error.message || "Unable to load your bookings.");
      })
      .finally(() => {
        if (!cancelled) setBookingsLoading(false);
      });
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, page]);

  const customer = useMemo(() => {
    if (!auth.profile) return null;
    return {
      id: auth.profile.id,
      name: auth.profile.full_name || auth.profile.email,
      phone: auth.profile.phone || "",
      email: auth.profile.email || "",
      role: auth.profile.role || "customer",
    };
  }, [auth.profile]);

  const activeServices = useMemo(
    () => services.filter((service) => service.active && service.name.toLowerCase().includes(query.toLowerCase())),
    [services, query]
  );

  const requireAuth = (destination) => {
    if (auth.isAuthenticated) go(destination);
    else { notify("Please sign in to continue."); setLoginOpen(true); }
  };

  const routeAfterAuthentication = async () => {
    const profile = await auth.refreshProfile();
    if (profile?.role === "admin") go("admin");
    else if (profile?.role === "employee") go("professional");
    else if (profile?.role === "driver") go("driver-dashboard");
    else go("home");
  };

  const openService = (service) => {
    setSelectedService(service);
    setBookingStep(0);
    setBookingForm((old) => ({ ...old, name: customer?.name || "", phone: customer?.phone || "", email: customer?.email || "" }));
    go("booking");
  };

  const updateForm = (key, value) => setBookingForm((old) => ({ ...old, [key]: value }));

  const submitBooking = async () => {
    if (bookingSubmitting) return;
    if (!auth.isAuthenticated) {
      notify("Please sign in to confirm your booking.");
      setLoginOpen(true);
      return;
    }
    if (!selectedService) return notify("Please select a service first.");
    const phone = bookingForm.phone.replace(/\D/g, "");
    if (!bookingForm.name.trim()) return notify("Enter the customer name.");
    if (phone.length !== 10) return notify("Enter a valid 10-digit mobile number.");
    if (!bookingForm.address.trim() || !bookingForm.city.trim() || !/^\d{6}$/.test(bookingForm.pincode)) {
      return notify("Enter a complete address, city and 6-digit pincode.");
    }
    if (!bookingForm.date) return notify("Please select a valid booking date.");
    if (!bookingForm.time) return notify("Please select a valid booking time.");
    if (!isWithinBusinessHours(bookingForm.time)) {
      return notify(`Please choose a time between ${formatTimeDisplay(BUSINESS_HOURS_START)} and ${formatTimeDisplay(BUSINESS_HOURS_END)}.`);
    }
    if (!bookingForm.payment) return notify("Please select a payment method.");
    if (!isPaymentMethodConfigured(bookingForm.payment)) {
      return notify("Payment configuration required. Choose Cash on Service or contact support.");
    }

    const subtotal = selectedService.price * Number(bookingForm.quantity || 1);
    const discount = bookingForm.coupon.trim().toUpperCase() === "HOMEFIX10" ? Math.round(subtotal * 0.1) : 0;
    const fee = Math.round(subtotal * 0.05);
    const amount = Math.max(0, subtotal + fee - discount);
    const address = `${bookingForm.address}${bookingForm.landmark ? `, ${bookingForm.landmark}` : ""}, ${bookingForm.city} - ${bookingForm.pincode}`;

    setBookingSubmitting(true);
    try {
      const remote = await createBooking({
        service: selectedService.name,
        mobile: phone,
        address,
        bookingDate: bookingForm.date,
        timeSlot: bookingForm.time,
      });
      const payment = await createPayment({ bookingId: remote.id, customerId: remote.customer_id, amount, paymentMethod: bookingForm.payment });
      const booking = {
        ...mapRemoteBooking(remote),
        customer: bookingForm.name,
        amount,
        subtotal,
        fee,
        discount,
        payment: bookingForm.payment,
        paymentStatus: payment.status,
      };
      setBookings((all) => [booking, ...all]);
      setActive(booking);
      go("confirmation");
    } catch (error) {
      console.error("[HOMEFIX] Booking error:", error);
      if (error.code === "42501") {
        notify("Unable to create your booking. Please sign in again and try again.");
      } else if (error.message?.includes("sign in")) {
        notify(error.message);
        setLoginOpen(true);
      } else {
        notify(error.message || "We couldn't confirm your booking. Please try again.");
      }
    } finally {
      setBookingSubmitting(false);
    }
  };

  const requestRide = async (rideType, rideData) => {
    if (!auth.isAuthenticated) {
      notify("Please sign in to request a ride.");
      setLoginOpen(true);
      return;
    }
    try {
      const ride = await createRideRequest({ rideType, ...rideData });
      notify("Ride request sent! Finding a driver...");
      setActive({ id: ride.id });
      go("ride-tracking", { activeId: ride.id });
    } catch (error) {
      notify(error.message || "Unable to request a ride. Please try again.");
    }
  };

  const cancelBooking = async (booking) => {
    const current = normalizeStatus(booking.status);
    if (!["PENDING", "CONFIRMED"].includes(current)) return notify("Only pending or confirmed bookings can be cancelled.");
    if (!window.confirm(`Cancel booking ${booking.id}?`)) return;
    try {
      const updated = await cancelMyBooking(booking.id);
      const next = { ...booking, ...mapRemoteBooking(updated) };
      setBookings((all) => all.map((item) => (item.id === booking.id ? next : item)));
      setActive(next);
      notify("Booking cancelled.");
    } catch (error) {
      console.error("[HOMEFIX] Booking cancellation error:", error);
      notify(error.message || "Unable to cancel booking.");
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    setActive(null);
    setBookings([]);
    go("home");
  };

  // Role-based navigation items
  const getNavItems = () => {
    if (!customer) return [["home", "Home"], ["services", "Services"]];

    switch (customer.role) {
      case "admin":
        return [
          ["admin", "Admin Dashboard"],
          ["profile", "Profile"],
        ];
      case "employee":
        return [
          ["professional", "Dashboard"],
          ["professional", "Jobs & Earnings"],
          ["profile", "Profile"],
        ];
      case "driver":
        return [
          ["driver-dashboard", "Driver Dashboard"],
          ["profile", "Profile"],
        ];
      case "customer":
      default:
        return [
          ["home", "Home"],
          ["services", "Services"],
          ["orders", "My Bookings"],
          ["profile", "Profile"],
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <div className="app-shell">
      <header className="header">
        <button className="brand" onClick={() => go("home")}>
          <span className="brand-mark">H</span>
          <span><b>HOMEFIX</b><small>Trusted home & mobility services</small></span>
        </button>
        <nav className={mobileOpen ? "nav open" : "nav"}>
          {navItems.map(([target, label]) => {
            const requiresAuth = !["home", "services"].includes(target);
            return (
              <button key={target} onClick={() => (requiresAuth ? requireAuth(target) : go(target))}>
                {label}
              </button>
            );
          })}
          {!customer && (
            <>
              <button className="text-btn" onClick={() => setLoginOpen(true)}>Customer Sign In</button>
              <button className="text-btn" onClick={() => go("employee-login")}>Employee Sign In</button>
            </>
          )}
          <button onClick={() => setSupportOpen(true)}>Support</button>
        </nav>
        <div className="header-actions">
          {customer ? (
            <>
              <NotificationBell userId={customer.id} />
              <button className="user-chip" onClick={() => go("profile")}><User size={16} />{customer.name}</button>
              <button className="icon-btn" onClick={handleLogout}><LogOut size={16} /></button>
            </>
          ) : (
            <button className="outline-btn" onClick={() => setLoginOpen(true)}>Sign In</button>
          )}
          <button className="icon-btn menu-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu"><Menu /></button>
        </div>
      </header>

      {page === "home" && (
        !customer || customer.role === "customer" ? (
          <Home
            services={activeServices}
            query={query}
            setQuery={setQuery}
            onService={openService}
            onServices={() => go("services")}
            onOrders={() => requireAuth("orders")}
            onBikeRide={() => requireAuth("ride-booking-bike")}
            onAutoRide={() => requireAuth("ride-booking-auto")}
            onBikeMechanic={() => requireAuth("bike-mechanic")}
            onCarMechanic={() => requireAuth("car-mechanic")}
          />
        ) : <AccessDenied onBack={() => routeAfterAuthentication()} requiredRole={customer?.role} />
      )}
      {page === "login" && (
        <div className="center-page">
          <AuthModal
            close={() => go("home")}
            onAuthenticated={() => {
              notify("Signed in successfully.");
              routeAfterAuthentication().catch((error) => notify(error.message || "Unable to load your account."));
            }}
            loginType="customer"
          />
        </div>
      )}
      {page === "employee-login" && (
        <div className="center-page">
          <EmployeeLogin
            onBack={() => go("home")}
            onAuthenticated={() => {
              notify("Signed in successfully.");
              routeAfterAuthentication().catch((error) => notify(error.message || "Unable to load your account."));
            }}
            onSignupClick={() => notify("Create a customer account first, then request professional access from your profile.")}
          />
        </div>
      )}
      {page === "admin-login" && (
        <div className="center-page">
          <AdminLogin
            onAuthenticated={() => {
              routeAfterAuthentication().then(() => notify("Signed in successfully.")).catch((error) => notify(error.message || "Unable to load your account."));
            }}
          />
        </div>
      )}
      {page === "driver-login" && (
        <div className="center-page">
          <DriverLogin
            onSuccess={() => {
              notify("Welcome, driver!");
              routeAfterAuthentication().catch((error) => notify(error.message || "Unable to load your account."));
            }}
          />
        </div>
      )}
      {page === "driver-dashboard" && (
        !auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("driver-login")} label="Driver sign in" /> : customer.role === "driver" ? <DriverDashboard /> : (
          <div className="center-page">
            <div className="alert alert-error">
              <p>Please sign in as a driver</p>
              <button className="btn btn-primary" onClick={() => go("driver-login")}>Driver Login</button>
            </div>
          </div>
        )
      )}
      {page === "ride-booking-bike" && (
        !auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("login")} /> : customer.role === "customer" ? <RideBooking
          rideType="bike"
          onBack={() => go("home")}
          onConfirm={(rideData) => requestRide("bike", rideData)}
        /> : <AccessDenied onBack={() => routeAfterAuthentication()} requiredRole="customer" />
      )}
      {page === "ride-booking-auto" && (
        !auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("login")} /> : customer.role === "customer" ? <RideBooking
          rideType="auto"
          onBack={() => go("home")}
          onConfirm={(rideData) => requestRide("auto", rideData)}
        /> : <AccessDenied onBack={() => routeAfterAuthentication()} requiredRole="customer" />
      )}
      {page === "ride-tracking" && (
        <RideTracking rideId={active?.id || window.location.pathname.split("/")[2]} onBack={() => go("home")} />
      )}
      {page === "bike-mechanic" && (
        !auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("login")} /> : customer.role === "customer" ? <BikeMechanicBooking
          onBack={() => go("home")}
          onSuccess={() => go("home")}
          notify={notify}
        /> : <AccessDenied onBack={() => routeAfterAuthentication()} requiredRole="customer" />
      )}
      {page === "car-mechanic" && (
        !auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("login")} /> : customer.role === "customer" ? <CarMechanicBooking
          onBack={() => go("home")}
          onSuccess={() => go("home")}
          notify={notify}
        /> : <AccessDenied onBack={() => routeAfterAuthentication()} requiredRole="customer" />
      )}
      {page === "services" && (
        !customer || customer.role === "customer" ? <Services services={activeServices} query={query} setQuery={setQuery} onService={openService} /> : <AccessDenied onBack={() => routeAfterAuthentication()} requiredRole={customer?.role} />
      )}
      {page === "booking" && (
        !auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("login")} /> : customer.role === "customer" ? <Booking
          service={selectedService}
          form={bookingForm}
          update={updateForm}
          step={bookingStep}
          setStep={setBookingStep}
          onBack={() => (bookingStep ? setBookingStep(bookingStep - 1) : go("services"))}
          onConfirm={submitBooking}
          submitting={bookingSubmitting}
        /> : <AccessDenied onBack={() => routeAfterAuthentication()} requiredRole="customer" />
      )}
      {page === "confirmation" && (
        !auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("login")} /> : customer.role === "customer" ? <Confirmation
          booking={active}
          onTrack={() => go("tracking")}
          onOrders={() => go("orders")}
          onHome={() => go("home")}
          onCancel={cancelBooking}
          onCall={() => notify("Calling your assigned professional...")}
          notify={notify}
        /> : <AccessDenied onBack={() => routeAfterAuthentication()} requiredRole="customer" />
      )}
      {page === "orders" && (
        !auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("login")} /> : customer.role === "customer" ? <Orders
          bookings={bookings}
          loading={bookingsLoading}
          error={bookingsError}
          onOpen={(booking) => { setActive(booking); go("order-details", { activeId: booking.id }); }}
          onTrack={(booking) => { setActive(booking); go("tracking", { activeId: booking.id }); }}
          onCancel={cancelBooking}
          onDownload={downloadInvoice}
        /> : <AccessDenied onBack={() => routeAfterAuthentication()} requiredRole="customer" />
      )}
      {page === "order-details" && (
        !auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("login")} /> : customer.role === "customer" ? <OrderDetails booking={active} onBack={() => go("orders")} onTrack={() => go("tracking", { activeId: active?.id })} onDownload={() => downloadInvoice(active)} /> : <AccessDenied onBack={() => routeAfterAuthentication()} requiredRole="customer" />
      )}
      {page === "tracking" && (
        !auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("login")} /> : customer.role === "customer" ? <Tracking
          booking={active}
          onBack={() => go("orders")}
          notify={notify}
          onLiveUpdate={(next) => {
            setActive(next);
            setBookings((all) => all.map((item) => (item.id === next.id ? next : item)));
          }}
        /> : <AccessDenied onBack={() => routeAfterAuthentication()} requiredRole="customer" />
      )}
      {page === "profile" && (
        <Profile customer={customer} bookings={bookings} notify={notify} logout={handleLogout} onSave={auth.refreshProfile} />
      )}
      {page === "professional" && (
        <>
          {!auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("employee-login")} label="Employee sign in" /> : customer.role === "employee" ? (
            <EmployeeDashboardPage
              profile={auth.profile}
              initialTab={employeeTabFromPath()}
              onTabChange={(tab) => {
                const path = tab === "jobs" ? "/employee/jobs" : tab === "history" ? "/employee/rides" : "/employee/profile";
                if (window.location.pathname !== path) window.history.pushState({}, "", path);
              }}
            />
          ) : (
            <AccessDenied onBack={() => go("home")} requiredRole="employee" />
          )}
        </>
      )}
      {page === "admin" && (
        <>
          {!auth.isAuthenticated || !customer ? <LoginRequired onLogin={() => go("admin-login")} label="Admin sign in" /> : customer.role === "admin" ? (
            <AdminDashboardPage
              profile={auth.profile}
              initialTab={adminTabFromPath()}
              onTabChange={(tab) => {
                const path = `/admin/${tab}`;
                if (window.location.pathname !== path) window.history.pushState({}, "", path);
              }}
            />
          ) : (
            <AccessDenied onBack={() => go("home")} requiredRole="admin" />
          )}
        </>
      )}
      {page === "access-denied" && (
        <AccessDenied onBack={() => go("home")} />
      )}

      {page === "support" && <SupportModal close={() => go("home")} notify={notify} />}

      {loginOpen && (
        <AuthModal
          close={() => setLoginOpen(false)}
          onAuthenticated={() => {
            setLoginOpen(false);
            notify("Signed in successfully.");
            routeAfterAuthentication().catch((error) => notify(error.message || "Unable to load your account."));
          }}
        />
      )}
      {supportOpen && <SupportModal close={() => setSupportOpen(false)} notify={notify} />}
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}

      {!["professional", "admin"].includes(page) && <AIAssistant role="customer" profile={auth.profile} />}

      <footer className="footer">
        <b>HOMEFIX</b>
        <span>Trusted home & mobility services</span>
        <button className="text-btn" onClick={() => setSupportOpen(true)}>Help & support</button>
        <span>Safe · Reliable · Professional</span>
      </footer>
    </div>
  );
}

function mapRemoteBooking(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    service: row.service,
    phone: row.mobile,
    address: row.address,
    date: row.booking_date,
    time: row.booking_time,
    amount: row.amount || 0,
    status: normalizeStatus(row.status),
    createdAt: row.created_at,
    professional: row.professional || null,
  };
}

// ---------------------------------------------------------------------
// Presentational pages
// ---------------------------------------------------------------------

function SectionTitle({ eyebrow, title, action, onClick }) {
  return (
    <div className="section-heading">
      <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
      {action && <button className="text-btn" onClick={onClick}>{action}<ArrowRight size={16} /></button>}
    </div>
  );
}

function ServiceCard({ service, onClick }) {
  return (
    <button className="service-card" onClick={onClick}>
      <img src={service.image} alt="" onError={(event) => { event.currentTarget.src = img.appliance; }} />
      <span><b>{service.name}</b><small>{service.description}</small><strong>From {money(service.price)}</strong></span>
      <ChevronRight />
    </button>
  );
}

function Home({ services, query, setQuery, onService, onServices, onOrders, onBikeRide, onAutoRide, onBikeMechanic, onCarMechanic }) {
  const useCurrentLocation = () => {
    if (!navigator.geolocation) return alert("Location is not supported by this browser.");
    navigator.geolocation.getCurrentPosition(
      () => alert("Current location detected."),
      (error) => alert(error.code === error.PERMISSION_DENIED ? "Location permission was denied." : "Unable to fetch your location.")
    );
  };
  return (
    <main>
      <section className="hero premium-hero">
        <div className="hero-copy hero-reveal">
          <span className="eyebrow"><ShieldCheck size={16} /> TRUSTED HOME &amp; MOBILITY SERVICES</span>
          <h1><span>Book a professional.</span><br /><em>Fix your home.</em></h1>
          <p>From everyday repairs and cleaning to appliance care, trusted help arrives at your doorstep.</p>
          <div className="search-box hero-search">
            <Search size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What do you need help with?" />
            <button onClick={onServices}>Search</button>
          </div>
          <div className="hero-actions">
            <button className="primary-btn" onClick={onServices}>Book a service <ArrowRight size={18} /></button>
            <button className="secondary-btn hero-secondary" onClick={onServices}>Explore services</button>
            <button className="text-btn" onClick={useCurrentLocation}><LocateFixed size={16} /> Current location</button>
          </div>
        </div>
        <div className="hero-art hero-art-reveal">
          <img src={img.cleaning} alt="Professional cleaning a home" />
          <div className="floating-proof"><CheckCircle2 size={20} /><span><b>Verified providers</b><small>For your home and ride</small></span></div>
        </div>
      </section>
      <section className="trust-strip">
        <span><ShieldCheck /> Verified professionals</span>
        <span><Clock3 /> Same-day availability</span>
        <span><WalletCards /> Transparent pricing</span>
      </section>
      <section className="content-section reveal-section">
        <SectionTitle eyebrow="POPULAR SERVICES" title="What can we help with?" action="View all" onClick={onServices} />
        <div className="service-grid">
          {services.slice(0, 6).map((service) => <ServiceCard service={service} onClick={() => onService(service)} key={service.id} />)}
        </div>
      </section>
      <section className="content-section reveal-section">
        <SectionTitle eyebrow="RIDES & MOBILITY" title="Book a ride" action="See more" onClick={null} />
        <div className="service-grid">
          <button className="service-card" onClick={onBikeRide} style={{ cursor: "pointer" }}>
            <div style={{ textAlign: "center", padding: "2rem", fontSize: "3rem" }}>🏍️</div>
            <span><b>Bike Ride</b><small>Quick & affordable</small><strong>Starting ₹20</strong></span>
            <ChevronRight />
          </button>
          <button className="service-card" onClick={onAutoRide} style={{ cursor: "pointer" }}>
            <div style={{ textAlign: "center", padding: "2rem", fontSize: "3rem" }}>🚗</div>
            <span><b>Auto Ride</b><small>Comfortable travel</small><strong>Starting ₹40</strong></span>
            <ChevronRight />
          </button>
        </div>
      </section>
      <section className="content-section reveal-section">
        <SectionTitle eyebrow="MECHANIC SERVICES" title="Vehicle repair" action="See all" onClick={null} />
        <div className="service-grid">
          <button className="service-card" onClick={onBikeMechanic} style={{ cursor: "pointer" }}>
            <div style={{ textAlign: "center", padding: "2rem", fontSize: "3rem" }}>🔧</div>
            <span><b>Bike Mechanic</b><small>Breakdown & repair</small><strong>From ₹200</strong></span>
            <ChevronRight />
          </button>
          <button className="service-card" onClick={onCarMechanic} style={{ cursor: "pointer" }}>
            <div style={{ textAlign: "center", padding: "2rem", fontSize: "3rem" }}>🛠️</div>
            <span><b>Car Mechanic</b><small>Expert service</small><strong>From ₹400</strong></span>
            <ChevronRight />
          </button>
        </div>
      </section>
      <section className="content-section reveal-section">
        <div className="home-map-layout">
          <div className="map-copy">
            <span className="eyebrow"><MapPin size={16} /> SERVICES NEAR YOU</span>
            <h2>Track every step with confidence.</h2>
            <p>Share your location only when you choose. HOMEFIX keeps live professional tracking private to your active booking.</p>
            <div className="map-copy-points"><span><ShieldCheck size={17} /> Permission-first location</span><span><CheckCircle2 size={17} /> Private booking tracking</span></div>
          </div>
          <PublicMapPreview />
        </div>
      </section>
      <section className="content-section reveal-section how-it-works">
        <SectionTitle eyebrow="HOW HOMEFIX WORKS" title="A better way to get things fixed." />
        <div className="steps-grid">
          {[
            ["01", "Choose a service", "Find help for your home, vehicle, or journey."],
            ["02", "Pick date & location", "Choose the exact date, time, and address that suits you."],
            ["03", "Confirm your booking", "Review your service and choose a payment method."],
            ["04", "Track your professional", "Follow progress once a verified provider is assigned."],
          ].map(([number, title, description]) => <article className="step-card" key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>
      <section className="home-cta reveal-section">
        <div><span className="eyebrow">HOMEFIX AT YOUR DOOR</span><h2>Need help at home?</h2><p>Book a trusted HOMEFIX professional today.</p></div>
        <button className="primary-btn" onClick={onServices}>Book a service <ArrowRight size={18} /></button>
      </section>
    </main>
  );
}

function PublicMapPreview() {
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return <div className="public-map-placeholder"><MapPin size={30} /><b>Maps configuration required</b><span>Set VITE_GOOGLE_MAPS_API_KEY to view service coverage.</span></div>;
  }
  return <div className="public-map"><GoogleMap center={{ lat: 17.385, lng: 78.4867 }} /></div>;
}

function Services({ services, query, setQuery, onService }) {
  return (
    <main className="content-section page-content">
      <div className="page-heading">
        <span className="eyebrow">THE HOMEFIX DIRECTORY</span>
        <h1>Services for every corner of home.</h1>
        <p>Choose a service and we will match you with a verified professional.</p>
      </div>
      <div className="search-box"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services" /></div>
      <div className="service-grid full">
        {services.map((service) => <ServiceCard service={service} onClick={() => onService(service)} key={service.id} />)}
      </div>
      {!services.length && <Empty text="No services match your search." />}
    </main>
  );
}

function Booking({ service, form, update, step, setStep, onBack, onConfirm, submitting }) {
  if (!service) return <Empty text="Choose a service to begin." />;
  const subtotal = service.price * Number(form.quantity || 1);
  const discount = form.coupon.trim().toUpperCase() === "HOMEFIX10" ? Math.round(subtotal * 0.1) : 0;
  const fee = Math.round(subtotal * 0.05);
  const total = Math.max(0, subtotal + fee - discount);

  const next = () => {
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (step === 1 && (!form.name.trim() || phoneDigits.length !== 10 || !form.address.trim() || !form.city.trim() || !/^\d{6}$/.test(form.pincode))) return;
    setStep(step + 1);
  };

  return (
    <main className="booking-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Back</button>
      <div className="progress">
        {["Service", "Details", "Schedule", "Payment"].map((label, index) => (
          <span className={index <= step ? "done" : ""} key={label}><i>{index < step ? <Check size={14} /> : index + 1}</i>{label}</span>
        ))}
      </div>
      <div className="booking-layout">
        <section className="booking-main">
          {step === 0 && (
            <>
              <img className="booking-image" src={service.image} alt={service.name} />
              <span className="eyebrow">SERVICE DETAILS</span>
              <h1>{service.name}</h1>
              <p className="lead">{service.description}. A verified HOMEFIX professional brings the right tools and care to your door.</p>
              <div className="option-row">
                <div><b>Quantity</b><small>Rooms, items or units</small></div>
                <div className="stepper">
                  <button onClick={() => update("quantity", Math.max(1, form.quantity - 1))}>−</button>
                  <b>{form.quantity}</b>
                  <button onClick={() => update("quantity", form.quantity + 1)}>+</button>
                </div>
              </div>
              <label>Notes for your professional
                <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Tell your professional what needs attention..." />
              </label>
            </>
          )}
          {step === 1 && <CustomerDetailsForm form={form} update={update} />}
          {step === 2 && <ScheduleForm form={form} update={update} />}
          {step === 3 && <PaymentForm form={form} update={update} total={total} />}
        </section>
        <aside className="price-card">
          <span className="eyebrow">YOUR BOOKING</span>
          <h3>{service.name}</h3>
          <div><span>Service price</span><b>{money(subtotal)}</b></div>
          <div><span>Platform fee</span><b>{money(fee)}</b></div>
          <div><span>Coupon discount</span><b>-{money(discount)}</b></div>
          <hr />
          <div className="total"><span>Total</span><b>{money(total)}</b></div>
          <button className="primary-btn wide" disabled={submitting} onClick={step === 3 ? onConfirm : next}>
            {submitting ? "Confirming..." : step === 3 ? "Confirm Booking" : "Continue"}
            <ArrowRight size={17} />
          </button>
        </aside>
      </div>
    </main>
  );
}

function CustomerDetailsForm({ form, update }) {
  const fields = [
    ["name", "Full name", "Your name", "text"],
    ["phone", "Mobile number", "10-digit mobile", "tel"],
    ["email", "Email", "you@example.com", "email"],
    ["address", "Address", "House no., street", "text"],
    ["landmark", "Landmark", "Nearby landmark", "text"],
    ["city", "City", "City", "text"],
    ["pincode", "Pincode", "6-digit pincode", "text"],
  ];
  return (
    <div>
      <span className="eyebrow">CUSTOMER DETAILS</span>
      <h1>Where should we come?</h1>
      <div className="form-grid">
        {fields.map(([key, label, placeholder, type]) => (
          <label key={key}>
            {label}
            <input
              type={type}
              value={form[key]}
              onChange={(event) => {
                const raw = event.target.value;
                const digitsOnly = key === "phone" ? raw.replace(/\D/g, "").slice(0, 10) : key === "pincode" ? raw.replace(/\D/g, "").slice(0, 6) : raw;
                update(key, digitsOnly);
              }}
              placeholder={placeholder}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function ScheduleForm({ form, update }) {
  const outOfHours = form.time && !isWithinBusinessHours(form.time);
  return (
    <div>
      <span className="eyebrow">SCHEDULE</span>
      <h1>Choose your exact date and time.</h1>
      <p className="lead">
        Pick the exact date and time you want the professional to arrive
        (business hours: {formatTimeDisplay(BUSINESS_HOURS_START)} - {formatTimeDisplay(BUSINESS_HOURS_END)}).
      </p>
      <label>Date<input type="date" min={dateToday()} value={form.date} onChange={(event) => update("date", event.target.value)} /></label>
      <label>Time
        <input
          type="time"
          min={BUSINESS_HOURS_START}
          max={BUSINESS_HOURS_END}
          value={form.time}
          onChange={(event) => update("time", event.target.value)}
        />
      </label>
      {outOfHours && (
        <p className="lead" style={{ color: "#b42318" }}>
          Please select a time between {formatTimeDisplay(BUSINESS_HOURS_START)} and {formatTimeDisplay(BUSINESS_HOURS_END)}.
        </p>
      )}
    </div>
  );
}

function PaymentForm({ form, update, total }) {
  return (
    <div>
      <span className="eyebrow">DEMO PAYMENT</span>
      <h1>Choose how to pay.</h1>
      <p className="lead">Simulated checkout only. No real money will be charged.</p>
      <div className="payment-options">
        {["UPI", "Card", "Wallet", "Cash on Service"].map((method) => (
          <button className={form.payment === method ? "payment-option selected" : "payment-option"} onClick={() => update("payment", method)} key={method}>
            {method === "Card" ? <CreditCard /> : method === "UPI" ? <Zap /> : <WalletCards />}
            <b>{method}</b>
            <span>{method === "Cash on Service" ? "Pay after work" : "Demo checkout"}</span>
          </button>
        ))}
      </div>
      <label>Coupon<input value={form.coupon} onChange={(event) => update("coupon", event.target.value)} placeholder="HOMEFIX10" /></label>
      <div className="payment-total">Amount due <b>{money(total)}</b></div>
    </div>
  );
}

function Confirmation({ booking, onTrack, onOrders, onHome, onCancel, onCall, notify }) {
  if (!booking) return <Empty text="No booking selected." />;
  return (
    <main className="center-page">
      <div className="confirmation">
        <div className="success-icon"><Check size={30} /></div>
        <span className="eyebrow">BOOKING CONFIRMED</span>
        <h1>Booking Confirmed!</h1>
        <p>Your HOMEFIX professional will take it from here.</p>
        <div className="reference-card"><small>BOOKING ID</small><b>{booking.id}</b><span>Professional assignment in progress</span></div>
        <div className="detail-list">
          <div><span>Customer</span><b>{booking.customer}</b></div>
          <div><span>Service</span><b>{booking.service}</b></div>
          <div><span>Date</span><b>{booking.date}</b></div>
          <div><span>Time</span><b>{booking.time}</b></div>
          <div><span>Address</span><b>{booking.address}</b></div>
          <div><span>Mobile</span><b>{booking.phone}</b></div>
          <div><span>Payment method</span><b>{booking.payment}</b></div>
          <div><span>Total amount</span><b>{money(booking.amount)}</b></div>
          <div><span>Status</span><b>{STATUS_LABELS[normalizeStatus(booking.status)]}</b></div>
        </div>
        <div className="hero-actions">
          <button className="primary-btn" onClick={onTrack}>Track booking <ArrowRight size={17} /></button>
          <button className="secondary-btn" onClick={onCall}><Phone size={16} /> Call professional</button>
          <button className="danger-btn" onClick={() => onCancel(booking)}>Cancel booking</button>
          <button className="secondary-btn" onClick={onOrders}>My orders</button>
          <button className="text-btn" onClick={() => { window.print(); notify("Print dialog opened."); }}><Printer size={16} /> Print</button>
          <button className="text-btn" onClick={() => { downloadInvoice(booking); notify("Confirmation downloaded."); }}><Download size={16} /> Download</button>
          <button className="text-btn" onClick={onHome}>Back home</button>
        </div>
      </div>
    </main>
  );
}

function Orders({ bookings, loading, error, onOpen, onTrack, onCancel, onDownload }) {
  const [tab, setTab] = useState("All");
  const groups = {
    All: bookings,
    Upcoming: bookings.filter((b) => !["COMPLETED", "CANCELLED"].includes(normalizeStatus(b.status))),
    Completed: bookings.filter((b) => normalizeStatus(b.status) === "COMPLETED"),
    Cancelled: bookings.filter((b) => normalizeStatus(b.status) === "CANCELLED"),
  };
  const list = groups[tab];
  return (
    <main className="content-section page-content">
      <div className="page-heading"><span className="eyebrow">CUSTOMER SPACE</span><h1>My Orders</h1><p>Your bookings, all in one place.</p></div>
      <div className="order-tabs">
        {Object.keys(groups).map((item) => (
          <button className={tab === item ? "selected" : ""} onClick={() => setTab(item)} key={item}>{item} <small>{groups[item].length}</small></button>
        ))}
      </div>
      {loading && <p>Loading bookings...</p>}
      {error && <p className="auth-error">{error}</p>}
      {!loading && list.length > 0 && (
        <div className="orders-list">
          {list.map((booking) => (
            <OrderCard booking={booking} onOpen={onOpen} onTrack={onTrack} onCancel={onCancel} onDownload={onDownload} key={booking.id} />
          ))}
        </div>
      )}
      {!loading && !list.length && <Empty text="No bookings yet." />}
    </main>
  );
}

function OrderCard({ booking, onOpen, onTrack, onCancel, onDownload }) {
  const status = normalizeStatus(booking.status);
  return (
    <article className="order-card expanded">
      <span>
        <b>{booking.service}</b>
        <small>{booking.id} · {booking.date} · {booking.time}</small>
        <strong>{money(booking.amount)}</strong>
      </span>
      <Badge status={status} />
      <div className="order-actions">
        <button onClick={() => onOpen(booking)}>View details</button>
        <button onClick={() => onTrack(booking)}>Track</button>
        {status !== "CANCELLED" && status !== "COMPLETED" && <button onClick={() => onCancel(booking)}>Cancel</button>}
        <button onClick={() => onDownload(booking)}>Invoice</button>
      </div>
    </article>
  );
}

function OrderDetails({ booking, onBack, onTrack, onDownload }) {
  if (!booking) return <Empty text="No order selected." />;
  return (
    <main className="content-section page-content">
      <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> My orders</button>
      <div className="panel order-detail">
        <span className="eyebrow">BOOKING DETAILS</span>
        <h1>{booking.service}</h1>
        <Badge status={normalizeStatus(booking.status)} />
        <div className="detail-list">
          <div><span>Booking ID</span><b>{booking.id}</b></div>
          <div><span>Date and time</span><b>{booking.date} · {booking.time}</b></div>
          <div><span>Address</span><b>{booking.address}</b></div>
          <div><span>Total</span><b>{money(booking.amount)}</b></div>
        </div>
        <div className="hero-actions">
          <button className="primary-btn" onClick={onTrack}>Track booking</button>
          <button className="secondary-btn" onClick={onDownload}>Download invoice</button>
        </div>
      </div>
    </main>
  );
}

function Tracking({ booking, onBack, notify, onLiveUpdate }) {
  const [employeeLocation, setEmployeeLocation] = useState(null);
  const [customerLocation, setCustomerLocation] = useState(null);

  useEffect(() => {
    if (!booking?.customerId) return undefined;
    return subscribeToMyBookings(booking.customerId, (payload) => {
      if (payload.new && payload.new.id === booking.id) onLiveUpdate(mapRemoteBooking(payload.new));
    });
  }, [booking?.id, booking?.customerId]);

  // Real Supabase Realtime feed of the assigned professional's position.
  useEffect(() => {
    if (!booking?.id) return undefined;
    return subscribeToBookingLocation(booking.id, (row) => {
      setEmployeeLocation({ latitude: row.latitude, longitude: row.longitude });
    });
  }, [booking?.id]);

  // One-time customer position for the map (never watched/streamed).
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setCustomerLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => {}
    );
  }, []);

  if (!booking) return <Empty text="No booking to track yet." />;
  const current = STATUSES.indexOf(normalizeStatus(booking.status));
  const professional = booking.professional;
  return (
    <main className="content-section page-content">
      <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> My orders</button>
      <div className="tracking-head">
        <div><span className="eyebrow">LIVE BOOKING</span><h1>{booking.service}</h1><p>{booking.id} · {booking.address}</p></div>
        <Badge status={normalizeStatus(booking.status)} />
      </div>
      <div className="tracking-grid">
        <section className="panel">
          <LiveTrackingMap
            customerLocation={customerLocation}
            employeeLocation={employeeLocation}
            employeeName={professional?.full_name}
            status={STATUS_LABELS[normalizeStatus(booking.status)]}
            updatedAt={employeeLocation ? Date.now() : null}
          />
          <h3>Progress timeline</h3>
          <div className="timeline">
            {STATUSES.filter((s) => s !== "CANCELLED").map((label, index) => (
              <div className={index <= current ? "timeline-item active" : "timeline-item"} key={label}>
                <i>{index < current ? <Check size={14} /> : index === current ? <span /> : ""}</i>
                <span><b>{STATUS_LABELS[label]}</b><small>{index <= current ? "Completed" : "Awaiting update"}</small></span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel professional">
          <h3>Your professional</h3>
          {professional ? (
            <>
              <div className="person">
                <span className="avatar">{professional.full_name?.slice(0, 2).toUpperCase() || "P"}</span>
                <span><b>{professional.full_name}</b><small><Star size={14} fill="currentColor" /> {Number(professional.average_rating || 5).toFixed(1)} · Verified</small></span>
              </div>
              {professional.phone && <p><Phone size={16} /> {professional.phone}</p>}
              <div className="hero-actions">
                <button className="secondary-btn" onClick={() => notify(`Calling ${professional.full_name}...`)}><Phone size={16} /> Call</button>
              </div>
            </>
          ) : (
            <p>Professional location will appear here once tracking starts.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function Profile({ customer, bookings, notify, logout, onSave }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer?.name || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateOwnProfile(customer.id, { full_name: name, phone });
      await onSave();
      setEditing(false);
      notify("Profile updated.");
    } catch (error) {
      notify(error.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!customer) return <Empty text="Sign in to view your profile." />;
  return (
    <main className="content-section page-content">
      <div className="profile-hero">
        <span className="avatar large">{(customer.name || "U").slice(0, 2).toUpperCase()}</span>
        <div><span className="eyebrow">MY PROFILE</span><h1>{customer.name}</h1><p>{customer.phone} · {customer.email}</p></div>
        <button className="secondary-btn" onClick={logout}><LogOut size={16} /> Logout</button>
      </div>
      <div className="profile-grid">
        <section className="panel">
          <h3>Account details</h3>
          {editing ? (
            <>
              <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label>Mobile<input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} /></label>
              <div className="hero-actions">
                <button className="primary-btn" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save changes"}</button>
                <button className="text-btn" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="detail-list">
                <div><span>Name</span><b>{customer.name}</b></div>
                <div><span>Mobile</span><b>{customer.phone || "Not set"}</b></div>
                <div><span>Email</span><b>{customer.email}</b></div>
                <div><span>Role</span><b>{customer.role}</b></div>
              </div>
              <button className="secondary-btn" onClick={() => setEditing(true)}><Pencil size={16} /> Edit profile</button>
            </>
          )}
        </section>
        <section className="panel">
          <h3>Booking history</h3>
          {bookings.length ? (
            <div className="detail-list">
              {bookings.map((booking) => <div key={booking.id}><span>{booking.service}</span><b>{money(booking.amount)}</b></div>)}
            </div>
          ) : <Empty text="No bookings yet." />}
        </section>
      </div>
    </main>
  );
}

function AccessDenied({ onBack, requiredRole }) {
  return (
    <main className="center-page">
      <div className="confirmation">
        <div className="success-icon"><ShieldAlert size={30} /></div>
        <span className="eyebrow">ACCESS DENIED</span>
        <h1>Unauthorized Access</h1>
        <p>
          {requiredRole
            ? `You need to be logged in as a ${requiredRole} to access this page.`
            : "You don't have permission to access this page."}
        </p>
        <div className="hero-actions">
          <button className="primary-btn" onClick={onBack}>Go back to home</button>
        </div>
      </div>
    </main>
  );
}

function LoginRequired({ onLogin, label = "Customer sign in" }) {
  return (
    <main className="center-page">
      <div className="confirmation">
        <div className="success-icon"><ShieldAlert size={30} /></div>
        <span className="eyebrow">SIGN IN REQUIRED</span>
        <h1>Sign in to continue</h1>
        <p>This customer feature requires a HOMEFIX account.</p>
        <button className="primary-btn" onClick={onLogin}>{label}</button>
      </div>
    </main>
  );
}

function SupportModal({ close, notify }) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("other");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!message.trim()) return notify("Please describe your issue.");
    setSending(true);
    try {
      await createSupportTicket({ category, message: message.trim() });
      notify("Support ticket submitted. Our team will get back to you.");
      close();
    } catch (error) {
      notify(error.message || "Unable to submit support ticket.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close" onClick={close}><X /></button>
        <h2>HOMEFIX support</h2>
        <p className="lead">Our support team is available to help with bookings and payments.</p>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginBottom: 10, width: "100%" }}>
          {["booking", "payment", "account", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea
          rows={4}
          style={{ width: "100%", marginBottom: 12 }}
          placeholder="Describe your issue..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button className="primary-btn wide" disabled={sending} onClick={submit}><MessageCircle size={16} /> {sending ? "Submitting..." : "Submit ticket"}</button>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return <div className="stat"><span className="stat-icon">{icon}</span><small>{label}</small><b>{value}</b></div>;
}

function Badge({ status }) {
  return <span className={`status status-${status.toLowerCase()}`}>{STATUS_LABELS[status] || status}</span>;
}

function Empty({ text }) {
  return <div className="empty"><Package size={28} /><p>{text}</p></div>;
}

function downloadInvoice(booking) {
  if (!booking) return;
  const body = `HOMEFIX BOOKING RECEIPT\nBooking: ${booking.id}\nService: ${booking.service}\nDate: ${booking.date}\nTime: ${booking.time}\nAddress: ${booking.address}\nAmount: ${money(booking.amount)}`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
  link.download = `${booking.id}-invoice.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}
