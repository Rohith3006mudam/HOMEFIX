import { useEffect, useMemo, useState } from "react";
import "./extra.css";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, CreditCard,
  Download, LocateFixed, LogOut, MapPin, Menu, MessageCircle, Package, Pencil, Phone,
  Printer, Search, ShieldCheck, ShieldAlert, Star, User, Users, WalletCards, X, Zap,
} from "lucide-react";
import { isSupabaseConfigured } from "./lib/supabase";
import { useAuth } from "./hooks/useAuth";
import { updateOwnProfile } from "./services/auth";
import { cancelMyBooking, createBooking, listMyBookings, subscribeToMyBookings } from "./services/bookings";
import { createPayment } from "./paymentService";
import AuthModal from "./components/AuthModal";
import RoleRoute from "./components/common/RoleRoute";

// ---------------------------------------------------------------------
// Static content: service catalogue + demo professionals for the
// Professional/Admin dashboards (out of scope for the Supabase booking
// pipeline, kept as local UI state as before).
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

const EMPLOYEES = ["Ravi Kumar", "Meera Shah", "Arjun Reddy", "Anjali Menon"].map((name, index) => ({
  id: `EMP-${1042 + index * 17}`,
  name,
  phone: `+91 98${String(7654321 + index * 193).slice(0, 8)}`,
  skills: index % 2 ? "Cleaning, Painting" : "Plumbing, Electrical",
  rating: 4.7 + (index % 3) / 10,
  jobs: 80 + index * 13,
  earnings: 42000 + index * 2800,
  available: true,
  avatar: name.split(" ").map((part) => part[0]).join(""),
}));

