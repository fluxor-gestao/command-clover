import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInstallments, useOperations, useReferences } from "@/lib/data/hooks";
import { brl, competenceBR, pct, todayISO } from "@/lib/format";
import {
  buildHomologation,
  type HomologResult,
  type HomologStatus,
  type OperationRow,
} from "@/lib/homolog/compare";
import { readWorkbookFile } from "@/lib/import/import-workbook";
import type { ParseResult } from "@/lib/import/parse-workbook";

const statusVariant = (status: HomologStatus) =>
  status === "OK" ? "secondary" : status === "ATENCAO" ? "outline" : "destructive";

const money = (value: number) => brl(value);

function StatusBadge({ status }: { status: HomologStatus }) {
  return <Badge variant={statusVariant(status)}>{status === "ATENCAO" ? "ATENÇÃO" : status}</Badge>;
}

function buildReport(result: HomologResult, filename: string): string {
  const { totals, indicators, competences, operationsRows, checks, summary } = result;
  const line = (label: string, base: number, system: number) =>
    `- ${label}: base ${money(base)} | sistema ${money(system)} | dif ${money(system - base)}`;
  const topOps = operationsRows.filter((o) => o.status !== "OK").slice(0, 10);
  const topComp = [...competences].filter((c) => c.status !== "OK").sort((a, b) => b.worstDiff - a.worstDiff).slice(0, 10);
  const causes = [...new Set(operationsRows.flatMap((o) => (o.status === "OK" ? [] : o.causes)))];

  return [
    `HOMOLOGAÇÃO FINANCEIRA — NOVA ERA`,
    `Arquivo base: ${filename}`,
    `Data de referência: ${result.today}`,
    ``,
    `1. TOTAIS DA BASE EXCEL`,
    `- Referências: ${totals.base.references} | Operações: ${totals.base.operations} | Parcelas: ${totals.base.installments}`,
    `- Capital investido: ${money(totals.base.capital)}`,
    `- Total previsto: ${money(totals.base.expected)}`,
    `- Total recebido: ${money(totals.base.received)}`,
    `- Total a receber: ${money(totals.base.toReceive)} (futuro ${money(totals.base.futureReceivable)} + inadimplente ${money(totals.base.overdue)})`,
    ``,
    `2. TOTAIS DO SISTEMA`,
    `- Referências: ${totals.system.references} | Operações: ${totals.system.operations} | Parcelas: ${totals.system.installments}`,
    `- Capital investido: ${money(totals.system.capital)}`,
    `- Total previsto: ${money(totals.system.expected)}`,
    `- Total recebido: ${money(totals.system.received)}`,
    `- Total a receber: ${money(totals.system.toReceive)} (futuro ${money(totals.system.futureReceivable)} + inadimplente ${money(totals.system.overdue)})`,
    ``,
    `3. DIFERENÇAS`,
    ...indicators.map((i) => `- ${i.indicator}: ${i.status} | dif ${i.money ? money(i.diff) : i.diff}`),
    ``,
    `4. OPERAÇÕES COM MAIOR DIVERGÊNCIA`,
    ...(topOps.length
      ? topOps.map((o) => `- ${o.reference}: dif ${money(o.worstDiff)} | ${o.causes.join("; ") || "—"}`)
      : ["- nenhuma"]),
    ``,
    `5. COMPETÊNCIAS COM MAIOR DIVERGÊNCIA`,
    ...(topComp.length
      ? topComp.map((c) => `- ${competenceBR(c.competence)}: dif ${money(c.worstDiff)}`)
      : ["- nenhuma"]),
    ``,
    `6. CAUSAS PROVÁVEIS`,
    ...(causes.length ? causes.map((c) => `- ${c}`) : ["- nenhuma"]),
    ``,
    `7. TESTES DE CONSISTÊNCIA`,
    ...checks.map((c) => `- [${c.passed ? "OK" : "FALHOU"}] ${c.name} (${c.detail})`),
    ``,
    `8. STATUS FINAL: ${summary.status.replace(/_/g, " ")}`,
    `- Indicadores OK: ${summary.indicatorsOk} | divergentes: ${summary.indicatorsDiverging}`,
    `- Operações divergentes: ${summary.operationsDiverging} | Competências divergentes: ${summary.competencesDiverging}`,
    `- Valor total da divergência: ${money(summary.totalDivergence)}`,
    ``,
    `9. O QUE PRECISA SER CORRIGIDO`,
    ...(topOps.length || checks.some((c) => !c.passed)
      ? [
          ...topOps.map((o) => `- Revisar operação ${o.reference}: ${o.causes.join("; ") || "conferir valores"}`),
          ...checks.filter((c) => !c.passed).map((c) => `- Corrigir consistência: ${c.name} (${c.detail})`),
        ]
      : ["- nada pendente"]),
    ``,
    `Nenhum dado foi alterado nesta execução (somente leitura e comparação).`,
  ].join("\n");
}

