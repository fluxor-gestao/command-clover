import type { ParseResult } from "@/lib/import/parse-workbook";
import { normalizeReference } from "@/lib/import/parse-workbook";

export type HomologStatus = "OK" | "ATENCAO" | "DIVERGENTE";

export interface SystemInstallmentRow {
  id: string | null;
  operation_id: string | null;
  reference: string | null;
  competence: string | null;
  due_date: string | null;
  expected_amount: number | null;
  received_amount: number | null;
  outstanding_amount: number | null;
  payment_status: string | null;
  financial_status: string | null;
}

export interface SystemOperationRow {
  operation_id: string | null;
  reference: string | null;
  category: string | null;
  initial_capital: number | null;
  total_invested: number | null;
  total_received: number | null;
  outstanding_amount: number | null;
  overdue_receivable: number | null;
  future_receivable: number | null;
  capital_to_recover: number | null;
}

export interface HomologInput {
  base: ParseResult;
  operations: SystemOperationRow[];
  installments: SystemInstallmentRow[];
  referencesCount: number;
  today: string; // YYYY-MM-DD
}

export interface IndicatorRow {
  indicator: string;
  group: "CADASTRO" | "FINANCEIRO" | "CONTAGEM";
  base: number;
  system: number;
  diff: number;
  diffPct: number;
  status: HomologStatus;
  money: boolean;
}

export interface CompetenceRow {
  competence: string;
  expectedBase: number;
  expectedSystem: number;
  receivedBase: number;
  receivedSystem: number;
  overdueBase: number;
  overdueSystem: number;
  status: HomologStatus;
  worstDiff: number;
}

export interface OperationRow {
  reference: string;
  operationId: string | null;
  categoryBase: string | null;
  categorySystem: string | null;
  capitalBase: number;
  capitalSystem: number;
  receivedBase: number;
  receivedSystem: number;
  receivableBase: number;
  receivableSystem: number;
  overdueBase: number;
  overdueSystem: number;
  expectedBase: number;
  expectedSystem: number;
  status: HomologStatus;
  worstDiff: number;
  causes: string[];
  sheets: string[];
  competences: {
    competence: string;
    expectedBase: number;
    expectedSystem: number;
    receivedBase: number;
    receivedSystem: number;
    overdueBase: number;
    overdueSystem: number;
    sheet: string | null;
    row: string | null;
  }[];
}

export interface ConsistencyCheck {
  name: string;
  detail: string;
  passed: boolean;
}

export interface HomologResult {
  today: string;
  indicators: IndicatorRow[];
  competences: CompetenceRow[];
  operationsRows: OperationRow[];
  checks: ConsistencyCheck[];
  sample: { references: string[]; ok: number; total: number };
  summary: {
    status: "APROVADA" | "APROVADA_COM_RESSALVAS" | "REPROVADA";
    indicatorsOk: number;
    indicatorsDiverging: number;
    operationsDiverging: number;
    competencesDiverging: number;
    totalDivergence: number;
  };
  totals: {
    base: GlobalTotals;
    system: GlobalTotals;
  };
}

export interface GlobalTotals {
  references: number;
  operations: number;
  capital: number;
  expected: number;
  received: number;
  capitalToRecover: number;
  toReceive: number;
  futureReceivable: number;
  overdue: number;
  installments: number;
  installmentsReceived: number;
  installmentsOpen: number;
  installmentsOverdue: number;
}

const r2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const num = (value: number | null | undefined) => Number(value ?? 0);

export function statusFor(base: number, system: number): HomologStatus {
  const diff = Math.abs(r2(system - base));
  if (diff <= 0.05) return "OK";
  const scale = Math.max(Math.abs(base), Math.abs(system), 1);
  if (diff / scale <= 0.001) return "ATENCAO";
  return "DIVERGENTE";
}

const worst = (values: HomologStatus[]): HomologStatus =>
  values.includes("DIVERGENTE") ? "DIVERGENTE" : values.includes("ATENCAO") ? "ATENCAO" : "OK";

function indicator(
  name: string,
  group: IndicatorRow["group"],
  base: number,
  system: number,
  money = true,
): IndicatorRow {
  const diff = r2(system - base);
  return {
    indicator: name,
    group,
    base: r2(base),
    system: r2(system),
    diff,
    diffPct: base === 0 ? (diff === 0 ? 0 : 1) : diff / base,
    status: money ? statusFor(base, system) : diff === 0 ? "OK" : "DIVERGENTE",
    money,
  };
}

