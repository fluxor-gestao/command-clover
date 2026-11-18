import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppShell } from "@/components/layout/AppShell";
import { loadSession } from "@/lib/platform/session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: ["session"],
      queryFn: loadSession,
    });
    if (!session) throw redirect({ to: "/auth" });
    return { session };
  },
  component: () => (
    <SidebarProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </SidebarProvider>
  ),
});
