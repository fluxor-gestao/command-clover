import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Webhook do provedor de pagamentos.
 *
 * Contrato normalizado (o adaptador do provedor contratado converte o payload dele para este formato):
 *   { provider, event_id, charge_id, status, amount?, fee?, receipt_url? }
 *   status ∈ aprovado | recusado | expirado | reembolsado | contestado
 *
 * Segurança: assinatura HMAC-SHA256 do corpo bruto no cabeçalho `x-signature` (hex), com o segredo
 * PAYMENT_WEBHOOK_SECRET. A idempotência fica no banco (payment_events único por provider + event_id).
 */

const STATUS_MAP: Record<string, string> = {
  // nomes comuns em provedores → status internos
  paid: "aprovado",
  approved: "aprovado",
  confirmed: "aprovado",
  received: "aprovado",
  aprovado: "aprovado",
  refused: "recusado",
  declined: "recusado",
  failed: "recusado",
  recusado: "recusado",
  expired: "expirado",
  overdue: "expirado",
  expirado: "expirado",
  refunded: "reembolsado",
  reembolsado: "reembolsado",
  chargeback: "contestado",
  disputed: "contestado",
  contestado: "contestado",
};

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const Route = createFileRoute("/api/pagamentos/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYMENT_WEBHOOK_SECRET"];
        if (!secret) return json(503, { error: "PAYMENT_WEBHOOK_SECRET não configurado" });

        const raw = await request.text();
        const signature = (request.headers.get("x-signature") ?? "").toLowerCase();
        if (!signature || !safeEqual(signature, await hmacHex(secret, raw)))
          return json(401, { error: "assinatura inválida" });

        let body: {
          provider?: unknown;
          event_id?: unknown;
          charge_id?: unknown;
          status?: unknown;
          amount?: unknown;
          fee?: unknown;
          receipt_url?: unknown;
        };
        try {
          body = JSON.parse(raw);
        } catch {
          return json(400, { error: "JSON inválido" });
        }
        const status = STATUS_MAP[String(body.status ?? "").toLowerCase()];
        if (!body.event_id || !body.charge_id || !status)
          return json(422, { error: "evento incompleto ou status desconhecido" });

        const { data, error } = await supabaseAdmin.rpc(
          "process_payment_event" as never,
          {
            p_provider: String(body.provider ?? "provedor"),
            p_event_id: String(body.event_id),
            p_charge_id: String(body.charge_id),
            p_status: status,
            p_amount: body.amount ?? null,
            p_fee: body.fee ?? null,
            p_payload: body,
            p_receipt_url: body.receipt_url ?? null,
          } as never,
        );
        if (error) return json(500, { error: error.message });
        // 200 também para duplicados: o provedor para de reenviar.
        return json(200, data);
      },
    },
  },
});
