import type { Workbook, Worksheet, Cell, Row } from "exceljs";

import { addMonthsClamped } from "../finance/contract";

/**
 * Leitor das planilhas Nova Era.
 *
 * Suporta dois layouts:
 *  - v3 "Controle Gerencial": abas Operações / Recebimentos / Aportes / Base2026 / Alugueis.
 *  - legado: abas anuais ("A Receber 2026", "Base2026") com grade mensal colorida.
 */

export interface ParseOptions {
  referenceMonth?: string;
  sheets?: string[];
}

/** Corte oficial de inadimplência: competências anteriores a este mês. */
export const CUTOFF_COMPETENCE = "2026-08";
/** Nenhuma parcela anterior a esta competência entra no sistema. */
export const MIN_COMPETENCE = "2026-01";

export function listAnnualSheets(workbook: Workbook): string[] {
  const names = workbook.worksheets.map((s) => s.name);
  if (isV3Workbook(workbook)) {
    return names.filter((n) => {
      const t = normalizeText(n);
      return (
        t.startsWith("OPERACOES") ||
        t.startsWith("RECEBIMENTOS") ||
        t.startsWith("APORTES") ||
        t.startsWith("BASE") ||
        t.startsWith("ALUGUEIS")
      );
    });
  }
  return names.filter((n) => normalizeText(n).startsWith("A RECEBER") || n.match(/20\d{2}/));
}

export type IssueType =
  | "CONTRATO_INCOMPLETO"
  | "PARCELAS_NAO_IDENTIFICADAS"
  | "PRIMEIRO_VENCIMENTO_AUSENTE"
  | "CAPITAL_NAO_IDENTIFICADO"
  | "REFERENCIA_DUPLICADA"
  | "OPERACAO_NAO_ENCONTRADA"
  | "VALOR_INVALIDO"
  | "CELULA_NAO_INTERPRETADA"
  | "POSSIVEL_INADIMPLENCIA"
  | "LINHA_IGNORADA";

export type IssueSeverity = "INFORMATIVO" | "ATENCAO" | "CRITICO";

export interface ParsedIssue {
  sheet: string;
  row: string;
  reference: string | null;
  issueType: IssueType;
  description: string;
  severity?: IssueSeverity;
  action?: string;
  raw?: Record<string, unknown>;
}

export interface ParsedInstallment {
  competence: string; // YYYY-MM-01
  dueDate: string; // YYYY-MM-DD
  expected: number;
  received: number;
  overdue: number;
  sourceKey: string;
  sheet: string;
}

export interface ParsedReceipt {
  competence: string; // YYYY-MM-01
  receiptDate: string; // YYYY-MM-DD
  amount: number;
  notes: string | null;
  sourceKey: string;
}

export interface ParsedContribution {
  date: string;
  type: string;
  amount: number;
  notes: string | null;
  sourceKey: string;
}

export interface ParsedOperation {
  reference: string;
  category: string;
  dueDay: number | null;
  initialCapital: number | null;
  firstDueDate: string | null;
  lastDueDate: string | null;
  installmentCount: number | null;
  installmentValue: number | null;
  notes: string | null;
  sourceKey: string;
  sourceHash?: string;
  isManagement?: boolean;
  installments: ParsedInstallment[];
  receipts: ParsedReceipt[];
  contributions: ParsedContribution[];
  incomplete: boolean;
  sheets: string[];
}

export interface ParsedRental {
  reference: string;
  dueDay: number | null;
  currentRent: number | null;
  contractStart: string | null;
  contractEnd: string | null;
  adjustmentDate: string | null;
  status: string;
  notes: string | null;
  monthlyValues: Record<string, number>;
  receivedAmount: number;
  sourceKey: string;
  sourceHash: string;
}

export interface ParseBaseline {
  operationRows: number;
  capitalTotal: number;
  monthlyTotal: number;
  receivedTotal: number;
  overdueTotal: number;
  toReceiveTotal: number;
  monthlyCells: number;
  ignoredRows: number;
}

