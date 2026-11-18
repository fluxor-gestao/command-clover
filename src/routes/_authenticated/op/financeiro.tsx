import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Field,
  Forbidden,
  Loading,
  PageHeader,
  Section,
  Stat,
  StatusBadge,
} from "@/components/platform/ui";
import { db, errorText, list, rpc, unwrap } from "@/lib/platform/db";
import { exportXlsx } from "@/lib/platform/export";
import { FIN_KIND_LABEL } from "@/lib/platform/labels";
import { brl, dateBR, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Metrics } from "@/lib/platform/types";

export const Route = createFileRoute("/_authenticated/op/financeiro")({
  component: FinanceiroPage,
});

type Entry = {
  id: string;
  kind: string;
  direction: string;
  description: string;
  category: string | null;
  amount: number;
  competence_date: string;
  due_date: string | null;
  settled_date: string | null;
  status: string;
  order_id: string | null;
};
type Pay = {
  id: string;
  order_code: string;
  status: string;
  amount: number;
  fee_amount: number;
  net_amount: number | null;
  paid_at: string | null;
  payout_id: string | null;
  cash_status: string;
};
type Recon = {
  payout_id: string;
  payout_ref: string;
  payout_date: string;
  sales_gross: number;
  sales_fees: number;
  sales_refunds: number;
  expected_net: number;
  deposited_net: number;
  difference: number;
  payments: number;
};

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

