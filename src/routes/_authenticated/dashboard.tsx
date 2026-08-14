import { createFileRoute } from "@tanstack/react-router";
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
import { useMonthlyFlow, useOperations, usePortfolioSummary } from "@/lib/data/hooks";
import { brl, brlCompact, competenceBR, pct, todayISO } from "@/lib/format";

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

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function DashboardPage() {
  const summary = usePortfolioSummary();
  const operations = useOperations();
  const flow = useMonthlyFlow();

  const s = summary.data;
  const today = todayISO();
  const currentMonth = today.slice(0, 7);

  const monthly = (flow.data ?? []).map((row) => ({
    competence: competenceBR(row.competence),
    raw: row.competence ?? "",
    previsto: Number(row.expected ?? 0),
    recebido: Number(row.received ?? 0),
    inadimplente: Number(row.overdue ?? 0),
  }));

  const monthRow = monthly.find((row) => row.raw.slice(0, 7) === currentMonth);

  const byCategory = Object.values(
    (operations.data ?? []).reduce<Record<string, { name: string; value: number }>>((acc, op) => {
      const name = op.category ?? "Sem categoria";
      acc[name] ??= { name, value: 0 };
      acc[name]!.value += Number(op.total_invested ?? 0);
      return acc;
    }, {}),
  ).sort((a, b) => b.value - a.value);

  const topOverdue = [...(operations.data ?? [])]
    .filter((op) => Number(op.overdue_receivable ?? 0) > 0)
    .sort((a, b) => Number(b.overdue_receivable ?? 0) - Number(a.overdue_receivable ?? 0))
    .slice(0, 8);

  if (summary.isLoading) {
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
          Posição consolidada da carteira — dados calculados a partir das parcelas e recebimentos registrados.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="Capital investido"
          value={brl(s?.total_invested)}
          hint={`${s?.total_operations ?? 0} operações cadastradas`}
          icon={<Wallet className="size-4 text-muted-foreground" />}
        />
        <Kpi
          title="Capital recebido"
          value={brl(s?.total_received)}
          hint={`${pct(s?.recovery_percentage)} do capital recuperado`}
          icon={<ArrowDownRight className="size-4 text-muted-foreground" />}
        />
        <Kpi
          title="Saldo a recuperar"
          value={brl(s?.capital_to_recover)}
          hint="Capital ainda não retornado"
          icon={<ArrowUpRight className="size-4 text-muted-foreground" />}
        />
        <Kpi
          title="Lucro realizado"
          value={brl(s?.realized_profit)}
          hint={`Lucro sobre capital retornado`}
          icon={<TrendingUp className="size-4 text-muted-foreground" />}
        />
        <Kpi
          title="Resultado Projetado"
          value={brl(s?.projected_result)}
          hint="Expectativa total de lucro"
          icon={<TrendingUp className="size-4 text-primary" />}
        />
        <Kpi
          title="A receber (futuro)"
          value={brl(s?.future_receivable)}
          hint="Parcelas com vencimento em aberto"
        />
        <Kpi
          title="Inadimplência"
          value={brl(s?.overdue_receivable)}
          hint={`${s?.overdue_installments ?? 0} parcelas vencidas em ${s?.overdue_operations ?? 0} operações`}
          icon={<AlertTriangle className="size-4 text-destructive" />}
          tone="destructive"
        />
        <Kpi
          title="Recebido no mês"
          value={brl(monthRow?.recebido ?? 0)}
          hint={`Previsto ${brl(monthRow?.previsto ?? 0)}`}
        />
        <Kpi
          title="Operações em revisão"
          value={String(s?.review_operations ?? 0)}
          hint={`${s?.closed_operations ?? 0} encerradas`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recuperação do capital</CardTitle>
          <CardDescription>
            {brl(s?.total_received)} recuperados de {brl(s?.total_invested)} investidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={Number(s?.recovery_percentage ?? 0) * 100} />
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
                <Bar dataKey="previsto" name="Previsto" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recebido" name="Recebido" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
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
                  stroke="var(--destructive)"
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
                  <TableRow key={op.operation_id}>
                    <TableCell className="font-medium">{op.reference}</TableCell>
                    <TableCell className="text-right text-destructive">{brl(op.overdue_receivable)}</TableCell>
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
}: {
  title: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "destructive";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className={tone === "destructive" ? "text-2xl font-semibold text-destructive" : "text-2xl font-semibold"}>
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
