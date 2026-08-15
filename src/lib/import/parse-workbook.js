import { createHash } from "crypto";
export function listAnnualSheets(workbook) {
    return workbook.worksheets
        .map((s) => s.name)
        .filter((n) => normalizeText(n).startsWith("A RECEBER") || n.match(/20\d{2}/));
}
const MONTHS = {
    JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
    JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};
function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}
export function normalizeText(value) {
    if (value === null || value === undefined)
        return "";
    const text = typeof value === "object" && value !== null && "result" in value
        ? String(value.result ?? "")
        : String(value);
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}
export function normalizeReference(reference) {
    return normalizeText(reference).replace(/[^A-Z0-9]/g, "");
}
function cellText(cell) {
    if (!cell)
        return "";
    const value = cell.value;
    if (value === null || value === undefined)
        return "";
    if (value instanceof Date)
        return value.toISOString().slice(0, 10);
    if (typeof value === "object") {
        const obj = value;
        if (obj["richText"] && Array.isArray(obj["richText"])) {
            return obj["richText"].map((part) => part.text).join("").trim();
        }
        if (obj["text"])
            return String(obj["text"] ?? "").trim();
        if (obj["result"])
            return String(obj["result"] ?? "").trim();
    }
    return String(value).trim();
}
function cellNumber(cell) {
    if (!cell)
        return null;
    const value = cell.value;
    if (value === null || value === undefined || value === "")
        return null;
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    if (typeof value === "object") {
        const result = value["result"];
        if (typeof result === "number")
            return result;
        return null;
    }
    const parsed = Number(String(value).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}
function cellDate(cell) {
    if (!cell)
        return null;
    const value = cell.value;
    if (value instanceof Date)
        return value.toISOString().slice(0, 10);
    const text = cellText(cell);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match)
        return `${match[1]}-${match[2]}-${match[3]}`;
    const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br)
        return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    return null;
}
function isRed(cell) {
    if (!cell)
        return false;
    const argb = cell.font?.color?.argb;
    if (argb && /FF0000$/i.test(argb))
        return true;
    return false;
}
function categoryFromSection(section) {
    const text = normalizeText(section);
    if (text.includes("CARRO") || text.includes("VEICUL"))
        return "Veículos";
    if (text.includes("EMPREST"))
        return "Empréstimos";
    if (text.includes("SUBLOCA"))
        return "Sublocação";
    if (text.includes("ALUGUE") || text.includes("IMOVE") || text.includes("CONDOMINIO"))
        return "Aluguéis";
    return "Outros";
}
function buildDueDate(year, month, dueDay) {
    const day = dueDay && dueDay > 0 ? Math.min(dueDay, 28) : 25;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function yearFromSheetName(name) {
    const match = name.match(/(20\d{2})/);
    return match ? Number(match[1]) : null;
}
class OperationIndex {
    map = new Map();
    get(reference, category, keyOverride) {
        const key = keyOverride ?? normalizeReference(reference);
        const existing = this.map.get(key);
        if (existing)
            return existing;
        const created = {
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
            contributions: [],
            incomplete: false,
            sheets: [],
        };
        this.map.set(key, created);
        return created;
    }
    all() { return [...this.map.values()]; }
}
function upsertInstallment(op, inst) {
    const existing = op.installments.find(i => i.competence === inst.competence);
    if (existing) {
        existing.expected = Math.max(existing.expected, inst.expected);
        existing.received = Math.max(existing.received, inst.received);
        existing.overdue = Math.max(existing.overdue, inst.overdue);
    }
    else {
        op.installments.push(inst);
    }
}
export async function parseWorkbook(workbook, options) {
    const referenceMonth = options?.referenceMonth ?? new Date().toISOString().slice(0, 7);
    const result = {
        operations: [], rentals: [], issues: [],
        baseline: { operationRows: 0, capitalTotal: 0, monthlyTotal: 0, receivedTotal: 0, overdueTotal: 0, toReceiveTotal: 0, monthlyCells: 0, ignoredRows: 0 },
        readiness: { ready: 0, pending: 0, ignored: 0, critical: 0 },
        stats: {
            sheetsRead: [], availableSheets: [], referenceMonth, operations: 0, rentals: 0, installments: 0,
            receivedInstallments: 0, overdueInstallments: 0, contributions: 0, expectedTotal: 0, receivedTotal: 0,
            overdueTotal: 0, toReceiveTotal: 0, investedTotal: 0, byYear: [],
        }
    };
    const index = new OperationIndex();
    workbook.eachSheet(sheet => {
        const name = normalizeText(sheet.name);
        // Filtro de abas se fornecido nas opções
        if (options?.sheets && !options.sheets.includes(sheet.name))
            return;
        if (name.startsWith("A RECEBER") || name.match(/20\d{2}/)) {
            const year = yearFromSheetName(sheet.name) || new Date().getFullYear();
            parseAnnualSheet(sheet, year, index, result.issues, result.baseline, referenceMonth);
            result.stats.sheetsRead.push(sheet.name);
        }
        else if (name.includes("ALUGUEIS") || name.includes("PATRIMONIO")) {
            parseRentalsSheet(sheet, result);
            result.stats.sheetsRead.push(sheet.name);
        }
    });
    result.operations = index.all();
    result.stats.operations = result.operations.length;
    // Stats calculation ... (simplified for breath)
    return result;
}
function parseAnnualSheet(sheet, year, index, issues, baseline, referenceMonth) {
    let section = "";
    let monthCols = [];
    sheet.eachRow((row, rowNum) => {
        const valA = cellText(row.getCell(1));
        if (MONTHS[normalizeText(cellText(row.getCell(5)))]) {
            monthCols = [];
            row.eachCell((cell, c) => {
                const m = MONTHS[normalizeText(cellText(cell))];
                if (m)
                    monthCols.push({ col: c, month: m });
            });
            return;
        }
        const ref = cellText(row.getCell(2));
        if (!ref || rowNum < 3 || normalizeText(ref).includes("TOTAL"))
            return;
        const op = index.get(ref, categoryFromSection(section));
        monthCols.forEach(({ col, month }) => {
            const val = cellNumber(row.getCell(col));
            if (val && val > 0) {
                const comp = `${year}-${String(month).padStart(2, "0")}`;
                const red = isRed(row.getCell(col));
                const isPast = comp < referenceMonth;
                upsertInstallment(op, {
                    competence: `${comp}-01`,
                    dueDate: buildDueDate(year, month, op.dueDay),
                    expected: val,
                    received: !red && isPast ? val : 0,
                    overdue: red && isPast ? val : 0,
                    sourceKey: `hist:${normalizeReference(ref)}:${comp}`,
                    sheet: sheet.name
                });
            }
        });
    });
}
function parseRentalsSheet(sheet, result) {
    sheet.eachRow((row, rowNum) => {
        const ref = cellText(row.getCell(2));
        if (!ref || rowNum < 5 || normalizeText(ref).includes("TOTAL"))
            return;
        const val = cellNumber(row.getCell(4)) || 0;
        if (val <= 0)
            return;
        const sourceKey = `rental:${normalizeReference(ref)}`;
        const sourceHash = createHash("md5").update(`${ref}|${val}`).digest("hex");
        result.rentals.push({
            reference: ref, dueDay: 10, currentRent: val, contractStart: null, contractEnd: null,
            adjustmentDate: null, status: "ATIVO", notes: null, monthlyValues: {}, receivedAmount: 0,
            sourceKey, sourceHash
        });
        result.stats.rentals += 1;
    });
}
