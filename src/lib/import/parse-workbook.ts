import type { Workbook, Worksheet, Cell } from "exceljs";

/**
 * Leitor da base histórica Nova Era.
 *
 * Suporta dois formatos:
 *  1. Abas anuais "À receber YYYY" (colunas JANEIRO..DEZEMBRO).
 *     Valores em vermelho = saldo em aberto / inadimplência (NÃO são recebimentos).
 *     Valores em preto em competências já vencidas = recebimentos efetivos.
 *  2. Abas estruturadas "Operações", "Recebimentos", "Aportes".
 */

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

export const ISSUE_SEVERITY: Record<IssueType, IssueSeverity> = {
  CONTRATO_INCOMPLETO: "ATENCAO",
  PARCELAS_NAO_IDENTIFICADAS: "ATENCAO",
  PRIMEIRO_VENCIMENTO_AUSENTE: "ATENCAO",
  CAPITAL_NAO_IDENTIFICADO: "ATENCAO",
  REFERENCIA_DUPLICADA: "CRITICO",
  OPERACAO_NAO_ENCONTRADA: "CRITICO",
  VALOR_INVALIDO: "CRITICO",
  CELULA_NAO_INTERPRETADA: "INFORMATIVO",
  POSSIVEL_INADIMPLENCIA: "INFORMATIVO",
  LINHA_IGNORADA: "INFORMATIVO",
};

export const ISSUE_ACTION: Record<IssueType, string> = {
  CONTRATO_INCOMPLETO: "Completar contrato na tela da operação após a importação.",
  PARCELAS_NAO_IDENTIFICADAS: "Informar quantidade de parcelas na operação.",
  PRIMEIRO_VENCIMENTO_AUSENTE: "Informar o primeiro vencimento da operação.",
  CAPITAL_NAO_IDENTIFICADO: "Informar o capital investido (Valor Emprestado).",
  REFERENCIA_DUPLICADA: "Conferir referências repetidas na planilha antes de importar.",
  OPERACAO_NAO_ENCONTRADA: "Cadastrar a operação ou corrigir a referência na planilha.",
  VALOR_INVALIDO: "Corrigir o valor na planilha de origem.",
  CELULA_NAO_INTERPRETADA: "Nenhuma — célula ignorada com segurança.",
  POSSIVEL_INADIMPLENCIA: "Conferir na tela de Parcelas após a importação.",
  LINHA_IGNORADA: "Nenhuma — linha sem dados de recebível.",
};

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
  installmentCount: number | null;
  installmentValue: number | null;
  notes: string | null;
  sourceKey: string;
  installments: ParsedInstallment[];
  contributions: ParsedContribution[];
  incomplete: boolean;
  sheets: string[];
}

/** Totais lidos direto das células da planilha, sem passar pela normalização. */
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
  issues: ParsedIssue[];
  baseline: ParseBaseline;
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
    installments: number;
    receivedInstallments: number;
    overdueInstallments: number;
    contributions: number;
    expectedTotal: number;
    receivedTotal: number;
    overdueTotal: number;
    toReceiveTotal: number;
    investedTotal: number;
  };
}


const MONTHS: Record<string, number> = {
  JANEIRO: 1,
  FEVEREIRO: 2,
  MARCO: 3,
  ABRIL: 4,
  MAIO: 5,
  JUNHO: 6,
  JULHO: 7,
  AGOSTO: 8,
  SETEMBRO: 9,
  OUTUBRO: 10,
  NOVEMBRO: 11,
  DEZEMBRO: 12,
};

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" && value !== null && "result" in (value as object)
    ? String((value as { result: unknown }).result ?? "")
    : String(value);
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizeReference(reference: string): string {
  return normalizeText(reference).replace(/[^A-Z0-9]/g, "");
}

