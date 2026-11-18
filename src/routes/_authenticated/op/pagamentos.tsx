import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";

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
import { Loading, PageHeader, Section, StatusBadge } from "@/components/platform/ui";
import { errorText, list, rpc } from "@/lib/platform/db";
import { PAYMENT_METHOD_LABEL, STATUS } from "@/lib/platform/labels";
import { brl, dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/op/pagamentos")({
  component: PagamentosPage,
});

type Pay = {
  id: string;
  order_code: string;
  provider: string;
  provider_charge_id: string;
  method: string;
  status: string;
  amount: number;
  fee_amount: number;
  attempts: number;
  next_retry_at: string | null;
  expires_at: string | null;
  paid_at: string | null;
  cash_status: string;
  payout_ref: string | null;
  created_at: string;
};
type Evt = {
  id: string;
  provider: string;
  event_id: string;
  provider_charge_id: string;
  status: string;
  result: string | null;
  received_at: string;
};

function PagamentosPage() {
  const qc = useQueryClient();
  const [event, setEvent] = useState<Record<string, string>>({});
  const [lastEvent, setLastEvent] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["payments"],
    queryFn: async () => ({
      payments: await list<Pay>("v_finance_payments", (x) =>
        x.order("created_at", { ascending: false }).limit(200),
      ),
      events: await list<Evt>("payment_events", (x) =>
        x.order("received_at", { ascending: false }).limit(50),
      ),
    }),
  });
  const send = useMutation({
    mutationFn: async ({ p, status, eventId }: { p: Pay; status: string; eventId: string }) =>
      rpc<{ result: string }>("process_payment_event", {
        p_provider: p.provider,
        p_event_id: eventId,
        p_charge_id: p.provider_charge_id,
        p_status: status,
      }),
    onSuccess: (r) => {
      toast.success(`Provedor → ${r.result.replace(/_/g, " ")}`);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const expire = useMutation({
    mutationFn: () => rpc<number>("expire_overdue_payments"),
    onSuccess: (n) => {
      toast.success(`${n} cobrança(s) Pix expirada(s)`);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (q.isLoading || !q.data) return <Loading />;
  const webhook =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/pagamentos/webhook`
      : "/api/pagamentos/webhook";

  return (
    <>
      <PageHeader
        title="Pagamentos"
        description="Cartão recorrente, Pix e Pix Automático. Cada evento do provedor é processado uma única vez: reenvios da mesma confirmação não geram novo pedido nem novo lançamento."
        actions={
          <Button variant="outline" onClick={() => expire.mutate()}>
            Expirar Pix vencidos
          </Button>
        }
      />
      <Section title="Integração com o provedor" className="mb-6">
        <p className="text-sm">
          Configure no provedor o webhook{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">{webhook}</code>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => navigator.clipboard.writeText(webhook)}
          >
            <Copy className="size-3" />
          </Button>
          com o segredo <code>PAYMENT_WEBHOOK_SECRET</code>. Enquanto o provedor não está
          contratado, use a simulação abaixo para testar o fluxo (aprovação, recusa com novas
          tentativas, expiração, reembolso, contestação e reenvio duplicado).
        </p>
      </Section>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Taxa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Caixa</TableHead>
              <TableHead>Simular evento do provedor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <p className="font-medium">{p.order_code}</p>
                  <p className="text-xs text-muted-foreground">{dateTimeBR(p.created_at)}</p>
                </TableCell>
                <TableCell className="text-sm">
                  {PAYMENT_METHOD_LABEL[p.method]}
                  {p.attempts > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {p.attempts} tentativa(s)
                      {p.next_retry_at && ` · próxima ${dateTimeBR(p.next_retry_at)}`}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{brl(p.amount)}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(p.fee_amount)}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell>
                  {["a_receber", "recebido"].includes(p.cash_status) ? (
                    <>
                      <StatusBadge status={p.cash_status} />
                      {p.payout_ref && (
                        <p className="text-xs text-muted-foreground">{p.payout_ref}</p>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    <Select
                      value={event[p.id] ?? ""}
                      onValueChange={(v) => setEvent({ ...event, [p.id]: v })}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue placeholder="Evento…" />
                      </SelectTrigger>
                      <SelectContent>
                        {["aprovado", "recusado", "expirado", "reembolsado", "contestado"].map(
                          (s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS[s]?.label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!event[p.id] || send.isPending}
                      onClick={() => {
                        const eventId = `sim_${crypto.randomUUID().slice(0, 8)}`;
                        setLastEvent({ ...lastEvent, [p.id]: `${event[p.id]}|${eventId}` });
                        send.mutate({ p, status: event[p.id]!, eventId });
                      }}
                    >
                      Enviar
                    </Button>
                    {lastEvent[p.id] && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Reenvia o mesmo evento, como o provedor faz em caso de timeout"
                        onClick={() => {
                          const [status, eventId] = lastEvent[p.id]!.split("|");
                          send.mutate({ p, status: status!, eventId: eventId! });
                        }}
                      >
                        Reenviar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Section title="Eventos recebidos" className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recebido</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Cobrança</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.events.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">{dateTimeBR(e.received_at)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {e.provider}/{e.event_id}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {e.provider_charge_id?.slice(0, 16)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={e.status} />
                </TableCell>
                <TableCell className="text-sm">{e.result?.replace(/_/g, " ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">
          Um evento repetido (mesmo identificador) nem chega a ser registrado de novo: aparece no
          aviso como “evento duplicado ignorado”.
        </p>
      </Section>
    </>
  );
}
