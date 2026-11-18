import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Field, Loading, PageHeader, Section, StatusBadge } from "@/components/platform/ui";
import { db, errorText, list, rpc, unwrap } from "@/lib/platform/db";
import { brl, dateBR, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/op/precos")({ component: PrecosPage });

type Breakdown = {
  dish_id: string;
  ingredients: number;
  packaging: number;
  labor: number;
  cost_per_portion: number;
  delivery_per_portion: number;
  payment_fee_pct: number;
  tax_pct: number;
  target_margin_pct: number;
  min_margin_pct: number;
  suggested_price: number | null;
  current_price: number | null;
  net_price: number;
  contribution_margin_pct: number | null;
  below_min_margin: boolean;
};

function PrecosPage() {
  const { session } = Route.useRouteContext();
  const canApprove = session.has("financeiro");
  const qc = useQueryClient();
  const [propose, setPropose] = useState<{
    dish_id: string;
    name: string;
    price: string;
    valid_from: string;
    b: Breakdown;
  } | null>(null);
  const [explain, setExplain] = useState<{ name: string; b: Breakdown } | null>(null);

  const q = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => {
      const dishes = await list<{ id: string; name: string; status: string }>("dishes", (x) =>
        x.in("status", ["aprovado", "em_aprovacao"]).order("name"),
      );
      const breakdowns = await Promise.all(
        dishes.map((d) => rpc<Breakdown>("price_breakdown", { p_dish_id: d.id })),
      );
      const pending = await list<{
        id: string;
        dish_id: string;
        price: number;
        suggested_price: number | null;
        valid_from: string;
        created_at: string;
        dishes: { name: string };
      }>("dish_prices", (x) => x.eq("status", "proposto").order("created_at"), "*,dishes(name)");
      const plans = await list<{ id: string; name: string; discount_pct: number; active: boolean }>(
        "subscription_plans",
        (x) => x.order("discount_pct"),
      );
      const planMargins = await Promise.all(
        plans.map(async (p) => {
          const bs = await Promise.all(
            dishes
              .filter((d) => d.status === "aprovado")
              .map((d) =>
                rpc<Breakdown>("price_breakdown", {
                  p_dish_id: d.id,
                  p_discount_pct: p.discount_pct,
                }),
              ),
          );
          const valid = bs.filter((b) => b.contribution_margin_pct !== null);
          return {
            plan: p,
            avg: valid.length
              ? valid.reduce((s, b) => s + Number(b.contribution_margin_pct), 0) / valid.length
              : null,
            below: valid.filter((b) => b.below_min_margin).length,
          };
        }),
      );
      return { dishes, breakdowns, pending, planMargins };
    },
  });

  const proposeM = useMutation({
    mutationFn: () =>
      rpc("propose_dish_price", {
        p_dish_id: propose!.dish_id,
        p_price: Number(propose!.price),
        p_valid_from: propose!.valid_from,
      }),
    onSuccess: () => {
      toast.success("Preço enviado para aprovação do gestor");
      setPropose(null);
      qc.invalidateQueries({ queryKey: ["pricing"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const approve = useMutation({
    mutationFn: ({ id, ok }: { id: string; ok: boolean }) =>
      rpc("approve_dish_price", { p_price_id: id, p_approve: ok }),
    onSuccess: () => {
      toast.success("Decisão registrada");
      qc.invalidateQueries({ queryKey: ["pricing"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const discount = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: number }) =>
      unwrap(await db.from("subscription_plans").update({ discount_pct: v }).eq("id", id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing"] }),
    onError: (e) => toast.error(errorText(e)),
  });

  if (q.isLoading || !q.data) return <Loading label="Calculando custos e margens…" />;
  const first = q.data.breakdowns[0];

  return (
    <>
      <PageHeader
        title="Custos e preços"
        description={
          first
            ? `Preço sugerido = (custo da porção + entrega) ÷ (1 − taxa ${pct(first.payment_fee_pct)} − tributos ${pct(first.tax_pct)} − margem-alvo ${pct(first.target_margin_pct)}). Margem mínima: ${pct(first.min_margin_pct)}.`
            : undefined
        }
      />

      {q.data.pending.length > 0 && (
        <Section title="Preços aguardando aprovação" className="mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prato</TableHead>
                <TableHead className="text-right">Sugerido</TableHead>
                <TableHead className="text-right">Proposto</TableHead>
                <TableHead>Vale a partir de</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.pending.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.dishes.name}</TableCell>
                  <TableCell className="text-right">
                    {p.suggested_price ? brl(p.suggested_price) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{brl(p.price)}</TableCell>
                  <TableCell>{dateBR(p.valid_from)}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    {canApprove ? (
                      <>
                        <Button size="sm" onClick={() => approve.mutate({ id: p.id, ok: true })}>
                          <Check className="mr-1 size-4" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => approve.mutate({ id: p.id, ok: false })}
                        >
                          <X className="mr-1 size-4" />
                          Rejeitar
                        </Button>
                      </>
                    ) : (
                      <StatusBadge status="proposto" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">
            Preço com data futura aparece para o cliente como mudança programada antes de entrar em
            vigor. Pedidos já feitos mantêm o preço da contratação.
          </p>
        </Section>
      )}

      <Section title="Preço por item" className="mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prato</TableHead>
              <TableHead className="text-right">Custo/porção</TableHead>
              <TableHead className="text-right">Sugerido</TableHead>
              <TableHead className="text-right">Vigente</TableHead>
              <TableHead className="text-right">Margem de contribuição</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.dishes.map((d, i) => {
              const b = q.data.breakdowns[i]!;
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {d.name} {d.status !== "aprovado" && <StatusBadge status={d.status} />}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      className="underline-offset-4 hover:underline"
                      onClick={() => setExplain({ name: d.name, b })}
                    >
                      {brl(b.cost_per_portion)}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    {b.suggested_price ? brl(b.suggested_price) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {b.current_price ? (
                      brl(b.current_price)
                    ) : (
                      <span className="text-destructive">sem preço</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right",
                      b.below_min_margin && "font-semibold text-destructive",
                    )}
                  >
                    {b.contribution_margin_pct !== null ? pct(b.contribution_margin_pct) : "—"}
                    {b.below_min_margin && <AlertTriangle className="ml-1 inline size-4" />}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPropose({
                          dish_id: d.id,
                          name: d.name,
                          price: String(b.suggested_price ?? ""),
                          valid_from: new Date().toISOString().slice(0, 10),
                          b,
                        })
                      }
                    >
                      Propor preço
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Section>

      <Section title="Planos de assinatura (preço por kit e por plano)">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead className="w-36">Desconto</TableHead>
              <TableHead className="text-right">Margem média com desconto</TableHead>
              <TableHead>Alerta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.planMargins.map(({ plan, avg, below }) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>
                  {canApprove ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.5"
                        className="h-8 w-20"
                        defaultValue={num(plan.discount_pct * 100, 1).replace(",", ".")}
                        onBlur={(e) =>
                          discount.mutate({ id: plan.id, v: Number(e.target.value) / 100 })
                        }
                      />
                      %
                    </div>
                  ) : (
                    pct(plan.discount_pct)
                  )}
                </TableCell>
                <TableCell className="text-right">{avg !== null ? pct(avg) : "—"}</TableCell>
                <TableCell>
                  {below > 0 ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="mr-1 size-3" />
                      {below} prato(s) abaixo da margem mínima
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">ok</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Dialog open={!!propose} onOpenChange={(o) => !o && setPropose(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propor preço · {propose?.name}</DialogTitle>
          </DialogHeader>
          {propose && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                proposeM.mutate();
              }}
            >
              <p className="text-sm text-muted-foreground">
                Custo {brl(propose.b.cost_per_portion)} · sugerido {brl(propose.b.suggested_price)}
              </p>
              <Field label="Preço de venda (R$)">
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={propose.price}
                  onChange={(e) => setPropose({ ...propose, price: e.target.value })}
                />
              </Field>
              <Field label="Vale a partir de">
                <Input
                  type="date"
                  required
                  value={propose.valid_from}
                  onChange={(e) => setPropose({ ...propose, valid_from: e.target.value })}
                />
              </Field>
              <DialogFooter>
                <Button disabled={proposeM.isPending}>Enviar para aprovação</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!explain} onOpenChange={(o) => !o && setExplain(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Composição · {explain?.name}</DialogTitle>
          </DialogHeader>
          {explain && (
            <dl className="space-y-1.5 text-sm">
              {[
                ["Ingredientes (com perdas, sobre o rendimento real)", brl(explain.b.ingredients)],
                ["Embalagem", brl(explain.b.packaging)],
                ["Mão de obra de produção", brl(explain.b.labor)],
                ["Custo da porção", brl(explain.b.cost_per_portion)],
                ["Entrega rateada por porção", brl(explain.b.delivery_per_portion)],
                ["Taxa de pagamento", pct(explain.b.payment_fee_pct)],
                ["Tributos", pct(explain.b.tax_pct)],
                ["Margem de contribuição desejada", pct(explain.b.target_margin_pct)],
                ["Preço sugerido", brl(explain.b.suggested_price)],
                ["Preço vigente", explain.b.current_price ? brl(explain.b.current_price) : "—"],
                [
                  "Margem no preço vigente",
                  explain.b.contribution_margin_pct !== null
                    ? pct(explain.b.contribution_margin_pct)
                    : "—",
                ],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-4 border-b py-1 last:border-0">
                  <dt className="text-muted-foreground">{l}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