function cellText(cell: Cell | undefined): string {
  if (!cell) return "";
  const value = cell.value as unknown;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const rich = obj["richText"];
    if (Array.isArray(rich)) {
      return (rich as { text: string }[]).map((part) => part.text).join("").trim();
    }
    if ("text" in obj) return String(obj["text"] ?? "").trim();
    if ("result" in obj) return String(obj["result"] ?? "").trim();
  }
  return String(value).trim();
}

function cellNumber(cell: Cell | undefined): number | null {
  if (!cell) return null;
  const value = cell.value as unknown;
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object") {
    const result = (value as Record<string, unknown>)["result"];
    if (typeof result === "number") return result;
    return null;
  }
  const parsed = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function cellDate(cell: Cell | undefined): string | null {
  if (!cell) return null;
  const value = cell.value as unknown;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = cellText(cell);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]!.padStart(2, "0")}-${br[1]!.padStart(2, "0")}`;
  return null;
}

/** Valor em vermelho na planilha = saldo devedor / inadimplência. */
function isRed(cell: Cell | undefined): boolean {
  if (!cell) return false;
  const argb = cell.font?.color?.argb;
  if (argb && /FF0000$/i.test(argb)) return true;
  const value = cell.value as unknown;
  if (value && typeof value === "object" && "richText" in (value as object)) {
    const parts = (value as { richText: { font?: { color?: { argb?: string } } }[] }).richText;
    return parts.some((part) => part.font?.color?.argb && /FF0000$/i.test(part.font.color.argb));
  }
  return false;
}

function categoryFromSection(section: string): string {
  const text = normalizeText(section);
  if (text.includes("CARRO") || text.includes("VEICUL")) return "Veículos";
  if (text.includes("EMPREST")) return "Empréstimos";
  if (text.includes("SUBLOCA")) return "Sublocação";
  if (text.includes("ALUGUE") || text.includes("IMOVE") || text.includes("CONDOMINIO")) return "Aluguéis";
  if (text.includes("CONTAS A RECEBER") || text.includes("CONTAS Á RECEBER")) return "Empréstimos";
  return "Outros";
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildDueDate(year: number, month: number, dueDay: number | null): string {
  const day = Math.min(Math.max(dueDay && dueDay > 0 ? dueDay : 25, 1), lastDayOfMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function yearFromSheetName(name: string): number | null {
  const match = name.match(/(20\d{2})/);
  return match ? Number(match[1]) : null;
}

interface OperationBucket extends ParsedOperation {
  key: string;
}

class OperationIndex {
  private map = new Map<string, OperationBucket>();

  get(reference: string, category: string): OperationBucket {
    const key = normalizeReference(reference);
    const existing = this.map.get(key);
    if (existing) return existing;
    const created: OperationBucket = {
      key,
      reference: reference.trim(),
      category,
      dueDay: null,
      initialCapital: null,
      firstDueDate: null,
      installmentCount: null,
      installmentValue: null,
      notes: null,
      sourceKey: `ref:${key}`,
      installments: [],
      contributions: [],
      incomplete: false,
      sheets: [],
    };
    this.map.set(key, created);
    return created;
  }

  find(reference: string): OperationBucket | undefined {
    return this.map.get(normalizeReference(reference));
  }

  all(): OperationBucket[] {
    return [...this.map.values()];
  }
}

function upsertInstallment(op: OperationBucket, installment: ParsedInstallment) {
  const index = op.installments.findIndex((item) => item.competence === installment.competence);
  if (index === -1) {
    op.installments.push(installment);
    return;
  }
  const current = op.installments[index]!;
  op.installments[index] = {
    ...current,
    expected: Math.max(current.expected, installment.expected),
    received: Math.max(current.received, installment.received),
    overdue: Math.max(current.overdue, installment.overdue),
  };
}


function parseAnnualSheet(
  sheet: Worksheet,
  year: number,
  index: OperationIndex,
  issues: ParsedIssue[],
  baseline: ParseBaseline,
  referenceMonth: string,
) {
  let section = sheet.name;
  let skipSection = false;
  let monthColumns: { column: number; month: number }[] = [];
  let columns = { reference: 2, dueDay: 3, capital: 4 };
  const seenReferences = new Set<string>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const colA = cellText(row.getCell(1));
    const colB = cellText(row.getCell(2));

    // Cabeçalho da tabela: descobre as colunas dos meses
    if (normalizeText(colA) === "QT." || normalizeText(colB) === "REFERENCIA") {
      const found: { column: number; month: number }[] = [];
      let referenceCol = 2;
      let dueDayCol = 3;
      let capitalCol = 4;
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = normalizeText(cellText(cell));
        if (header === "REFERENCIA") referenceCol = colNumber;
        else if (header.startsWith("VENC")) dueDayCol = colNumber;
        else if (header.includes("EMPRESTADO") || header.includes("CAPITAL")) capitalCol = colNumber;
        else if (MONTHS[header]) found.push({ column: colNumber, month: MONTHS[header]! });
      });
      if (found.length > 0) {
        monthColumns = found;
        columns = { reference: referenceCol, dueDay: dueDayCol, capital: capitalCol };
      }
      return;
    }

    // Título de seção (categoria)
    if (
      colA &&
      (!colB || normalizeText(colB) === normalizeText(colA)) &&
      Number.isNaN(Number(colA)) &&
      colA.length > 4
    ) {
      section = colA;
      // Blocos de patrimônio/imóveis não são recebíveis: os valores são preços de ativos
      skipSection = /IMOVEIS|TITULARES|PATRIMONIO|RECEBIVEIS/.test(normalizeText(colA));
      return;
    }
    if (skipSection) return;

    const reference = cellText(row.getCell(columns.reference));
    if (!reference) return;
    const normalized = normalizeText(reference);
    if (
      /^(SUB[- ]?TOTA|TOTA|QT\.|RECEBIVEIS|IMOVEIS)/.test(normalized) ||
      normalized.includes("TOTAL") ||
      normalized === "REFERENCIA" ||
      normalized === "-" ||
      /^[0-9.,]+$/.test(normalized)
    ) {
      return;
    }
    if (monthColumns.length === 0) return;

    const refKey = normalizeReference(reference);
    if (seenReferences.has(refKey)) {
      issues.push({
        sheet: sheet.name,
        row: String(rowNumber),
        reference,
        issueType: "REFERENCIA_DUPLICADA",
        description: "Referência repetida na mesma aba — os valores foram consolidados em uma única operação.",
      });
    }
    seenReferences.add(refKey);

    const op = index.get(reference, categoryFromSection(section));
    if (!op.sheets.includes(sheet.name)) op.sheets.push(sheet.name);
    const sectionCategory = categoryFromSection(section);
    if (op.category === "Outros" && sectionCategory !== "Outros") op.category = sectionCategory;
    const dueDay = cellNumber(row.getCell(columns.dueDay));
    if (dueDay !== null && dueDay > 0 && op.dueDay === null) op.dueDay = Math.round(dueDay);

    // "Valor Emprestado" = capital investido (não é previsto nem recebido)
    const capital = cellNumber(row.getCell(columns.capital));
    if (capital !== null && capital > 0 && (op.initialCapital === null || capital > op.initialCapital)) {
      op.initialCapital = capital;
      baseline.capitalTotal = round2(baseline.capitalTotal + capital);
    }

    baseline.operationRows += 1;

    let hasValue = false;
    let overdueRow = 0;
    for (const { column, month } of monthColumns) {
      const cell = row.getCell(column);
      const amount = cellNumber(cell);
      if (amount === null || amount <= 0) {
        const text = cellText(cell);
        if (text && text.trim() && amount === null) {
          issues.push({
            sheet: sheet.name,
            row: String(rowNumber),
            reference,
            issueType: "CELULA_NAO_INTERPRETADA",
            description: `Célula ${cell.address} com conteúdo não numérico ("${text.slice(0, 40)}") ignorada.`,
          });
        }
        continue;
      }
      hasValue = true;
      const red = isRed(cell);
      const competenceKey = `${year}-${String(month).padStart(2, "0")}`;
      const competence = `${competenceKey}-01`;
      const isFuture = competenceKey > referenceMonth;
      // vermelho em competência passada/corrente = saldo devedor; futuro = previsto a receber
      const received = !red && !isFuture ? round2(amount) : 0;
      const overdue = red && !isFuture ? round2(amount) : 0;
      overdueRow += overdue;

      baseline.monthlyCells += 1;
      baseline.monthlyTotal = round2(baseline.monthlyTotal + amount);
      baseline.receivedTotal = round2(baseline.receivedTotal + received);
      baseline.overdueTotal = round2(baseline.overdueTotal + overdue);
      baseline.toReceiveTotal = round2(baseline.toReceiveTotal + (isFuture ? round2(amount) : 0));

      upsertInstallment(op, {
        competence,
        dueDate: buildDueDate(year, month, op.dueDay),
        expected: round2(amount),
        received,
        overdue,
        sourceKey: `hist:${op.key}:${competence}`,
        sheet: sheet.name,
      });
    }

    if (overdueRow > 0) {
      issues.push({
        sheet: sheet.name,
        row: String(rowNumber),
        reference,
        issueType: "POSSIVEL_INADIMPLENCIA",
        description: `Saldo devedor identificado por marcação em vermelho: ${overdueRow.toFixed(2)}.`,
      });
    }

    if (!hasValue && op.installments.length === 0 && capital === null) {
      baseline.ignoredRows += 1;
      baseline.operationRows -= 1;
      issues.push({
        sheet: sheet.name,
        row: String(rowNumber),
        reference,
        issueType: "LINHA_IGNORADA",
        description: "Linha sem capital e sem valores mensais identificáveis.",
      });
    }
  });
}


function parseOperationsSheet(sheet: Worksheet, index: OperationIndex, issues: ParsedIssue[]) {
  let headerRow = 0;
  const header: Record<string, number> = {};
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (!headerRow) {
      const cells: Record<string, number> = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        cells[normalizeText(cellText(cell))] = colNumber;
      });
      if (Object.keys(cells).some((key) => key.includes("REFERENCIA"))) {
        headerRow = rowNumber;
        Object.assign(header, cells);
      }
      return;
    }
    const col = (name: string) =>
      Object.entries(header).find(([key]) => key.includes(name))?.[1];
    const reference = cellText(row.getCell(col("REFERENCIA") ?? 1));
    if (!reference || normalizeText(reference).startsWith("TOTAL")) return;

    const categoryText = cellText(row.getCell(col("CATEGORIA") ?? 2));
    const op = index.get(reference, categoryText ? categoryFromSection(categoryText) : "Outros");
    if (categoryText) op.category = categoryFromSection(categoryText);

    const dueDay = cellNumber(row.getCell(col("DIA VENC") ?? 3));
    if (dueDay && dueDay > 0) op.dueDay = Math.round(dueDay);
    const capital = cellNumber(row.getCell(col("CAPITAL INICIAL") ?? 4));
    if (capital && capital > 0) op.initialCapital = capital;
    const firstDue = cellDate(row.getCell(col("1o VENCIMENTO") ?? col("VENCIMENTO") ?? 5));
    if (firstDue) op.firstDueDate = firstDue;
    const count = cellNumber(row.getCell(col("N PARCELAS") ?? col("PARCELAS") ?? 6));
    if (count && count > 0) op.installmentCount = Math.round(count);
    const value = cellNumber(row.getCell(col("VALOR PARCELA") ?? 7));
    if (value && value > 0) op.installmentValue = round2(value);
    const notes = cellText(row.getCell(col("OBSERVA") ?? 15));
    if (notes) op.notes = notes;

    const extra = cellNumber(row.getCell(col("APORTES") ?? 8));
    if (extra && extra > 0) {
      op.contributions.push({
        date: firstDue ?? `${new Date().getUTCFullYear()}-01-01`,
        type: "APORTE_ADICIONAL",
        amount: round2(extra),
        notes: "Importado da base histórica",
        sourceKey: `hist-aporte:${op.key}:base`,
      });
    }

    if (!op.initialCapital) {
      issues.push({
        sheet: sheet.name,
        row: String(rowNumber),
        reference,
        issueType: "CAPITAL_NAO_IDENTIFICADO",
        description: "Capital investido não identificado na base — informar valor investido.",
      });
    }
  });
}

function parseReceiptsSheet(sheet: Worksheet, index: OperationIndex, issues: ParsedIssue[]) {
  let headerRow = 0;
  const header: Record<string, number> = {};
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (!headerRow) {
      const cells: Record<string, number> = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        cells[normalizeText(cellText(cell))] = colNumber;
      });
      if (Object.keys(cells).some((key) => key.includes("REFERENCIA"))) {
        headerRow = rowNumber;
        Object.assign(header, cells);
      }
      return;
    }
    const col = (name: string) => Object.entries(header).find(([key]) => key.includes(name))?.[1];
    const reference = cellText(row.getCell(col("REFERENCIA") ?? 1));
    if (!reference) return;
    const competence = cellDate(row.getCell(col("COMPETENCIA") ?? 2));
    const amount = cellNumber(row.getCell(col("VALOR RECEBIDO") ?? col("VALOR") ?? 3));
    if (!competence || !amount || amount <= 0) return;

    const op = index.find(reference);
    if (!op) {
      issues.push({
        sheet: sheet.name,
        row: String(rowNumber),
        reference,
        issueType: "OPERACAO_NAO_ENCONTRADA",
        description: "Recebimento sem operação correspondente na carteira.",
        raw: { competence, amount },
      });
      return;
    }
    const monthStart = `${competence.slice(0, 7)}-01`;
    const [yearText, monthText] = monthStart.split("-");
    const existing = op.installments.find((item) => item.competence === monthStart);
    if (existing) {
      existing.received = Math.max(existing.received, round2(amount));
      existing.expected = Math.max(existing.expected, round2(amount));
      return;
    }
    op.installments.push({
      competence: monthStart,
      dueDate: buildDueDate(Number(yearText), Number(monthText), op.dueDay),
      expected: round2(amount),
      received: round2(amount),
      sourceKey: `hist:${op.key}:${monthStart}`,
      sheet: sheet.name,
    });
  });
}

function parseContributionsSheet(sheet: Worksheet, index: OperationIndex, issues: ParsedIssue[]) {
  let headerRow = 0;
  const header: Record<string, number> = {};
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (!headerRow) {
      const cells: Record<string, number> = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        cells[normalizeText(cellText(cell))] = colNumber;
      });
      if (Object.keys(cells).some((key) => key.includes("REFERENCIA"))) {
        headerRow = rowNumber;
        Object.assign(header, cells);
      }
      return;
    }
    const col = (name: string) => Object.entries(header).find(([key]) => key.includes(name))?.[1];
    const reference = cellText(row.getCell(col("REFERENCIA") ?? 1));
    const amount = cellNumber(row.getCell(col("VALOR") ?? 4));
    if (!reference || !amount || amount === 0) return;
    const op = index.find(reference);
    if (!op) {
      issues.push({
        sheet: sheet.name,
        row: String(rowNumber),
        reference,
        issueType: "OPERACAO_NAO_ENCONTRADA",
        description: "Aporte sem operação correspondente na carteira.",
      });
      return;
    }
    const date = cellDate(row.getCell(col("DATA") ?? 2)) ?? `${new Date().getUTCFullYear()}-01-01`;
    op.contributions.push({
      date,
      type: normalizeText(cellText(row.getCell(col("TIPO") ?? 3))).includes("RENOVA")
        ? "RENOVACAO"
        : "APORTE_ADICIONAL",
      amount: round2(amount),
      notes: cellText(row.getCell(col("OBSERVA") ?? 5)) || null,
      sourceKey: `hist-aporte:${op.key}:${date}:${round2(amount)}`,
    });
  });
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseWorkbook(workbook: Workbook): ParseResult {
  const index = new OperationIndex();
  const issues: ParsedIssue[] = [];
  const sheetsRead: string[] = [];

  // 1) abas anuais
  workbook.eachSheet((sheet) => {
    const year = yearFromSheetName(sheet.name);
    const isAnnual = /RECEBER/.test(normalizeText(sheet.name)) && year !== null;
    if (!isAnnual) return;
    sheetsRead.push(sheet.name);
    parseAnnualSheet(sheet, year!, index, issues);
  });

  // 2) abas estruturadas
  workbook.eachSheet((sheet) => {
    const name = normalizeText(sheet.name);
    if (name.includes("OPERAC") || name.includes("CARTEIRA")) {
      sheetsRead.push(sheet.name);
      parseOperationsSheet(sheet, index, issues);
    }
  });
  workbook.eachSheet((sheet) => {
    const name = normalizeText(sheet.name);
    if (name.includes("RECEBIMENTO")) {
      sheetsRead.push(sheet.name);
      parseReceiptsSheet(sheet, index, issues);
    }
    if (name.includes("APORTE")) {
      sheetsRead.push(sheet.name);
      parseContributionsSheet(sheet, index, issues);
    }
  });

  const today = new Date().toISOString().slice(0, 10);
  const operations = index.all().filter((op) => op.installments.length > 0 || op.initialCapital);

  for (const op of operations) {
    op.installments.sort((a, b) => a.competence.localeCompare(b.competence));
    if (!op.firstDueDate && op.installments.length > 0) {
      op.firstDueDate = null; // contrato não confirmado: não inventar
    }
    const contractComplete = Boolean(op.installmentCount && op.installmentValue && op.firstDueDate);
    op.incomplete = !contractComplete;
    if (!contractComplete) {
      issues.push({
        sheet: "Operações",
        row: op.reference,
        reference: op.reference,
        issueType: "CONTRATO_INCOMPLETO",
        description: "Contrato incompleto — informar primeiro vencimento, quantidade de parcelas e valor da parcela.",
      });
    }
  }

  const stats = {
    sheetsRead: [...new Set(sheetsRead)],
    operations: operations.length,
    installments: operations.reduce((sum, op) => sum + op.installments.length, 0),
    receivedInstallments: operations.reduce(
      (sum, op) => sum + op.installments.filter((i) => i.received > 0).length,
      0,
    ),
    overdueInstallments: operations.reduce(
      (sum, op) =>
        sum + op.installments.filter((i) => i.dueDate < today && i.received < i.expected).length,
      0,
    ),
    contributions: operations.reduce((sum, op) => sum + op.contributions.length, 0),
    expectedTotal: round2(
      operations.reduce((sum, op) => sum + op.installments.reduce((s, i) => s + i.expected, 0), 0),
    ),
    receivedTotal: round2(
      operations.reduce((sum, op) => sum + op.installments.reduce((s, i) => s + i.received, 0), 0),
    ),
    overdueTotal: round2(
      operations.reduce(
        (sum, op) =>
          sum +
          op.installments.reduce(
            (s, i) => s + (i.dueDate < today ? Math.max(i.expected - i.received, 0) : 0),
            0,
          ),
        0,
      ),
    ),
    investedTotal: round2(
      operations.reduce(
        (sum, op) =>
          sum +
          (op.initialCapital ?? 0) +
          op.contributions.reduce((s, c) => s + c.amount, 0),
        0,
      ),
    ),
  };

  return { operations, issues, stats };
}
