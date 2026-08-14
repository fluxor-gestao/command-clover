import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMonthlyFlow } from "@/lib/data/hooks";
import { brl, competenceBR, pct } from "@/lib/format";

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
  const flow = useMonthlyFlow();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Fluxo mensal previsto, recebido e vencido.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fluxo por competência</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead className="text-right">Parcelas</TableHead>
                <TableHead className="text-right">Previsto</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-right">Vencido</TableHead>
                <TableHead className="text-right">A vencer</TableHead>
                <TableHead className="text-right">% realizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(flow.data ?? []).map((row) => (
                <TableRow key={row.competence}>
                  <TableCell className="font-medium">{competenceBR(row.competence)}</TableCell>
                  <TableCell className="text-right">{row.installments_count ?? 0}</TableCell>
                  <TableCell className="text-right">{brl(row.expected)}</TableCell>
                  <TableCell className="text-right">{brl(row.received)}</TableCell>
                  <TableCell className="text-right">{brl(row.difference)}</TableCell>
                  <TableCell className="text-right text-destructive">{brl(row.overdue)}</TableCell>
                  <TableCell className="text-right">{brl(row.future_receivable)}</TableCell>
                  <TableCell className="text-right">{pct(row.realization_percentage)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
