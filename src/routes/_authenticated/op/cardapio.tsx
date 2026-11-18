import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2 } from "lucide-react";

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
import { Progress } from "@/components/ui/progress";
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
import {
  Empty,
  Field,
  Forbidden,
  Loading,
  PageHeader,
  Section,
  StatusBadge,
} from "@/components/platform/ui";
import { db, errorText, list, rpc, unwrap } from "@/lib/platform/db";
import { MEAL_LABEL } from "@/lib/platform/labels";
import { brl, dateTimeBR, weekdayBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/op/cardapio")({ component: CardapioPage });

type Cycle = { id: string; name: string; sales_start: string; cutoff_at: string; status: string };

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function CardapioPage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const cycles = useQuery({
    queryKey: ["cycles"],
    queryFn: () =>
      list<Cycle>("menu_cycles", (x) => x.order("cutoff_at", { ascending: false }).limit(20)),
  });
  useEffect(() => {
    if (!cycleId && cycles.data?.[0]) setCycleId(cycles.data[0].id);
  }, [cycles.data, cycleId]);

  if (!session.has("operacao")) return <Forbidden />;
  if (cycles.isLoading) return <Loading />;

  return (
    <>
      <PageHeader
        title="Cardápio da semana"
        description="Monte o cardápio com receitas aprovadas, insumos disponíveis e compras previstas. Configure período de vendas, prazo de corte, capacidade por dia e limites por prato."
        actions={
          <>
            {cycles.data && cycles.data.length > 0 && (
              <Select value={cycleId ?? ""} onValueChange={setCycleId}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cycles.data.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-2 size-4" /> Nova semana
            </Button>
          </>
        }
      />
      {!cycleId ? (
        <Empty title="Nenhuma semana cadastrada" />
      ) : (
        <CycleEditor key={cycleId} cycleId={cycleId} />
      )}
      <NewCycle
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCycleId(id);
          qc.invalidateQueries({ queryKey: ["cycles"] });
        }}
      />
    </>
  );
}

