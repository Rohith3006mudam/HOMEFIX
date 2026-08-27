import { ShieldAlert } from "lucide-react";

// Reusable role guard: renders children only if the signed-in profile's
// role is in allowedRoles, otherwise renders a fallback (or the built-in
// "access denied" view). Frontend-only convenience — the real enforcement
// is Supabase RLS (see supabase/migrations/001_homefix_platform.sql).
export default function RoleRoute({ role, allowedRoles, children, fallback }) {
  if (allowedRoles.includes(role)) return children;
  if (fallback) return fallback;
  return (
    <main className="center-page">
      <div className="confirmation">
        <div className="success-icon"><ShieldAlert size={30} /></div>
        <span className="eyebrow">ACCESS DENIED</span>
        <h1>You don't have permission to view this page.</h1>
        <p>This area is restricted to authorized HOMEFIX accounts.</p>
      </div>
    </main>
  );
}
