import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  Boxes,
  CalendarRange,
  ChefHat,
  ClipboardList,
  CreditCard,
  FileInput,
  Gauge,
  HeartPulse,
  LogOut,
  Package,
  Receipt,
  Salad,
  ScanSearch,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Soup,
  Tag,
  User,
  Users,
  Wallet,
  Wheat,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
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
  SidebarTrigger,
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
import { APP_NAME, APP_TAGLINE, ROLE_LABEL, type Role } from "@/lib/platform/labels";
import { useSession } from "@/lib/platform/session";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Gauge; roles: Role[] };

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Minha conta",
    items: [
      { to: "/cliente/kit", label: "Kit da semana", icon: ShoppingBag, roles: ["cliente"] },
      { to: "/cliente/assinatura", label: "Assinatura", icon: CalendarRange, roles: ["cliente"] },
      { to: "/cliente/pedidos", label: "Pedidos e cobranças", icon: Receipt, roles: ["cliente"] },
      { to: "/cliente/perfil", label: "Perfil alimentar", icon: User, roles: ["cliente"] },
      { to: "/cliente/plano", label: "Plano alimentar", icon: HeartPulse, roles: ["cliente"] },
      {
        to: "/cliente/privacidade",
        label: "Privacidade (LGPD)",
        icon: ShieldCheck,
        roles: ["cliente"],
      },
    ],
  },
  {
    group: "Operação",
    items: [
      {
        to: "/op/painel",
        label: "Painel",
        icon: Gauge,
        roles: ["operacao", "cozinha", "financeiro", "nutricionista"],
      },
      { to: "/op/cardapio", label: "Cardápio da semana", icon: Soup, roles: ["operacao"] },
      {
        to: "/op/pedidos",
        label: "Pedidos e entregas",
        icon: ClipboardList,
        roles: ["operacao", "financeiro"],
      },
      { to: "/op/producao", label: "Produção", icon: ChefHat, roles: ["operacao", "cozinha"] },
      { to: "/op/etiquetas", label: "Etiquetas", icon: Tag, roles: ["operacao", "cozinha"] },
      {
        to: "/op/rastreabilidade",
        label: "Rastreabilidade",
        icon: ScanSearch,
        roles: ["operacao", "cozinha"],
      },
    ],
  },
  {
    group: "Insumos",
    items: [
      {
        to: "/op/ingredientes",
        label: "Ingredientes",
        icon: Wheat,
        roles: ["operacao", "nutricionista"],
      },
      {
        to: "/op/fichas",
        label: "Fichas técnicas",
        icon: Salad,
        roles: ["operacao", "nutricionista", "cozinha"],
      },
      { to: "/op/estoque", label: "Estoque por lote", icon: Boxes, roles: ["operacao", "cozinha"] },
      {
        to: "/op/recebimento",
        label: "Compras e recebimento",
        icon: FileInput,
        roles: ["operacao"],
      },
    ],
  },
  {
    group: "Gestão",
    items: [
      {
        to: "/op/precos",
        label: "Custos e preços",
        icon: BadgeDollarSign,
        roles: ["operacao", "financeiro"],
      },
      {
        to: "/op/pagamentos",
        label: "Pagamentos",
        icon: CreditCard,
        roles: ["operacao", "financeiro"],
      },
      { to: "/op/financeiro", label: "Financeiro", icon: Wallet, roles: ["financeiro"] },
      { to: "/op/usuarios", label: "Usuários e acessos", icon: Users, roles: ["admin"] },
      {
        to: "/op/configuracoes",
        label: "Configurações",
        icon: Settings,
        roles: ["admin", "financeiro"],
      },
    ],
  },
  {
    group: "Nutrição",
    items: [
      {
        to: "/nutri/planos",
        label: "Revisão de planos",
        icon: HeartPulse,
        roles: ["nutricionista"],
      },
      {
        to: "/nutri/parametros",
        label: "Parâmetros",
        icon: SlidersHorizontal,
        roles: ["nutricionista"],
      },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { data: session } = useSession();

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  };

  const isAdmin = session?.roles.includes("admin") ?? false;
  const visible = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) =>
      g.group === "Minha conta"
        ? session?.roles.includes("cliente")
        : isAdmin || i.roles.some((r) => session?.roles.includes(r)),
    ),
  })).filter((g) => g.items.length > 0);

  const current = NAV.flatMap((g) => g.items).find((n) => pathname.startsWith(n.to));

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar collapsible="icon" className="print:hidden">
        <SidebarHeader className="py-5">
          <div className={cn("flex items-center gap-3 px-2", isCollapsed && "justify-center px-0")}>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Salad className="size-5" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground">{APP_NAME}</p>
                <p className="truncate text-xs text-sidebar-foreground/60">{APP_TAGLINE}</p>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          {visible.map((g) => (
            <SidebarGroup key={g.group}>
              <SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
                {g.group}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {g.items.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(item.to)}
                        tooltip={item.label}
                      >
                        <Link to={item.to as never}>
                          <item.icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="pb-5">
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print:hidden sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-md md:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h2 className="truncate text-sm font-semibold">{current?.label ?? APP_NAME}</h2>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 rounded-full">
                <Package className="size-4" />
                <span className="hidden max-w-[180px] truncate text-xs sm:inline">
                  {session?.email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="space-y-1">
                <p className="truncate text-sm">{session?.email}</p>
                <p className="text-xs font-normal text-muted-foreground">
                  {(session?.roles ?? []).map((r) => ROLE_LABEL[r]).join(" · ") || "Sem papel"}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 size-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
