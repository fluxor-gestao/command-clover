import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Forbidden,
  Loading,
  PageHeader,
  Section,
  Stat,
  StatusBadge,
} from "@/components/platform/ui";
import { list, rpc } from "@/lib/platform/db";
import { brl, dateBR, dateTimeBR, qty } from "@/lib/format";
import type { Metrics } from "@/lib/platform/types";

export const Route = createFileRoute("/_authenticated/op/painel")({ component: PainelPage });

function PainelPage() {
  const { session } = Route.useRouteContext();
  const q = useQuery({
    queryKey: ["op-dashboard"],
    enabled: session.isStaff,
    queryFn: async () => {
      const [m, cycles, lots, attention] = await Promise.all([
        rpc<Metrics>("dashboard_metrics"),
        list<{ id: string; name: string; status: string; cutoff_at: string }>("menu_cycles", (x) =>
          x.order("cutoff_at", { ascending: false }).limit(3),
        ),
        session.has("operacao", "cozinha")
          ? list<{
              id: string;
              ingredient_name: string;
              lot_code: string;
              expires_at: string;
              quantity_on_hand: number;
              usage_unit: string;
              is_expired: boolean;
            }>("v_stock_lots", (x) =>
              x
                .or("is_expired.eq.true,expiring_soon.eq.true")
                .gt("quantity_on_hand", 0)
                .order("expires_at")
                .limit(8),
            )
          : [],
        session.has("operacao", "financeiro")
          ? list<{ id: string; code: string; status: string; needs_attention: string }>(
              "orders",
              (x) => x.not("needs_attention", "is", null).neq("status", "entregue").limit(8),
            )
          : [],
      ]);
      return { m, cycles, lots, attention };
    },
  });
  if (!session.isStaff) return <Forbidden />;
  if (q.isLoading || !q.data) return <Loading />;
  const { m, cycles, lots, attention } = q.data;

  return (
    <>
      <PageHeader title="Painel da operação" description="O que precisa de atenção agora." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Assinaturas ativas"
          value={m.active_subscriptions}
          hint={`${m.paused_subscriptions} pausadas · ${m.cancelled_30d} canceladas em 30 dias`}
        />
        <Stat
          label="Inadimplentes"
          value={m.delinquent_subscriptions}
          tone={m.delinquent_subscriptions ? "danger" : undefined}
        />
        <Stat
          label="Pedidos em aberto"
          value={m.orders_open}
          hint={`${m.orders_attention} exigem atenção`}
        />
        {session.has("financeiro") && (
          <Stat
            label="Faturamento do mês"
            value={brl(m.revenue_month)}
            hint={`Receita recorrente estimada ${brl(m.mrr_estimate)}/mês`}
          />
        )}
        <Stat
          label="Lotes vencidos com saldo"
          value={m.lots_expired}
          tone={m.lots_expired ? "danger" : undefined}
          hint="Bloqueados para uso"
        />
        <Stat
          label="Lotes perto do vencimento"
          value={m.lots_expiring}
          tone={m.lots_expiring ? "warning" : undefined}
        />
        <Stat
          label="Fichas para aprovar"
          value={m.dishes_to_approve}
          hint={`${m.prices_to_approve} preços aguardando o gestor`}
        />
        <Stat label="Planos para revisar" value={m.plans_to_review} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section
          title="Semanas"
          actions={
            <Button asChild size="sm" variant="outline">
              <Link to="/op/cardapio">Cardápio</Link>
            </Button>
          }
        >
          <ul className="divide-y text-sm">
            {cycles.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span>
                  {c.name} · corte {dateTimeBR(c.cutoff_at)}
                </span>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        </Section>
        {lots.length > 0 && (
          <Section
            title="Validade de insumos"
            actions={
              <Button asChild size="sm" variant="outline">
                <Link to="/op/estoque">Estoque</Link>
              </Button>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.ingredient_name}</TableCell>
                    <TableCell>{l.lot_code}</TableCell>
                    <TableCell
                      className={
                        l.is_expired
                          ? "font-medium text-destructive"
                          : "text-warning-foreground dark:text-warning"
                      }
                    >
                      {dateBR(l.expires_at)} {l.is_expired && "· vencido"}
                    </TableCell>
                    <TableCell className="text-right">
                      {qty(l.quantity_on_hand, l.usage_unit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        )}
        {attention.length > 0 && (
          <Section title="Pedidos que exigem atenção">
            <ul className="space-y-2 text-sm">
              {attention.map((o) => (
                <li key={o.id}>
                  <b>{o.code}</b> <StatusBadge status={o.status} /> — {o.needs_attention}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
