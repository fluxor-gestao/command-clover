import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Info, Minus, Plus, RefreshCw, Repeat2, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Empty, Loading, PageHeader, Section, StatusBadge } from "@/components/platform/ui";
import { errorText, list, rpc } from "@/lib/platform/db";
import { MEAL_LABEL, MEAL_TYPES, PAYMENT_METHOD_LABEL, tagLabel } from "@/lib/platform/labels";
import { brl, dateBR, dateTimeBR, num, weekdayBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DishDetail } from "@/components/platform/DishDetail";

export const Route = createFileRoute("/_authenticated/cliente/kit")({ component: KitPage });

type Cycle = { id: string; name: string; cutoff_at: string; sales_start: string; status: string };
type Day = { id: string; delivery_date: string; production_date: string };
type KitLine = {
  cycle_day_id: string;
  delivery_date: string;
  meal_type: string;
  dish_id: string;
  dish_name: string;
  price: number;
  quantity: number;
};
type Eligible = {
  dish_id: string;
  dish_name: string;
  meal_type: string;
  description: string | null;
  tags: string[];
  price: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion_weight_g: number;
  allergens: string[];
  may_contain: string[];
  compatible: boolean;
  reason: string | null;
  remaining: number;
};

function KitPage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const base = useQuery({
    queryKey: ["kit-base"],
    queryFn: async () => {
      const cycles = await list<Cycle>("menu_cycles", (q) =>
        q
          .eq("status", "aberto")
          .gt("cutoff_at", new Date().toISOString())
          .order("cutoff_at")
          .limit(1),
      );
      const cycle = cycles[0] ?? null;
      const [days, subs, upcoming, orders] = await Promise.all([
        cycle
          ? list<Day>("menu_cycle_days", (q) => q.eq("cycle_id", cycle.id).order("delivery_date"))
          : [],
        list<{
          id: string;
          status: string;
          payment_method: string;
          subscription_plans: { name: string; discount_pct: number };
        }>(
          "subscriptions",
          (q) =>
            q.eq("customer_id", session.userId).in("status", ["ativa", "pausada", "inadimplente"]),
          "id,status,payment_method,subscription_plans(name,discount_pct)",
        ),
        list<{
          dish_name: string;
          new_price: number;
          current_price: number | null;
          valid_from: string;
        }>("v_upcoming_price_changes"),
        cycle
          ? list<{ id: string; code: string; status: string; total: number }>("orders", (q) =>
              q
                .eq("cycle_id", cycle.id)
                .eq("customer_id", session.userId)
                .not("status", "in", "(cancelado,expirado)"),
            )
          : [],
      ]);
      return { cycle, days, sub: subs[0] ?? null, upcoming, orders };
    },
  });

  const cycle = base.data?.cycle;
  const suggestion = useQuery({
    queryKey: ["kit-suggestion", cycle?.id],
    enabled: !!cycle,
    queryFn: () => rpc<Omit<KitLine, "quantity">[]>("suggest_kit", { p_cycle_id: cycle!.id }),
  });

  const [kit, setKit] = useState<KitLine[]>([]);
  const [useSub, setUseSub] = useState(true);
  const [method, setMethod] = useState("cartao");
  const [swap, setSwap] = useState<{
    index: number | null;
    cycle_day_id: string;
    delivery_date: string;
    meal_type: string;
  } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    if (suggestion.data)
      setKit(suggestion.data.map((s) => ({ ...s, price: Number(s.price), quantity: 1 })));
  }, [suggestion.data]);
  useEffect(() => {
    if (base.data?.sub) setMethod(base.data.sub.payment_method);
  }, [base.data?.sub]);

  const sub = base.data?.sub;
  const discountPct =
    useSub && sub?.status === "ativa" ? Number(sub.subscription_plans.discount_pct) : 0;
  const subtotal = kit.reduce((s, l) => s + l.price * l.quantity, 0);
  const discount = Math.round(subtotal * discountPct * 100) / 100;
  const total = subtotal - discount;

  const byDay = useMemo(() => {
    const m = new Map<string, { day: Day; lines: { line: KitLine; index: number }[] }>();
    (base.data?.days ?? []).forEach((d) => m.set(d.id, { day: d, lines: [] }));
    kit.forEach((line, index) => m.get(line.cycle_day_id)?.lines.push({ line, index }));
    return [...m.values()];
  }, [kit, base.data?.days]);

  const place = useMutation({
    mutationFn: () =>
      rpc<string>("place_order", {
        p_cycle_id: cycle!.id,
        p_items: kit.map((l) => ({
          cycle_day_id: l.cycle_day_id,
          dish_id: l.dish_id,
          quantity: l.quantity,
        })),
        p_payment_method: method,
        p_subscription_id: useSub && sub?.status === "ativa" ? sub.id : null,
      }),
    onSuccess: () => {
      toast.success(
        "Pedido criado. Insumos e capacidade reservados enquanto o pagamento é confirmado.",
      );
      qc.invalidateQueries();
      navigate({ to: "/cliente/pedidos" });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (base.isLoading) return <Loading />;
  if (!cycle)
    return (
      <>
        <PageHeader title="Kit da semana" />
        <Empty title="Nenhum cardápio aberto agora">
          O próximo cardápio aparece aqui assim que as vendas abrirem.
        </Empty>
      </>
    );

  const existing = base.data!.orders[0];

  return (
    <>
      <PageHeader
        title={`Kit da semana · ${cycle.name}`}
        description="Sugestão montada pelo seu perfil, preferências, restrições e pelo que a cozinha tem disponível. Troque o que quiser antes de confirmar."
        actions={
          <Button
            variant="outline"
            onClick={() => suggestion.refetch()}
            disabled={suggestion.isFetching}
          >
            <RefreshCw className="mr-2 size-4" /> Refazer sugestão
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">Prazo de corte: {dateTimeBR(cycle.cutoff_at)}</Badge>
        <span>Até o corte você pode editar, pular ou cancelar.</span>
        <Link to="/cliente/perfil" className="text-primary underline-offset-4 hover:underline">
          Ajustar perfil
        </Link>
      </div>

      {existing && (
        <Alert className="mb-4">
          <Info className="size-4" />
          <AlertTitle>Você já tem um pedido nesta semana</AlertTitle>
          <AlertDescription>
            {existing.code} · {brl(existing.total)} · <StatusBadge status={existing.status} />. Para
            mudar o kit, cancele o pedido em{" "}
            <Link to="/cliente/pedidos" className="underline">
              Pedidos e cobranças
            </Link>{" "}
            antes do corte e confirme um novo.
          </AlertDescription>
        </Alert>
      )}

      {base.data!.upcoming.length > 0 && (
        <Alert className="mb-4">
          <AlertTriangle className="size-4" />
          <AlertTitle>Mudanças de preço programadas</AlertTitle>
          <AlertDescription>
            {base.data!.upcoming.map((u) => (
              <div key={u.dish_name + u.valid_from}>
                {u.dish_name}: {u.current_price ? brl(u.current_price) : "—"} → {brl(u.new_price)} a
                partir de {dateBR(u.valid_from)}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {suggestion.isLoading && <Loading label="Montando sugestão…" />}
          {suggestion.data && kit.length === 0 && (
            <Empty title="Não encontramos pratos compatíveis com o seu perfil nesta semana">
              Revise os dias e refeições no perfil, ou adicione pratos manualmente abaixo.
            </Empty>
          )}
          {byDay.map(({ day, lines }) => (
            <Section
              key={day.id}
              title={weekdayBR(day.delivery_date)}
              actions={
                <Select
                  onValueChange={(mt) =>
                    setSwap({
                      index: null,
                      cycle_day_id: day.id,
                      delivery_date: day.delivery_date,
                      meal_type: mt,
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-[150px]">
                    <SelectValue placeholder="Adicionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_TYPES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MEAL_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            >
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem refeições neste dia.</p>
              ) : (
                <ul className="divide-y">
                  {lines.map(({ line, index }) => (
                    <li key={index} className="flex flex-wrap items-center gap-3 py-3">
                      <Badge variant="secondary" className="w-16 justify-center">
                        {MEAL_LABEL[line.meal_type]}
                      </Badge>
                      <button
                        className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
                        onClick={() => setDetail(line.dish_id)}
                      >
                        {line.dish_name}
                      </button>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Diminuir"
                          onClick={() =>
                            setKit(
                              kit.map((l, i) =>
                                i === index ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l,
                              ),
                            )
                          }
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-6 text-center tabular-nums">{line.quantity}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Aumentar"
                          onClick={() =>
                            setKit(
                              kit.map((l, i) =>
                                i === index ? { ...l, quantity: l.quantity + 1 } : l,
                              ),
                            )
                          }
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <span className="w-20 text-right tabular-nums">
                        {brl(line.price * line.quantity)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSwap({
                            index,
                            cycle_day_id: line.cycle_day_id,
                            delivery_date: line.delivery_date,
                            meal_type: line.meal_type,
                          })
                        }
                      >
                        <Repeat2 className="mr-1 size-4" /> Trocar
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Remover"
                        onClick={() => setKit(kit.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ))}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Section title="Resumo">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Refeições</dt>
                <dd className="tabular-nums">{kit.reduce((s, l) => s + l.quantity, 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{brl(subtotal)}</dd>
              </div>
              {discountPct > 0 && (
                <div className="flex justify-between text-success-foreground dark:text-success">
                  <dt>
                    Desconto {sub?.subscription_plans.name} ({num(discountPct * 100)}%)
                  </dt>
                  <dd className="tabular-nums">−{brl(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{brl(total)}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-3">
              {sub && (
                <label className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    Usar minha assinatura ({sub.subscription_plans.name})
                    {sub.status !== "ativa" && ` — ${sub.status}`}
                  </span>
                  <Switch
                    checked={useSub && sub.status === "ativa"}
                    disabled={sub.status !== "ativa"}
                    onCheckedChange={setUseSub}
                  />
                </label>
              )}
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                disabled={!kit.length || place.isPending || !!existing}
                onClick={() => place.mutate()}
              >
                {place.isPending ? "Reservando…" : `Confirmar kit · ${brl(total)}`}
              </Button>
              <p className="text-xs text-muted-foreground">
                O preço fica registrado no pedido. Os dados do cartão são tratados pelo provedor de
                pagamento, nunca por nós.
              </p>
            </div>
          </Section>
        </div>
      </div>

      <SwapDialog
        target={swap}
        onClose={() => setSwap(null)}
        onPick={(e) => {
          if (!swap) return;
          const line: KitLine = {
            cycle_day_id: swap.cycle_day_id,
            delivery_date: swap.delivery_date,
            meal_type: e.meal_type,
            dish_id: e.dish_id,
            dish_name: e.dish_name,
            price: Number(e.price),
            quantity: 1,
          };
          setKit(
            swap.index === null
              ? [...kit, line]
              : kit.map((l, i) => (i === swap.index ? { ...line, quantity: l.quantity } : l)),
          );
          setSwap(null);
        }}
        onDetail={setDetail}
      />
      <DishDetail dishId={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function SwapDialog({
  target,
  onClose,
  onPick,
  onDetail,
}: {
  target: { cycle_day_id: string; delivery_date: string; meal_type: string } | null;
  onClose: () => void;
  onPick: (e: Eligible) => void;
  onDetail: (id: string) => void;
}) {
  const q = useQuery({
    queryKey: ["eligible", target?.cycle_day_id, target?.meal_type],
    enabled: !!target,
    queryFn: () =>
      rpc<Eligible[]>("eligible_dishes", {
        p_cycle_day_id: target!.cycle_day_id,
        p_meal_type: target!.meal_type,
      }),
  });
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {target && `${MEAL_LABEL[target.meal_type]} · ${weekdayBR(target.delivery_date)}`}
          </DialogTitle>
          <DialogDescription>
            Pratos bloqueados para o seu perfil aparecem com o motivo e não podem ser escolhidos.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading && <Loading />}
        <ul className="space-y-2">
          {q.data?.map((e) => (
            <li
              key={e.dish_id}
              className={cn("rounded-lg border p-3", !e.compatible && "bg-muted/50 opacity-70")}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <button
                    className="text-left font-medium hover:underline"
                    onClick={() => onDetail(e.dish_id)}
                  >
                    {e.dish_name}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {num(e.portion_weight_g)} g · {num(e.kcal)} kcal · P {num(e.protein_g)} g · C{" "}
                    {num(e.carbs_g)} g · G {num(e.fat_g)} g
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {e.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        {tagLabel(t)}
                      </Badge>
                    ))}
                  </div>
                  {!e.compatible && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                      <AlertTriangle className="size-3" /> {e.reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">{e.price ? brl(e.price) : "—"}</span>
                  <Button size="sm" disabled={!e.compatible} onClick={() => onPick(e)}>
                    Escolher
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