export interface ParseResult {
  operations: ParsedOperation[];
  rentals: ParsedRental[];
  issues: ParsedIssue[];
  baseline: ParseBaseline;
  layout?: "V3" | "LEGADO";
  syncInfo?: Record<string, "NOVO" | "ALTERADO_NO_EXCEL" | "INALTERADO" | "CONFLITO">;
  readiness: {
    ready: number;
    pending: number;
    ignored: number;
    critical: number;
  };
  stats: {
    sheetsRead: string[];
    availableSheets: string[];
    referenceMonth: string;
    operations: number;
    rentals: number;
    installments: number;
    receivedInstallments: number;
    overdueInstallments: number;
    contributions: number;
    expectedTotal: number;
    receivedTotal: number;
    overdueTotal: number;
    toReceiveTotal: number;
    investedTotal: number;
    byYear: {
      year: string;
      operations: number;
      rentals: number;
      installments: number;
      expected: number;
      received: number;
      overdue: number;
    }[];
  };
}

const MONTHS: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizeReference(reference: string): string {
  return normalizeText(reference).replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cellText(cell: Cell | undefined): string {
  if (!cell) return "";
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const rich = value as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (rich.richText) return rich.richText.map((r) => r.text).join("").trim();
    if (rich.text) return String(rich.text).trim();
    if (rich.result !== undefined && rich.result !== null) return String(rich.result).trim();
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function cellNumber(cell: Cell | undefined): number | null {
  if (!cell) return null;
  const raw = cell.value;
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return round2(raw);
  if (typeof raw === "object") {
    const result = (raw as { result?: unknown }).result;
    if (typeof result === "number") return round2(result);
  }
  const text = cellText(cell)
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) && text !== "" ? round2(parsed) : null;
}

function cellDate(cell: Cell | undefined): string | null {
  if (!cell) return null;
  const raw = cell.value;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "object" && raw !== null) {
    const result = (raw as { result?: unknown }).result;
    if (result instanceof Date) return result.toISOString().slice(0, 10);
  }
  const text = cellText(cell);
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function isRed(cell: Cell | undefined): boolean {
  if (!cell) return false;
  const fill = cell.fill as { fgColor?: { argb?: string } } | undefined;
  const argb = fill?.fgColor?.argb ?? (cell.font?.color as { argb?: string } | undefined)?.argb;
  if (argb && /FF0000$/i.test(argb)) return true;
  return false;
}

function categoryFromSection(section: string): string {
  const text = normalizeText(section);
  if (text.includes("CARRO") || text.includes("VEICUL")) return "Veículos";
  if (text.includes("EMPREST")) return "Empréstimos";
  if (text.includes("SUBLOCA")) return "Sublocação";
  if (text.includes("ALUGUE") || text.includes("IMOVE") || text.includes("CONDOMINIO")) return "Aluguéis";
  return "Outros";
}

function buildDueDate(year: number, month: number, dueDay: number | null): string {
  const day = dueDay && dueDay > 0 ? Math.min(dueDay, 28) : 25;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function yearFromSheetName(name: string): number | null {
  const match = name.match(/(20\d{2})/);
  return match ? Number(match[1]) : null;
}

function hashOf(parts: unknown[]): string {
  // Hash estável e compatível com o navegador (FNV-1a 64 bits simplificado).
  const text = parts.map((p) => String(p ?? "")).join("|");
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((code << 3) | i % 7), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;

}

/* ------------------------------------------------------------------ */
/* Localização de cabeçalhos por nome (não por índice fixo)            */
/* ------------------------------------------------------------------ */

interface HeaderMap {
  row: number;
  cols: Record<string, number>;
  monthCols: { col: number; month: number }[];
}

function findHeader(sheet: Worksheet, required: string[]): HeaderMap | null {
  let found: HeaderMap | null = null;
  sheet.eachRow((row: Row, rowNum: number) => {
    if (found || rowNum > 20) return;
    const cols: Record<string, number> = {};
    const monthCols: { col: number; month: number }[] = [];
    row.eachCell({ includeEmpty: false }, (cell: Cell, col: number) => {
      const label = normalizeText(cellText(cell));
      if (!label) return;
      if (!(label in cols)) cols[label] = col;
      const month = MONTHS[label];
      if (month) monthCols.push({ col, month });
    });
    const ok = required.every((label) => Object.keys(cols).some((key) => key.includes(label)));
    if (ok) found = { row: rowNum, cols, monthCols };
  });
  return found;
}

function col(header: HeaderMap, ...labels: string[]): number | null {
  for (const label of labels) {
    const target = normalizeText(label);
    const exact = header.cols[target];
    if (exact) return exact;
    const partial = Object.keys(header.cols).find((key) => key.includes(target));
    if (partial) return header.cols[partial] ?? null;
  }
  return null;
}

function sheetByName(workbook: Workbook, ...prefixes: string[]): Worksheet | null {
  for (const prefix of prefixes) {
    const target = normalizeText(prefix);
    const sheet = workbook.worksheets.find((s) => normalizeText(s.name).startsWith(target));
    if (sheet) return sheet;
  }
  return null;
}

export function isV3Workbook(workbook: Workbook): boolean {
  return Boolean(sheetByName(workbook, "OPERACOES") && sheetByName(workbook, "RECEBIMENTOS"));
}

/* ------------------------------------------------------------------ */
/* Índice de operações                                                 */
/* ------------------------------------------------------------------ */

class OperationIndex {
  private map = new Map<string, ParsedOperation>();
  get(reference: string, category: string, keyOverride?: string): ParsedOperation {
    const key = keyOverride ?? normalizeReference(reference);
    const existing = this.map.get(key);
    if (existing) return existing;
    const created: ParsedOperation = {
      reference: reference.trim(),
      category,
      dueDay: null,
      initialCapital: null,
      firstDueDate: null,
      lastDueDate: null,
      installmentCount: null,
      installmentValue: null,
      notes: null,
      sourceKey: `ref:${key}`,
      installments: [],
      receipts: [],
      contributions: [],
      incomplete: false,
      sheets: [],
    };
    this.map.set(key, created);
    return created;
  }
  find(reference: string): ParsedOperation | null {
    return this.map.get(normalizeReference(reference)) ?? null;
  }
  all() { return [...this.map.values()]; }
}

function upsertInstallment(op: ParsedOperation, inst: ParsedInstallment) {
  const existing = op.installments.find((i) => i.competence === inst.competence);
  if (existing) {
    // No layout V3, Operações gera o cronograma e Recebimentos abate.
    // Não devemos somar expected, mas sim manter o maior ou o do contrato.
    existing.expected = Math.max(existing.expected, inst.expected);
    existing.received = round2(existing.received + inst.received);
    existing.overdue = Math.max(existing.overdue, inst.overdue);
  } else {
    op.installments.push(inst);
  }
}

function emptyResult(referenceMonth: string): ParseResult {
  return {
    operations: [], rentals: [], issues: [],
    baseline: { operationRows: 0, capitalTotal: 0, monthlyTotal: 0, receivedTotal: 0, overdueTotal: 0, toReceiveTotal: 0, monthlyCells: 0, ignoredRows: 0 },
    readiness: { ready: 0, pending: 0, ignored: 0, critical: 0 },
    stats: {
      sheetsRead: [], availableSheets: [], referenceMonth, operations: 0, rentals: 0, installments: 0,
      receivedInstallments: 0, overdueInstallments: 0, contributions: 0, expectedTotal: 0, receivedTotal: 0,
      overdueTotal: 0, toReceiveTotal: 0, investedTotal: 0, byYear: [],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Entrada principal                                                   */
/* ------------------------------------------------------------------ */

export async function parseWorkbook(workbook: Workbook, options?: ParseOptions): Promise<ParseResult> {
  const referenceMonth = options?.referenceMonth ?? new Date().toISOString().slice(0, 7);
  const result = emptyResult(referenceMonth);
  result.stats.availableSheets = workbook.worksheets.map((s) => s.name);

  const index = new OperationIndex();
  const allowed = (name: string) => !options?.sheets || options.sheets.includes(name);

  if (isV3Workbook(workbook)) {
    result.layout = "V3";
    parseV3(workbook, index, result, allowed);
  } else {
    result.layout = "LEGADO";
    workbook.eachSheet((sheet) => {
      const name = normalizeText(sheet.name);
      if (!allowed(sheet.name)) return;
      if (name.startsWith("A RECEBER") || name.match(/20\d{2}/) || name.startsWith("BASE")) {
        const isBase2026 = name.includes("2026") && name.includes("BASE");
        const year = yearFromSheetName(sheet.name) || (isBase2026 ? 2026 : new Date().getFullYear());
        if (year < 2026 && !isBase2026) return;
        parseAnnualSheet(sheet, year, index, result.issues, result.baseline, referenceMonth, isBase2026);
        result.stats.sheetsRead.push(sheet.name);
      } else if (name.includes("ALUGUEIS") || name.includes("PATRIMONIO")) {
        parseRentalsSheet(sheet, result);
        result.stats.sheetsRead.push(sheet.name);
      }
    });
  }

  result.operations = index.all();
  computeStats(result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Layout v3                                                           */
/* ------------------------------------------------------------------ */

function parseV3(workbook: Workbook, index: OperationIndex, result: ParseResult, allowed: (name: string) => boolean) {
  const operations = sheetByName(workbook, "OPERACOES");
  const receipts = sheetByName(workbook, "RECEBIMENTOS");
  const contributions = sheetByName(workbook, "APORTES");
  const rentals = sheetByName(workbook, "ALUGUEIS");
  const panel = sheetByName(workbook, "PAINEL");

  if (operations && allowed(operations.name)) {
    parseOperationsSheet(operations, index, result);
    result.stats.sheetsRead.push(operations.name);
  }
  if (receipts && allowed(receipts.name)) {
    parseReceiptsSheet(receipts, index, result);
    result.stats.sheetsRead.push(receipts.name);
  }
  if (contributions && allowed(contributions.name)) {
    parseContributionsSheet(contributions, index, result);
    result.stats.sheetsRead.push(contributions.name);
  }
  if (rentals && allowed(rentals.name)) {
    parseRentalsSheetV3(rentals, result);
    result.stats.sheetsRead.push(rentals.name);
  }
  if (panel) parsePanelBaseline(panel, result.baseline);

  // Status derivado das parcelas depois de aplicar todas as baixas.
  for (const op of index.all()) {
    // Ordenar por competência para garantir projeção correta
    op.installments.sort((a, b) => a.competence.localeCompare(b.competence));
    
    for (const inst of op.installments) {
      const competence = inst.competence.slice(0, 7);
      const pending = round2(Math.max(inst.expected - inst.received, 0));
      // Inadimplência Stricto Sensu: apenas se for antes do Ponto de Corte (Agosto 2026)
      inst.overdue = competence < CUTOFF_COMPETENCE ? pending : 0;
    }
  }
}

/** Aba Operações: fonte oficial do contrato. Gera o cronograma completo. */
function parseOperationsSheet(sheet: Worksheet, index: OperationIndex, result: ParseResult) {
  const header = findHeader(sheet, ["REFERENCIA"]);
  if (!header) {
    result.issues.push({
      sheet: sheet.name, row: "-", reference: null, issueType: "CELULA_NAO_INTERPRETADA",
      severity: "CRITICO", description: "Cabeçalho da aba Operações não encontrado.",
      action: "Confira se a aba possui a coluna 'Referência / Operação'.",
    });
    return;
  }

  const cRef = col(header, "REFERENCIA")!;
  const cCategory = col(header, "CATEGORIA");
  const cDueDay = col(header, "DIA VENC");
  const cCapital = col(header, "CAPITAL INICIAL", "CAPITAL INFORMADO");
  const cFirstDue = col(header, "1o VENCIMENTO", "1º VENCIMENTO", "VENCIMENTO");
  const cCount = col(header, "N PARCELAS", "Nº PARCELAS", "QTDE PARCELAS");
  const cValue = col(header, "VALOR PARCELA");
  const cFinal = col(header, "DATA FINAL");
  const cStatus = col(header, "SITUACAO");
  const cNotes = col(header, "OBSERVACOES", "OBSERVACAO");

  sheet.eachRow((row: Row, rowNum: number) => {
    if (rowNum <= header.row) return;
    const reference = cellText(row.getCell(cRef));
    if (!reference || normalizeText(reference).includes("TOTAL")) return;

    const category = cCategory ? categoryFromSection(cellText(row.getCell(cCategory))) : "Outros";
    const dueDay = cDueDay ? cellNumber(row.getCell(cDueDay)) : null;
    const capital = cCapital ? cellNumber(row.getCell(cCapital)) : null;
    const firstDue = cFirstDue ? cellDate(row.getCell(cFirstDue)) : null;
    const count = cCount ? cellNumber(row.getCell(cCount)) : null;
    const value = cValue ? cellNumber(row.getCell(cValue)) : null;
    const finalDate = cFinal ? cellDate(row.getCell(cFinal)) : null;
    const notes = cNotes ? cellText(row.getCell(cNotes)) : "";
    const status = cStatus ? cellText(row.getCell(cStatus)) : "";

    const op = index.get(reference, category);
    op.isManagement = true;
    op.sheets.push(sheet.name);
    op.dueDay = dueDay && dueDay > 0 ? Math.min(Math.trunc(dueDay), 31) : op.dueDay;
    op.initialCapital = capital ?? op.initialCapital;
    op.firstDueDate = firstDue ?? op.firstDueDate;
    op.installmentCount = count && count > 0 ? Math.trunc(count) : op.installmentCount;
    op.installmentValue = value ?? op.installmentValue;
    op.lastDueDate = finalDate ?? op.lastDueDate;
    op.notes = notes || op.notes;
    op.sourceHash = hashOf([
      normalizeReference(reference), category, op.dueDay, op.initialCapital,
      op.firstDueDate, op.installmentCount, op.installmentValue, op.lastDueDate,
    ]);

    result.baseline.operationRows += 1;
    result.baseline.capitalTotal = round2(result.baseline.capitalTotal + (capital ?? 0));

    if (!op.firstDueDate || !op.installmentCount || !op.installmentValue) {
      op.incomplete = true;
      result.issues.push({
        sheet: sheet.name, row: String(rowNum), reference, issueType: "CONTRATO_INCOMPLETO",
        severity: "ATENCAO",
        description: "Contrato sem 1º vencimento, nº de parcelas ou valor da parcela — cronograma não projetado.",
        action: "Complete os dados na aba Operações e reimporte.",
      });
      return;
    }

    if (normalizeText(status).includes("CANCEL")) {
      result.baseline.ignoredRows += 1;
      return;
    }

    generateSchedule(op, sheet.name, result.baseline);
  });
}

/** Cronograma projetado: 1º vencimento + nº parcelas, limitado pela data final. */
function generateSchedule(op: ParsedOperation, sheetName: string, baseline: ParseBaseline) {
  const count = op.installmentCount ?? 0;
  const value = op.installmentValue ?? 0;
  if (!op.firstDueDate || count <= 0 || value <= 0) return;

  for (let i = 0; i < count; i += 1) {
    const dueDate = addMonthsClamped(op.firstDueDate, i, op.dueDay);
    if (op.lastDueDate && dueDate > op.lastDueDate) break;
    const competence = `${dueDate.slice(0, 7)}-01`;
    const compMonth = competence.slice(0, 7);
    if (compMonth < MIN_COMPETENCE) continue;

    upsertInstallment(op, {
      competence,
      dueDate,
      expected: value,
      received: 0,
      overdue: 0,
      sourceKey: `inst:${normalizeReference(op.reference)}:${competence.slice(0, 7)}`,
      sheet: sheetName,
    });
    baseline.monthlyCells += 1;
    baseline.monthlyTotal = round2(baseline.monthlyTotal + value);
  }
}

/** Aba Recebimentos: baixas efetivas por competência. */
function parseReceiptsSheet(sheet: Worksheet, index: OperationIndex, result: ParseResult) {
  const header = findHeader(sheet, ["REFERENCIA", "COMPETENCIA"]);
  if (!header) return;

  const cRef = col(header, "REFERENCIA")!;
  const cCompetence = col(header, "COMPETENCIA")!;
  const cAmount = col(header, "VALOR RECEBIDO", "VALOR");
  const cDate = col(header, "DATA RECEBIMENTO", "DATA");
  const cNotes = col(header, "OBSERVACAO", "OBSERVACOES");
  const seq = new Map<string, number>();

  sheet.eachRow((row: Row, rowNum: number) => {
    if (rowNum <= header.row) return;
    const reference = cellText(row.getCell(cRef));
    if (!reference || normalizeText(reference).includes("TOTAL")) return;

    const competenceDate = cellDate(row.getCell(cCompetence));
    const amount = cAmount ? cellNumber(row.getCell(cAmount)) : null;
    if (!competenceDate || !amount || amount <= 0) return;

    const competence = `${competenceDate.slice(0, 7)}-01`;
    const compMonth = competence.slice(0, 7);
    if (compMonth < MIN_COMPETENCE) {
      result.baseline.ignoredRows += 1;
      return;
    }

    const op = index.find(reference);
    if (!op) {
      result.issues.push({
        sheet: sheet.name, row: String(rowNum), reference, issueType: "OPERACAO_NAO_ENCONTRADA",
        severity: "ATENCAO",
        description: "Recebimento sem operação correspondente na aba Operações.",
        action: "Cadastre a operação na aba Operações ou corrija a referência.",
      });
      return;
    }

    const key = `${normalizeReference(reference)}:${competence.slice(0, 7)}`;
    const next = (seq.get(key) ?? 0) + 1;
    seq.set(key, next);

    const receiptDate = (cDate ? cellDate(row.getCell(cDate)) : null) ?? dueDateForCompetence(competence, op.dueDay);
    op.receipts.push({
      competence,
      receiptDate,
      amount,
      notes: cNotes ? cellText(row.getCell(cNotes)) || null : null,
      sourceKey: `rec:${key}:${next}`,
    });

    const installment = op.installments.find((i) => i.competence === competence);
    if (installment) {
      installment.received = round2(installment.received + amount);
      // Recalcular overdue imediatamente para o baseline
      const pending = round2(Math.max(installment.expected - installment.received, 0));
      installment.overdue = competence.slice(0, 7) < CUTOFF_COMPETENCE ? pending : 0;
    } else {
      // Baixa fora do cronograma contratual: cria a parcela correspondente.
      upsertInstallment(op, {
        competence,
        dueDate: receiptDate,
        expected: amount,
        received: amount,
        overdue: 0,
        sourceKey: `inst:${normalizeReference(reference)}:${competence.slice(0, 7)}`,
        sheet: sheet.name,
      });
    }
    result.baseline.receivedTotal = round2(result.baseline.receivedTotal + amount);
  });
}

function dueDateForCompetence(competence: string, dueDay: number | null): string {
  const year = Number(competence.slice(0, 4));
  const month = Number(competence.slice(5, 7));
  return buildDueDate(year, month, dueDay);
}

/** Aba Aportes. */
function parseContributionsSheet(sheet: Worksheet, index: OperationIndex, result: ParseResult) {
  const header = findHeader(sheet, ["REFERENCIA"]);
  if (!header) return;

  const cRef = col(header, "REFERENCIA")!;
  const cDate = col(header, "DATA");
  const cType = col(header, "TIPO");
  const cAmount = col(header, "VALOR DO APORTE", "VALOR");
  const cNotes = col(header, "OBSERVACAO", "OBSERVACOES");
  const seq = new Map<string, number>();

  sheet.eachRow((row: Row, rowNum: number) => {
    if (rowNum <= header.row) return;
    const reference = cellText(row.getCell(cRef));
    if (!reference || normalizeText(reference).includes("TOTAL")) return;
    const amount = cAmount ? cellNumber(row.getCell(cAmount)) : null;
    if (!amount || amount <= 0) return;

    const op = index.find(reference);
    if (!op) {
      result.issues.push({
        sheet: sheet.name, row: String(rowNum), reference, issueType: "OPERACAO_NAO_ENCONTRADA",
        severity: "ATENCAO", description: "Aporte sem operação correspondente.",
        action: "Cadastre a operação na aba Operações.",
      });
      return;
    }

    const date = (cDate ? cellDate(row.getCell(cDate)) : null) ?? op.firstDueDate ?? `${MIN_COMPETENCE}-01`;
    const key = `${normalizeReference(reference)}:${date}`;
    const next = (seq.get(key) ?? 0) + 1;
    seq.set(key, next);

    op.contributions.push({
      date,
      type: (cType ? cellText(row.getCell(cType)) : "") || "APORTE_ADICIONAL",
      amount,
      notes: cNotes ? cellText(row.getCell(cNotes)) || null : null,
      sourceKey: `ap:${key}:${next}`,
    });
  });
}

/** Aba Alugueis (layout largo com colunas mensais). */
function parseRentalsSheetV3(sheet: Worksheet, result: ParseResult) {
  const header = findHeader(sheet, ["REFERENCIA"]);
  if (!header) return;

  const cRef = col(header, "REFERENCIA")!;
  const cDueDay = col(header, "DIA VENC");
  const cRent = col(header, "VALOR ALUGUEL");
  const cStart = col(header, "INICIO CONTRATO");
  const cEnd = col(header, "DATA FINAL");
  const cReceived = col(header, "RECEBIDO ATE AGORA", "RECEBIDO");
  const cStatus = col(header, "STATUS", "SITUACAO");
  const cNotes = col(header, "OBSERVACOES", "OBSERVACAO");
  const cYear = col(header, "ANO REFERENCIA");

  sheet.eachRow((row: Row, rowNum: number) => {
    if (rowNum <= header.row) return;
    const reference = cellText(row.getCell(cRef));
    if (!reference || normalizeText(reference).includes("TOTAL")) return;

    const year = (cYear ? cellNumber(row.getCell(cYear)) : null) ?? 2026;
    const rent = cRent ? cellNumber(row.getCell(cRent)) : null;
    const dueDay = cDueDay ? cellNumber(row.getCell(cDueDay)) : null;
    const statusText = normalizeText(cStatus ? cellText(row.getCell(cStatus)) : "");

    const monthlyValues: Record<string, number> = {};
    for (const { col: monthCol, month } of header.monthCols) {
      const value = cellNumber(row.getCell(monthCol));
      if (value && value > 0) {
        monthlyValues[`${year}-${String(month).padStart(2, "0")}-01`] = value;
      }
    }

    const sourceKey = `rental:${normalizeReference(reference)}`;
    result.rentals.push({
      reference: reference.trim(),
      dueDay: dueDay && dueDay > 0 ? Math.min(Math.trunc(dueDay), 31) : null,
      currentRent: rent ?? 0,
      contractStart: cStart ? cellDate(row.getCell(cStart)) : null,
      contractEnd: cEnd ? cellDate(row.getCell(cEnd)) : null,
      adjustmentDate: null,
      status: statusText.includes("VAGO") ? "VAGO" : statusText.includes("ENCERR") ? "ENCERRADO" : "ATIVO",
      notes: cNotes ? cellText(row.getCell(cNotes)) || null : null,
      monthlyValues,
      receivedAmount: (cReceived ? cellNumber(row.getCell(cReceived)) : null) ?? 0,
      sourceKey,
      sourceHash: hashOf([sourceKey, rent, dueDay, statusText, JSON.stringify(monthlyValues)]),
    });
    result.stats.rentals += 1;
  });
}

/** Painel do Excel: baseline oficial para a homologação. */
function parsePanelBaseline(sheet: Worksheet, baseline: ParseBaseline) {
  const labels = new Map<string, number>();
  const rows: { row: number; cells: Map<number, string> }[] = [];
  sheet.eachRow((row: Row, rowNum: number) => {
    const cells = new Map<number, string>();
    row.eachCell({ includeEmpty: false }, (cell: Cell, c: number) => cells.set(c, cellText(cell)));
    rows.push({ row: rowNum, cells });
  });

  rows.forEach((entry, i) => {
    const next = rows[i + 1];
    if (!next) return;
    entry.cells.forEach((text, c) => {
      const label = normalizeText(text);
      if (!label) return;
      const cell = sheet.getRow(next.row).getCell(c);
      const value = cellNumber(cell);
      if (value !== null && !labels.has(label)) labels.set(label, value);
    });
  });

  const get = (needle: string) => {
    for (const [label, value] of labels) if (label.includes(normalizeText(needle))) return value;
    return null;
  };

  const invested = get("CAPITAL INVESTIDO");
  const received = get("TOTAL RECEBIDO");
  const toReceive = get("CAPITAL A RECEBER");
  const overdue = get("SALDO INADIMPLENTE");
  const expected = get("PREVISTO EXCEL") || get("TOTAL PREVISTO");

  if (invested !== null) baseline.capitalTotal = invested;
  if (received !== null) baseline.receivedTotal = received;
  if (toReceive !== null) baseline.toReceiveTotal = toReceive;
  if (overdue !== null) baseline.overdueTotal = overdue;
  if (expected !== null) baseline.monthlyTotal = expected;
}

/* ------------------------------------------------------------------ */
/* Estatísticas do sistema (lado "Sistema" da homologação)             */
/* ------------------------------------------------------------------ */

function computeStats(result: ParseResult) {
  const stats = result.stats;
  const byYear = new Map<string, ParseResult["stats"]["byYear"][number]>();
  stats.operations = result.operations.length;
  stats.rentals = result.rentals.length;
  stats.installments = 0;
  stats.receivedInstallments = 0;
  stats.overdueInstallments = 0;
  stats.contributions = 0;
  stats.expectedTotal = 0;
  stats.receivedTotal = 0;
  stats.overdueTotal = 0;
  stats.toReceiveTotal = 0;
  stats.investedTotal = 0;
  // stats.expectedTotal, stats.receivedTotal e stats.overdueTotal serão calculados pelas parcelas
  result.readiness = { ready: 0, pending: 0, ignored: 0, critical: 0 };

  for (const op of result.operations) {
    const contributionsTotal = op.contributions.reduce((sum, c) => sum + c.amount, 0);
    stats.investedTotal = round2(stats.investedTotal + (op.initialCapital ?? 0) + contributionsTotal);
    stats.contributions += op.contributions.length;
    if (op.incomplete) result.readiness.pending += 1;
    else result.readiness.ready += 1;

    for (const inst of op.installments) {
      const year = inst.competence.slice(0, 4);
      const bucket = byYear.get(year) ?? { year, operations: 0, rentals: 0, installments: 0, expected: 0, received: 0, overdue: 0 };
      const currentPending = round2(Math.max(inst.expected - inst.received, 0));

      stats.installments += 1;
      stats.expectedTotal = round2(stats.expectedTotal + inst.expected);
      stats.receivedTotal = round2(stats.receivedTotal + inst.received);
      
      stats.overdueTotal = round2(stats.overdueTotal + inst.overdue);
      stats.toReceiveTotal = round2(stats.toReceiveTotal + currentPending);
      if (inst.received > 0) stats.receivedInstallments += 1;
      if (inst.overdue > 0) stats.overdueInstallments += 1;

      bucket.installments += 1;
      bucket.expected = round2(bucket.expected + inst.expected);
      bucket.received = round2(bucket.received + inst.received);
      bucket.overdue = round2(bucket.overdue + inst.overdue);
      byYear.set(year, bucket);
    }

    const firstYear = op.installments[0]?.competence.slice(0, 4);
    if (firstYear) {
      const bucket = byYear.get(firstYear);
      if (bucket) bucket.operations += 1;
    }
  }

  result.readiness.critical = result.issues.filter((i) => i.severity === "CRITICO").length;
  result.readiness.ignored = result.baseline.ignoredRows;
  stats.byYear = [...byYear.values()].sort((a, b) => a.year.localeCompare(b.year));
}

/* ------------------------------------------------------------------ */
/* Layout legado                                                       */
/* ------------------------------------------------------------------ */

function parseAnnualSheet(sheet: Worksheet, year: number, index: OperationIndex, issues: ParsedIssue[], baseline: ParseBaseline, referenceMonth: string, isManagement: boolean = false) {
  let monthCols: { col: number; month: number }[] = [];
  sheet.eachRow((row: Row, rowNum: number) => {
    if (MONTHS[normalizeText(cellText(row.getCell(5)))]) {
      monthCols = [];
      row.eachCell((cell: Cell, c: number) => {
        const m = MONTHS[normalizeText(cellText(cell))];
        if (m) monthCols.push({ col: c, month: m });
      });
      return;
    }
    const ref = cellText(row.getCell(2));
    if (!ref || rowNum < 3 || normalizeText(ref).includes("TOTAL")) return;

    const op = index.get(ref, "Outros");
    if (isManagement) op.isManagement = true;

    monthCols.forEach(({ col: monthCol, month }) => {
      const val = cellNumber(row.getCell(monthCol));
      if (val && val > 0) {
        const comp = `${year}-${String(month).padStart(2, "0")}`;
        if (comp < MIN_COMPETENCE) return;
        const red = isRed(row.getCell(monthCol));
        const isOverdue = red && comp < CUTOFF_COMPETENCE;
        const isPast = comp < CUTOFF_COMPETENCE;

        upsertInstallment(op, {
          competence: `${comp}-01`,
          dueDate: buildDueDate(year, month, op.dueDay),
          expected: val,
          received: !red && isPast ? val : 0,
          overdue: isOverdue ? val : 0,
          sourceKey: `inst:${normalizeReference(ref)}:${comp}`,
          sheet: sheet.name,
        });
        baseline.monthlyCells += 1;
        baseline.monthlyTotal = round2(baseline.monthlyTotal + val);
      }
    });
  });
}

function parseRentalsSheet(sheet: Worksheet, result: ParseResult) {
  sheet.eachRow((row: Row, rowNum: number) => {
    const ref = cellText(row.getCell(2));
    if (!ref || rowNum < 5 || normalizeText(ref).includes("TOTAL")) return;
    const val = cellNumber(row.getCell(4)) || 0;
    if (val <= 0) return;

    const sourceKey = `rental:${normalizeReference(ref)}`;
    result.rentals.push({
      reference: ref, dueDay: 10, currentRent: val, contractStart: null, contractEnd: null,
      adjustmentDate: null, status: "ATIVO", notes: null, monthlyValues: {}, receivedAmount: 0,
      sourceKey, sourceHash: hashOf([sourceKey, val]),
    });
  });
}
