import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CalendarClock,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  PiggyBank,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/operacoes", label: "Operações", icon: Building2 },
  { to: "/parcelas", label: "Parcelas", icon: CalendarClock },
  { to: "/recebimentos", label: "Recebimentos", icon: Wallet },
  { to: "/aportes", label: "Aportes", icon: PiggyBank },
  { to: "/importacao", label: "Importação", icon: FileSpreadsheet },
  { to: "/qualidade", label: "Qualidade da base", icon: ShieldCheck },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
        <div className="px-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nova Era</p>
          <p className="text-lg font-semibold text-sidebar-foreground">Gestão de Investimentos</p>
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" className="justify-start gap-3" onClick={signOut}>
          <LogOut className="size-4" />
          Sair
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 overflow-x-auto border-b bg-background px-4 py-3 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium",
                pathname.startsWith(item.to) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