function CycleEditor({ cycleId }: { cycleId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cycle", cycleId],
    queryFn: async () => {
      const [cycle] = await list<Cycle>("menu_cycles", (x) => x.eq("id", cycleId));
      const [days, items, dishes, cap] = await Promise.all([
        list<{
          id: string;
          production_date: string;
          delivery_date: string;
          capacity_portions: number;
        }>("menu_cycle_days", (x) => x.eq("cycle_id", cycleId).order("delivery_date")),
        list<{
          id: string;
          dish_id: string;
          max_portions: number | null;
          dishes: { name: string; meal_type: string; status: string };
        }>("menu_items", (x) => x.eq("cycle_id", cycleId), "*,dishes(name,meal_type,status)"),
        list<{ id: string; name: string; meal_type: string }>("dishes", (x) =>
          x.eq("status", "aprovado").order("name"),
        ),
        list<{ cycle_day_id: string; used_portions: number; capacity_portions: number }>(
          "v_cycle_capacity",
          (x) => x.eq("cycle_id", cycleId),
        ),
      ]);
      const sold = await list<{
        dish_id: string;
        quantity: number;
        orders: { status: string; cycle_id: string };
      }>(
        "order_items",
        (x) => x.eq("orders.cycle_id", cycleId).not("orders.status", "in", "(cancelado,expirado)"),
        "dish_id,quantity,orders!inner(status,cycle_id)",
      );
      const prices = await list<{ dish_id: string; price: number; valid_from: string }>(
        "dish_prices",
        (x) => x.eq("status", "aprovado").order("valid_from", { ascending: false }),
      );
      return { cycle: cycle!, days, items, dishes, cap, sold, prices };
    },
  });
  const run = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: (r) => {
      if (r && typeof r === "object" && !Array.isArray(r))
        toast.success(
          Object.entries(r as object)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · "),
        );
      else toast.success("Atualizado");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const [addDish, setAddDish] = useState("");

  if (q.isLoading || !q.data) return <Loading />;
  const { cycle, days, items, dishes, cap, sold, prices } = q.data;
  const soldBy = (id: string) =>
    sold.filter((s) => s.dish_id === id).reduce((a, b) => a + b.quantity, 0);
  const priceOf = (id: string) => prices.find((p) => p.dish_id === id)?.price;
  const firstProduction = days[0]?.production_date;

  const suggest = async () => {
    if (!firstProduction) {
      toast.error("Cadastre os dias da semana primeiro");
      return;
    }
    const missing = dishes.filter((d) => !items.some((i) => i.dish_id === d.id));
    let added = 0;
    for (const d of missing) {
      const ok = await rpc<boolean>("dish_stock_ok", {
        p_dish_id: d.id,
        p_portions: 20,
        p_needed_by: firstProduction,
      });
      if (ok && priceOf(d.id)) {
        unwrap(await db.from("menu_items").insert({ cycle_id: cycleId, dish_id: d.id }));
        added++;
      }
    }
    toast.success(
      added
        ? `${added} pratos adicionados (aprovados, com preço e insumo para ao menos 20 porções)`
        : "Nenhum prato novo atende aos critérios",
    );
    qc.invalidateQueries({ queryKey: ["cycle", cycleId] });
  };

  return (
    <div className="space-y-6">
      <Section title={cycle.name} actions={<StatusBadge status={cycle.status} />}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Início das vendas">
            <Input
              type="datetime-local"
              defaultValue={toLocalInput(cycle.sales_start)}
              className="w-52"
              onBlur={(e) =>
                run.mutate(async () =>
                  unwrap(
                    await db
                      .from("menu_cycles")
                      .update({ sales_start: new Date(e.target.value).toISOString() })
                      .eq("id", cycleId),
                  ),
                )
              }
            />
          </Field>
          <Field label="Prazo de corte">
            <Input
              type="datetime-local"
              defaultValue={toLocalInput(cycle.cutoff_at)}
              className="w-52"
              onBlur={(e) =>
                run.mutate(async () =>
                  unwrap(
                    await db
                      .from("menu_cycles")
                      .update({ cutoff_at: new Date(e.target.value).toISOString() })
                      .eq("id", cycleId),
                  ),
                )
              }
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {cycle.status === "rascunho" && (
              <Button
                disabled={!items.length || !days.length}
                onClick={() =>
                  run.mutate(async () =>
                    unwrap(
                      await db.from("menu_cycles").update({ status: "aberto" }).eq("id", cycleId),
                    ),
                  )
                }
              >
                Abrir vendas
              </Button>
            )}
            {cycle.status === "aberto" && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    run.mutate(() => rpc("generate_subscription_orders", { p_cycle_id: cycleId }))
                  }
                >
                  Gerar pedidos das assinaturas
                </Button>
                <Button
                  onClick={() =>
                    confirm(
                      "Fazer o corte agora? Pedidos não pagos expiram e liberam a reserva.",
                    ) && run.mutate(() => rpc("close_cycle", { p_cycle_id: cycleId }))
                  }
                >
                  Fazer corte
                </Button>
              </>
            )}
            {["corte", "producao"].includes(cycle.status) && (
              <Button
                variant="outline"
                onClick={() =>
                  run.mutate(async () =>
                    unwrap(
                      await db
                        .from("menu_cycles")
                        .update({ status: "encerrado" })
                        .eq("id", cycleId),
                    ),
                  )
                }
              >
                Encerrar semana
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Vendas: {dateTimeBR(cycle.sales_start)} → corte {dateTimeBR(cycle.cutoff_at)}
        </p>
      </Section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Section title="Dias e capacidade de produção">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entrega</TableHead>
                <TableHead>Produção</TableHead>
                <TableHead className="w-28">Capacidade</TableHead>
                <TableHead>Ocupação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((d) => {
                const c = cap.find((x) => x.cycle_day_id === d.id);
                const pct =
                  c && c.capacity_portions ? (100 * c.used_portions) / c.capacity_portions : 0;
                return (
                  <TableRow key={d.id}>
                    <TableCell>{weekdayBR(d.delivery_date)}</TableCell>
                    <TableCell>{weekdayBR(d.production_date)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="h-8"
                        defaultValue={d.capacity_portions}
                        onBlur={(e) =>
                          Number(e.target.value) !== d.capacity_portions &&
                          run.mutate(async () =>
                            unwrap(
                              await db
                                .from("menu_cycle_days")
                                .update({ capacity_portions: Number(e.target.value) })
                                .eq("id", d.id),
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="min-w-28">
                      <Progress value={pct} className="h-2" />
                      <span className="text-xs text-muted-foreground">
                        {c?.used_portions ?? 0} porções
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Section>

        <Section
          title="Pratos do cardápio"
          actions={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={suggest}>
                <Sparkles className="mr-1 size-4" /> Sugerir pelo estoque
              </Button>
              <Select
                value={addDish}
                onValueChange={(v) => {
                  setAddDish("");
                  run.mutate(async () =>
                    unwrap(await db.from("menu_items").insert({ cycle_id: cycleId, dish_id: v })),
                  );
                }}
              >
                <SelectTrigger className="h-8 w-48">
                  <SelectValue placeholder="Adicionar prato…" />
                </SelectTrigger>
                <SelectContent>
                  {dishes
                    .filter((d) => !items.some((i) => i.dish_id === d.id))
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prato</TableHead>
                <TableHead>Refeição</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="w-28">Máx. porções</TableHead>
                <TableHead className="text-right">Vendidas</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">
                    {i.dishes.name}
                    {i.dishes.status !== "aprovado" && (
                      <Badge variant="destructive" className="ml-2">
                        fora do ar: {i.dishes.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{MEAL_LABEL[i.dishes.meal_type]}</TableCell>
                  <TableCell className="text-right">
                    {priceOf(i.dish_id) ? (
                      brl(priceOf(i.dish_id))
                    ) : (
                      <span className="text-destructive">sem preço</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="h-8"
                      placeholder="sem limite"
                      defaultValue={i.max_portions ?? ""}
                      onBlur={(e) =>
                        run.mutate(async () =>
                          unwrap(
                            await db
                              .from("menu_items")
                              .update({
                                max_portions: e.target.value === "" ? null : Number(e.target.value),
                              })
                              .eq("id", i.id),
                          ),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{soldBy(i.dish_id)}</TableCell>
                  <TableCell>
                    {soldBy(i.dish_id) === 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          run.mutate(async () =>
                            unwrap(await db.from("menu_items").delete().eq("id", i.id)),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      </div>
    </div>
  );
}

function NewCycle({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const nextMonday = (() => {
    const d = new Date();
    d.setDate(d.getDate() + ((8 - (d.getDay() || 7)) % 7 || 7));
    return d.toISOString().slice(0, 10);
  })();
  const [f, setF] = useState({
    monday: nextMonday,
    days: 5,
    capacity: 300,
    leadDays: 1,
    cutoffHour: "12:00",
  });
  const m = useMutation({
    mutationFn: async () => {
      const monday = new Date(`${f.monday}T12:00:00`);
      const cutoff = new Date(`${f.monday}T${f.cutoffHour}:00`);
      cutoff.setDate(cutoff.getDate() - f.leadDays - 1);
      const name = `Semana ${monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
      const c = unwrap<{ id: string }>(
        await db
          .from("menu_cycles")
          .insert({ name, sales_start: new Date().toISOString(), cutoff_at: cutoff.toISOString() })
          .select("id")
          .single(),
      );
      const rows = Array.from({ length: f.days }, (_, i) => {
        const delivery = new Date(monday);
        delivery.setDate(monday.getDate() + i);
        const production = new Date(delivery);
        production.setDate(delivery.getDate() - f.leadDays);
        return {
          cycle_id: c.id,
          delivery_date: delivery.toISOString().slice(0, 10),
          production_date: production.toISOString().slice(0, 10),
          capacity_portions: f.capacity,
        };
      });
      unwrap(await db.from("menu_cycle_days").insert(rows));
      return c.id;
    },
    onSuccess: (id) => {
      toast.success("Semana criada em rascunho. Adicione os pratos e abra as vendas.");
      onClose();
      onCreated(id);
    },
    onError: (e) => toast.error(errorText(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova semana</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <Field label="Primeira entrega (segunda)">
            <Input
              type="date"
              value={f.monday}
              onChange={(e) => setF({ ...f, monday: e.target.value })}
            />
          </Field>
          <Field label="Dias de entrega">
            <Input
              type="number"
              min={1}
              max={6}
              value={f.days}
              onChange={(e) => setF({ ...f, days: Number(e.target.value) })}
            />
          </Field>
          <Field label="Capacidade por dia (porções)">
            <Input
              type="number"
              value={f.capacity}
              onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })}
            />
          </Field>
          <Field label="Produção quantos dias antes">
            <Input
              type="number"
              min={0}
              max={3}
              value={f.leadDays}
              onChange={(e) => setF({ ...f, leadDays: Number(e.target.value) })}
            />
          </Field>
          <Field label="Corte no dia anterior à 1ª produção, às" className="sm:col-span-2">
            <Input
              type="time"
              value={f.cutoffHour}
              onChange={(e) => setF({ ...f, cutoffHour: e.target.value })}
            />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button disabled={m.isPending}>Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
