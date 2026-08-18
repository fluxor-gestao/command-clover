---
name: User Management Page
description: Implementation of a user management page with CRUD operations, role-based access control, and integration with Supabase Auth.
type: feature
---

# User Management Implementation Plan

## Proposed Changes

### Database & Security
- Implement RLS policies on `user_roles` to allow admins to manage all roles.
- Ensure `has_role` function is available for checking admin status.
- Add a secure RPC `list_users_with_roles` to fetch data from `auth.users` joined with `public.user_roles`. This is necessary because the browser client cannot directly list all users from `auth.users` due to security restrictions.
- Add a server function/RPC `admin_create_user` to handle user creation via the admin dashboard, including initial role assignment.

### Frontend
- **New Route**: `src/routes/_authenticated/usuarios.tsx`.
  - Data table displaying users, emails, and roles.
  - "Create User" dialog (email, initial password, role).
  - "Edit User" dialog (role modification).
  - "Delete User" confirmation.
- **Navigation**: Update `src/components/layout/AppShell.tsx` to include "Usuários" in the sidebar under the "Gestão" group.
- **Hooks**: Add `useUsers`, `useCreateUser`, `useUpdateUserRole`, and `useDeleteUser` to `src/lib/data/hooks.ts`.

### Technical Details
- **Role Control**: The page should only be visible/accessible to users with the 'admin' role.
- **Supabase Admin**: Server-side logic for user creation/deletion will require the `supabaseAdmin` client (service role) to bypass standard user self-service limits.
- **UI Components**: Use shadcn/ui components (`Table`, `Dialog`, `Form`, `Select`, `Button`) for consistency with the "Nova Era" aesthetic.

## User Review Required
- **Password Policy**: Should the admin set an initial password, or should we send a password reset/invite email?
- **Deletion Behavior**: When a user is deleted, should we also delete their `user_roles` entries (cascading) and audit logs, or keep the audit logs for history?
- **Access Level**: Should 'moderators' also have view-only access to this page, or is it strictly for 'admins'?
