import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import logoAsset from "@/assets/logo.png.asset.json";
import {
  BarChart3,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  PiggyBank,
  Search,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV_OPERATIONAL = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/operacoes", label: "Operações", icon: Building2 },
  { to: "/referencias", label: "Referências", icon: Building2 },
  { to: "/parcelas", label: "Parcelas & Vencimentos", icon: CalendarClock },
  { to: "/recebimentos", label: "Recebimentos", icon: Wallet },
  { to: "/aportes", label: "Aportes", icon: PiggyBank },
] as const;

const NAV_SYSTEM = [
  { to: "/importacao", label: "Importação", icon: FileSpreadsheet },
  { to: "/qualidade", label: "Qualidade da base", icon: ShieldCheck },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const getPageTitle = () => {
    const allNav = [...NAV_OPERATIONAL, ...NAV_SYSTEM];
    const item = allNav.find((n) => pathname.startsWith(n.to));
    return item?.label || "Nova Era";
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar collapsible="icon">
        <SidebarHeader className="py-6">
          <div className={cn("flex items-center gap-3 px-2 transition-all", isCollapsed && "justify-center px-0")}>
            <img
              src={logoAsset.url}
              alt="Nova Era"
              className={cn("object-contain shrink-0", isCollapsed ? "h-8 w-8" : "h-10 w-10")}
            />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold tracking-[0.2em] text-sidebar-foreground/50 uppercase">
                  Nova Era
                </span>
                <span className="text-sm font-semibold text-sidebar-foreground mt-0.5 truncate">
                  Gestão de Investimentos
                </span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>Operacional</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_OPERATIONAL.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(item.to)}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_SYSTEM.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(item.to)}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="pb-6">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut} tooltip="Sair">
                <LogOut className="size-4" />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar operação ou referência..."
                className="h-9 w-64 pl-9 text-xs bg-muted/50 border-none focus-visible:ring-1"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
