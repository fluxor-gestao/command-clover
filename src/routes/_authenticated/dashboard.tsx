import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, TrendingUp, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { YearScopeSelect, scopeFromValue } from "@/components/filters/YearScopeSelect";
import {
  useInstallments,
  useMonthlyFlow,
  useOperations,
  usePortfolioMetrics,
  useReceivedInMonth,
} from "@/lib/data/hooks";
import { brl, brlCompact, competenceBR, pct, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard executivo · Nova Era Investimentos" },
      {
        name: "description",
        content:
          "Painel executivo com capital investido, recebido, saldo a recuperar, inadimplência e retorno da carteira Nova Era.",
      },
      { property: "og:title", content: "Dashboard executivo · Nova Era Investimentos" },
      {
        property: "og:description",
        content: "Indicadores consolidados da carteira de investimentos Nova Era em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const CHART_COLORS = ["oklch(0.696 0.17 162.48)", "oklch(0.446 0.03 256.802)", "oklch(0.129 0.042 264.695)", "oklch(0.92 0.004 286.32)", "oklch(0.85 0.01 264.695)"];

function DashboardPage() {
  const navigate = useNavigate();
  const today = todayISO();
  const currentMonth = today.slice(0, 7);

  const [scopeValue, setScopeValue] = useState(today.slice(0, 4));
  const scope = scopeFromValue(scopeValue);
  const year = "year" in scope ? scope.year : null;

  const metrics = usePortfolioMetrics(scope);
  const operations = useOperations();
  const installments = useInstallments();
  const flow = useMonthlyFlow();
  const receivedInMonth = useReceivedInMonth(currentMonth);

  const s = metrics.data;

  const monthly = (flow.data ?? [])
    .filter((row) => (year === null ? true : String(row.competence ?? "").slice(0, 4) === String(year)))
    .map((row) => ({
      competence: competenceBR(row.competence),
      raw: row.competence ?? "",
      previsto: Number(row.expected ?? 0),
      recebido: Number(row.received ?? 0),
      inadimplente: Number(row.overdue ?? 0),
    }));

  const monthRow = monthly.find((row) => row.raw.slice(0, 7) === currentMonth);

  const scopedInstallments = (installments.data ?? []).filter((row) =>
    year === null ? true : String(row.competence ?? "").slice(0, 4) === String(year),
  );

  const scopedOperationIds = new Set(scopedInstallments.map((row) => row.operation_id));

  const overdueByOperation = scopedInstallments.reduce<Record<string, { amount: number; count: number }>>(
    (acc, row) => {
      const outstanding = Number(row.outstanding_amount ?? 0);
      if (outstanding <= 0 || !row.operation_id) return acc;
      if (String(row.due_date ?? "") >= today) return acc;
      acc[row.operation_id] ??= { amount: 0, count: 0 };
      acc[row.operation_id]!.amount += outstanding;
      acc[row.operation_id]!.count += 1;
      return acc;
    },
    {},
  );

  const scopedOperations = (operations.data ?? []).filter(
    (op) => year === null || (op.operation_id != null && scopedOperationIds.has(op.operation_id)),
  );

  const byCategory = Object.values(
    scopedOperations.reduce<Record<string, { name: string; value: number }>>((acc, op) => {
      const name = op.category ?? "Sem categoria";
      acc[name] ??= { name, value: 0 };
      acc[name]!.value += Number(op.initial_capital ?? 0) + Number(op.total_contributions ?? 0);
      return acc;
    }, {}),
  ).sort((a, b) => b.value - a.value);

  const topOverdue = scopedOperations
    .map((op) => ({
      operation_id: op.operation_id,
      reference: op.reference,
      overdue_receivable: op.operation_id ? (overdueByOperation[op.operation_id]?.amount ?? 0) : 0,
      overdue_installments: op.operation_id ? (overdueByOperation[op.operation_id]?.count ?? 0) : 0,
    }))
    .filter((op) => op.overdue_receivable > 0)
    .sort((a, b) => b.overdue_receivable - a.overdue_receivable)
    .slice(0, 8);

  if (metrics.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard executivo</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores oficiais da carteira — Auditoria financeira consolidada.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Capital investido"
          value={brl(s?.total_invested)}
          hint={`${s?.total_operations ?? 0} operações`}
          icon={<Wallet className="size-4" />}
          primary
          onClick={() => navigate({ to: "/operacoes" })}
        />
        <Kpi
          title="Capital recebido"
          value={brl(s?.total_received)}
          hint={`${pct(s?.recovery_percentage)} do capital`}
          icon={<ArrowDownRight className="size-4" />}
          primary
          onClick={() => navigate({ to: "/recebimentos" })}
        />
        <Kpi
          title="Capital a Recuperar"
          value={brl(s?.capital_to_recover)}
          hint="Saldo pendente do aporte"
          icon={<ArrowUpRight className="size-4" />}
          primary
          onClick={() => navigate({ to: "/operacoes" })}
        />
        <Kpi
          title="Total a Receber"
          value={brl(s?.total_a_receber)}
          hint="Projeção total futura"
          icon={<TrendingUp className="size-4" />}
          primary
          onClick={() => navigate({ to: "/parcelas" })}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Lucro realizado"
          value={brl(s?.realized_profit)}
          hint="Sobre capital retornado"
          onClick={() => navigate({ to: "/relatorios" })}
        />
        <Kpi
          title="Resultado Projetado"
          value={brl(s?.projected_result)}
          hint="Resultado esperado ao final da carteira"
          onClick={() => navigate({ to: "/relatorios" })}
        />
        <Kpi
          title="Inadimplência"
          value={brl(s?.overdue_receivable)}
          hint={`${s?.overdue_installments ?? 0} parcelas vencidas`}
          tone="destructive"
          onClick={() => navigate({ to: "/parcelas", search: { status: "VENCIDA" } })}
        />
        <Kpi
          title="Recebido no mês"
          value={brl(receivedInMonth.data ?? 0)}
          hint={`Previsto no mês: ${brl(monthRow?.previsto ?? 0)}`}
          onClick={() => navigate({ to: "/relatorios" })}
        />
      </section>

      <Card className="border-none shadow-sm bg-card/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Recuperação do capital</CardTitle>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-foreground">{pct(s?.recovery_percentage)}</span>
                <span className="text-sm text-muted-foreground">
                  {brl(s?.total_received)} de {brl(s?.total_invested)} recuperados
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Progress 
            value={Number(s?.recovery_percentage ?? 0) * 100} 
            className="h-3 bg-muted"
          />
          <div className="mt-4 flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span>Capital recuperado</span>
            <span>Capital restante</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Previsto x Recebido por competência</CardTitle>
            <CardDescription>Fluxo mensal completo da carteira</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="competence" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v: number) => brlCompact(v)} />
                <Tooltip formatter={(value: number) => brl(value)} />
                <Legend />
                <Bar dataKey="previsto" name="Previsto" fill="oklch(0.446 0.03 256.802)" radius={[4, 4, 0, 0]} fillOpacity={0.3} />
                <Bar dataKey="recebido" name="Recebido" fill="oklch(0.696 0.17 162.48)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capital por categoria</CardTitle>
            <CardDescription>Distribuição do valor investido</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                  {byCategory.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => brl(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução da inadimplência</CardTitle>
            <CardDescription>Saldo vencido em aberto por competência</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="competence" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v: number) => brlCompact(v)} />
                <Tooltip formatter={(value: number) => brl(value)} />
                <Line
                  type="monotone"
                  dataKey="inadimplente"
                  name="Inadimplente"
                  stroke="oklch(0.605 0.22 28.27)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maiores inadimplências</CardTitle>
            <CardDescription>Operações com saldo vencido em aberto</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operação</TableHead>
                  <TableHead className="text-right">Vencido</TableHead>
                  <TableHead className="text-right">Parcelas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topOverdue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      Nenhuma parcela vencida em aberto.
                    </TableCell>
                  </TableRow>
                )}
                {topOverdue.map((op) => (
                  <TableRow 
                    key={op.operation_id} 
                    className="group cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => navigate({ to: "/operacoes/$id", params: { id: op.operation_id ?? "" } })}
                  >
                    <TableCell className="font-medium">{op.reference}</TableCell>
                    <TableCell className="text-right text-destructive font-bold tabular-nums">{brl(op.overdue_receivable)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{op.overdue_installments ?? 0}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  hint,
  icon,
  tone,
  primary,
  onClick,
}: {
  title: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "destructive";
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card 
      onClick={onClick}
      className={cn(
        "border-none shadow-sm transition-all hover:shadow-md",
        onClick && "cursor-pointer active:scale-[0.98]",
        primary ? "bg-primary text-primary-foreground" : "bg-card",
        tone === "destructive" && !primary && "bg-destructive/5"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn(
          "text-xs font-bold uppercase tracking-wider",
          primary ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {title}
        </CardTitle>
        {icon && (
          <div className={cn(
            "rounded-md p-1.5",
            primary ? "bg-primary-foreground/10" : "bg-muted"
          )}>
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1">
          <p className={cn(
            "text-2xl font-bold tracking-tight",
            tone === "destructive" && !primary ? "text-destructive" : ""
          )}>
            {value}
          </p>
          {hint && (
            <p className={cn(
              "text-[10px] font-medium uppercase tracking-tight opacity-70",
              primary ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {hint}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
