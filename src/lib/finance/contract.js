/**
 * Motor de datas e simulação de contratos.
 *
 * Fluxo A: informa 1º vencimento + nº de parcelas -> deriva a data final.
 * Fluxo B: informa data final + nº de parcelas -> deriva o 1º vencimento.
 * Ambos respeitam o dia de vencimento e ajustam meses curtos (30/31 -> 28/29).
 */
const lastDayOfMonth = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
export function addMonthsClamped(iso, months, dueDay) {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d)
        return iso;
    const base = new Date(Date.UTC(y, m - 1 + months, 1));
    const year = base.getUTCFullYear();
    const month = base.getUTCMonth();
    const wanted = dueDay && dueDay > 0 ? dueDay : d;
    const day = Math.min(wanted, lastDayOfMonth(year, month));
    return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}
export function deriveContractDates(input) {
    const count = input.installmentCount && input.installmentCount > 0 ? Math.trunc(input.installmentCount) : null;
    const dueDay = input.dueDay && input.dueDay > 0 ? Math.min(Math.trunc(input.dueDay), 31) : null;
    if (input.mode === "PRIMEIRO_VENCIMENTO") {
        if (!input.firstDueDate || !count) {
            return { firstDueDate: input.firstDueDate ?? null, finalDate: null, installmentCount: count, dueDay, error: "Informe o 1º vencimento e a quantidade de parcelas." };
        }
        const first = addMonthsClamped(input.firstDueDate, 0, dueDay);
        return { firstDueDate: first, finalDate: addMonthsClamped(first, count - 1, dueDay), installmentCount: count, dueDay, error: null };
    }
    if (!input.finalDate || !count) {
        return { firstDueDate: null, finalDate: input.finalDate ?? null, installmentCount: count, dueDay, error: "Informe a data final e a quantidade de parcelas." };
    }
    const last = addMonthsClamped(input.finalDate, 0, dueDay);
    return { firstDueDate: addMonthsClamped(last, -(count - 1), dueDay), finalDate: last, installmentCount: count, dueDay, error: null };
}
export function simulateContract(input) {
    const count = Math.max(0, Math.trunc(input.installmentCount || 0));
    const value = Number(input.installmentValue || 0);
    const capital = Number(input.capital || 0);
    const contractedTotal = count * value;
    const profit = contractedTotal - capital;
    const roiTotal = capital > 0 ? profit / capital : 0;
    const schedule = [];
    let accumulated = 0;
    let paybackInstallments = null;
    for (let i = 1; i <= count; i += 1) {
        accumulated += value;
        const dueDate = input.firstDueDate ? addMonthsClamped(input.firstDueDate, i - 1, input.dueDay) : "";
        if (paybackInstallments === null && capital > 0 && accumulated >= capital)
            paybackInstallments = i;
        schedule.push({
            number: i,
            dueDate,
            amount: value,
            accumulated,
            remainingCapital: Math.max(capital - accumulated, 0),
        });
    }
    return {
        contractedTotal,
        profit,
        roiTotal,
        roiMonthlyAverage: count > 0 ? roiTotal / count : 0,
        paybackInstallments,
        paybackDate: paybackInstallments ? (schedule[paybackInstallments - 1]?.dueDate ?? null) : null,
        finalDate: schedule.length > 0 ? (schedule[schedule.length - 1]?.dueDate ?? null) : null,
        schedule,
    };
}