function FinanceiroPage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [expense, setExpense] = useState<{
    description: string;
    category: string;
    amount: string;
    competence_date: string;
    due_date: string;
  } | null>(null);
  const [payout, setPayout] = useState<{
    ref: string;
    date: string;
    net: string;
    ids: string[];
  } | null>(null);

  const q = useQuery({
    queryKey: ["finance", from, to],
    queryFn: async () => {
      const [entries, payments, recon, margin, batches, losses, metrics] = await Promise.all([
        list<Entry>("financial_entries", (x) =>
          x
            .gte("competence_date", from)
            .lte("competence_date", to)
            .order("competence_date", { ascending: false }),
        ),
        list<Pay>("v_finance_payments", (x) =>
          x
            .in("status", ["aprovado", "reembolsado", "contestado"])
            .order("paid_at", { ascending: false }),
        ),
        list<Recon>("v_payout_reconciliation", (x) => x.order("payout_date", { ascending: false })),
        list<{
          dish_name: string;
          month: string;
          portions: number;
          revenue: number;
          expected_cost: number;
          gross_margin: number;
        }>("v_dish_margin", (x) => x.gte("month", from.slice(0, 8) + "01").lte("month", to)),
        list<{
          lot_code: string;
          production_date: string;
          portions: number;
          expected_cost: number;
          actual_cost: number;
        }>("v_batch_cost", (x) => x.gte("production_date", from).lte("production_date", to)),
        list<{
          quantity: number;
          unit_cost: number;
          reason: string;
          created_at: string;
          ingredients: { name: string };
        }>(
          "stock_movements",
          (x) => x.eq("kind", "perda").gte("created_at", from).lte("created_at", `${to}T23:59:59`),
          "quantity,unit_cost,reason,created_at,ingredients(name)",
        ),
        rpc<Metrics>("dashboard_metrics"),
      ]);
      return { entries, payments, recon, margin, batches, losses, metrics };
    },
  });

  const saveExpense = useMutation({
    mutationFn: async () =>
      unwrap(
        await db.from("financial_entries").insert({
          kind: "despesa",
          direction: "saida",
          description: expense!.description,
          category: expense!.category,
          amount: Number(expense!.amount),
          competence_date: expense!.competence_date,
          due_date: expense!.due_date || null,
        }),
      ),
    onSuccess: () => {
      toast.success("Despesa lançada");
      setExpense(null);
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const settle = useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await db
          .from("financial_entries")
          .update({ status: "liquidado", settled_date: today() })
          .eq("id", id),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
    onError: (e) => toast.error(errorText(e)),
  });
  const savePayout = useMutation({
    mutationFn: () =>
      rpc("register_payout", {
        p_payout_ref: payout!.ref,
        p_payout_date: payout!.date,
        p_net_amount: Number(payout!.net),
        p_payment_ids: payout!.ids,
      }),
    onSuccess: () => {
      toast.success("Repasse registrado e conciliado");
      setPayout(null);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const sums = useMemo(() => {
    const e = q.data?.entries ?? [];
    const by = (k: string) =>
      e
        .filter((x) => x.kind === k && x.status !== "cancelado")
        .reduce((s, x) => s + Number(x.amount), 0);
    const receivable = (q.data?.payments ?? []).filter((p) => p.cash_status === "a_receber");
    const received = (q.data?.recon ?? [])
      .filter((r) => r.payout_date >= from && r.payout_date <= to)
      .reduce((s, r) => s + Number(r.deposited_net), 0);
    return {
      revenue: by("receita_venda"),
      fees: by("taxa_pagamento"),
      refunds: by("reembolso"),
      chargebacks: by("contestacao"),
      expenses: by("despesa"),
      purchases: by("compra_insumo"),
      receivable: receivable.reduce((s, p) => s + Number(p.net_amount ?? p.amount), 0),
      receivableList: receivable,
      received,
      losses: (q.data?.losses ?? []).reduce(
        (s, l) => s + Math.abs(Number(l.quantity)) * Number(l.unit_cost ?? 0),
        0,
      ),
    };
  }, [q.data, from, to]);

  if (!session.has("financeiro")) return <Forbidden />;
  if (q.isLoading || !q.data) return <Loading />;
  const d = q.data;
  const result =
    sums.revenue - sums.fees - sums.refunds - sums.chargebacks - sums.expenses - sums.purchases;
  const payables = d.entries.filter(
    (e) =>
      e.direction === "saida" &&
      e.status === "aberto" &&
      ["despesa", "compra_insumo"].includes(e.kind),
  );
  const cashflow = Object.entries(
    d.entries.reduce<Record<string, { in: number; out: number }>>((acc, e) => {
      if (e.status === "cancelado") return acc;
      const k = (e.settled_date ?? e.due_date ?? e.competence_date).slice(0, 10);
      acc[k] ??= { in: 0, out: 0 };
      acc[k]![e.direction === "entrada" ? "in" : "out"] += Number(e.amount);
      return acc;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));

  const doExport = () =>
    exportXlsx(`financeiro_${from}_${to}`, [
      {
        name: "Lançamentos",
        rows: d.entries.map((e) => ({
          Competência: e.competence_date,
          Tipo: FIN_KIND_LABEL[e.kind] ?? e.kind,
          Descrição: e.description,
          Categoria: e.category,
          Direção: e.direction,
          Valor: Number(e.amount),
          Vencimento: e.due_date,
          Liquidação: e.settled_date,
          Status: e.status,
        })),
      },
      {
        name: "Pagamentos",
        rows: d.payments.map((p) => ({
          Pedido: p.order_code,
          Status: p.status,
          Bruto: Number(p.amount),
          Taxa: Number(p.fee_amount),
          Líquido: Number(p.net_amount ?? 0),
          "Pago em": p.paid_at,
          Caixa: p.cash_status,
        })),
      },
      {
        name: "Conciliação",
        rows: d.recon.map((r) => ({
          Repasse: r.payout_ref,
          Data: r.payout_date,
          "Vendas brutas": Number(r.sales_gross),
          Taxas: Number(r.sales_fees),
          Reembolsos: Number(r.sales_refunds),
          "Líquido esperado": Number(r.expected_net),
          Depositado: Number(r.deposited_net),
          Diferença: Number(r.difference),
        })),
      },
      {
        name: "Margem por prato",
        rows: d.margin.map((m) => ({
          Mês: m.month,
          Prato: m.dish_name,
          Porções: m.portions,
          Receita: Number(m.revenue),
          "Custo previsto": Number(m.expected_cost),
          Margem: Number(m.gross_margin),
        })),
      },
      {
        name: "Custo por lote",
        rows: d.batches.map((b) => ({
          Lote: b.lot_code,
          Produção: b.production_date,
          Porções: b.portions,
          "Custo previsto": Number(b.expected_cost),
          "Custo realizado": Number(b.actual_cost),
        })),
      },
      {
        name: "Perdas",
        rows: d.losses.map((l) => ({
          Data: l.created_at,
          Ingrediente: l.ingredients.name,
          Quantidade: Math.abs(Number(l.quantity)),
          "Valor (R$)": Math.abs(Number(l.quantity)) * Number(l.unit_cost ?? 0),
          Motivo: l.reason,
        })),
      },
    ]);

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Faturamento, valores a receber do provedor e dinheiro efetivamente recebido, separados. Conciliação entre bruto, taxas, reembolsos e líquido depositado."
        actions={
          <>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
            <Button variant="outline" onClick={doExport}>
              <Download className="mr-2 size-4" /> Exportar planilha
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Faturamento (vendas aprovadas)" value={brl(sums.revenue)} />
        <Stat
          label="A receber do provedor"
          value={brl(sums.receivable)}
          hint={`${sums.receivableList.length} pagamento(s) sem repasse`}
          tone="warning"
        />
        <Stat label="Recebido (repasses)" value={brl(sums.received)} tone="success" />
        <Stat
          label="Resultado do período"
          value={brl(result)}
          tone={result < 0 ? "danger" : "success"}
          hint={`Taxas ${brl(sums.fees)} · reembolsos ${brl(sums.refunds)} · compras ${brl(sums.purchases)} · despesas ${brl(sums.expenses)}`}
        />
        <Stat
          label="Assinaturas ativas"
          value={d.metrics.active_subscriptions}
          hint={`Receita recorrente estimada ${brl(d.metrics.mrr_estimate)}/mês`}
        />
        <Stat
          label="Inadimplência"
          value={d.metrics.delinquent_subscriptions}
          tone={d.metrics.delinquent_subscriptions ? "danger" : undefined}
        />
        <Stat label="Cancelamentos (30 dias)" value={d.metrics.cancelled_30d} />
        <Stat
          label="Perdas de estoque"
          value={brl(sums.losses)}
          tone={sums.losses ? "danger" : undefined}
        />
      </div>

      <Tabs defaultValue="pagar" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pagar">Contas a pagar</TabsTrigger>
          <TabsTrigger value="receber">A receber</TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
          <TabsTrigger value="caixa">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="margem">Margem e custos</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="pagar">
          <Section
            title="Contas a pagar"
            actions={
              <Button
                size="sm"
                onClick={() =>
                  setExpense({
                    description: "",
                    category: "operacional",
                    amount: "",
                    competence_date: today(),
                    due_date: today(),
                  })
                }
              >
                <Plus className="mr-1 size-4" /> Despesa
              </Button>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payables.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell
                      className={cn(
                        e.due_date && e.due_date < today() && "font-medium text-destructive",
                      )}
                    >
                      {dateBR(e.due_date)}
                    </TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(e.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => settle.mutate(e.id)}>
                        Marcar pago
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>

        <TabsContent value="receber">
          <Section
            title="Pagamentos aprovados aguardando repasse"
            actions={
              <Button
                size="sm"
                disabled={!sums.receivableList.length}
                onClick={() =>
                  setPayout({
                    ref: "",
                    date: today(),
                    net: num(sums.receivable, 2).replace(/\./g, "").replace(",", "."),
                    ids: sums.receivableList.map((p) => p.id),
                  })
                }
              >
                Registrar repasse
              </Button>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sums.receivableList.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.order_code}</TableCell>
                    <TableCell>{dateBR(p.paid_at)}</TableCell>
                    <TableCell className="text-right">{brl(p.amount)}</TableCell>
                    <TableCell className="text-right">{brl(p.fee_amount)}</TableCell>
                    <TableCell className="text-right font-medium">{brl(p.net_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>

        <TabsContent value="conciliacao">
          <Section title="Repasses do provedor">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repasse</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Vendas brutas</TableHead>
                  <TableHead className="text-right">Taxas</TableHead>
                  <TableHead className="text-right">Reembolsos</TableHead>
                  <TableHead className="text-right">Líquido esperado</TableHead>
                  <TableHead className="text-right">Depositado</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.recon.map((r) => (
                  <TableRow key={r.payout_id}>
                    <TableCell className="font-medium">
                      {r.payout_ref}
                      <p className="text-xs text-muted-foreground">{r.payments} pagamentos</p>
                    </TableCell>
                    <TableCell>{dateBR(r.payout_date)}</TableCell>
                    <TableCell className="text-right">{brl(r.sales_gross)}</TableCell>
                    <TableCell className="text-right">−{brl(r.sales_fees)}</TableCell>
                    <TableCell className="text-right">−{brl(r.sales_refunds)}</TableCell>
                    <TableCell className="text-right">{brl(r.expected_net)}</TableCell>
                    <TableCell className="text-right font-medium">{brl(r.deposited_net)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        Math.abs(Number(r.difference)) > 0.009
                          ? "text-destructive"
                          : "text-success-foreground dark:text-success",
                      )}
                    >
                      {brl(r.difference)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>

        <TabsContent value="caixa">
          <Section title="Fluxo de caixa (por data de liquidação ou vencimento)">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Saldo do dia</TableHead>
                  <TableHead className="text-right">Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {
                  cashflow.reduce<{ rows: ReactNode[]; acc: number }>(
                    (st, [day, v]) => {
                      const acc = st.acc + v.in - v.out;
                      st.rows.push(
                        <TableRow key={day}>
                          <TableCell>{dateBR(day)}</TableCell>
                          <TableCell className="text-right">{brl(v.in)}</TableCell>
                          <TableCell className="text-right">{brl(v.out)}</TableCell>
                          <TableCell className="text-right">{brl(v.in - v.out)}</TableCell>
                          <TableCell
                            className={cn("text-right font-medium", acc < 0 && "text-destructive")}
                          >
                            {brl(acc)}
                          </TableCell>
                        </TableRow>,
                      );
                      return { rows: st.rows, acc };
                    },
                    { rows: [], acc: 0 },
                  ).rows
                }
              </TableBody>
            </Table>
          </Section>
        </TabsContent>

        <TabsContent value="margem" className="grid gap-6 lg:grid-cols-2">
          <Section title="Margem por prato">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prato</TableHead>
                  <TableHead className="text-right">Porções</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Margem bruta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.margin.map((m) => (
                  <TableRow key={m.dish_name + m.month}>
                    <TableCell>{m.dish_name}</TableCell>
                    <TableCell className="text-right">{m.portions}</TableCell>
                    <TableCell className="text-right">{brl(m.revenue)}</TableCell>
                    <TableCell className="text-right">
                      {brl(m.gross_margin)}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({pct(Number(m.revenue) ? Number(m.gross_margin) / Number(m.revenue) : 0)})
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
          <Section title="Custo previsto × realizado por lote">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead className="text-right">Previsto</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">Desvio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.batches.map((b) => (
                  <TableRow key={b.lot_code}>
                    <TableCell className="font-mono text-xs">{b.lot_code}</TableCell>
                    <TableCell className="text-right">{brl(b.expected_cost)}</TableCell>
                    <TableCell className="text-right">{brl(b.actual_cost)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right",
                        Number(b.actual_cost) > Number(b.expected_cost) && "text-destructive",
                      )}
                    >
                      {brl(Number(b.actual_cost) - Number(b.expected_cost))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>

        <TabsContent value="lancamentos">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{dateBR(e.competence_date)}</TableCell>
                    <TableCell>{FIN_KIND_LABEL[e.kind]}</TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        e.direction === "saida" && "text-destructive",
                      )}
                    >
                      {e.direction === "saida" ? "−" : ""}
                      {brl(e.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!expense} onOpenChange={(o) => !o && setExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova despesa</DialogTitle>
          </DialogHeader>
          {expense && (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveExpense.mutate();
              }}
            >
              <Field label="Descrição" className="sm:col-span-2">
                <Input
                  required
                  value={expense.description}
                  onChange={(e) => setExpense({ ...expense, description: e.target.value })}
                />
              </Field>
              <Field label="Categoria">
                <Input
                  value={expense.category}
                  onChange={(e) => setExpense({ ...expense, category: e.target.value })}
                  placeholder="aluguel, energia, embalagens…"
                />
              </Field>
              <Field label="Valor (R$)">
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={expense.amount}
                  onChange={(e) => setExpense({ ...expense, amount: e.target.value })}
                />
              </Field>
              <Field label="Competência">
                <Input
                  type="date"
                  value={expense.competence_date}
                  onChange={(e) => setExpense({ ...expense, competence_date: e.target.value })}
                />
              </Field>
              <Field label="Vencimento">
                <Input
                  type="date"
                  value={expense.due_date}
                  onChange={(e) => setExpense({ ...expense, due_date: e.target.value })}
                />
              </Field>
              <DialogFooter className="sm:col-span-2">
                <Button disabled={saveExpense.isPending}>Lançar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!payout} onOpenChange={(o) => !o && setPayout(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar repasse do provedor</DialogTitle>
          </DialogHeader>
          {payout && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                savePayout.mutate();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Identificador">
                  <Input
                    required
                    value={payout.ref}
                    onChange={(e) => setPayout({ ...payout, ref: e.target.value })}
                  />
                </Field>
                <Field label="Data do depósito">
                  <Input
                    type="date"
                    value={payout.date}
                    onChange={(e) => setPayout({ ...payout, date: e.target.value })}
                  />
                </Field>
                <Field label="Valor depositado">
                  <Input
                    type="number"
                    step="0.01"
                    value={payout.net}
                    onChange={(e) => setPayout({ ...payout, net: e.target.value })}
                  />
                </Field>
              </div>
              <div className="max-h-60 space-y-1 overflow-y-auto rounded border p-2 text-sm">
                {sums.receivableList.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={payout.ids.includes(p.id)}
                      onCheckedChange={(c) =>
                        setPayout({
                          ...payout,
                          ids: c ? [...payout.ids, p.id] : payout.ids.filter((x) => x !== p.id),
                        })
                      }
                    />
                    {p.order_code} · líquido {brl(p.net_amount)}
                  </label>
                ))}
              </div>
              <DialogFooter>
                <Button disabled={savePayout.isPending || !payout.ids.length}>Conciliar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
