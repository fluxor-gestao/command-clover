import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInstallments } from "@/lib/data/hooks";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/parcelas")({
  head: () => ({
    meta: [
      { title: "Parcelas · Nova Era Investimentos" },
      {
        name: "description",
        content:
          "Cronograma consolidado de parcelas com filtros por situação, competência e operação, incluindo atrasos e saldos.",
      },
      { property: "og:title", content: "Parcelas · Nova Era Investimentos" },
      { property: "og:description", content: "Cronograma consolidado de parcelas da carteira." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InstallmentsPage,
});

function InstallmentsPage() {
  const installments = useInstallments();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("TODAS");
  const [competence, setCompetence] = useState("TODAS");

  const rows = installments.data ?? [];
  const competences = useMemo(
    () => [...new Set(rows.map((row) => row.competence).filter(Boolean))].sort() as string[],
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const matchSearch = (row.reference ?? "").toLowerCase().includes(search.toLowerCase());
        const matchStatus = status === "TODAS" || row.financial_status === status;
        const matchCompetence = competence === "TODAS" || row.competence === competence;
        return matchSearch && matchStatus && matchCompetence;
      }),
    [rows, search, status, competence],
  );

  const totals = filtered.reduce(
    (acc, row) => ({
      expected: acc.expected + (row.expected_amount ?? 0),
      received: acc.received + (row.received_amount ?? 0),
      outstanding: acc.outstanding + (row.outstanding_amount ?? 0),
    }),
    { expected: 0, received: 0, outstanding: 0 },
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Parcelas</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} parcelas · previsto {brl(totals.expected)} · recebido {brl(totals.received)} · saldo{" "}
          {brl(totals.outstanding)}
        </p>
      </header>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Buscar operação..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as situações</SelectItem>
                <SelectItem value="A_VENCER">A vencer</SelectItem>
                <SelectItem value="VENCIDA">Vencida</SelectItem>
                <SelectItem value="PAGA">Paga</SelectItem>
                <SelectItem value="PARCIAL">Parcial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={competence} onValueChange={setCompetence}>
              <SelectTrigger>
                <SelectValue placeholder="Competência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as competências</SelectItem>
                {competences.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operação</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>#</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Previsto</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Atraso</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 500).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.reference}</TableCell>
                  <TableCell>{row.category ?? "—"}</TableCell>
                  <TableCell>{row.installment_number}</TableCell>
                  <TableCell>{dateBR(row.due_date)}</TableCell>
                  <TableCell className="text-right">{brl(row.expected_amount)}</TableCell>
                  <TableCell className="text-right">{brl(row.received_amount)}</TableCell>
                  <TableCell className="text-right">{brl(row.outstanding_amount)}</TableCell>
                  <TableCell className="text-right">
                    {(row.days_overdue ?? 0) > 0 ? `${row.days_overdue} dias` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.financial_status === "VENCIDA" ? "destructive" : "secondary"}>
                      {row.financial_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-sm text-muted-foreground">
                    Nenhuma parcela encontrada.
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