const STATUSES = ["PENDING", "CONFIRMED", "ASSIGNED", "ON_THE_WAY", "SERVICE_STARTED", "COMPLETED", "CANCELLED"];
const STATUS_LABELS = {
  PENDING: "Pending", CONFIRMED: "Confirmed", ASSIGNED: "Professional Assigned",
  ON_THE_WAY: "On The Way", SERVICE_STARTED: "Service Started", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const normalizeStatus = (value) => (STATUSES.includes(value) ? value : "PENDING");
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const dateToday = () => new Date().toISOString().slice(0, 10);
const TIME_SLOTS = ["09:00 AM - 11:00 AM", "12:00 PM - 02:00 PM", "03:00 PM - 05:00 PM", "05:00 PM - 07:00 PM"];

const pageFromPath = () => {
  const path = window.location.pathname;
  if (path === "/services") return "services";
  if (path.startsWith("/service/") || path === "/booking") return "booking";
  if (path === "/confirmation") return "confirmation";
  if (path === "/orders") return "orders";
  if (path.startsWith("/orders/")) return "order-details";
  if (path.startsWith("/track/")) return "tracking";
  if (path === "/profile") return "profile";
  if (path.startsWith("/employee")) return "professional";
  if (path.startsWith("/admin")) return "admin";
  return "home";
};

const routeFor = (page, activeId) => ({
  home: "/", services: "/services", booking: "/booking", confirmation: "/confirmation",
  orders: "/orders", "order-details": activeId ? `/orders/${activeId}` : "/orders",
  tracking: activeId ? `/track/${activeId}` : "/orders", profile: "/profile",
  professional: "/employee", admin: "/admin",
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

  const [services] = useState(SERVICES);
  const [employees] = useState(EMPLOYEES);
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
      quantity: 1, date: dateToday(), time: TIME_SLOTS[0], name: "", phone: "", email: "",
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
    if (!bookingForm.payment) return notify("Please select a payment method.");

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
      const payment = createPayment({ bookingId: remote.id, customerId: remote.customer_id, amount, paymentMethod: bookingForm.payment });
      const booking = {
        ...mapRemoteBooking(remote),
        customer: bookingForm.name,
        amount,
        subtotal,
        fee,
        discount,
        payment: bookingForm.payment,
        paymentStatus: payment.paymentStatus,
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

  const navItems = [["home", "Home"], ["services", "Services"], ["orders", "My Orders"], ["profile", "Profile"]];

  return (
    <div className="app-shell">
      <header className="header">
        <button className="brand" onClick={() => go("home")}>
          <span className="brand-mark">H</span>
          <span><b>HOMEFIX</b><small>Trusted home & mobility services</small></span>
        </button>
        <nav className={mobileOpen ? "nav open" : "nav"}>
          {navItems.map(([target, label]) => (
            <button key={target} onClick={() => (target === "home" || target === "services" ? go(target) : requireAuth(target))}>
              {label}
            </button>
          ))}
          {customer?.role === "professional" && <button onClick={() => go("professional")}>Professional</button>}
          {customer?.role === "admin" && <button onClick={() => go("admin")}>Admin</button>}
          <button onClick={() => setSupportOpen(true)}>Support</button>
        </nav>
        <div className="header-actions">
          {customer ? (
            <button className="user-chip" onClick={() => go("profile")}><User size={16} />{customer.name}</button>
          ) : (
            <button className="outline-btn" onClick={() => setLoginOpen(true)}>Sign In</button>
          )}
          <button className="icon-btn menu-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu"><Menu /></button>
        </div>
      </header>

      {page === "home" && (
        <Home
          services={activeServices}
          query={query}
          setQuery={setQuery}
          onService={openService}
          onServices={() => go("services")}
          onOrders={() => requireAuth("orders")}
        />
      )}
      {page === "services" && (
        <Services services={activeServices} query={query} setQuery={setQuery} onService={openService} />
      )}
      {page === "booking" && (
        <Booking
          service={selectedService}
          form={bookingForm}
          update={updateForm}
          step={bookingStep}
          setStep={setBookingStep}
          onBack={() => (bookingStep ? setBookingStep(bookingStep - 1) : go("services"))}
          onConfirm={submitBooking}
          submitting={bookingSubmitting}
        />
      )}
      {page === "confirmation" && (
        <Confirmation
          booking={active}
          onTrack={() => go("tracking")}
          onOrders={() => go("orders")}
          onHome={() => go("home")}
          onCancel={cancelBooking}
          onCall={() => notify("Calling your assigned professional...")}
          notify={notify}
        />
      )}
      {page === "orders" && (
        <Orders
          bookings={bookings}
          loading={bookingsLoading}
          error={bookingsError}
          onOpen={(booking) => { setActive(booking); go("order-details", { activeId: booking.id }); }}
          onTrack={(booking) => { setActive(booking); go("tracking", { activeId: booking.id }); }}
          onCancel={cancelBooking}
          onDownload={downloadInvoice}
        />
      )}
      {page === "order-details" && (
        <OrderDetails booking={active} onBack={() => go("orders")} onTrack={() => go("tracking", { activeId: active?.id })} onDownload={() => downloadInvoice(active)} />
      )}
      {page === "tracking" && (
        <Tracking
          booking={active}
          employees={employees}
          onBack={() => go("orders")}
          notify={notify}
          onLiveUpdate={(next) => {
            setActive(next);
            setBookings((all) => all.map((item) => (item.id === next.id ? next : item)));
          }}
        />
      )}
      {page === "profile" && (
        <Profile customer={customer} bookings={bookings} notify={notify} logout={handleLogout} onSave={auth.refreshProfile} />
      )}
      {page === "professional" && (
        <RoleRoute role={customer?.role} allowedRoles={["professional"]}>
          <ProfessionalDashboard bookings={bookings} setBookings={setBookings} employee={employees[0]} notify={notify} />
        </RoleRoute>
      )}
      {page === "admin" && (
        <RoleRoute role={customer?.role} allowedRoles={["admin"]}>
          <AdminDashboard bookings={bookings} setBookings={setBookings} services={services} employees={employees} notify={notify} />
        </RoleRoute>
      )}

      {loginOpen && (
        <AuthModal
          close={() => setLoginOpen(false)}
          onAuthenticated={() => { setLoginOpen(false); notify("Signed in successfully."); }}
        />
      )}
      {supportOpen && <SupportModal close={() => setSupportOpen(false)} notify={notify} />}
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}

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

function Home({ services, query, setQuery, onService, onServices, onOrders }) {
  const useCurrentLocation = () => {
    if (!navigator.geolocation) return alert("Location is not supported by this browser.");
    navigator.geolocation.getCurrentPosition(
      () => alert("Current location detected."),
      (error) => alert(error.code === error.PERMISSION_DENIED ? "Location permission was denied." : "Unable to fetch your location.")
    );
  };
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><ShieldCheck size={16} /> TRUSTED LOCAL PROFESSIONALS</span>
          <h1>Book a professional.<br /><em>Fix your home.</em></h1>
          <p>From everyday repairs and cleaning to appliance care, trusted help arrives at your doorstep.</p>
          <div className="search-box hero-search">
            <Search size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What do you need help with?" />
            <button onClick={onServices}>Search</button>
          </div>
          <div className="hero-actions">
            <button className="primary-btn" onClick={onServices}>Explore services <ArrowRight size={18} /></button>
            <button className="text-btn" onClick={onOrders}>View my orders</button>
            <button className="text-btn" onClick={useCurrentLocation}><LocateFixed size={16} /> Current location</button>
          </div>
        </div>
        <div className="hero-art">
          <img src={img.cleaning} alt="Professional cleaning a home" />
          <div className="floating-proof"><CheckCircle2 size={20} /><span><b>4.9/5</b><small>Rated by 2,000+ homes</small></span></div>
        </div>
      </section>
      <section className="trust-strip">
        <span><ShieldCheck /> Verified professionals</span>
        <span><Clock3 /> Same-day availability</span>
        <span><WalletCards /> Transparent pricing</span>
      </section>
      <section className="content-section">
        <SectionTitle eyebrow="POPULAR SERVICES" title="What can we help with?" action="View all" onClick={onServices} />
        <div className="service-grid">
          {services.slice(0, 6).map((service) => <ServiceCard service={service} onClick={() => onService(service)} key={service.id} />)}
        </div>
      </section>
    </main>
  );
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
  return (
    <div>
      <span className="eyebrow">SCHEDULE</span>
      <h1>Choose a convenient time.</h1>
      <p className="lead">Your professional will arrive during the selected two-hour window.</p>
      <label>Date<input type="date" min={dateToday()} value={form.date} onChange={(event) => update("date", event.target.value)} /></label>
      <label>Time slot
        <select value={form.time} onChange={(event) => update("time", event.target.value)}>
          {TIME_SLOTS.map((slot) => <option key={slot}>{slot}</option>)}
        </select>
      </label>
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

function Tracking({ booking, employees, onBack, notify, onLiveUpdate }) {
  useEffect(() => {
    if (!booking?.customerId) return undefined;
    return subscribeToMyBookings(booking.customerId, (payload) => {
      if (payload.new && payload.new.id === booking.id) onLiveUpdate(mapRemoteBooking(payload.new));
    });
  }, [booking?.id, booking?.customerId]);

  if (!booking) return <Empty text="No booking to track yet." />;
  const current = STATUSES.indexOf(normalizeStatus(booking.status));
  const professional = employees[0];
  return (
    <main className="content-section page-content">
      <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> My orders</button>
      <div className="tracking-head">
        <div><span className="eyebrow">LIVE BOOKING</span><h1>{booking.service}</h1><p>{booking.id} · {booking.address}</p></div>
        <Badge status={normalizeStatus(booking.status)} />
      </div>
      <div className="tracking-grid">
        <section className="panel">
          <div className="map-placeholder"><MapPin size={28} /><b>Map unavailable</b><small>Live map is optional in demo mode</small></div>
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
                <span className="avatar">{professional.avatar}</span>
                <span><b>{professional.name}</b><small><Star size={14} fill="currentColor" /> {professional.rating.toFixed(1)} · Verified</small></span>
              </div>
              <p><Phone size={16} /> {professional.phone}</p>
              <div className="hero-actions">
                <button className="secondary-btn" onClick={() => notify(`Calling ${professional.name}...`)}><Phone size={16} /> Call</button>
                <button className="secondary-btn" onClick={() => notify("Chat opened for demo.")}><MessageCircle size={16} /> Chat</button>
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

function ProfessionalDashboard({ bookings, setBookings, employee, notify }) {
  const actions = {
    CONFIRMED: ["Accept booking", "ASSIGNED"],
    ASSIGNED: ["Start job", "ON_THE_WAY"],
    ON_THE_WAY: ["Start service", "SERVICE_STARTED"],
    SERVICE_STARTED: ["Complete service", "COMPLETED"],
  };
  const jobs = bookings.filter((item) => !["COMPLETED", "CANCELLED"].includes(normalizeStatus(item.status)));
  const advance = (booking, nextStatus) => {
    setBookings((all) => all.map((item) => (item.id === booking.id ? { ...item, status: nextStatus } : item)));
    notify(`${booking.id} updated to ${STATUS_LABELS[nextStatus]}.`);
  };
  return (
    <main className="content-section page-content">
      <div className="dashboard-top">
        <div><span className="eyebrow">PROFESSIONAL DASHBOARD</span><h1>Good morning, {employee.name.split(" ")[0]}.</h1></div>
      </div>
      <div className="stat-grid four">
        <Stat label="Today's jobs" value={jobs.length} icon={<CalendarDays />} />
        <Stat label="Pending" value={jobs.length} icon={<Clock3 />} />
        <Stat label="Completed jobs" value={employee.jobs} icon={<CheckCircle2 />} />
        <Stat label="Earnings" value={money(employee.earnings)} icon={<WalletCards />} />
      </div>
      <h2 className="subheading">Assigned jobs</h2>
      {jobs.length ? (
        <div className="job-grid">
          {jobs.map((booking) => {
            const action = actions[normalizeStatus(booking.status)];
            return (
              <article className="job-card" key={booking.id}>
                <div className="job-card-head"><b>{booking.id}</b><Badge status={normalizeStatus(booking.status)} /></div>
                <h3>{booking.service}</h3>
                <p><MapPin size={15} /> {booking.address}</p>
                <p><CalendarDays size={15} /> {booking.date} · {booking.time}</p>
                <div className="job-foot">
                  <b>{money(booking.amount)}</b>
                  {action && <button className="primary-btn small" onClick={() => advance(booking, action[1])}>{action[0]} <ArrowRight size={15} /></button>}
                </div>
              </article>
            );
          })}
        </div>
      ) : <Empty text="No assigned jobs right now." />}
    </main>
  );
}

function AdminDashboard({ bookings, setBookings, services, employees, notify }) {
  const revenue = bookings.reduce((sum, item) => sum + item.amount, 0);
  const changeStatus = (booking, status) => {
    setBookings((all) => all.map((item) => (item.id === booking.id ? { ...item, status } : item)));
    notify(`${booking.id} updated to ${STATUS_LABELS[status] || status}.`);
  };
  return (
    <main className="content-section page-content">
      <div className="dashboard-top"><div><span className="eyebrow">OPERATIONS CENTER</span><h1>Admin dashboard</h1></div></div>
      <div className="stat-grid four">
        <Stat label="Total bookings" value={bookings.length} icon={<Package />} />
        <Stat label="Revenue" value={money(revenue)} icon={<WalletCards />} />
        <Stat label="Services" value={services.length} icon={<Package />} />
        <Stat label="Professionals" value={employees.length} icon={<Users />} />
      </div>
      <section className="panel table-panel">
        <div className="panel-title"><h3>Bookings</h3><small>{bookings.length} records</small></div>
        {bookings.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Booking</th><th>Service</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td><b>{booking.id}</b><small>{booking.date}</small></td>
                    <td>{booking.service}</td>
                    <td>{money(booking.amount)}</td>
                    <td>
                      <select value={normalizeStatus(booking.status)} onChange={(event) => changeStatus(booking, event.target.value)}>
                        {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty text="Bookings will appear here." />}
      </section>
    </main>
  );
}

function SupportModal({ close, notify }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close" onClick={close}><X /></button>
        <h2>HOMEFIX support</h2>
        <p className="lead">Our support team is available to help with bookings and payments.</p>
        <button className="primary-btn wide" onClick={() => { notify("Support chat opened."); close(); }}><MessageCircle size={16} /> Start chat</button>
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
