# HOMEFIX Multi-Role Platform - Implementation Guide

## Overview

This is a complete implementation of the HOMEFIX home services marketplace with three distinct user roles:

1. **CUSTOMER** - Books services and tracks professionals
2. **EMPLOYEE** - Provides services and manages jobs  
3. **ADMIN** - Manages platform, approves employees, oversees operations

## Architecture

### Tech Stack
- **Frontend**: React 18 + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Authentication**: Supabase Auth (Email/Password + OTP)
- **Maps**: Google Maps API
- **Location**: Browser Geolocation API
- **Real-time**: Supabase Realtime subscriptions

### Database Schema
```
- profiles (auth users + role + approval status)
- bookings (service requests + assignments)
- service_categories (plumbing, electrical, etc.)
- services (specific services with pricing)
- employee_profiles (extended employee info)
- reviews (customer ratings)
- notifications (system notifications)
- payments (payment tracking)
- employee_locations (live tracking)
- tracking_locations (customer sees employee)
```

## Setup Instructions

### 1. Environment Variables
Create `.env.local` in the project root:
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

### 2. Database Migration
1. Open Supabase SQL Editor
2. Copy entire contents of: `supabase/migrations/003_complete_homefix_schema.sql`
3. Execute the migration
4. Verify tables are created:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname='public';
   ```

### 3. Seed Admin Account
After creating your first admin user via signup, promote them to admin:
```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'your-admin-email@example.com';
```

### 4. Install Dependencies & Build
```bash
npm install
npm run build
npm run dev  # For development
```

## User Flows

### CUSTOMER Journey
1. Visit `/login` → Create account (auto-role: customer)
2. Home page: Browse services, search
3. Click "Book Now" → 4-step booking wizard
4. Pay and confirm
5. `/orders` → View bookings
6. Click booking → Track professional in real-time
7. Rate professional after completion
8. `/profile` → Edit details

**Routes**:
- `/` - Home
- `/login` - Customer login
- `/signup` - New customer
- `/services` - Browse all services
- `/booking` - Create booking
- `/orders` - My bookings
- `/orders/:id` - Booking details
- `/track/:id` - Live tracking
- `/profile` - My profile

### EMPLOYEE Journey
1. Visit `/employee/login` or click "Apply to join"
2. Create account → Complete professional profile
3. Select services, experience, area
4. Submit application (awaiting admin approval)
5. Admin approves → Status changes to `approved`
6. Login to `/employee/dashboard`
7. View pending job requests
8. Accept jobs (atomic operation - no double-accepts)
9. Update job status: pending → assigned → on_the_way → completed
10. `/employee/earnings` → View accumulated earnings
11. Enable location sharing for active jobs

**Routes**:
- `/employee/login` - Employee login
- `/employee/dashboard` - Job dashboard
- `/employee/earnings` - View earnings
- `/employee/profile` - View/edit profile

**Key Functions**:
- `acceptJob(bookingId)` - Accept a pending job
- `updateJobStatus(bookingId, status)` - Update job progress
- `writeMyLocation()` - Share live location
- `getAvailableJobs()` - List pending jobs in area

### ADMIN Journey
1. Visit `/admin/login` (not linked from anywhere)
2. Login (account must be promoted to admin role)
3. `/admin/dashboard` - Overview KPIs
4. Employees tab → Review pending applications
5. Approve/Reject employees
6. Bookings tab → Manage all bookings
7. Assign employees manually if needed
8. Services tab → Create/edit services
9. Users tab → Manage customers
10. Live tab → See active jobs on map

**Routes**:
- `/admin/login` - Admin login (secure)
- `/admin/dashboard` - Main dashboard
- `/admin/users` - Customer management
- `/admin/employees` - Employee management
- `/admin/services` - Service management
- `/admin/bookings` - Booking management
- `/admin/live` - Live operations map

**Key Functions**:
- `getPendingEmployees()` - List applications
- `approveEmployee(id)` - Approve employee
- `rejectEmployee(id)` - Reject employee
- `getAllBookings(filters)` - List all bookings
- `assignEmployeeToBooking(bookingId, employeeId)` - Manual assignment
- `getAllServices()` - List services
- `createService()` - Add new service
- `getPlatformStats()` - Overview statistics

## Security Implementation

### Authentication
- Email/Password signup with Supabase Auth
- Mobile OTP support (optional)
- Session persistence with secure cookies
- Password reset via email

### Authorization
- Role-based access control (RBAC)
- Database-backed role verification
- Row Level Security (RLS) on all sensitive tables
- Frontend role checks supplemented by database policies

### Row Level Security Policies
```sql
-- Customers can only read their own data
SELECT: profile.id = auth.uid() AND role = 'customer'

-- Employees can read assigned bookings
SELECT: booking.professional_id = auth.uid()

-- Admins can read everything
SELECT: auth.uid() in (SELECT id FROM profiles WHERE role = 'admin')

-- No booking modifications across roles
UPDATE: Only customer (own) or assigned employee or admin
```

### Best Practices Implemented
- ✅ Service role key never exposed in frontend
- ✅ All secrets in environment variables
- ✅ No sensitive data in localStorage
- ✅ Passwords hashed by Supabase Auth
- ✅ All API calls through secure Supabase client
- ✅ Rate limiting via Supabase auth
- ✅ CORS configured properly
- ✅ Admin operations logged (can be added)

## Real-Time Features

### Supabase Realtime Subscriptions
1. **Bookings**: Customer sees job status updates
2. **Locations**: Customer sees employee location in real-time
3. **Job Requests**: Employee notified of new jobs
4. **Notifications**: Users get push notifications

### Implementation
```javascript
// Subscribe to booking updates
subscribeToMyBookings(customerId, (payload) => {
  // Handle booking status change
});

