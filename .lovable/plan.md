# Plan - Remove landing page and redirect to login

The user wants to remove the initial landing page that contains the "Acessar Sistema" button and instead open the application directly at the login screen.

## User Review Required

> [!IMPORTANT]
> This change will make the `/auth` page the new entry point for unauthenticated users.

- None

## Proposed Changes

### Routing

#### [src/routes/index.tsx](src/routes/index.tsx)
- Replace the current landing page component with a redirect to `/auth`.
- Use the `beforeLoad` or a simple `Navigate` component to handle the redirection.

## Verification Plan

### Automated Tests
- Run a Playwright script to verify that navigating to `http://localhost:8080/` automatically redirects to `http://localhost:8080/auth`.

### Manual Verification
- Open the preview at the root path and confirm it lands on the login page.
