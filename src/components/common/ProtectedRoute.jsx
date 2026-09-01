import { ShieldAlert } from "lucide-react";

/**
 * ProtectedRoute enforces role-based access at the React component level.
 * However, this is a convenience feature only - the real enforcement
 * happens via Supabase RLS policies at the database level.
 * 
 * IMPORTANT: Never rely on frontend-only checks. Always verify the user's
 * actual role from the database (via the profile), and set up proper
 * Supabase RLS policies on all tables.
 */
export default function ProtectedRoute({
  role,
  allowedRoles,
  requiredApprovalStatus,
  children,
  fallback
}) {
  // Check if user has one of the allowed roles
  if (!allowedRoles.includes(role)) {
    if (fallback) return fallback;
    return (
      <main className="center-page">
        <div className="confirmation">
          <div className="success-icon"><ShieldAlert size={30} /></div>
          <span className="eyebrow">ACCESS DENIED</span>
          <h1>You don't have permission to access this area.</h1>
          <p>Only authorized HOMEFIX staff can access this page.</p>
          <button 
            className="primary-btn"
            onClick={() => window.location.href = "/"}
          >
            Return to home
          </button>
        </div>
      </main>
    );
  }

  // For employee and admin roles, optionally check approval status
  if (requiredApprovalStatus && role === "employee") {
    // This check is for reference - real approval checking happens in useAuth
    return children;
  }

  return children;
}
