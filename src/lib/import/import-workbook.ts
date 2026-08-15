import ExcelJS from "exceljs";

import { supabase } from "@/integrations/supabase/client";

import {
  listAnnualSheets,
  normalizeReference,
  parseWorkbook,
  type ParseOptions,
  type ParseResult,
} from "./parse-workbook";

export interface ImportProgress {
  step: string;
  done: number;
  total: number;
}

export interface ImportOutcome {
  importId: string;
  operations: number;
  installments: number;
  receipts: number;
  issues: number;
  stats: ParseResult["stats"];
}

/** Lista as abas anuais disponíveis no arquivo, sem gravar nada. */
export async function inspectWorkbookFile(file: File): Promise<{ workbook: ExcelJS.Workbook; sheets: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  return { workbook, sheets: listAnnualSheets(workbook) };
}

/** Lê a planilha no navegador e devolve o resultado normalizado (pré-visualização). */
export async function readWorkbookFile(file: File, options?: ParseOptions): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  return parseWorkbook(workbook, options);
}


/**
 * Carga idempotente: usa source_key em cada entidade, então reimportar o mesmo
 * arquivo não duplica operações, parcelas nem recebimentos.
 */
export async function importParseResult(
  filename: string,
  result: ParseResult,
  mode: "CARGA_HISTORICA" | "CONTROLE_GERENCIAL",
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportOutcome> {
  const { data: user } = await supabase.auth.getUser();
  const { data: importRow, error: importError } = await supabase
    .from("sync_runs")
    .insert({
      filename,
      mode,
      status: "EM_ANDAMENTO",
      total_processed: result.operations.length,
      created_by: user.user?.id,
    })
    .select("id")
    .single();
  if (importError) throw new Error(importError.message);
  const importId = importRow.id;

  const { data: categories, error: categoryError } = await supabase
    .from("investment_categories")
    .select("id, name");
  if (categoryError) throw new Error(categoryError.message);
  const categoryId = (name: string) => categories?.find((c) => c.name === name)?.id ?? null;

  let installmentsCount = 0;
  let receiptsCount = 0;
  const total = result.operations.length;
  let done = 0;

  for (const op of result.operations) {
    onProgress?.({ step: op.reference, done, total });
    done += 1;

    const sourceKey = `imp-op:${normalizeReference(op.reference)}`;
    const { data: existing } = await supabase
      .from("investment_operations")
      .select("id, source_hash, import_status")
      .or(`source_key.eq.${sourceKey},reference.ilike.${op.reference.replace(/[,()]/g, " ")}`)
      .limit(1)
      .maybeSingle();

    let operationId = existing?.id ?? null;

    // Se já existe e o hash é igual, pulamos a atualização da operação base
    const needsUpdate = !existing || existing.source_hash !== op.sourceHash;

    if (needsUpdate) {
      const payload = {
        reference: op.reference,
        category_id: categoryId(op.category),
        due_day: op.dueDay,
        initial_capital: op.initialCapital ?? 0,
        first_due_date: op.firstDueDate,
        installment_count: op.installmentCount,
        installment_value: op.installmentValue,
        notes: op.notes,
        source: "IMPORTADO",
        import_status: op.incomplete ? "PENDENTE_REVISAO" : "IMPORTADO",
        source_key: sourceKey,
        source_hash: op.sourceHash ?? null,
        last_synced_at: new Date().toISOString(),
      };

      const { data: saved, error } = await supabase
        .from("investment_operations")
        .upsert(payload, { onConflict: "source_key" })
        .select("id")
        .single();

      if (error) {
        await supabase.from("investment_import_issues").insert({
          import_id: importId,
          source_sheet: filename,
          reference: op.reference,
          issue_type: "VALOR_INVALIDO",
          description: `Falha ao gravar a operação: ${error.message}`,
        });
        continue;
      }
      operationId = saved.id;
    }

    // Se é uma aba de gestão (Base2026), vincular à carteira gerencial
    if (op.isManagement && operationId) {
      const yearMatch = op.sheets.find(s => s.startsWith("Base"))?.match(/\d{4}/);
      if (yearMatch) {
        const year = parseInt(yearMatch[0]);
        await supabase
          .from("portfolio_memberships")
          .upsert(
            { operation_id: operationId, portfolio_year: year, is_active: true },
            { onConflict: "operation_id,portfolio_year" }
          );
      }
    }

    if (op.installments.length > 0) {
      // Número determinístico por competência: estável entre importações de anos
      // diferentes e sem colisão com a numeração antiga (1..N).
      const numberFor = (competence: string) => {
        const year = Number(competence.slice(0, 4));
        const month = Number(competence.slice(5, 7));
        return (year - 2000) * 12 + month;
      };
      const rows = op.installments.map((inst) => ({
        operation_id: operationId!,
        installment_number: numberFor(inst.competence),
        competence: inst.competence,
        due_date: inst.dueDate,
        expected_amount: inst.expected,
        received_amount: inst.received,
        source: "IMPORTADO",
        source_key: `imp:${normalizeReference(op.reference)}:${inst.competence}`,
      }));
      const { data: savedInstallments, error: instError } = await supabase
        .from("investment_installments")
        .upsert(rows, { onConflict: "source_key" })
        .select("id, source_key, received_amount, due_date");
      if (instError) throw new Error(instError.message);
      installmentsCount += savedInstallments?.length ?? 0;


      const withReceipt = (savedInstallments ?? []).filter((i) => Number(i.received_amount) > 0);
      if (withReceipt.length > 0) {
        const receiptRows = withReceipt.map((inst) => ({
          operation_id: operationId!,
          receipt_date: inst.due_date,
          total_amount: Number(inst.received_amount),
          notes: "Recebimento importado da base histórica",
          source: "IMPORTADO",
          source_key: `imp-rec:${inst.source_key}`,
        }));
        const { data: savedReceipts, error: receiptError } = await supabase
          .from("investment_receipts")
          .upsert(receiptRows, { onConflict: "source_key" })
          .select("id, source_key");
        if (receiptError) throw new Error(receiptError.message);
        receiptsCount += savedReceipts?.length ?? 0;

        const allocations = (savedReceipts ?? [])
          .map((receipt) => {
            const installment = withReceipt.find((i) => `imp-rec:${i.source_key}` === receipt.source_key);
            if (!installment) return null;
            return {
              receipt_id: receipt.id,
              installment_id: installment.id,
              amount: Number(installment.received_amount),
            };
          })
          .filter((row): row is { receipt_id: string; installment_id: string; amount: number } => row !== null);

        if (allocations.length > 0) {
          const receiptIds = allocations.map((a) => a.receipt_id);
          const { data: existingAllocations } = await supabase
            .from("investment_receipt_allocations")
            .select("receipt_id")
            .in("receipt_id", receiptIds);
          const already = new Set((existingAllocations ?? []).map((a) => a.receipt_id));
          const pending = allocations.filter((a) => !already.has(a.receipt_id));
          if (pending.length > 0) {
            const { error: allocError } = await supabase
              .from("investment_receipt_allocations")
              .insert(pending);
            if (allocError) throw new Error(allocError.message);
          }
        }
      }
    }

    if (op.contributions.length > 0) {
      const { error: contribError } = await supabase.from("investment_contributions").upsert(
        op.contributions.map((c) => ({
          operation_id: operationId!,
          contribution_date: c.date,
          type: c.type,
          amount: c.amount,
          notes: c.notes,
          source: "IMPORTADO",
          source_key: `imp-ap:${normalizeReference(op.reference)}:${c.sourceKey}`,
        })),
        { onConflict: "source_key" },
      );
      if (contribError) throw new Error(contribError.message);
    }
  }

  if (result.issues.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < result.issues.length; i += chunkSize) {
      const { error } = await supabase.from("investment_import_issues").insert(
        result.issues.slice(i, i + chunkSize).map((issue) => ({
          import_id: importId,
          source_sheet: issue.sheet,
          source_row: issue.row,
          reference: issue.reference,
          issue_type: issue.issueType,
          description: `[${issue.severity ?? "INFORMATIVO"}] ${issue.description}`,
        })),
      );
      if (error) throw new Error(error.message);
    }
  }

  await supabase
    .from("sync_runs")
    .update({
      status: "CONCLUIDA",
      new_records: result.operations.length, // Simplificado
      finished_at: new Date().toISOString(),
      summary: {
        operacoes: result.operations.length,
        parcelas: installmentsCount,
        recebimentos: receiptsCount,
        previsto: result.stats.expectedTotal,
        recebido: result.stats.receivedTotal,
        inadimplente: result.stats.overdueTotal,
        investido: result.stats.investedTotal,
        abas: result.stats.sheetsRead,
      },
    })
    .eq("id", importId);

  return {
    importId,
    operations: result.operations.length,
    installments: installmentsCount,
    receipts: receiptsCount,
    issues: result.issues.length,
    stats: result.stats,
  };
}