export function buildHomologation(input: HomologInput): HomologResult {
  const { base, operations, installments, referencesCount, today } = input;
  const currentMonth = today.slice(0, 7);

  // ---------- BASE (Excel) ----------
  const baseOps = base.operations;
  const baseByRef = new Map<string, (typeof baseOps)[number]>();
  for (const op of baseOps) baseByRef.set(normalizeReference(op.reference), op);

  const baseTotals: GlobalTotals = {
    references: new Set(baseOps.map((op) => normalizeReference(op.reference))).size,
    operations: baseOps.length,
    capital: 0,
    expected: 0,
    received: 0,
    capitalToRecover: 0,
    toReceive: 0,
    futureReceivable: 0,
    overdue: 0,
    installments: 0,
    installmentsReceived: 0,
    installmentsOpen: 0,
    installmentsOverdue: 0,
  };
  const baseCompetence = new Map<string, { expected: number; received: number; overdue: number }>();

  for (const op of baseOps) {
    baseTotals.capital = r2(baseTotals.capital + (op.initialCapital ?? 0));
    for (const inst of op.installments) {
      baseTotals.installments += 1;
      baseTotals.expected = r2(baseTotals.expected + inst.expected);
      baseTotals.received = r2(baseTotals.received + inst.received);
      baseTotals.overdue = r2(baseTotals.overdue + inst.overdue);
      const open = r2(inst.expected - inst.received);
      if (inst.received >= inst.expected - 0.005) baseTotals.installmentsReceived += 1;
      else baseTotals.installmentsOpen += 1;
      if (inst.overdue > 0) baseTotals.installmentsOverdue += 1;
      baseTotals.toReceive = r2(baseTotals.toReceive + Math.max(open, 0));
      if (inst.overdue <= 0) baseTotals.futureReceivable = r2(baseTotals.futureReceivable + Math.max(open, 0));

      const key = inst.competence.slice(0, 7);
      const bucket = baseCompetence.get(key) ?? { expected: 0, received: 0, overdue: 0 };
      bucket.expected = r2(bucket.expected + inst.expected);
      bucket.received = r2(bucket.received + inst.received);
      bucket.overdue = r2(bucket.overdue + inst.overdue);
      baseCompetence.set(key, bucket);
    }
  }
  baseTotals.capitalToRecover = r2(Math.max(baseTotals.capital - baseTotals.received, 0));

  // ---------- SISTEMA ----------
  const sysTotals: GlobalTotals = {
    references: referencesCount,
    operations: operations.length,
    capital: 0,
    expected: 0,
    received: 0,
    capitalToRecover: 0,
    toReceive: 0,
    futureReceivable: 0,
    overdue: 0,
    installments: 0,
    installmentsReceived: 0,
    installmentsOpen: 0,
    installmentsOverdue: 0,
  };
  const sysCompetence = new Map<string, { expected: number; received: number; overdue: number }>();
  const sysByOperation = new Map<
    string,
    { expected: number; received: number; open: number; overdue: number; competences: Map<string, { expected: number; received: number; overdue: number }> }
  >();

  for (const op of operations) {
    sysTotals.capital = r2(sysTotals.capital + num(op.total_invested ?? op.initial_capital));
  }
  sysTotals.received = r2(operations.reduce((acc, op) => acc + num(op.total_received), 0));

  for (const inst of installments) {
    const expected = num(inst.expected_amount);
    const received = num(inst.received_amount);
    const open = r2(Math.max(expected - received, 0));
    const due = (inst.due_date ?? "").slice(0, 10);
    const isOverdue = open > 0.005 && due !== "" && due < today;

    sysTotals.installments += 1;
    sysTotals.expected = r2(sysTotals.expected + expected);
    sysTotals.toReceive = r2(sysTotals.toReceive + open);
    if (open <= 0.005) sysTotals.installmentsReceived += 1;
    else sysTotals.installmentsOpen += 1;
    if (isOverdue) {
      sysTotals.installmentsOverdue += 1;
      sysTotals.overdue = r2(sysTotals.overdue + open);
    } else {
      sysTotals.futureReceivable = r2(sysTotals.futureReceivable + open);
    }

    const key = (inst.competence ?? due).slice(0, 7);
    const bucket = sysCompetence.get(key) ?? { expected: 0, received: 0, overdue: 0 };
    bucket.expected = r2(bucket.expected + expected);
    bucket.received = r2(bucket.received + received);
    if (isOverdue) bucket.overdue = r2(bucket.overdue + open);
    sysCompetence.set(key, bucket);

    const opKey = normalizeReference(inst.reference ?? "");
    const opBucket =
      sysByOperation.get(opKey) ??
      { expected: 0, received: 0, open: 0, overdue: 0, competences: new Map() };
    opBucket.expected = r2(opBucket.expected + expected);
    opBucket.received = r2(opBucket.received + received);
    opBucket.open = r2(opBucket.open + open);
    if (isOverdue) opBucket.overdue = r2(opBucket.overdue + open);
    const opComp = opBucket.competences.get(key) ?? { expected: 0, received: 0, overdue: 0 };
    opComp.expected = r2(opComp.expected + expected);
    opComp.received = r2(opComp.received + received);
    if (isOverdue) opComp.overdue = r2(opComp.overdue + open);
    opBucket.competences.set(key, opComp);
    sysByOperation.set(opKey, opBucket);
  }
  sysTotals.capitalToRecover = r2(Math.max(sysTotals.capital - sysTotals.received, 0));

  // ---------- INDICADORES GLOBAIS ----------
  const indicators: IndicatorRow[] = [
    indicator("Quantidade de referências", "CADASTRO", baseTotals.references, sysTotals.references, false),
    indicator("Quantidade de operações", "CADASTRO", baseTotals.operations, sysTotals.operations, false),
    indicator("Capital investido", "FINANCEIRO", baseTotals.capital, sysTotals.capital),
    indicator("Total previsto", "FINANCEIRO", baseTotals.expected, sysTotals.expected),
    indicator("Total recebido", "FINANCEIRO", baseTotals.received, sysTotals.received),
    indicator("Capital a recuperar", "FINANCEIRO", baseTotals.capitalToRecover, sysTotals.capitalToRecover),
    indicator("Total a receber", "FINANCEIRO", baseTotals.toReceive, sysTotals.toReceive),
    indicator("A receber futuro", "FINANCEIRO", baseTotals.futureReceivable, sysTotals.futureReceivable),
    indicator("Saldo inadimplente", "FINANCEIRO", baseTotals.overdue, sysTotals.overdue),
    indicator("Parcelas", "CONTAGEM", baseTotals.installments, sysTotals.installments, false),
    indicator("Parcelas recebidas", "CONTAGEM", baseTotals.installmentsReceived, sysTotals.installmentsReceived, false),
    indicator("Parcelas abertas", "CONTAGEM", baseTotals.installmentsOpen, sysTotals.installmentsOpen, false),
    indicator("Parcelas inadimplentes", "CONTAGEM", baseTotals.installmentsOverdue, sysTotals.installmentsOverdue, false),
  ];

  // ---------- COMPETÊNCIAS ----------
  const competenceKeys = [...new Set([...baseCompetence.keys(), ...sysCompetence.keys()])].sort();
  const competences: CompetenceRow[] = competenceKeys.map((key) => {
    const b = baseCompetence.get(key) ?? { expected: 0, received: 0, overdue: 0 };
    const s = sysCompetence.get(key) ?? { expected: 0, received: 0, overdue: 0 };
    const statuses = [
      statusFor(b.expected, s.expected),
      statusFor(b.received, s.received),
      statusFor(b.overdue, s.overdue),
    ];
    return {
      competence: `${key}-01`,
      expectedBase: b.expected,
      expectedSystem: s.expected,
      receivedBase: b.received,
      receivedSystem: s.received,
      overdueBase: b.overdue,
      overdueSystem: s.overdue,
      status: worst(statuses),
      worstDiff: Math.max(
        Math.abs(r2(s.expected - b.expected)),
        Math.abs(r2(s.received - b.received)),
        Math.abs(r2(s.overdue - b.overdue)),
      ),
    };
  });

  // ---------- OPERAÇÕES ----------
  const sysOpByRef = new Map<string, SystemOperationRow>();
  for (const op of operations) sysOpByRef.set(normalizeReference(op.reference ?? ""), op);
  const allRefs = [...new Set([...baseByRef.keys(), ...sysOpByRef.keys()])];

  const operationsRows: OperationRow[] = allRefs.map((refKey) => {
    const b = baseByRef.get(refKey);
    const sOp = sysOpByRef.get(refKey);
    const sInst = sysByOperation.get(refKey);

    const capitalBase = r2(b?.initialCapital ?? 0);
    const capitalSystem = r2(num(sOp?.total_invested ?? sOp?.initial_capital));
    const expectedBase = r2((b?.installments ?? []).reduce((acc, i) => acc + i.expected, 0));
    const receivedBase = r2((b?.installments ?? []).reduce((acc, i) => acc + i.received, 0));
    const overdueBase = r2((b?.installments ?? []).reduce((acc, i) => acc + i.overdue, 0));
    const receivableBase = r2(Math.max(expectedBase - receivedBase, 0));

    const expectedSystem = r2(sInst?.expected ?? 0);
    const receivedSystem = r2(sOp ? num(sOp.total_received) : (sInst?.received ?? 0));
    const receivableSystem = r2(sInst?.open ?? num(sOp?.outstanding_amount));
    const overdueSystem = r2(sInst?.overdue ?? num(sOp?.overdue_receivable));

    const statuses = [
      statusFor(capitalBase, capitalSystem),
      statusFor(receivedBase, receivedSystem),
      statusFor(receivableBase, receivableSystem),
      statusFor(overdueBase, overdueSystem),
      statusFor(expectedBase, expectedSystem),
    ];
    const status = worst(statuses);

    const causes: string[] = [];
    if (!sOp) causes.push("PARCELA AUSENTE / OPERAÇÃO NÃO IMPORTADA");
    if (!b && sOp) causes.push("DADO HISTÓRICO INCOMPLETO (operação não existe na base)");
    if (capitalSystem === 0 && capitalBase > 0) causes.push("CAPITAL NÃO IMPORTADO");
    if (expectedSystem > expectedBase + 0.05 && expectedBase > 0) causes.push("PARCELA DUPLICADA");
    if (expectedSystem < expectedBase - 0.05) causes.push("PARCELA AUSENTE");
    if (receivedSystem > receivedBase + 0.05) {
      causes.push(
        overdueBase > 0 && r2(receivedSystem - receivedBase) <= overdueBase + 0.05
          ? "VALOR VERMELHO INTERPRETADO COMO RECEBIDO"
          : "RECEBIMENTO DUPLICADO",
      );
    }
    if (receivedSystem < receivedBase - 0.05) causes.push("RECEBIMENTO NÃO IMPORTADO");
    if (overdueBase > 0 && overdueSystem === 0) causes.push("VENCIMENTO INCORRETO / COMPETÊNCIA INCORRETA");
    if (
      b &&
      sOp &&
      b.category &&
      sOp.category &&
      b.category.toUpperCase() !== sOp.category.toUpperCase()
    ) {
      causes.push("CATEGORIA DIVERGENTE");
    }
    if (status === "ATENCAO") causes.push("ARREDONDAMENTO");

    const compKeys = [
      ...new Set([
        ...(b?.installments ?? []).map((i) => i.competence.slice(0, 7)),
        ...[...(sInst?.competences.keys() ?? [])],
      ]),
    ].sort();

    return {
      reference: b?.reference ?? sOp?.reference ?? refKey,
      operationId: sOp?.operation_id ?? null,
      categoryBase: b?.category ?? null,
      categorySystem: sOp?.category ?? null,
      capitalBase,
      capitalSystem,
      receivedBase,
      receivedSystem,
      receivableBase,
      receivableSystem,
      overdueBase,
      overdueSystem,
      expectedBase,
      expectedSystem,
      status,
      worstDiff: Math.max(
        Math.abs(r2(capitalSystem - capitalBase)),
        Math.abs(r2(receivedSystem - receivedBase)),
        Math.abs(r2(receivableSystem - receivableBase)),
        Math.abs(r2(overdueSystem - overdueBase)),
      ),
      causes: [...new Set(causes)],
      sheets: b?.sheets ?? [],
      competences: compKeys.map((key) => {
        const bi = (b?.installments ?? []).find((i) => i.competence.slice(0, 7) === key);
        const si = sInst?.competences.get(key);
        return {
          competence: `${key}-01`,
          expectedBase: r2(bi?.expected ?? 0),
          expectedSystem: r2(si?.expected ?? 0),
          receivedBase: r2(bi?.received ?? 0),
          receivedSystem: r2(si?.received ?? 0),
          overdueBase: r2(bi?.overdue ?? 0),
          overdueSystem: r2(si?.overdue ?? 0),
          sheet: bi?.sheet ?? null,
          row: null,
        };
      }),
    };
  });

  operationsRows.sort((a, b) => b.worstDiff - a.worstDiff);

  // ---------- CONSISTÊNCIA INTERNA ----------
  const checks: ConsistencyCheck[] = [];
  const push = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail });

  const expectedRecover = r2(Math.max(sysTotals.capital - sysTotals.received, 0));
  push(
    "Capital a recuperar = Capital investido − Total recebido",
    Math.abs(expectedRecover - sysTotals.capitalToRecover) <= 0.05,
    `${expectedRecover.toFixed(2)} vs ${sysTotals.capitalToRecover.toFixed(2)}`,
  );
  push(
    "Total a receber = A receber futuro + Inadimplência",
    Math.abs(r2(sysTotals.futureReceivable + sysTotals.overdue) - sysTotals.toReceive) <= 0.05,
    `${r2(sysTotals.futureReceivable + sysTotals.overdue).toFixed(2)} vs ${sysTotals.toReceive.toFixed(2)}`,
  );
  push(
    "Total previsto − Total recebido = Total a receber",
    Math.abs(r2(sysTotals.expected - sysTotals.received) - sysTotals.toReceive) <= 0.05,
    `${r2(sysTotals.expected - sysTotals.received).toFixed(2)} vs ${sysTotals.toReceive.toFixed(2)}`,
  );

  const paidWithBalance = installments.filter(
    (i) =>
      (i.payment_status ?? "") === "RECEBIDA" &&
      num(i.expected_amount) - num(i.received_amount) > 0.005,
  );
  push(
    "Nenhuma parcela recebida com saldo em aberto",
    paidWithBalance.length === 0,
    `${paidWithBalance.length} violação(ões)`,
  );

  const futureFlaggedOverdue = installments.filter(
    (i) => (i.due_date ?? "") >= today && (i.financial_status ?? "").includes("INADIMPL"),
  );
  push(
    "Nenhuma parcela futura marcada como inadimplente",
    futureFlaggedOverdue.length === 0,
    `${futureFlaggedOverdue.length} violação(ões)`,
  );

  const overdueNotFlagged = installments.filter(
    (i) =>
      (i.due_date ?? "") < today &&
      num(i.expected_amount) - num(i.received_amount) > 0.005 &&
      !(i.financial_status ?? "").includes("INADIMPL"),
  );
  push(
    "Parcelas vencidas em aberto sinalizadas como atraso",
    overdueNotFlagged.length === 0,
    `${overdueNotFlagged.length} violação(ões)`,
  );
  push(
    "Inadimplência ≤ Total a receber",
    sysTotals.overdue <= sysTotals.toReceive + 0.05,
    `${sysTotals.overdue.toFixed(2)} ≤ ${sysTotals.toReceive.toFixed(2)}`,
  );
  push(
    "Inadimplência apenas em competências anteriores a " + currentMonth,
    !installments.some(
      (i) =>
        (i.competence ?? "").slice(0, 7) >= currentMonth &&
        (i.financial_status ?? "").includes("INADIMPL"),
    ),
    "leitura de vermelho restrita a meses passados",
  );

  // ---------- AMOSTRAGEM ----------
  const byCapital = [...operationsRows].sort((a, b) => b.capitalBase - a.capitalBase).slice(0, 5);
  const byReceived = [...operationsRows].sort((a, b) => b.receivedBase - a.receivedBase).slice(0, 5);
  const byOverdue = operationsRows.filter((o) => o.overdueBase > 0).slice(0, 5);
  const random = [...operationsRows].sort(() => Math.random() - 0.5).slice(0, 5);
  const sampleRefs = [...new Set([...byCapital, ...byReceived, ...byOverdue, ...random].map((o) => o.reference))];
  const sampleRows = operationsRows.filter((o) => sampleRefs.includes(o.reference));

  // ---------- RESUMO ----------
  const financialIndicators = indicators.filter((i) => i.group === "FINANCEIRO");
  const indicatorsDiverging = indicators.filter((i) => i.status === "DIVERGENTE").length;
  const financialDiverging = financialIndicators.filter((i) => i.status === "DIVERGENTE").length;
  const operationsDiverging = operationsRows.filter((o) => o.status === "DIVERGENTE").length;
  const competencesDiverging = competences.filter((c) => c.status === "DIVERGENTE").length;
  const totalDivergence = r2(
    financialIndicators.reduce((acc, i) => acc + Math.abs(i.diff), 0),
  );

  const status: HomologResult["summary"]["status"] =
    financialDiverging > 0 || competencesDiverging > 0 || operationsDiverging > 0
      ? "REPROVADA"
      : indicatorsDiverging > 0 || checks.some((c) => !c.passed) || indicators.some((i) => i.status === "ATENCAO")
        ? "APROVADA_COM_RESSALVAS"
        : "APROVADA";

  return {
    today,
    indicators,
    competences,
    operationsRows,
    checks,
    sample: {
      references: sampleRefs,
      ok: sampleRows.filter((o) => o.status === "OK").length,
      total: sampleRows.length,
    },
    summary: {
      status,
      indicatorsOk: indicators.filter((i) => i.status === "OK").length,
      indicatorsDiverging,
      operationsDiverging,
      competencesDiverging,
      totalDivergence,
    },
    totals: { base: baseTotals, system: sysTotals },
  };
}
