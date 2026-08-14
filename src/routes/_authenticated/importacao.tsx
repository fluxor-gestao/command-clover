import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useImports, useInvalidateAll } from "@/lib/data/hooks";
import { brl, dateBR } from "@/lib/format";
import { importParseResult, readWorkbookFile } from "@/lib/import/import-workbook";
import type { ParseResult } from "@/lib/import/parse-workbook";

export const Route = createFileRoute("/_authenticated/importacao")({
  head: () => ({
    meta: [
      { title: "Importação · Nova Era Investimentos" },
      {
        name: "description",
        content: "Importe as planilhas históricas em Excel, pré-visualize os dados e carregue tudo sem duplicar registros.",
      },
      { property: "og:title", content: "Importação · Nova Era Investimentos" },
      { property: "og:description", content: "Importação idempotente das planilhas históricas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const imports = useImports();
  const invalidate = useInvalidateAll();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);

  const analyse = async (selected: File) => {
    setBusy(true);
    try {
      setFile(selected);
      setPreview(await readWorkbookFile(selected));
      toast.success("Planilha analisada. Revise antes de importar.");
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
      const outcome = await importParseResult(file.name, preview);
      toast.success(
        `Importação concluída: ${outcome.operations} operações, ${outcome.installments} parcelas, ${outcome.receipts} recebimentos.`,
      );
      invalidate();
      setPreview(null);
      setFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na importação.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Importação</h1>
        <p className="text-sm text-muted-foreground">
          Envie as planilhas históricas (.xlsx). A carga é idempotente: reimportar o mesmo arquivo não duplica dados.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".xlsx"
            disabled={busy}
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void analyse(selected);
            }}
          />
          {preview && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-4 text-sm">
                <Stat label="Operações" value={String(preview.stats.operations)} />
                <Stat label="Parcelas" value={String(preview.stats.installments)} />
                <Stat label="Previsto" value={brl(preview.stats.expectedTotal)} />
                <Stat label="Recebido" value={brl(preview.stats.receivedTotal)} />
              </div>
              <p className="text-sm text-muted-foreground">
                {preview.issues.length} apontamentos de qualidade serão registrados.
              </p>
              <Button onClick={runImport} disabled={busy}>
                Confirmar importação
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