// Subscribe to employee location
subscribeToBookingLocation(bookingId, (payload) => {
  // Update map with new location
});
```

## File Structure

```
src/
├── App.jsx                              # Main app with routing
├── main.jsx                             # Entry point
├── extra.css                            # Tailored styles
├── index.css                            # Base styles
├── index.html                           # HTML template
│
├── components/
│   ├── AuthModal.jsx                   # Login/signup modal
│   ├── CustomerLogin.jsx               # Customer login page
│   ├── EmployeeLogin.jsx               # Employee login page
│   ├── AdminLogin.jsx                  # Admin login page
│   ├── EmployeeSignup.jsx              # Employee access request
│   ├── auth.css                        # Auth styles
│   ├── common/
│   │   ├── RoleRoute.jsx               # Role-based route guard
│   │   └── ProtectedRoute.jsx          # Protected route wrapper
│   └── maps/
│       ├── GoogleMap.jsx               # Google Maps component
│       └── LiveTrackingMap.jsx         # Customer tracking map
│
├── pages/
│   ├── EmployeeDashboard.jsx           # Employee dashboard
│   └── AdminDashboard.jsx              # Admin dashboard
│
├── hooks/
│   ├── useAuth.js                      # Auth context hook
│   └── useLiveLocation.js              # Location tracking hook
│
├── services/
│   ├── auth.js                         # Auth operations
│   ├── bookings.js                     # Booking CRUD + jobs
│   ├── catalog.js                      # Service listings
│   ├── employeeLocation.js             # Location services
│   └── admin.js                        # Admin operations
│
└── lib/
    └── supabase.js                     # Supabase client config

supabase/
├── homefix_schema.sql                  # Original schema
├── migrations/
│   ├── 001_homefix_platform.sql        # Initial setup
│   ├── 002_employee_locations.sql      # Locations table
│   └── 003_complete_homefix_schema.sql # Multi-role complete
```

## Key Components & Features

### 1. Multi-Role Authentication
- Separate login pages for each role
- Role-based redirects after login
- Database-backed role verification
- Approval workflow for employees

### 2. Customer Booking Flow
- 4-step booking wizard
- Service selection with images
- Date/time picker
- Address input with current location
- Price calculation with discounts
- Multiple payment methods
- Booking confirmation

### 3. Employee Management
- Self-service access request
- Admin approval workflow
- Profile management
- Approval status display
- Earnings tracking
- Job acceptance (atomic - prevents double-booking)
- Status progression validation

### 4. Admin Dashboard
- Platform KPIs and statistics
- Employee application review
- Booking management
- Service management
- Live operations map
- User management

### 5. Real-Time Features
- Live location tracking
- Job status notifications
- Booking updates
- Live operations view

## Testing Scenarios

### Customer Test Case
```
1. Sign up as customer at /login
2. Search for "Plumbing" service
3. Click "Book Now"
4. Complete 4-step booking
5. Verify booking in /orders
6. Verify tracking page
```

### Employee Test Case
```
1. Click "Apply to join" at /employee/login
2. Complete profile (select services, area)
3. Submit application
4. (Switch to admin account)
5. Approve employee
6. (Switch back to employee)
7. Login to /employee/dashboard
8. Accept a pending job
9. Update job status to completed
```

### Admin Test Case
```
1. Login at /admin/login with admin account
2. View /admin/dashboard
3. Go to Employees → Approve pending
4. Go to Bookings → Assign professional
5. View Live Operations
```

## Error Handling

All errors are handled with:
- User-friendly messages
- Fallback UI states
- Graceful degradation
- Logging to console

Examples:
- Missing Supabase config → Configuration Required page
- Unauthorized access → ACCESS DENIED page
- Network errors → Retry with user notification
- Location unavailable → Fallback address input

## Performance Optimizations

1. **Lazy loading**: Components load on-demand
2. **Memoization**: useAuth and related hooks use memoization
3. **Throttled updates**: Location sharing throttled to 8 seconds
4. **Efficient queries**: Specific column selection in queries
5. **Indexed tables**: Foreign keys and status fields indexed
6. **CSS optimization**: Minified production build

## Deployment Considerations

### Before Production:
1. Set up proper environment variables
2. Enable HTTPS only
3. Configure CORS properly
4. Set up email notifications
5. Configure payment gateway
6. Set up monitoring/logging
7. Enable database backups
8. Test all RLS policies
9. Load test the system

### Recommended Platforms:
- Frontend: Vercel, Netlify
- Backend: Supabase (managed PostgreSQL)
- Emails: SendGrid, AWS SES
- Payments: Stripe, Razorpay (for India)
- Monitoring: Sentry, DataDog

## Future Enhancements

1. **AI Assistant**: Integration with Claude/GPT for service recommendations
2. **Video Calls**: Real-time video between customer and professional
3. **SMS Notifications**: Job updates via SMS
4. **Push Notifications**: Mobile app notifications
5. **Advanced Analytics**: Detailed reports and insights
6. **Blockchain**: Verified credentials for professionals
7. **ML Matching**: Smart professional matching based on history
8. **API**: Public API for partners
9. **Mobile Apps**: Native iOS/Android apps
10. **Multi-language**: Localization support

## Support & Documentation

- Database schema: See `supabase/homefix_schema.sql`
- API reference: See `src/services/` files
- Component props: JSDoc comments in components
- CSS variables: Define in index.css
- Environment config: See `.env.example`

## License

This project is built for HOMEFIX platform. All rights reserved.

## Contact

For questions or issues, refer to the implementation checklist and testing guide.
