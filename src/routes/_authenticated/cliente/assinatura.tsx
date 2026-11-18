import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Empty, Field, Loading, PageHeader, Section, StatusBadge } from "@/components/platform/ui";
import { errorText, list, rpc } from "@/lib/platform/db";
import { MEAL_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/platform/labels";
import { brl, dateBR, dateTimeBR, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cliente/assinatura")({
  component: AssinaturaPage,
});

type Plan = {
  id: string;
  name: string;
  description: string | null;
  meal_types: string[];
  discount_pct: number;
  active: boolean;
};
type Sub = {
  id: string;
  status: string;
  payment_method: string;
  paused_until: string | null;
  started_at: string;
  subscription_plans: Plan;
};

function AssinaturaPage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const [method, setMethod] = useState("cartao");
  const [pauseUntil, setPauseUntil] = useState("");

  const q = useQuery({
    queryKey: ["my-subscription"],
    queryFn: async () => {
      const [plans, subs, cycles] = await Promise.all([
        list<Plan>("subscription_plans", (x) => x.eq("active", true).order("discount_pct")),
        list<Sub>(
          "subscriptions",
          (x) => x.eq("customer_id", session.userId).order("created_at", { ascending: false }),
          "*,subscription_plans(*)",
        ),
        list<{ id: string; name: string; cutoff_at: string; status: string }>("menu_cycles", (x) =>
          x
            .in("status", ["aberto", "corte", "producao"])
            .order("cutoff_at", { ascending: false })
            .limit(6),
        ),
      ]);
      const current = subs.find((s) => s.status !== "cancelada") ?? null;
      const scycles = current
        ? await list<{
            cycle_id: string;
            status: string;
            order_id: string | null;
            note: string | null;
          }>("subscription_cycles", (x) => x.eq("subscription_id", current.id))
        : [];
      const orders = current
        ? await list<{ id: string; cycle_id: string; code: string; status: string; total: number }>(
            "orders",
            (x) => x.eq("subscription_id", current.id).not("status", "in", "(cancelado,expirado)"),
          )
        : [];
      return { plans, current, cycles, scycles, orders };
    },
  });

  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      toast.success("Assinatura atualizada");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (q.isLoading || !q.data) return <Loading />;
  const { plans, current, cycles, scycles, orders } = q.data;

  return (
    <>
      <PageHeader
        title="Assinatura"
        description="A assinatura e o pedido de cada semana são controlados separadamente: você pode pular uma semana sem cancelar o plano."
      />

      {!current ? (
        <>
          <div className="mb-4 max-w-xs">
            <Field label="Forma de pagamento">
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
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {plans
              .filter((p) => Number(p.discount_pct) > 0)
              .map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle>{p.name}</CardTitle>
                    <CardDescription>{p.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>{p.meal_types.map((m) => MEAL_LABEL[m]).join(", ")}</p>
                    <p className="text-2xl font-semibold">
                      {num(Number(p.discount_pct) * 100)}% de desconto
                    </p>
                    <p className="text-xs text-muted-foreground">
                      sobre o preço de cada prato, cobrado a cada semana
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate(() =>
                          rpc("subscribe", { p_plan_id: p.id, p_payment_method: method }),
                        )
                      }
                    >
                      Assinar
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <Section
            title={current.subscription_plans.name}
            actions={<StatusBadge status={current.status} />}
          >
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Desconto</dt>
                <dd>{num(Number(current.subscription_plans.discount_pct) * 100)}%</dd>
              </div>
              <div className="flex justify-between">
                <dt>Pagamento</dt>
                <dd>{PAYMENT_METHOD_LABEL[current.payment_method]}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Desde</dt>
                <dd>{dateBR(current.started_at)}</dd>
              </div>
              {current.paused_until && (
                <div className="flex justify-between">
                  <dt>Pausada até</dt>
                  <dd>{dateBR(current.paused_until)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <dt>Próxima cobrança</dt>
                <dd className="text-right">
                  {cycles.find((c) => c.status === "aberto")
                    ? `ao confirmar o kit de ${cycles.find((c) => c.status === "aberto")!.name}`
                    : "quando abrir o próximo cardápio"}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap items-end gap-2">
              {current.status === "ativa" && (
                <>
                  <Field label="Pausar até">
                    <Input
                      type="date"
                      value={pauseUntil}
                      onChange={(e) => setPauseUntil(e.target.value)}
                      className="w-40"
                    />
                  </Field>
                  <Button
                    variant="outline"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate(() =>
                        rpc("set_subscription_status", {
                          p_subscription_id: current.id,
                          p_action: "pausar",
                          p_until: pauseUntil || null,
                        }),
                      )
                    }
                  >
                    Pausar
                  </Button>
                </>
              )}
              {current.status === "pausada" && (
                <Button
                  disabled={act.isPending}
                  onClick={() =>
                    act.mutate(() =>
                      rpc("set_subscription_status", {
                        p_subscription_id: current.id,
                        p_action: "retomar",
                      }),
                    )
                  }
                >
                  Retomar
                </Button>
              )}
              <Button
                variant="ghost"
                className="text-destructive"
                disabled={act.isPending}
                onClick={() =>
                  confirm("Cancelar a assinatura? Pedidos já confirmados continuam valendo.") &&
                  act.mutate(() =>
                    rpc("set_subscription_status", {
                      p_subscription_id: current.id,
                      p_action: "cancelar",
                    }),
                  )
                }
              >
                Cancelar assinatura
              </Button>
            </div>
          </Section>

          <Section title="Semanas">
            {cycles.length === 0 ? (
              <Empty title="Nenhuma semana em andamento" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semana</TableHead>
                    <TableHead>Corte</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycles.map((c) => {
                    const sc = scycles.find((x) => x.cycle_id === c.id);
                    const order = orders.find((o) => o.cycle_id === c.id);
                    const beforeCutoff = new Date(c.cutoff_at) > new Date();
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{dateTimeBR(c.cutoff_at)}</TableCell>
                        <TableCell>
                          {order ? (
                            <span className="text-sm">
                              {order.code} · {brl(order.total)} ·{" "}
                              <StatusBadge status={order.status} />
                            </span>
                          ) : (
                            <StatusBadge status={sc?.status ?? "agendado"} />
                          )}
                          {sc?.note && <p className="text-xs text-destructive">{sc.note}</p>}
                        </TableCell>
                        <TableCell className="text-right">
                          {beforeCutoff && sc?.status !== "pulado" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={act.isPending}
                              onClick={() =>
                                act.mutate(() =>
                                  rpc("skip_subscription_cycle", {
                                    p_subscription_id: current.id,
                                    p_cycle_id: c.id,
                                  }),
                                )
                              }
                            >
                              Pular semana
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Section>
        </div>
      )}
    </>
  );
}