export function HomologacaoFinanceira() {
  const operations = useOperations();
  const installments = useInstallments();
  const references = useReferences();
  const overdueBreakdown = useOverdueBreakdown({ type: "management", year: 2026, cutoff: "2026-08-01" });

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [drill, setDrill] = useState<OperationRow | null>(null);
  const [showPlan, setShowPlan] = useState(false);

  const result = useMemo<HomologResult | null>(() => {
    if (!parsed) return null;
    return buildHomologation({
      base: parsed,
      operations: (operations.data ?? []) as never,
      installments: (installments.data ?? []) as never,
      referencesCount: references.data?.length ?? 0,
      today: todayISO(),
    });
  }, [parsed, operations.data, installments.data, references.data]);

  const analyse = async (selected: File) => {
    setBusy(true);
    try {
      setFile(selected);
      // Todas as abas anuais — a homologação não se limita a um único ano.
      const parseResult = await readWorkbookFile(selected);
      setParsed(parseResult);
      toast.success("Base lida. Comparação gerada sem alterar nenhum dado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([buildReport(result, file?.name ?? "base.xlsx")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "homologacao-financeira.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planilha-base (fonte de verdade histórica)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Input
            type="file"
            accept=".xlsx"
            className="max-w-sm"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void analyse(selected);
            }}
          />
          {busy && <span className="text-sm text-muted-foreground">Lendo planilha…</span>}
          {result && (
            <>
              <Button variant="outline" size="sm" onClick={downloadReport}>
                Baixar relatório
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowPlan(true)}>
                Gerar plano de correção
              </Button>
            </>
          )}
          <p className="w-full text-xs text-muted-foreground">
            Execução somente leitura: nada é corrigido, excluído, reimportado ou sobrescrito.
          </p>
        </CardContent>
      </Card>

      {!result && (
        <p className="text-sm text-muted-foreground">
          Selecione a planilha histórica para comparar automaticamente Base Excel × Sistema.
        </p>
      )}

      {result && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Status da homologação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge
                className="text-sm"
                variant={
                  result.summary.status === "APROVADA"
                    ? "secondary"
                    : result.summary.status === "APROVADA_COM_RESSALVAS"
                      ? "outline"
                      : "destructive"
                }
              >
                {result.summary.status.replace(/_/g, " ")}
              </Badge>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: "Indicadores OK", value: String(result.summary.indicatorsOk) },
                  { label: "Indicadores divergentes", value: String(result.summary.indicatorsDiverging) },
                  { label: "Operações divergentes", value: String(result.summary.operationsDiverging) },
                  { label: "Competências divergentes", value: String(result.summary.competencesDiverging) },
                  { label: "Valor total da divergência", value: money(result.summary.totalDivergence) },
                ].map((card) => (
                  <div key={card.label} className="rounded-lg border bg-card p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{card.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Amostra homologada: {result.sample.ok} de {result.sample.total} operações sem divergência.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Homologação global</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicador</TableHead>
                    <TableHead className="text-right">Base Excel</TableHead>
                    <TableHead className="text-right">Sistema</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead className="text-right">Diferença %</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.indicators.map((row) => (
                    <TableRow key={row.indicator}>
                      <TableCell>{row.indicator}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.money ? money(row.base) : row.base}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.money ? money(row.system) : row.system}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.money ? money(row.diff) : row.diff}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{pct(row.diffPct, 2)}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Homologação por competência</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead className="text-right">Previsto base</TableHead>
                    <TableHead className="text-right">Previsto sist.</TableHead>
                    <TableHead className="text-right">Dif.</TableHead>
                    <TableHead className="text-right">Recebido base</TableHead>
                    <TableHead className="text-right">Recebido sist.</TableHead>
                    <TableHead className="text-right">Dif.</TableHead>
                    <TableHead className="text-right">Inadimpl. base</TableHead>
                    <TableHead className="text-right">Inadimpl. sist.</TableHead>
                    <TableHead className="text-right">Dif.</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.competences.map((row) => (
                    <TableRow key={row.competence}>
                      <TableCell>{competenceBR(row.competence)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.expectedBase)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.expectedSystem)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.expectedSystem - row.expectedBase)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.receivedBase)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.receivedSystem)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.receivedSystem - row.receivedBase)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.overdueBase)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.overdueSystem)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.overdueSystem - row.overdueBase)}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Homologação por operação</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <ScrollArea className="max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referência</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Capital base</TableHead>
                      <TableHead className="text-right">Capital sist.</TableHead>
                      <TableHead className="text-right">Recebido base</TableHead>
                      <TableHead className="text-right">Recebido sist.</TableHead>
                      <TableHead className="text-right">A receber base</TableHead>
                      <TableHead className="text-right">A receber sist.</TableHead>
                      <TableHead className="text-right">Vencido base</TableHead>
                      <TableHead className="text-right">Vencido sist.</TableHead>
                      <TableHead>Causa provável</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.operationsRows.map((row) => (
                      <TableRow
                        key={row.reference}
                        className="cursor-pointer"
                        onClick={() => setDrill(row)}
                      >
                        <TableCell className="font-medium">{row.reference}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.categoryBase ?? row.categorySystem ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.capitalBase)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.capitalSystem)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.receivedBase)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.receivedSystem)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.receivableBase)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.receivableSystem)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.overdueBase)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.overdueSystem)}</TableCell>
                        <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                          {row.causes.join("; ") || "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhamento da Inadimplência (Cutoff Agosto/2026)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operação</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(overdueBreakdown.data ?? []).map((row, i) => (
                    <TableRow key={`${row.reference}-${i}`}>
                      <TableCell>{row.reference}</TableCell>
                      <TableCell>{competenceBR(row.competence)}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={2}>TOTAL SISTEMA (Inadimplência < Agosto/2026)</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl((overdueBreakdown.data ?? []).reduce((acc, r) => acc + Number(r.amount), 0))}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold bg-primary/5 text-primary">
                    <TableCell colSpan={2}>TOTAL ESPERADO EXCEL</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(15068.54)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Testes de consistência interna</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.checks.map((check) => (
                <div key={check.name} className="flex items-center justify-between gap-4 rounded-md border p-2 text-sm">
                  <span>{check.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {check.detail}
                    <Badge variant={check.passed ? "secondary" : "destructive"}>
                      {check.passed ? "OK" : "FALHOU"}
                    </Badge>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Sheet open={Boolean(drill)} onOpenChange={(open) => !open && setDrill(null)}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Homologação da operação</SheetTitle>
            <SheetDescription>
              {drill?.reference} · origem: {drill?.sheets.join(", ") || "—"}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[80vh] pr-3">
            <p className="mb-3 text-xs text-muted-foreground">
              Causa provável: {drill?.causes.join("; ") || "sem divergência"}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comp.</TableHead>
                  <TableHead className="text-right">Prev. base</TableHead>
                  <TableHead className="text-right">Prev. sist.</TableHead>
                  <TableHead className="text-right">Receb. base</TableHead>
                  <TableHead className="text-right">Receb. sist.</TableHead>
                  <TableHead className="text-right">Venc. base</TableHead>
                  <TableHead className="text-right">Venc. sist.</TableHead>
                  <TableHead>Aba</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drill?.competences ?? []).map((row) => (
                  <TableRow key={row.competence}>
                    <TableCell>{competenceBR(row.competence)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(row.expectedBase)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(row.expectedSystem)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(row.receivedBase)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(row.receivedSystem)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(row.overdueBase)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(row.overdueSystem)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.sheet ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Sheet open={showPlan} onOpenChange={setShowPlan}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Plano de correção (não executado)</SheetTitle>
            <SheetDescription>Lista objetiva do que precisa ser corrigido. Nada é aplicado automaticamente.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[80vh] pr-3">
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {(result?.operationsRows ?? [])
                .filter((row) => row.status !== "OK")
                .slice(0, 50)
                .map((row) => (
                  <li key={row.reference}>
                    <span className="font-medium">{row.reference}</span> — {row.causes.join("; ") || "conferir valores"} (dif {money(row.worstDiff)})
                  </li>
                ))}
              {(result?.checks ?? [])
                .filter((check) => !check.passed)
                .map((check) => (
                  <li key={check.name}>Consistência: {check.name} ({check.detail})</li>
                ))}
              {result && result.summary.status === "APROVADA" && <li>Nada pendente — base homologada.</li>}
            </ol>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
