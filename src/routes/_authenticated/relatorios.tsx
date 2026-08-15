import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, FileBarChart, PieChart, TrendingUp, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { YearScopeSelect, scopeFromValue } from "@/components/filters/YearScopeSelect";
import { useMonthlyFlow, usePortfolioMetrics, useOperations, useInstallments } from "@/lib/data/hooks";
import { brl, competenceBR, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { simulateContract } from "@/lib/finance/contract";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios · Nova Era Investimentos" },
      {
        name: "description",
        content: "Fluxo mensal previsto x recebido, inadimplência e percentual de realização da carteira Nova Era.",
      },
      { property: "og:title", content: "Relatórios · Nova Era Investimentos" },
      { property: "og:description", content: "Fluxo mensal e realização da carteira." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [scopeValue, setScopeValue] = useState(new Date().getFullYear().toString());
  const scope = scopeFromValue(scopeValue);
  const year = "year" in scope ? scope.year : null;
  const metrics = usePortfolioMetrics(scope);
  const flow = useMonthlyFlow();
  const operations = useOperations();
  const allInstallments = useInstallments();

  const projectedRows = useMemo(() => {
    const realRows = (flow.data ?? []).map(r => ({ ...r, isProjected: false }));
    if (!year || !operations.data) return realRows.filter(r => !year || r.competence?.startsWith(String(year)));

    // Se temos um ano selecionado, vamos preencher as lacunas até Dezembro se necessário,
    // e projetar valores baseados nos contratos ativos que não têm parcelas no banco
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);
    
    return months.map(month => {
      const existing = realRows.find(r => r.competence === month);
      if (existing && (existing.installments_count ?? 0) > 0) return existing;

      // Projetar: buscar operações que deveriam estar ativas neste mês
      let projectedExpected = 0;
      let projectedOps = 0;

      operations.data?.forEach(op => {
        const rawOp = op as any;
        if (rawOp.is_own_property || !rawOp.first_due_date || !rawOp.installment_count || !rawOp.installment_value) return;
        
        const simulation = simulateContract({
          capital: rawOp.initial_capital ?? 0,
          installmentValue: rawOp.installment_value,
          installmentCount: rawOp.installment_count,
          firstDueDate: rawOp.first_due_date,
          dueDay: rawOp.due_day
        });

        const monthSim = simulation.schedule.find(s => s.dueDate.startsWith(month.slice(0, 7)));
        if (monthSim) {
          projectedExpected += monthSim.amount;
          projectedOps += 1;
        }
      });

      return {
        competence: month,
        installments_count: projectedOps,
        expected: projectedExpected,
        received: 0,
        overdue: 0,
        realization_percentage: 0,
        isProjected: true
      };
    });
  }, [flow.data, year, operations.data]);

  const rows = projectedRows;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FileBarChart className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Central de Relatórios</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Análise de performance e saúde da carteira</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <YearScopeSelect value={scopeValue} onChange={setScopeValue} />
          <Button variant="outline" className="h-9 text-[10px] font-bold uppercase tracking-widest border-muted-foreground/20 bg-card/50">
            <Download className="mr-2 size-3" /> Exportar Consolidado
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Capital investido", value: brl(metrics.data?.total_invested) },
          { label: "Total recebido", value: brl(metrics.data?.total_received) },
          { label: "Total a receber", value: brl(metrics.data?.total_a_receber) },
          { label: "Saldo inadimplente", value: brl(metrics.data?.overdue_receivable) },
        ].map((item) => (
          <Card key={item.label} className="border-none shadow-sm bg-card/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>


      <Tabs defaultValue="fluxo" className="space-y-6">
        <TabsList className="h-11 p-1 bg-muted/50 rounded-xl w-full justify-start overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="fluxo" className="rounded-lg font-bold text-[10px] uppercase tracking-wider px-6 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <TrendingUp className="mr-2 size-3" /> Fluxo de Caixa
          </TabsTrigger>
          <TabsTrigger value="carteira" className="rounded-lg font-bold text-[10px] uppercase tracking-wider px-6 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <PieChart className="mr-2 size-3" /> Carteira de Ativos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fluxo">
          <Card className="border-none shadow-sm overflow-hidden bg-card/50">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Competência por Competência</CardTitle>
              <CardDescription>Visão mensal de recebíveis e realização</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-[10px] uppercase font-bold tracking-wider pl-6">Mês/Ano</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">Parcelas</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">Previsto</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">Recebido</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider text-destructive">Vencido</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider text-success">Realizado %</TableHead>
                    <TableHead className="w-10 pr-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.competence} className="group hover:bg-muted/50 transition-colors border-border/40">
                      <TableCell className="font-bold py-4 pl-6 flex items-center gap-2">
                        {competenceBR(row.competence)}
                        {(row as any).isProjected && (
                          <Badge variant="secondary" className="h-4 text-[8px] px-1 bg-primary/5 text-primary border-primary/20">
                            <Sparkles className="size-2 mr-1" /> Projetado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{row.installments_count ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{brl(row.expected)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold text-success/80">{brl(row.received)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold text-destructive">{brl(row.overdue)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge variant="outline" className={cn(
                          "h-5 font-bold border-none",
                          (row.realization_percentage ?? 0) >= 90 ? "bg-success/10 text-success" : 
                          (row.realization_percentage ?? 0) >= 50 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                        )}>
                          {pct(row.realization_percentage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6">
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Download className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="carteira">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-none shadow-sm bg-card/50 flex flex-col items-center justify-center p-12 text-center text-muted-foreground border-2 border-dashed">
              <PieChart className="size-12 mb-4 opacity-10" />
              <p className="text-sm font-medium">Análise de carteira em desenvolvimento...</p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
