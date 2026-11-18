import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Empty, Loading, PageHeader, Section, StatusBadge } from "@/components/platform/ui";
import { db, errorText, list, rpc } from "@/lib/platform/db";
import { MEAL_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/platform/labels";
import { brl, dateTimeBR, weekdayBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cliente/pedidos")({ component: PedidosPage });

type Order = {
  id: string;
  code: string;
  status: string;
  total: number;
  subtotal: number;
  discount: number;
  created_at: string;
  pricing_snapshot: { conditions?: string; cutoff_at?: string };
  menu_cycles: { name: string; cutoff_at: string };
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    meal_type: string;
    dishes: { name: string };
    menu_cycle_days: { delivery_date: string };
  }[];
  payments: {
    id: string;
    status: string;
    method: string;
    amount: number;
    paid_at: string | null;
    receipt_url: string | null;
    attempts: number;
    next_retry_at: string | null;
    expires_at: string | null;
  }[];
};

function PedidosPage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => ({
      orders: await list<Order>(
        "orders",
        (x) => x.eq("customer_id", session.userId).order("created_at", { ascending: false }),
        "*,menu_cycles(name,cutoff_at),order_items(id,quantity,unit_price,meal_type,dishes(name),menu_cycle_days(delivery_date)),payments(*)",
      ),
      notifications: await list<{
        id: string;
        message: string;
        created_at: string;
        read_at: string | null;
      }>("notifications", (x) =>
        x.eq("customer_id", session.userId).order("created_at", { ascending: false }).limit(10),
      ),
    }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      rpc("cancel_order", { p_order_id: id, p_reason: "Cancelado pelo cliente" }),
    onSuccess: () => {
      toast.success("Pedido cancelado e reserva liberada");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const markRead = useMutation({
    mutationFn: async () =>
      db
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null)
        .eq("customer_id", session.userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-orders"] }),
  });

  if (q.isLoading || !q.data) return <Loading />;
  const unread = q.data.notifications.filter((n) => !n.read_at);
  const payments = q.data.orders.flatMap((o) => o.payments.map((p) => ({ ...p, order: o })));

  return (
    <>
      <PageHeader
        title="Pedidos e cobranças"
        description="Acompanhe cada pedido semanal, o status do pagamento e os comprovantes."
      />

      {unread.length > 0 && (
        <Section
          title="Avisos"
          className="mb-6"
          actions={
            <Button size="sm" variant="ghost" onClick={() => markRead.mutate()}>
              Marcar como lidos
            </Button>
          }
        >
          <ul className="space-y-1 text-sm">
            {unread.map((n) => (
              <li key={n.id} className="flex gap-2">
                <Bell className="mt-0.5 size-4 text-warning" />
                {n.message}{" "}
                <span className="text-xs text-muted-foreground">{dateTimeBR(n.created_at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {q.data.orders.length === 0 ? (
        <Empty title="Você ainda não fez pedidos" />
      ) : (
        <div className="space-y-4">
          {q.data.orders.map((o) => {
            const canCancel =
              ["aguardando_pagamento", "confirmado"].includes(o.status) &&
              new Date(o.menu_cycles.cutoff_at) > new Date();
            const pay = o.payments[0];
            return (
              <Section
                key={o.id}
                title={`${o.code} · ${o.menu_cycles.name}`}
                actions={
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} />
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={cancel.isPending}
                        onClick={() =>
                          confirm("Cancelar este pedido? A reserva será liberada.") &&
                          cancel.mutate(o.id)
                        }
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                }
              >
                <ul className="divide-y text-sm">
                  {o.order_items
                    .sort((a, b) =>
                      a.menu_cycle_days.delivery_date.localeCompare(
                        b.menu_cycle_days.delivery_date,
                      ),
                    )
                    .map((i) => (
                      <li key={i.id} className="flex justify-between gap-2 py-1.5">
                        <span>
                          {weekdayBR(i.menu_cycle_days.delivery_date)} · {MEAL_LABEL[i.meal_type]} ·{" "}
                          {i.dishes.name} × {i.quantity}
                        </span>
                        <span className="tabular-nums">{brl(i.unit_price * i.quantity)}</span>
                      </li>
                    ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                  <span className="text-muted-foreground">
                    {pay && (
                      <>
                        Pagamento {PAYMENT_METHOD_LABEL[pay.method]} ·{" "}
                        <StatusBadge status={pay.status} />
                        {pay.status === "recusado" &&
                          pay.next_retry_at &&
                          ` · nova tentativa em ${dateTimeBR(pay.next_retry_at)}`}
                        {pay.status === "pendente" &&
                          pay.expires_at &&
                          ` · Pix vence ${dateTimeBR(pay.expires_at)}`}
                      </>
                    )}
                  </span>
                  <span className="font-semibold">
                    {o.discount > 0 && (
                      <span className="mr-2 text-xs font-normal text-muted-foreground">
                        desconto {brl(o.discount)}
                      </span>
                    )}
                    Total {brl(o.total)}
                  </span>
                </div>
                {o.pricing_snapshot?.conditions && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Condições na contratação: {o.pricing_snapshot.conditions}
                  </p>
                )}
              </Section>
            );
          })}
        </div>
      )}

      <Section title="Histórico de cobranças" className="mt-6">
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem cobranças.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.order.code}</TableCell>
                  <TableCell>{PAYMENT_METHOD_LABEL[p.method]}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>{dateTimeBR(p.paid_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(p.amount)}</TableCell>
                  <TableCell className="text-right">
                    {p.receipt_url ? (
                      <a
                        href={p.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Comprovante <ExternalLink className="size-3" />
                      </a>
                    ) : p.status === "aprovado" ? (
                      <Button size="sm" variant="ghost" onClick={() => printReceipt(p.order, p)}>
                        Comprovante
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}

const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function printReceipt(o: Order, p: Order["payments"][number]) {
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return;
  const rows = o.order_items
    .map(
      (i) =>
        `<tr><td>${esc(i.dishes.name)} × ${i.quantity}</td><td style="text-align:right">${brl(i.unit_price * i.quantity)}</td></tr>`,
    )
    .join("");
  w.document
    .write(`<html><head><title>Comprovante ${o.code}</title><style>body{font-family:system-ui;padding:24px}td{padding:4px 0}table{width:100%}</style></head><body>
    <h2>Comprovante de pagamento</h2><p>Pedido ${esc(o.code)} · ${esc(o.menu_cycles.name)}</p><table>${rows}</table><hr/>
    <p>Desconto: ${brl(o.discount)}<br/><b>Total pago: ${brl(p.amount)}</b><br/>${PAYMENT_METHOD_LABEL[p.method]} · ${dateTimeBR(p.paid_at)}</p>
    <p style="font-size:12px;color:#666">Documento sem valor fiscal. A nota fiscal é emitida pelo estabelecimento.</p>
    <script>window.print()</script></body></html>`);
  w.document.close();
}
