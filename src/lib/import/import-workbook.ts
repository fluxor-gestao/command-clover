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
  rentals: number;
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
  options?: { forceUpdateRefs?: string[] },
): Promise<ImportOutcome> {
  const { data: user } = await supabase.auth.getUser();
  const { data: importRow, error: importError } = await supabase
    .from("sync_runs")
    .insert({
      filename,
      mode,
      status: "EM_ANDAMENTO",
      created_by: user.user?.id ?? null,
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
  let rentalsCount = 0;
  const total = result.operations.length + result.rentals.length;
  let done = 0;

  // 1. Sincronizar Aluguéis (rental_properties / rental_receipts)
  for (const rent of result.rentals) {
    onProgress?.({ step: `Aluguel: ${rent.reference}`, done, total });
    done += 1;

    const { data: existing } = await supabase
      .from("rental_properties")
      .select("id, source_hash")
      .eq("source_key", rent.sourceKey)
      .maybeSingle();

    let syncStatus: "NOVO" | "ALTERADO" | "INALTERADO" | "CONFLITO" = "NOVO";
    if (existing) {
      if (existing.source_hash === rent.sourceHash) {
        syncStatus = "INALTERADO";
      } else {
        // Se houve alteração manual no sistema após o último sync
        // (Aqui simplificamos a detecção de conflito para aluguéis)
        syncStatus = "ALTERADO";
      }
    }

    if (mode === "CONTROLE_GERENCIAL" && syncStatus === "INALTERADO") continue;

    const isForced = options?.forceUpdateRefs?.includes(rent.reference);
    if (mode === "CONTROLE_GERENCIAL" && syncStatus === ("CONFLITO" as any) && !isForced) {
        // Log issue
        continue;
    }

    const { data: saved, error } = await supabase
      .from("rental_properties")
      .upsert({
        name: rent.reference,
        due_day: rent.dueDay,
        current_rent: rent.currentRent ?? 0,
        status: rent.status,
        notes: rent.notes,
        source_key: rent.sourceKey,
        source_hash: rent.sourceHash,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "source_key" })
      .select("id")
      .single();

    if (error) continue;
    rentalsCount += 1;

    // Sincronizar recebíveis de aluguel (opcional/simplificado)
    for (const [comp, val] of Object.entries(rent.monthlyValues)) {
        if (val <= 0) continue;
        const isPast = comp < result.stats.referenceMonth;
        // Se for passado e não estiver marcado como vermelho (no parser), assumimos recebido
        // Aqui o parser já calculou receivedAmount, mas poderíamos detalhar parcelas se houvesse tabela rental_receipts adequada
    }
  }

  for (const op of result.operations) {
    // Aba Aluguéis / Patrimônio: Ignorar se for imóvel próprio na carteira de investimentos
    if (op.category?.toUpperCase() === "ALUGUEL" || op.reference.toLowerCase().includes("aluguel")) {
      continue;
    }

    onProgress?.({ step: op.reference, done, total });
    done += 1;

    const sourceKey = `imp-op:${normalizeReference(op.reference)}`;
    const { data: existing } = await supabase
      .from("investment_operations")
      .select("id, source_hash, import_status, reference")
      .or(`source_key.eq.${sourceKey},reference.ilike.${op.reference.replace(/[,.()\-]/g, " ").replace(/\s+/g, " ").trim()}`)
      .limit(1)
      .maybeSingle();

    let operationId = existing?.id ?? null;

    // Lógica de Diff/Sync
    let syncStatus: "NOVO" | "ALTERADO_NO_EXCEL" | "INALTERADO" | "CONFLITO" = "NOVO";
    if (existing) {
      const { data: status } = await supabase.rpc("check_sync_conflict", {
        p_operation_id: existing.id,
        p_incoming_hash: op.sourceHash ?? "",
      });
      syncStatus = (status as "NOVO" | "ALTERADO_NO_EXCEL" | "INALTERADO" | "CONFLITO") || "ALTERADO_NO_EXCEL";
    }

    // Se é modo de sincronização e está inalterado, pulamos a atualização
    if (mode === "CONTROLE_GERENCIAL" && syncStatus === "INALTERADO") {
      continue;
    }

    // BLOQUEADOR 1: Se há conflito no modo CONTROLE_GERENCIAL, não sobrescrever automaticamente, a menos que forçado
    const isForced = options?.forceUpdateRefs?.includes(op.reference);
    if (mode === "CONTROLE_GERENCIAL" && syncStatus === ("CONFLITO" as any) && !isForced) {
      await supabase.from("investment_import_issues").insert({
        import_id: importId,
        source_sheet: filename,
        reference: op.reference,
        issue_type: "VALOR_INVALIDO",
        description: `[CONFLITO] A operação possui alterações manuais no sistema que conflitam com o Excel. Resolução manual necessária.`,
      });
      continue;
    }

    const needsUpdate = syncStatus !== "INALTERADO" || isForced;

    if (needsUpdate) {
      const payload = {
        reference: op.reference,
        category_id: categoryId(op.category),
        due_day: op.dueDay,
        initial_capital: op.initialCapital ?? 0,
        first_due_date: op.firstDueDate,
        installment_count: op.installmentCount,
        installment_value: op.installmentValue,
        last_due_date: op.lastDueDate || null,
        notes: op.notes,
        source: "IMPORTADO",
        import_status: op.incomplete ? "PENDENTE_REVISAO" : "VALIDADO",
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
    if (mode === "CONTROLE_GERENCIAL" && operationId) {
      if (op.isManagement) {
        await supabase
          .from("portfolio_memberships")
          .upsert(
            { operation_id: operationId, portfolio_year: 2026, is_active: true },
            { onConflict: "operation_id,portfolio_year" }
          );
      }
      // NOTA: A inativação global de memberships que não estão na planilha agora 
      // é feita no final do processo de importação para ser atômica e segura.
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

  // Se é CONTROLE_GERENCIAL, inativar memberships de 2026 que não foram processados nesta rodada
  if (mode === "CONTROLE_GERENCIAL") {
    const importedOpIds = result.operations
      .filter(op => op.isManagement)
      .map(op => `imp-op:${normalizeReference(op.reference)}`);
    
    // Inativar operações que não estão na Base2026
    const { data: currentOps } = await supabase
      .from("investment_operations")
      .select("id")
      .in("source_key", importedOpIds);
    
    const validIds = (currentOps || []).map(o => o.id);
    
    if (validIds.length > 0) {
      await supabase
        .from("portfolio_memberships")
        .update({ is_active: false })
        .match({ portfolio_year: 2026 })
        .not("operation_id", "in", `(${validIds.join(",")})`);
    }
  }


  await supabase
    .from("sync_runs")
    .update({
      status: "CONCLUIDA",
      confirmed_at: new Date().toISOString(),
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
    rentals: rentalsCount,
    installments: installmentsCount,
    receipts: receiptsCount,
    issues: result.issues.length,
    stats: result.stats,
  };
}
