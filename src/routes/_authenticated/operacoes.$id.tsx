import { createFileRoute, Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInstallments, useOperation } from "@/lib/data/hooks";
import { brl, dateBR, pct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/operacoes/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da operação · Nova Era" },
      {
        name: "description",
        content: "Ficha completa da operação: capital, cronograma de parcelas, recebimentos e situação atual.",
      },
      { property: "og:title", content: "Detalhe da operação · Nova Era" },
      { property: "og:description", content: "Ficha completa da operação de investimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OperationDetail,
});

function OperationDetail() {
  const { id } = Route.useParams();
  const operation = useOperation(id);
  const installments = useInstallments(id);
  const op = operation.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{op?.reference ?? "Operação"}</h1>
          <p className="text-sm text-muted-foreground">{op?.category ?? "Sem categoria"}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/operacoes">Voltar</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Capital investido" value={brl(op?.total_invested)} />
        <Metric label="Total recebido" value={brl(op?.total_received)} />
        <Metric label="A recuperar" value={brl(op?.capital_to_recover)} />
        <Metric label="% recuperado" value={pct(op?.recovery_percentage)} />
        <Metric label="A vencer" value={brl(op?.future_receivable)} />
        <Metric label="Vencido" value={brl(op?.overdue_receivable)} />
        <Metric label="Parcelas em atraso" value={String(op?.overdue_installments ?? 0)} />
        <Metric label="Situação" value={op?.computed_status ?? "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cronograma de parcelas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Previsto</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(installments.data ?? []).map((installment) => (
                <TableRow key={installment.id}>
                  <TableCell>{installment.installment_number}</TableCell>
                  <TableCell>{dateBR(installment.due_date)}</TableCell>
                  <TableCell className="text-right">{brl(installment.expected_amount)}</TableCell>
                  <TableCell className="text-right">{brl(installment.received_amount)}</TableCell>
                  <TableCell className="text-right">{brl(installment.outstanding_amount)}</TableCell>
                  <TableCell>
                    <Badge variant={installment.financial_status === "VENCIDA" ? "destructive" : "secondary"}>
                      {installment.financial_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(installments.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    Nenhuma parcela cadastrada para esta operação.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-lg font-semibold">{value}</CardContent>
    </Card>
  );
}
