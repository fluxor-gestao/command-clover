# Plan: Universal Responsiveness Optimization

Improve the system's adaptability across all devices, specifically focusing on mobile usability for the investment management interface.

## User Review Required

> [!IMPORTANT]
> - Mobile navigation will use a bottom bar or a simplified hamburger menu to maximize screen real estate for financial data.
> - Some large tables will switch to a "card-list" view on smaller screens to remain readable without horizontal scrolling.

## Proposed Changes

### Layout & Navigation
- **AppShell**: Add a `SidebarTrigger` to the mobile header to allow opening/closing the sidebar on small screens.
- **AppShell**: Adjust header padding and font sizes for mobile.
- **Sidebar**: Ensure the mobile sheet version of the sidebar is fully functional and easy to navigate.

### Dashboard & Metrics
- **Dashboard**: Improve grid layout for KPI cards (1 column on mobile, 2 on tablet, 4 on desktop).
- **Dashboard**: Optimize chart responsiveness; ensure legends and axes don't overlap on narrow screens.
- **KPI Cards**: Adjust font sizes and spacing for better touch targets.

### Data Tables
- **Global Table Pattern**: Implement a responsive table wrapper that allows horizontal scrolling where necessary, or switches to stacked cards for critical entities (Operations, Installments).
- **Filters**: Ensure `YearScopeSelect` and other filter bars wrap correctly on mobile and don't overflow the screen.

### Authentication
- **Auth Page**: Refine the login card width and centering for perfect mobile display.

## Technical Details

- Use Tailwind's `md:`, `lg:`, and `xl:` prefixes to differentiate layouts.
- Utilize the `useIsMobile` hook from `src/hooks/use-mobile.ts` for conditional rendering of complex UI elements.
- Apply `overflow-x-auto` to all `Table` containers.
- Use `gap-2` or `gap-4` instead of fixed margins to allow flex/grid wrapping.
- Update `AppShell.tsx` to include `SidebarTrigger` from `src/components/ui/sidebar.tsx`.

