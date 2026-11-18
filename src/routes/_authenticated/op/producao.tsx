import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Play, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, Loading, PageHeader, Section, StatusBadge } from "@/components/platform/ui";
import { errorText, list, rpc } from "@/lib/platform/db";
import { MEAL_LABEL } from "@/lib/platform/labels";
import { num, qty, weekdayBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/op/producao")({ component: ProducaoPage });

type Plan = {
  cycle_day_id: string;
  production_date: string;
  delivery_date: string;
  dish_id: string;
  dish_name: string;
  meal_type: string;
  portions: number;
  orders: number;
  batch_id: string | null;
  batch_lot_code: string | null;
  batch_status: string | null;
};
type PI = {
  cycle_day_id: string;
  dish_id: string;
  dish_name: string;
  portions: number;
  ingredient_name: string;
  usage_unit: string;
  gross_quantity: number;
  prep_loss_pct: number;
};
type Shop = {
  ingredient_name: string;
  usage_unit: string;
  purchase_unit: string;
  conversion_factor: number;
  needed: number;
  reserved_in_stock: number;
  awaiting_purchase: number;
  consumed: number;
  first_needed_by: string | null;
};

function ProducaoPage() {
  const qc = useQueryClient();
  const cycles = useQuery({
    queryKey: ["cycles-prod"],
    queryFn: () =>
      list<{ id: string; name: string; status: string }>("menu_cycles", (x) =>
        x.neq("status", "rascunho").order("cutoff_at", { ascending: false }).limit(10),
      ),
  });
  const [cycleId, setCycleId] = useState<string | null>(null);
  useEffect(() => {
    if (!cycleId && cycles.data?.[0]) setCycleId(cycles.data[0].id);
  }, [cycles.data, cycleId]);
  const [day, setDay] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["production", cycleId],
    enabled: !!cycleId,
    queryFn: async () => ({
      plan: await list<Plan>("v_production_plan", (x) =>
        x.eq("cycle_id", cycleId).order("production_date").order("dish_name"),
      ),
      ingredients: await list<PI>("v_production_ingredients", (x) => x.eq("cycle_id", cycleId)),
      shopping: await list<Shop>("v_shopping_list", (x) =>
        x.eq("cycle_id", cycleId).order("ingredient_name"),
      ),
      batches: await list<{ id: string; lot_code: string; portions_planned: number }>(
        "production_batches",
        (x) => x.eq("status", "em_producao"),
      ),
    }),
  });
  const days = useMemo(
    () => [...new Map((q.data?.plan ?? []).map((p) => [p.cycle_day_id, p])).values()],
    [q.data?.plan],
  );
  useEffect(() => {
    if (days[0] && !days.some((d) => d.cycle_day_id === day)) setDay(days[0].cycle_day_id);
  }, [days, day]);
  const restrictions = useQuery({
    queryKey: ["kitchen-restrictions", day],
    enabled: !!day,
    queryFn: () =>
      rpc<
        {
          order_code: string;
          customer_label: string;
          dish_name: string;
          quantity: number;
          allergies: string[];
          restrictions: string[];
        }[]
      >("kitchen_restrictions", { p_cycle_day_id: day }),
  });

  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      toast.success("Produção atualizada");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (cycles.isLoading) return <Loading />;
  const cycle = cycles.data?.find((c) => c.id === cycleId);
  const dayPlan = (q.data?.plan ?? []).filter((p) => p.cycle_day_id === day);
  const dayIngredients = (q.data?.ingredients ?? []).filter((p) => p.cycle_day_id === day);

  return (
    <>
      <PageHeader
        title="Produção"
        description="Depois do corte: porções por prato e dia, ordem de produção pela ficha técnica, lista de compras e lote de cada preparo."
        actions={
          <Select value={cycleId ?? ""} onValueChange={setCycleId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Semana" />
            </SelectTrigger>
            <SelectContent>
              {(cycles.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {cycle?.status === "aberto" && (
        <p className="mb-4 rounded-lg bg-warning/15 p-3 text-sm">
          As vendas desta semana ainda estão abertas: os números abaixo podem mudar até o corte.
        </p>
      )}
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.plan.length ? (
        <Empty title="Sem pedidos confirmados nesta semana" />
      ) : (
        <Tabs defaultValue="plano">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TabsList>
              <TabsTrigger value="plano">Porções e lotes</TabsTrigger>
              <TabsTrigger value="ordem">Ordem de produção</TabsTrigger>
              <TabsTrigger value="restricoes">Restrições</TabsTrigger>
              <TabsTrigger value="compras">Lista de compras</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap gap-1">
              {days.map((d) => (
                <Button
                  key={d.cycle_day_id}
                  size="sm"
                  variant={d.cycle_day_id === day ? "default" : "outline"}
                  onClick={() => setDay(d.cycle_day_id)}
                >
                  Produção {weekdayBR(d.production_date)}
                </Button>
              ))}
            </div>
          </div>

          <TabsContent value="plano" className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prato</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead className="text-right">Porções</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayPlan.map((p) => (
                  <TableRow key={p.dish_id}>
                    <TableCell className="font-medium">
                      {p.dish_name}{" "}
                      <Badge variant="secondary" className="ml-1">
                        {MEAL_LABEL[p.meal_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{weekdayBR(p.delivery_date)}</TableCell>
                    <TableCell className="text-right text-lg font-semibold tabular-nums">
                      {p.portions}
                    </TableCell>
                    <TableCell className="text-right">{p.orders}</TableCell>
                    <TableCell>
                      {p.batch_lot_code ? (
                        <span className="font-mono text-sm">{p.batch_lot_code}</span>
                      ) : (
                        "—"
                      )}{" "}
                      {p.batch_status && <StatusBadge status={p.batch_status} />}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {!p.batch_id && (
                        <Button
                          size="sm"
                          onClick={() =>
                            act.mutate(() =>
                              rpc("start_production", {
                                p_cycle_day_id: p.cycle_day_id,
                                p_dish_id: p.dish_id,
                              }),
                            )
                          }
                        >
                          <Play className="mr-1 size-4" />
                          Iniciar lote
                        </Button>
                      )}
                      {p.batch_status === "em_producao" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const v = prompt("Porções efetivamente produzidas", String(p.portions));
                            if (v)
                              act.mutate(() =>
                                rpc("complete_batch", {
                                  p_batch_id: p.batch_id,
                                  p_portions_produced: Number(v),
                                }),
                              );
                          }}
                        >
                          Concluir
                        </Button>
                      )}
                      {p.batch_id && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/op/etiquetas" search={{ lote: p.batch_id }}>
                            <Printer className="mr-1 size-4" />
                            Etiquetas
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="ordem" className="space-y-4">
            {[...new Set(dayIngredients.map((i) => i.dish_id))].map((dishId) => {
              const rows = dayIngredients.filter((i) => i.dish_id === dishId);
              return (
                <Section
                  key={dishId}
                  title={`${rows[0]!.dish_name} · ${rows[0]!.portions} ${rows[0]!.portions === 1 ? "porção" : "porções"}`}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingrediente</TableHead>
                        <TableHead className="text-right">Peso bruto</TableHead>
                        <TableHead className="text-right">Perda prevista</TableHead>
                        <TableHead className="text-right">Peso líquido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.ingredient_name}>
                          <TableCell>{r.ingredient_name}</TableCell>
                          <TableCell className="text-right font-medium">
                            {qty(r.gross_quantity, r.usage_unit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {num(r.prep_loss_pct * 100)}%
                          </TableCell>
                          <TableCell className="text-right">
                            {qty(r.gross_quantity * (1 - r.prep_loss_pct), r.usage_unit)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Section>
              );
            })}
          </TabsContent>

          <TabsContent value="restricoes">
            <Section title="Pedidos com alergia ou restrição neste dia">
              {restrictions.isLoading ? (
                <Loading />
              ) : !restrictions.data?.length ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido com restrições.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Prato</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead>Alergias</TableHead>
                      <TableHead>Restrições</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {restrictions.data.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.customer_label}</TableCell>
                        <TableCell>{r.dish_name}</TableCell>
                        <TableCell className="text-right">{r.quantity}</TableCell>
                        <TableCell>
                          {r.allergies.map((a) => (
                            <Badge key={a} variant="destructive" className="mr-1">
                              <AlertTriangle className="mr-1 size-3" />
                              {a}
                            </Badge>
                          ))}
                        </TableCell>
                        <TableCell>{r.restrictions.join(", ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                A cozinha vê só o necessário para o preparo seguro. Peso, altura e objetivos do
                cliente não aparecem aqui.
              </p>
            </Section>
          </TabsContent>

          <TabsContent value="compras" className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead className="text-right">Necessário na semana</TableHead>
                  <TableHead className="text-right">Já em estoque</TableHead>
                  <TableHead className="text-right">Consumido</TableHead>
                  <TableHead className="text-right">Aguardando compra</TableHead>
                  <TableHead>Precisa até</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.shopping.map((s) => (
                  <TableRow key={s.ingredient_name}>
                    <TableCell className="font-medium">{s.ingredient_name}</TableCell>
                    <TableCell className="text-right">{qty(s.needed, s.usage_unit)}</TableCell>
                    <TableCell className="text-right">
                      {qty(s.reserved_in_stock, s.usage_unit)}
                    </TableCell>
                    <TableCell className="text-right">{qty(s.consumed, s.usage_unit)}</TableCell>
                    <TableCell
                      className={
                        Number(s.awaiting_purchase) > 0
                          ? "text-right font-semibold text-warning-foreground dark:text-warning"
                          : "text-right"
                      }
                    >
                      {Number(s.awaiting_purchase) > 0
                        ? `${qty(s.awaiting_purchase, s.usage_unit)} (${num(s.awaiting_purchase / s.conversion_factor, 2)} ${s.purchase_unit})`
                        : "—"}
                    </TableCell>
                    <TableCell>{s.first_needed_by ? weekdayBR(s.first_needed_by) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
