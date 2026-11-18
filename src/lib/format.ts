export const brl = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

export const brlCompact = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value ?? 0));

export const pct = (value: number | null | undefined, digits = 1) =>
  `${(Number(value ?? 0) * 100).toFixed(digits).replace(".", ",")}%`;

export const dateBR = (value: string | null | undefined) => {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const competenceBR = (value: string | null | undefined) => {
  if (!value) return "—";
  const [y, m] = value.slice(0, 10).split("-");
  return `${m}/${y}`;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const num = (value: number | string | null | undefined, digits = 0) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value ?? 0));

export const qty = (value: number | string | null | undefined, unit?: string | null) => {
  const n = Number(value ?? 0);
  if (unit === "g" && Math.abs(n) >= 1000) return `${num(n / 1000, 2)} kg`;
  if (unit === "ml" && Math.abs(n) >= 1000) return `${num(n / 1000, 2)} L`;
  return `${num(n, Number.isInteger(n) ? 0 : 2)}${unit ? ` ${unit}` : ""}`;
};

export const dateTimeBR = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
};

export const weekdayBR = (value: string | null | undefined) => {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
};
