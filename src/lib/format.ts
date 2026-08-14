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
