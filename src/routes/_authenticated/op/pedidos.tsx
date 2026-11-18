import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Loading, PageHeader, StatusBadge } from "@/components/platform/ui";
import { errorText, list, rpc } from "@/lib/platform/db";
import { MEAL_LABEL, PAYMENT_METHOD_LABEL, STATUS } from "@/lib/platform/labels";
import { brl, dateTimeBR, weekdayBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/op/pedidos")({ component: OpPedidosPage });

type Order = {
  id: string;
  code: string;
  status: string;
  total: number;
  created_at: string;
  payment_method: string;
  customer_id: string;
  delivery_address: string | null;
  needs_attention: string | null;
  subscription_id: string | null;
  cancel_reason: string | null;
  menu_cycles: { name: string };
  order_items: {
    quantity: number;
    meal_type: string;
    dishes: { name: string };
    menu_cycle_days: { delivery_date: string };
  }[];
  payments: { status: string }[];
};
const NEXT: Record<string, { to: string; label: string }[]> = {
  pronto: [{ to: "separado", label: "Separado" }],
  separado: [
    { to: "em_rota", label: "Saiu para entrega" },
    { to: "entregue", label: "Retirado / entregue" },
  ],
  em_rota: [{ to: "entregue", label: "Entregue" }],
};

function OpPedidosPage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const [status, setStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["op-orders"],
    queryFn: async () => {
      const orders = await list<Order>(
        "orders",
        (x) => x.order("created_at", { ascending: false }).limit(300),
        "*,menu_cycles(name),order_items(quantity,meal_type,dishes(name),menu_cycle_days(delivery_date)),payments(status)",
      );
      const accounts = await list<{
        customer_id: string;
        full_name: string | null;
        phone: string | null;
      }>("customer_accounts", (x) =>
        x.in("customer_id", [...new Set(orders.map((o) => o.customer_id))]),
      );
      return { orders, accounts };
    },
  });
  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      toast.success("Pedido atualizado");
      qc.invalidateQueries({ queryKey: ["op-orders"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  if (q.isLoading || !q.data) return <Loading />;
  const name = (id: string) => q.data.accounts.find((a) => a.customer_id === id);
  const rows = q.data.orders.filter(
    (o) =>
      (status === "todos" || o.status === status) &&
      (!search ||
        o.code.toLowerCase().includes(search.toLowerCase()) ||
        (name(o.customer_id)?.full_name ?? "").toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title="Pedidos e entregas"
        description="Separação, entrega e cancelamentos. Cancelar antes da produção libera insumos e capacidade; depois dela, os insumos já foram consumidos."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por código ou cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {[
              "aguardando_pagamento",
              "confirmado",
              "em_producao",
              "pronto",
              "separado",
              "em_rota",
              "entregue",
              "cancelado",
              "expirado",
            ].map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS[s]?.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente / entrega</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((o) => {
              const acc = name(o.customer_id);
              return (
                <TableRow key={o.id} className="align-top">
                  <TableCell>
                    <p className="font-medium">{o.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.menu_cycles.name} · {dateTimeBR(o.created_at)}
                      {o.subscription_id && " · assinatura"}
                    </p>
                    {o.needs_attention && (
                      <p className="mt-1 text-xs font-medium text-destructive">
                        {o.needs_attention}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{acc?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {acc?.phone} {o.delivery_address}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {o.order_items.map((i, idx) => (
                      <div key={idx}>
                        {weekdayBR(i.menu_cycle_days.delivery_date)} · {MEAL_LABEL[i.meal_type]} ·{" "}
                        {i.dishes.name} ×{i.quantity}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-xs">
                    {PAYMENT_METHOD_LABEL[o.payment_method]}
                    <br />
                    <StatusBadge status={o.payments[0]?.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(o.total)}</TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                    {o.cancel_reason && (
                      <p className="mt-1 text-xs text-muted-foreground">{o.cancel_reason}</p>
                    )}
                  </TableCell>
                  <TableCell className="space-y-1 text-right">
                    {session.has("operacao") &&
                      (NEXT[o.status] ?? []).map((n) => (
                        <Button
                          key={n.to}
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() =>
                            act.mutate(() =>
                              rpc("set_order_status", { p_order_id: o.id, p_status: n.to }),
                            )
                          }
                        >
                          {n.label}
                        </Button>
                      ))}
                    {session.has("operacao") &&
                      !["cancelado", "expirado", "entregue"].includes(o.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full text-destructive"
                          onClick={() => {
                            const reason = prompt("Motivo do cancelamento");
                            if (reason)
                              act.mutate(() =>
                                rpc("cancel_order", { p_order_id: o.id, p_reason: reason }),
                              );
                          }}
                        >
                          Cancelar
                        </Button>
                      )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
