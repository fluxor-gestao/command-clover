import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useImports, useInvalidateAll } from "@/lib/data/hooks";
import { brl, competenceBR, dateBR } from "@/lib/format";
import { importParseResult, inspectWorkbookFile, readWorkbookFile } from "@/lib/import/import-workbook";
import type { IssueSeverity, ParseResult } from "@/lib/import/parse-workbook";

export const Route = createFileRoute("/_authenticated/importacao")({
  head: () => ({
    meta: [
      { title: "Importação · Nova Era Investimentos" },
      {
        name: "description",
        content: "Importe as planilhas históricas em Excel, homologue os totais lidos e carregue tudo sem duplicar registros.",
      },
      { property: "og:title", content: "Importação · Nova Era Investimentos" },
      { property: "og:description", content: "Homologação e importação idempotente das planilhas históricas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportPage,
});

const ALL_SHEETS = "__ALL__";

function ImportPage() {
  const imports = useImports();
  const invalidate = useInvalidateAll();
  const [importMode, setImportMode] = useState<"CARGA_HISTORICA" | "CONTROLE_GERENCIAL">("CARGA_HISTORICA");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>(ALL_SHEETS);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [showData, setShowData] = useState(false);
  const [forceUpdateRefs, setForceUpdateRefs] = useState<string[]>([]);

  const analyse = async (selected: File, sheet?: string) => {
    setBusy(true);
    try {
      setFile(selected);
      let sheetList = sheets;
      if (!sheet) {
        const inspected = await inspectWorkbookFile(selected);
        sheetList = inspected.sheets;
        setSheets(sheetList);
      }
      const target = sheet ?? ALL_SHEETS;
      setSelectedSheet(target);
      const result = await readWorkbookFile(
        selected,
        target && target !== ALL_SHEETS ? { sheets: [target] } : undefined,
      );

      // Enriquecer com Diff de Sincronização
      const syncInfo: Record<string, any> = {};
      const { data: operations } = await supabase.from("investment_operations").select("id, reference, source_hash");
      
      for (const op of result.operations) {
        const existing = operations?.find(o => o.reference === op.reference);
        if (!existing) {
          syncInfo[op.reference] = "NOVO";
        } else {
          // Usar RPC para detecção precisa de CONFLITO
          const { data: conflictStatus } = await supabase.rpc("check_sync_conflict", {
            p_operation_id: existing.id,
            p_incoming_hash: op.sourceHash || ""
          });
          const status = (conflictStatus as "NOVO" | "ALTERADO_NO_EXCEL" | "INALTERADO" | "CONFLITO") || "ALTERADO_NO_EXCEL";
          syncInfo[op.reference] = status;
        }
      }
      
      setPreview({ ...result, syncInfo });
      toast.success("Leitura concluída. Homologue os totais antes de importar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
    } finally {
      setBusy(false);
    }
  };


  const runImport = async () => {
    if (!file || !preview) return;
    setBusy(true);
    try {
      const outcome = await importParseResult(file.name, preview, importMode, undefined, { forceUpdateRefs });
      toast.success(
        `Importação concluída: ${outcome.operations} operações, ${outcome.installments} parcelas, ${outcome.receipts} recebimentos.`,
      );
      invalidate();
      setPreview(null);
      setFile(null);
      setSheets([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na importação.");
    } finally {
      setBusy(false);
    }
  };

  const clearPortfolio = async () => {
    const year = 2026;
    if (!window.confirm(`ATENÇÃO CRÍTICA: Isso apagará permanentemente TODOS os dados:\n- Operações ${year}\n- Parcelas e Vencimentos\n- Recebimentos e Aportes\n- Imóveis Próprios e Aluguéis\n\nEsta ação NÃO pode ser desfeita. Deseja zerar o sistema completamente para 2026?`)) {
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.rpc("clear_portfolio_data" as any, { p_year: year });
      if (error) throw new Error(error.message);
      
      toast.success(`Sistema zerado com sucesso para a base ${year}.`);
      invalidate();
      
      // Forçar atualização do dashboard e outras telas
      window.location.reload(); 
      
      setPreview(null);
      setFile(null);
      setSheets([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao limpar a carteira.");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Importação de Dados</h1>
          <p className="text-sm text-muted-foreground">
            Sincronize o sistema com as planilhas oficiais (Base Histórica ou Controle Gerencial).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-destructive hover:bg-destructive/10 border-destructive/20"
            disabled={busy}
            onClick={clearPortfolio}
          >
            Limpar Carteira 2026
          </Button>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-1">
            <Button
              variant={importMode === "CARGA_HISTORICA" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-[10px] font-bold uppercase tracking-wider"
              onClick={() => setImportMode("CARGA_HISTORICA")}
            >
              Carga Histórica
            </Button>
            <Button
              variant={importMode === "CONTROLE_GERENCIAL" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-[10px] font-bold uppercase tracking-wider"
              onClick={() => setImportMode("CONTROLE_GERENCIAL")}
            >
              Sincronizar Carteira
            </Button>
          </div>
        </div>

      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="file"
              accept=".xlsx"
              disabled={busy}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) void analyse(selected);
              }}
            />
            {sheets.length > 0 && (
              <Select
                value={selectedSheet}
                disabled={busy || !file}
                onValueChange={(value) => {
                  if (file) void analyse(file, value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aba a importar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SHEETS}>Todas as abas (carga histórica completa)</SelectItem>
                  {sheets.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {preview && (
            <>
              <p className="text-xs text-muted-foreground">
                Abas lidas: <strong>{preview.stats.sheetsRead.join(", ") || "—"}</strong> · mês de referência{" "}
                {competenceBR(`${preview.stats.referenceMonth}-01`)}
              </p>
              {preview.stats.byYear.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Ano</th>
                        <th className="px-3 py-2 text-right">Operações</th>
                        <th className="px-3 py-2 text-right">Parcelas</th>
                        <th className="px-3 py-2 text-right">Previsto</th>
                        <th className="px-3 py-2 text-right">Recebido</th>
                        <th className="px-3 py-2 text-right">Inadimplente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.stats.byYear.map((row) => (
                        <tr key={row.year} className="border-t">
                          <td className="px-3 py-2">{row.year}</td>
                          <td className="px-3 py-2 text-right">{row.operations}</td>
                          <td className="px-3 py-2 text-right">{row.installments}</td>
                          <td className="px-3 py-2 text-right">{brl(row.expected)}</td>
                          <td className="px-3 py-2 text-right">{brl(row.received)}</td>
                          <td className="px-3 py-2 text-right">{brl(row.overdue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </CardContent>
      </Card>

      {preview && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Homologação da leitura</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <HomologationTable preview={preview} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo da importação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-5 text-sm">
                <Stat label="Prontos" value={String(preview.readiness.ready)} />
                <Stat label="Pendentes" value={String(preview.readiness.pending)} />
                <Stat label="Novos" value={String(Object.values(preview.syncInfo ?? {}).filter(v => v === 'NOVO').length)} />
                <Stat label="Alterados" value={String(Object.values(preview.syncInfo ?? {}).filter(v => v === 'ALTERADO_NO_EXCEL').length)} />
                <Stat label="Conflitos" value={String(Object.values(preview.syncInfo ?? {}).filter(v => v === 'CONFLITO').length)} color="text-destructive" />
              </div>
              <button
                type="button"
                onClick={() => setShowIssues(true)}
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                {preview.issues.length} apontamentos de qualidade serão registrados
              </button>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setShowData(true)}>
                  Ver dados que serão importados
                </Button>
                <Button onClick={runImport} disabled={busy}>
                  Confirmar importação
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Pendências não críticas não impedem a importação — elas ficam registradas em Qualidade da base para
                saneamento posterior.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importações anteriores</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Linhas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(imports.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.filename}</TableCell>
                  <TableCell>{dateBR(row.created_at)}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="text-right">{row.rows_processed ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={showIssues} onOpenChange={setShowIssues}>
        <SheetContent side="right" className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Apontamentos de qualidade</SheetTitle>
            <SheetDescription>
              {preview?.issues.length ?? 0} apontamentos classificados por gravidade.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[calc(100vh-8rem)] pr-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aba</TableHead>
                  <TableHead>Linha</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Gravidade</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(preview?.issues ?? []).map((issue, i) => (
                  <TableRow key={`${issue.issueType}-${issue.row}-${i}`}>
                    <TableCell className="text-xs">{issue.sheet}</TableCell>
                    <TableCell className="text-xs">{issue.row}</TableCell>
                    <TableCell className="text-xs">{issue.reference ?? "—"}</TableCell>
                    <TableCell className="text-xs">{issue.issueType}</TableCell>
                    <TableCell className="max-w-sm text-xs">{issue.description}</TableCell>
                    <TableCell>
                      <SeverityBadge severity={issue.severity ?? "INFORMATIVO"} />
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-muted-foreground">{issue.action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Sheet open={showData} onOpenChange={setShowData}>
        <SheetContent side="right" className="w-full sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle>Dados que serão importados</SheetTitle>
            <SheetDescription>Inspeção completa antes da confirmação — nada foi gravado ainda.</SheetDescription>
          </SheetHeader>
          {preview && (
            <PreviewTabs 
              preview={preview} 
              forceUpdateRefs={forceUpdateRefs} 
              onToggleForce={(ref) => setForceUpdateRefs(prev => 
                prev.includes(ref) ? prev.filter(r => r !== ref) : [...prev, ref]
              )} 
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function HomologationTable({ preview }: { preview: ParseResult }) {
  const rows = useMemo(() => {
    const { baseline, stats } = preview;
    return [
      { label: "Operações", excel: baseline.operationRows, system: stats.operations, money: false },
      { label: "Capital Investido", excel: baseline.capitalTotal, system: stats.investedTotal, money: true },
      { label: "Valor Previsto", excel: baseline.monthlyTotal, system: stats.expectedTotal, money: true },
      { label: "Total Recebido", excel: baseline.receivedTotal, system: stats.receivedTotal, money: true },
      { label: "Saldo Inadimplente", excel: baseline.overdueTotal, system: stats.overdueTotal, money: true },
      { label: "Total a Receber", excel: baseline.toReceiveTotal, system: stats.toReceiveTotal, money: true },
      { label: "Parcelas", excel: baseline.monthlyCells, system: stats.installments, money: false },
    ];
  }, [preview]);

  const fmt = (value: number, money: boolean) => (money ? brl(value) : String(value));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Indicador</TableHead>
          <TableHead className="text-right">Base Excel</TableHead>
          <TableHead className="text-right">Sistema</TableHead>
          <TableHead className="text-right">Diferença</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const diff = Math.round((row.system - row.excel) * 100) / 100;
          const ok = Math.abs(diff) < 0.01;
          return (
            <TableRow key={row.label}>
              <TableCell>{row.label}</TableCell>
              <TableCell className="text-right">{fmt(row.excel, row.money)}</TableCell>
              <TableCell className="text-right">{fmt(row.system, row.money)}</TableCell>
              <TableCell className="text-right">{fmt(diff, row.money)}</TableCell>
              <TableCell>
                <Badge variant={ok ? "secondary" : "destructive"}>{ok ? "OK" : "DIVERGENTE"}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function PreviewTabs({ 
  preview, 
  forceUpdateRefs, 
  onToggleForce 
}: { 
  preview: ParseResult; 
  forceUpdateRefs: string[]; 
  onToggleForce: (ref: string) => void;
}) {
  const installments = preview.operations.flatMap((op) =>
    op.installments.map((inst) => ({ reference: op.reference, ...inst })),
  );
  const receipts = installments.filter((i) => i.received > 0);
  const overdue = installments.filter((i) => i.overdue > 0);

  return (
    <Tabs defaultValue="operacoes" className="mt-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="operacoes">Operações ({preview.operations.length})</TabsTrigger>
        <TabsTrigger value="parcelas">Parcelas ({installments.length})</TabsTrigger>
        <TabsTrigger value="recebimentos">Recebimentos ({receipts.length})</TabsTrigger>
        <TabsTrigger value="inadimplencias">Inadimplências ({overdue.length})</TabsTrigger>
        <TabsTrigger value="pendencias">Pendências ({preview.issues.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="operacoes">
        <ScrollArea className="h-[calc(100vh-14rem)] pr-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Venc.</TableHead>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead className="text-right">Parcelas</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.operations.map((op) => {
                const syncStatus = preview.syncInfo?.[op.reference];
                const isConflict = syncStatus === "CONFLITO";
                const isForced = forceUpdateRefs.includes(op.reference);

                return (
                  <TableRow key={op.sourceKey} className={cn(isConflict && !isForced && "bg-destructive/5")}>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-1">
                        <span>{op.reference}</span>
                        {syncStatus && (
                          <Badge 
                            variant={
                              syncStatus === "NOVO" ? "secondary" : 
                              syncStatus === "CONFLITO" ? "destructive" : "default"
                            } 
                            className="w-fit text-[8px] h-4"
                          >
                            {syncStatus}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{op.category}</TableCell>
                    <TableCell className="text-right text-xs">{op.dueDay ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs">{brl(op.initialCapital ?? 0)}</TableCell>
                    <TableCell className="text-right text-xs">{op.installments.length}</TableCell>
                    <TableCell className="text-right">
                      {isConflict ? (
                        <Button 
                          size="sm" 
                          variant={isForced ? "default" : "outline"} 
                          className="h-7 text-[9px]"
                          onClick={() => onToggleForce(op.reference)}
                        >
                          {isForced ? "USAR EXCEL" : "MANTER SISTEMA"}
                        </Button>
                      ) : (
                        <span className="text-[9px] text-muted-foreground">Automático</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </TabsContent>

      {[
        { value: "parcelas", rows: installments },
        { value: "recebimentos", rows: receipts },
        { value: "inadimplencias", rows: overdue },
      ].map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          <ScrollArea className="h-[calc(100vh-14rem)] pr-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Previsto</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Em aberto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tab.rows.map((row) => (
                  <TableRow key={`${row.sourceKey}-${tab.value}`}>
                    <TableCell className="text-xs">{row.reference}</TableCell>
                    <TableCell className="text-xs">{competenceBR(row.competence)}</TableCell>
                    <TableCell className="text-xs">{dateBR(row.dueDate)}</TableCell>
                    <TableCell className="text-right text-xs">{brl(row.expected)}</TableCell>
                    <TableCell className="text-right text-xs">{brl(row.received)}</TableCell>
                    <TableCell className="text-right text-xs">{brl(row.overdue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>
      ))}

      <TabsContent value="pendencias">
        <ScrollArea className="h-[calc(100vh-14rem)] pr-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aba</TableHead>
                <TableHead>Linha</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Gravidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.issues.map((issue, i) => (
                <TableRow key={`${issue.issueType}-${i}`}>
                  <TableCell className="text-xs">{issue.sheet}</TableCell>
                  <TableCell className="text-xs">{issue.row}</TableCell>
                  <TableCell className="text-xs">{issue.reference ?? "—"}</TableCell>
                  <TableCell className="text-xs">{issue.issueType}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={issue.severity ?? "INFORMATIVO"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  const variant = severity === "CRITICO" ? "destructive" : severity === "ATENCAO" ? "default" : "secondary";
  return <Badge variant={variant}>{severity}</Badge>;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className={cn("font-semibold", color)}>{value}</p>
    </div>
  );
}
