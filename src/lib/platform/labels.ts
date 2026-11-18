export const APP_NAME = "Kit Fit";
export const APP_TAGLINE = "Refeições fitness por assinatura";

export type Role = "admin" | "operacao" | "cozinha" | "financeiro" | "nutricionista" | "cliente";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  operacao: "Operação",
  cozinha: "Cozinha",
  financeiro: "Financeiro",
  nutricionista: "Nutricionista",
  cliente: "Cliente",
};

export const MEAL_LABEL: Record<string, string> = {
  almoco: "Almoço",
  jantar: "Jantar",
  lanche: "Lanche",
};
export const MEAL_TYPES = ["almoco", "jantar", "lanche"] as const;

export const GOAL_LABEL: Record<string, string> = {
  manutencao: "Manutenção",
  hipertrofia: "Hipertrofia",
  reducao_peso: "Redução de peso",
};

export const ACTIVITY_LABEL: Record<string, string> = {
  baixo: "Baixo",
  moderado: "Moderado",
  alto: "Alto",
};

export const WEEKDAYS = [
  { value: 1, short: "Seg", label: "Segunda" },
  { value: 2, short: "Ter", label: "Terça" },
  { value: 3, short: "Qua", label: "Quarta" },
  { value: 4, short: "Qui", label: "Quinta" },
  { value: 5, short: "Sex", label: "Sexta" },
  { value: 6, short: "Sáb", label: "Sábado" },
];

export const RESTRICTION_TAGS = [
  { value: "vegetariano", label: "Vegetariano" },
  { value: "sem_lactose", label: "Sem lactose" },
  { value: "sem_gluten", label: "Sem glúten" },
];

export const PREFERENCE_TAGS = [
  ...RESTRICTION_TAGS,
  { value: "low_carb", label: "Low carb" },
  { value: "picante", label: "Picante" },
];

export const tagLabel = (t: string) =>
  [...PREFERENCE_TAGS].find((x) => x.value === t)?.label ?? t.replace(/_/g, " ");

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const STATUS: Record<string, { label: string; tone: Tone }> = {
  // pedidos
  aguardando_pagamento: { label: "Aguardando pagamento", tone: "warning" },
  confirmado: { label: "Confirmado", tone: "info" },
  em_producao: { label: "Em produção", tone: "info" },
  pronto: { label: "Pronto", tone: "success" },
  separado: { label: "Separado", tone: "success" },
  em_rota: { label: "Em rota", tone: "info" },
  entregue: { label: "Entregue", tone: "success" },
  cancelado: { label: "Cancelado", tone: "neutral" },
  expirado: { label: "Expirado", tone: "danger" },
  // pagamentos
  pendente: { label: "Pendente", tone: "warning" },
  aprovado: { label: "Aprovado", tone: "success" },
  recusado: { label: "Recusado", tone: "danger" },
  reembolsado: { label: "Reembolsado", tone: "neutral" },
  contestado: { label: "Contestado", tone: "danger" },
  a_receber: { label: "A receber", tone: "warning" },
  recebido: { label: "Recebido", tone: "success" },
  // assinatura
  ativa: { label: "Ativa", tone: "success" },
  pausada: { label: "Pausada", tone: "warning" },
  cancelada: { label: "Cancelada", tone: "neutral" },
  inadimplente: { label: "Inadimplente", tone: "danger" },
  agendado: { label: "Agendado", tone: "info" },
  pulado: { label: "Pulado", tone: "neutral" },
  pedido_gerado: { label: "Pedido gerado", tone: "success" },
  falhou: { label: "Falhou", tone: "danger" },
  // fichas e preços
  rascunho: { label: "Rascunho", tone: "neutral" },
  em_aprovacao: { label: "Em aprovação", tone: "warning" },
  inativo: { label: "Inativo", tone: "neutral" },
  proposto: { label: "Proposto", tone: "warning" },
  rejeitado: { label: "Rejeitado", tone: "danger" },
  // ciclos
  aberto: { label: "Vendas abertas", tone: "success" },
  corte: { label: "Corte realizado", tone: "warning" },
  producao: { label: "Em produção", tone: "info" },
  encerrado: { label: "Encerrado", tone: "neutral" },
  // estoque e compras
  disponivel: { label: "Disponível", tone: "success" },
  bloqueado: { label: "Bloqueado", tone: "danger" },
  esgotado: { label: "Esgotado", tone: "neutral" },
  prevista: { label: "Prevista", tone: "info" },
  recebida_parcial: { label: "Recebida parcial", tone: "warning" },
  recebida: { label: "Recebida", tone: "success" },
  em_conferencia: { label: "Em conferência", tone: "warning" },
  conferida: { label: "Conferida", tone: "success" },
  conferido: { label: "Conferido", tone: "success" },
  divergente: { label: "Divergente", tone: "warning" },
  ignorado: { label: "Ignorado", tone: "neutral" },
  // produção
  concluido: { label: "Concluído", tone: "success" },
  descartado: { label: "Descartado", tone: "neutral" },
  // nutrição
  proposta: { label: "Proposta do sistema", tone: "warning" },
  em_revisao: { label: "Em revisão", tone: "info" },
  publicado: { label: "Publicado", tone: "success" },
  substituido: { label: "Substituído", tone: "neutral" },
  // financeiro / LGPD
  liquidado: { label: "Liquidado", tone: "success" },
  aberta: { label: "Aberta", tone: "warning" },
  em_atendimento: { label: "Em atendimento", tone: "info" },
  concluida: { label: "Concluída", tone: "success" },
  recusada: { label: "Recusada", tone: "danger" },
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cartao: "Cartão recorrente",
  pix: "Pix",
  pix_automatico: "Pix Automático",
};

export const MOVEMENT_LABEL: Record<string, string> = {
  entrada: "Entrada",
  consumo: "Consumo na produção",
  perda: "Perda",
  devolucao: "Devolução",
  baixa: "Baixa",
  ajuste: "Ajuste de inventário",
};

export const FIN_KIND_LABEL: Record<string, string> = {
  receita_venda: "Venda",
  taxa_pagamento: "Taxa de pagamento",
  reembolso: "Reembolso",
  contestacao: "Contestação",
  despesa: "Despesa",
  compra_insumo: "Compra de insumos",
};
