import React, { useEffect, useState } from "react";
import { ArrowRight, MapPin, Phone, Clock, CheckCircle2, User as UserIcon } from "lucide-react";
import {
  acceptJob, getAvailableJobs, getMyAssignedBookings, subscribeToJobRequests, updateJobStatus,
} from "../services/bookings";
import { updateOwnProfile } from "../services/auth";
import { writeMyLocation } from "../services/employeeLocation";
import { useLiveLocation } from "../hooks/useLiveLocation";
import AIAssistant from "../components/AIAssistant";

const STATUS_LABELS = {
  PENDING: "Pending", CONFIRMED: "Confirmed", ASSIGNED: "Assigned to you",
  ON_THE_WAY: "On the way", SERVICE_STARTED: "Service started", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const NEXT_STATUS = { ASSIGNED: "ON_THE_WAY", ON_THE_WAY: "SERVICE_STARTED", SERVICE_STARTED: "COMPLETED" };
const NEXT_LABEL = { ASSIGNED: "Start heading over", ON_THE_WAY: "Start service", SERVICE_STARTED: "Mark completed" };

const money = (value) => `\u20b9${Number(value || 0).toLocaleString("en-IN")}`;

const TABS = [
  { id: "jobs", label: "Jobs" },
  { id: "history", label: "Earnings & History" },
  { id: "profile", label: "Profile" },
];

export default function EmployeeDashboard({ profile, initialTab, onTabChange }) {
  const [tab, setTab] = useState(initialTab && TABS.some((t) => t.id === initialTab) ? initialTab : "jobs");
  const [available, setAvailable] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const changeTab = (next) => {
    setTab(next);
    onTabChange?.(next);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [openJobs, myJobs] = await Promise.all([getAvailableJobs(), getMyAssignedBookings()]);
      setAvailable(openJobs);
      setAssigned(myJobs);
    } catch (err) {
      setError(err.message || "Unable to load jobs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsubscribe = subscribeToJobRequests(() => load());
    return unsubscribe;
  }, []);

  const handleAccept = async (job) => {
    setBusyId(job.id);
    setError("");
    try {
      await acceptJob(job.id);
      await load();
    } catch (err) {
      setError(err.message || "Unable to accept this job.");
    } finally {
      setBusyId(null);
    }
  };

  const handleAdvance = async (job) => {
    const next = NEXT_STATUS[job.status];
    if (!next) return;
    setBusyId(job.id);
    setError("");
    try {
      await updateJobStatus(job.id, next);
      await load();
    } catch (err) {
      setError(err.message || "Unable to update job status.");
    } finally {
      setBusyId(null);
    }
  };

  const activeJobs = assigned.filter((b) => ["ASSIGNED", "ON_THE_WAY", "SERVICE_STARTED"].includes(b.status));
  const completedJobs = assigned.filter((b) => b.status === "COMPLETED");
  const earnings = completedJobs.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const todayEarnings = completedJobs
    .filter((b) => (b.updated_at || b.created_at || "").slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  // Live GPS: only ever writes to Supabase while the employee has explicitly
  // opted in (location.isTracking) AND a job is actively in progress.
  const activeJob = activeJobs[0] || null;
  const location = useLiveLocation({ throttleMs: 8000 });

  useEffect(() => {
    if (!location.location || !activeJob) return;
    writeMyLocation({
      bookingId: activeJob.id,
      latitude: location.location.latitude,
      longitude: location.location.longitude,
      accuracy: location.location.accuracy,
      heading: location.location.heading,
      speed: location.location.speed,
    }).catch((err) => console.warn("[HOMEFIX] Location share failed:", err.message));
  }, [location.location, activeJob?.id]);

  useEffect(() => {
    if (!activeJob && location.isTracking) location.stopTracking();
  }, [activeJob, location.isTracking]);

  return (
    <main className="content-section page-content employee-dashboard">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">PROFESSIONAL DASHBOARD</span>
          <h1>Welcome back, {profile?.full_name?.split(" ")[0] || "there"}!</h1>
          <p>Manage your jobs, earnings and profile.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="stat-grid three">
        <div className="stat-card"><div><div className="stat-value">{activeJobs.length}</div><small className="stat-label">Active jobs</small></div></div>
        <div className="stat-card"><div><div className="stat-value">{available.length}</div><small className="stat-label">Open job requests</small></div></div>
        <div className="stat-card"><div><div className="stat-value">{money(earnings)}</div><small className="stat-label">Total earnings</small></div></div>
      </div>

      {profile?.approval_status !== "approved" && (
        <div className={`status-banner ${profile?.approval_status}`}>
          <p>
            {profile?.approval_status === "pending" && "Your account is pending admin approval. You'll be notified once approved."}
            {profile?.approval_status === "rejected" && "Your application was not approved. Contact support for details."}
            {profile?.approval_status === "suspended" && "Your account has been suspended by an administrator."}
          </p>
        </div>
      )}

      <div className="tab-navigation">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => changeTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === "jobs" && (
        <>
          {activeJob && (
            <section className="dashboard-section">
              <div className="info-card">
                <h3>Share live location</h3>
                <p>Lets the customer see your position on the map while job {activeJob.id} is active. You can turn this off anytime.</p>
                {location.error && <p style={{ color: "#c0392b" }}>{location.error}</p>}
                <button
                  className={location.isTracking ? "primary-btn small" : "secondary-btn small"}
                  onClick={() => (location.isTracking ? location.stopTracking() : location.startTracking())}
                >
                  {location.isTracking ? "Sharing location · Tap to stop" : "Enable location sharing"}
                </button>
              </div>
            </section>
          )}
          <section className="dashboard-section">
            <h2>Open job requests</h2>
            {available.length ? (
              <div className="jobs-list">
                {available.map((job) => (
                  <div className="job-card" key={job.id}>
                    <div className="job-header">
                      <div><h3>{job.service}</h3><small className="job-id">{job.id}</small></div>
                      <div className="job-status">{STATUS_LABELS[job.status] || job.status}</div>
                    </div>
                    <div className="job-details">
                      <p><MapPin size={16} /> {job.address}</p>
                      <p><Clock size={16} /> {job.booking_date} at {job.booking_time}</p>
                      <p><Phone size={16} /> {job.mobile}</p>
                    </div>
                    <div className="job-footer">
                      <div className="job-amount">{money(job.amount)}</div>
                      <button className="primary-btn small" disabled={busyId === job.id} onClick={() => handleAccept(job)}>
                        {busyId === job.id ? "Accepting..." : "Accept job"} <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="empty-text">No open job requests right now.</p>}
          </section>

          <section className="dashboard-section">
            <h2>Your active jobs</h2>
            {activeJobs.length ? (
              <div className="jobs-list">
                {activeJobs.map((job) => (
                  <div className="job-card active" key={job.id}>
                    <div className="job-header">
                      <div><h3>{job.service}</h3><small className="job-id">{job.id}</small></div>
                      <div className="job-status">{STATUS_LABELS[job.status] || job.status}</div>
                    </div>
                    <div className="job-details">
                      <p><MapPin size={16} /> {job.address}</p>
                      <p><Clock size={16} /> {job.booking_date} at {job.booking_time}</p>
                      <p><Phone size={16} /> {job.mobile}</p>
                    </div>
                    <div className="job-footer">
                      <div className="job-amount">{money(job.amount)}</div>
                      {NEXT_STATUS[job.status] && (
                        <button className="secondary-btn small" disabled={busyId === job.id} onClick={() => handleAdvance(job)}>
                          {busyId === job.id ? "Updating..." : NEXT_LABEL[job.status]} <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="empty-text">No active jobs. Accept a job request above to get started.</p>}
          </section>
        </>
      )}

      {tab === "history" && (
        <section className="admin-section">
          <h2>Earnings &amp; job history</h2>
          <div className="stat-grid three">
            <div className="stat-card"><div><div className="stat-value">{money(todayEarnings)}</div><small className="stat-label">Today's earnings</small></div></div>
            <div className="stat-card"><div><div className="stat-value">{money(earnings)}</div><small className="stat-label">Total earnings</small></div></div>
            <div className="stat-card"><div><div className="stat-value">{completedJobs.length}</div><small className="stat-label">Completed jobs</small></div></div>
          </div>
          {completedJobs.length ? (
            <div className="table-responsive">
              <table>
                <thead><tr><th>Booking</th><th>Service</th><th>Date</th><th>Amount</th></tr></thead>
                <tbody>
                  {completedJobs.map((job) => (
                    <tr key={job.id}><td><small>{job.id}</small></td><td>{job.service}</td><td>{job.booking_date}</td><td>{money(job.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="empty-text">Completed jobs will show up here.</p>}
        </section>
      )}

      {tab === "profile" && <EmployeeProfileForm profile={profile} />}

      {loading && <p className="loading-text">Loading...</p>}
      {!loading && !available.length && !assigned.length && tab === "jobs" && (
        <div className="empty-state"><CheckCircle2 size={40} /><p>No jobs yet. New requests will appear here automatically.</p></div>
      )}

      <AIAssistant role="employee" profile={profile} />
    </main>
  );
}

function EmployeeProfileForm({ profile }) {
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await updateOwnProfile(profile.id, { full_name: fullName, phone });
      setMessage("Profile updated.");
    } catch (err) {
      setMessage(err.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-section">
      <h2><UserIcon size={18} /> My profile</h2>
      <div className="settings-grid">
        <label>Full name<input value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
        <label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label>Approval status<input value={profile?.approval_status || ""} disabled /></label>
        <label>Email<input value={profile?.email || ""} disabled /></label>
        <button className="primary-btn" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save profile"}</button>
        {message && <small>{message}</small>}
      </div>
    </section>
  );
}

