# Role and Objective
Act as an expert Full-Stack Developer. Your task is to architect and implement a Supabase-backed authentication system with Role-Based Access Control (RBAC), manual admin approvals, and secure dashboards. 

We are integrating this into our existing application. Please adapt the UI components to match our current framework (e.g., React/Next.js/Vue) and styling.

# Core Requirements
1. **Supabase Database & Schema:** Generate the SQL necessary to create user profiles, roles, and approval statuses.
2. **Authentication Pages:** Build a Signup page and a Login page. The Login page must include a specific "Start Section" designated for "GSM PRO" users to enter the dashboard.
3. **Role & Approval Logic:** Users who sign up are default `users` and their status is `pending`. They cannot access the dashboard until an Admin approves them.
4. **Dashboards (Mockups):** Create an Admin Dashboard (to approve users) and a User Dashboard (to verify successful, approved logins).

---

## Implementation Plan

Please execute this implementation plan step-by-step. Ask for my confirmation or clarification before moving to the next phase.

### Phase 1: Database Schema & Supabase Setup
Write the raw SQL commands required to set up the database in the Supabase SQL Editor. 
* Create a custom `profiles` table that triggers/syncs with Supabase's native `auth.users`.
* Include a `role` column (default: 'user') and an `approval_status` column (enum or text: 'pending', 'approved', 'rejected').
* Write secure Row Level Security (RLS) policies so users can only read their own data, but admins can read and update all user profiles.
* Provide clear, manual instructions (or a specific SQL `INSERT`/`UPDATE` script) on how I can manually promote the very first user to the `admin` role directly in the Supabase console so we can bootstrap the system.

### Phase 2: GSM PRO Login & Signup UI
Create the frontend pages and the Supabase Auth integration logic.
* **GSM PRO Login Section:** Create a clean, professional login component. It must include a designated "GSM PRO" start/welcome section that guides the user to log in.
* **Signup Page:** Create a registration form. Add UI feedback letting the user know that after registering, their account will require admin approval before they can access the dashboard.
* **Auth Handlers:** Write the functions to handle Supabase `signUp` and `signInWithPassword`. Handle error states gracefully.

### Phase 3: Routing & Middleware (Access Control)
Implement the protective routing logic to ensure security.
* Write a middleware or higher-order component (depending on the framework) to check the user's session, `role`, and `approval_status` upon login.
* **Rules:**
    * If not logged in -> Redirect to Login.
    * If logged in, `role === 'user'`, but `approval_status === 'pending'` -> Redirect to a "Pending Approval" view (or show a lock screen).
    * If logged in, `role === 'user'`, and `approval_status === 'approved'` -> Grant access to User Dashboard.
    * If logged in, `role === 'admin'` -> Grant access to Admin Dashboard.

### Phase 4: Mock Dashboards
Build the mock UI components to test the entire flow.
* **Admin Dashboard:** Create a table/list fetching all users with an `approval_status` of `pending`. Add "Approve" and "Reject" buttons that update the Supabase `profiles` table via a Supabase client call. 
* **User Dashboard:** Create a simple welcome screen displaying the user's data to confirm that their role and approved status are functioning correctly.

---
**To get started:** Please acknowledge this plan, tell me what frontend framework you are assuming we are using (or ask me to clarify), and output the **Phase 1 SQL schema and RLS policies** to begin.