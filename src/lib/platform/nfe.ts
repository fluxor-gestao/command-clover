// Leitura do XML da NF-e (modelo 55) no navegador. O XML original segue para o banco para auditoria.

export type NfeLot = {
  lot_code: string;
  quantity: number;
  manufactured_at: string | null;
  expires_at: string | null;
};
export type NfeItem = {
  item_number: number;
  supplier_code: string;
  description: string;
  ncm: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
  lots: NfeLot[];
};
export type NfeHeader = {
  access_key: string;
  number: string;
  series: string;
  issued_at: string;
  supplier_cnpj: string;
  supplier_name: string;
  total_amount: number;
  due_date: string | null;
};

const text = (el: Element | Document | null | undefined, tag: string) => {
  if (!el) return null;
  const found = el.getElementsByTagNameNS("*", tag)[0] ?? el.getElementsByTagName(tag)[0];
  return found?.textContent?.trim() ?? null;
};
const direct = (el: Element, tag: string) =>
  Array.from(el.children).find((c) => c.localName === tag) ?? null;

export function parseNfe(xml: string): { header: NfeHeader; items: NfeItem[] } {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Arquivo XML inválido");
  const inf = doc.getElementsByTagNameNS("*", "infNFe")[0] ?? doc.getElementsByTagName("infNFe")[0];
  if (!inf) throw new Error("O arquivo não parece ser uma NF-e (infNFe não encontrado)");

  const ide = inf.getElementsByTagNameNS("*", "ide")[0];
  const emit = inf.getElementsByTagNameNS("*", "emit")[0];
  const id = inf.getAttribute("Id") ?? "";
  const accessKey = id.replace(/^NFe/, "") || text(doc, "chNFe") || "";
  const dup = inf.getElementsByTagNameNS("*", "dup")[0];

  const header: NfeHeader = {
    access_key: accessKey,
    number: text(ide, "nNF") ?? "",
    series: text(ide, "serie") ?? "",
    issued_at: text(ide, "dhEmi") ?? text(ide, "dEmi") ?? new Date().toISOString(),
    supplier_cnpj: (text(emit, "CNPJ") ?? text(emit, "CPF") ?? "").replace(/\D/g, ""),
    supplier_name: text(emit, "xNome") ?? "Fornecedor",
    total_amount: Number(text(inf.getElementsByTagNameNS("*", "ICMSTot")[0], "vNF") ?? 0),
    due_date: dup ? text(dup, "dVenc") : null,
  };
  if (!header.access_key) throw new Error("Chave de acesso não encontrada no XML");

  const items: NfeItem[] = Array.from(inf.getElementsByTagNameNS("*", "det")).map((det, idx) => {
    const prod = direct(det, "prod")!;
    const lots = Array.from(prod.getElementsByTagNameNS("*", "rastro")).map((r) => ({
      lot_code: text(r, "nLote") ?? "",
      quantity: Number(text(r, "qLote") ?? 0),
      manufactured_at: text(r, "dFab"),
      expires_at: text(r, "dVal"),
    }));
    // Medicamentos/alimentos às vezes trazem lote em <med> ou em infAdProd; o usuário completa na conferência.
    return {
      item_number: Number(det.getAttribute("nItem") ?? idx + 1),
      supplier_code: text(prod, "cProd") ?? "",
      description: text(prod, "xProd") ?? "",
      ncm: text(prod, "NCM"),
      unit: text(prod, "uCom") ?? "",
      quantity: Number(text(prod, "qCom") ?? 0),
      unit_price: Number(text(prod, "vUnCom") ?? 0),
      total: Number(text(prod, "vProd") ?? 0),
      lots,
    };
  });
  if (!items.length) throw new Error("Nenhum item encontrado na nota");
  return { header, items };
}
