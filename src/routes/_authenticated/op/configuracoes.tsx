import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Database } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Field,
  Forbidden,
  Loading,
  PageHeader,
  Section,
  StatusBadge,
} from "@/components/platform/ui";
import { db, errorText, list, rpc, unwrap } from "@/lib/platform/db";
import { dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/op/configuracoes")({ component: ConfigPage });

type Settings = {
  business_name: string;
  delivery_included_in_price: boolean;
  release_reservation_on_failure: boolean;
} & Record<string, number | boolean | string>;

const FIELDS: { key: string; label: string; pct?: boolean; hint?: string }[] = [
  { key: "card_fee_pct", label: "Taxa do cartão", pct: true },
  { key: "pix_fee_pct", label: "Taxa do Pix", pct: true },
  { key: "tax_pct", label: "Tributos sobre a venda", pct: true },
  { key: "target_margin_pct", label: "Margem de contribuição desejada", pct: true },
  { key: "min_margin_pct", label: "Margem mínima (alerta de desconto)", pct: true },
  { key: "labor_cost_per_hour", label: "Custo da mão de obra (R$/hora)" },
  { key: "delivery_cost_per_order", label: "Custo de entrega por pedido (R$)" },
  {
    key: "avg_portions_per_order",
    label: "Porções médias por pedido",
    hint: "Para ratear a entrega por porção",
  },
  {
    key: "delivery_price",
    label: "Taxa de entrega cobrada (R$)",
    hint: "Usada quando a entrega não está embutida no preço",
  },
  { key: "expiry_alert_days", label: "Alertar vencimento com quantos dias" },
  { key: "payment_max_retries", label: "Tentativas de cobrança antes de liberar a reserva" },
  { key: "payment_retry_hours", label: "Intervalo entre tentativas (horas)" },
  { key: "pix_expiration_minutes", label: "Validade da cobrança Pix (minutos)" },
];

function ConfigPage() {
  const { session } = Route.useRouteContext();
  const isAdmin = session.roles.includes("admin");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["settings"],
    queryFn: async () => ({
      settings: unwrap<Settings>(await db.from("platform_settings").select("*").single()),
      privacy: isAdmin
        ? await list<{
            id: string;
            customer_id: string;
            kind: string;
            status: string;
            details: string | null;
            created_at: string;
          }>("privacy_requests", (x) => x.order("created_at", { ascending: false }))
        : [],
      audit: isAdmin
        ? await list<{
            id: number;
            table_name: string;
            record_id: string;
            action: string;
            changed_by: string | null;
            changed_at: string;
          }>(
            "audit_log",
            (x) => x.order("changed_at", { ascending: false }).limit(100),
            "id,table_name,record_id,action,changed_by,changed_at",
          )
        : [],
    }),
  });
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    if (q.data) setS(q.data.settings);
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { id: _id, updated_at: _u, ...rest } = s!;
      void _id;
      void _u;
      unwrap(
        await db
          .from("platform_settings")
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq("id", true),
      );
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const seed = useMutation({
    mutationFn: () => rpc<{ result: string }>("seed_demo_data"),
    onSuccess: (r) => {
      toast.success(
        r.result === "ja_carregado"
          ? "Dados de demonstração já estavam carregados"
          : "Dados de demonstração carregados",
      );
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const privacy = useMutation({
    mutationFn: async ({
      id,
      customer,
      action,
    }: {
      id: string;
      customer: string;
      action: "anonimizar" | "atender" | "recusar";
    }) => {
      if (action === "anonimizar")
        return rpc("anonymize_customer", { p_customer_id: customer, p_request_id: id });
      unwrap(
        await db
          .from("privacy_requests")
          .update({
            status: action === "atender" ? "concluida" : "recusada",
            resolved_at: new Date().toISOString(),
            resolved_by: session.userId,
            response: action === "atender" ? "Atendida pela equipe" : "Recusada",
          })
          .eq("id", id),
      );
      return undefined;
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (!session.has("financeiro")) return <Forbidden />;
  if (q.isLoading || !s) return <Loading />;

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Parâmetros de preço, pagamento e alertas usados em todo o sistema."
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        }
      />
      <Tabs defaultValue="parametros">
        <TabsList>
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          {isAdmin && <TabsTrigger value="lgpd">LGPD</TabsTrigger>}
          {isAdmin && <TabsTrigger value="auditoria">Auditoria</TabsTrigger>}
        </TabsList>
        <TabsContent value="parametros" className="space-y-6">
          <Section title="Preço, pagamento e alertas">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Nome da operação">
                <Input
                  value={String(s.business_name ?? "")}
                  onChange={(e) => setS({ ...s, business_name: e.target.value })}
                />
              </Field>
              {FIELDS.map((f) => (
                <Field key={f.key} label={f.label + (f.pct ? " (%)" : "")} hint={f.hint}>
                  <Input
                    type="number"
                    step="0.01"
                    value={f.pct ? Math.round(Number(s[f.key]) * 10000) / 100 : Number(s[f.key])}
                    onChange={(e) =>
                      setS({
                        ...s,
                        [f.key]: f.pct ? Number(e.target.value) / 100 : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={Boolean(s.delivery_included_in_price)}
                  onCheckedChange={(v) => setS({ ...s, delivery_included_in_price: v })}
                />{" "}
                Entrega embutida no preço do prato
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={Boolean(s.release_reservation_on_failure)}
                  onCheckedChange={(v) => setS({ ...s, release_reservation_on_failure: v })}
                />{" "}
                Liberar reserva ao esgotar as tentativas
              </label>
            </div>
          </Section>
          {isAdmin && (
            <Section title="Dados de demonstração">
              <p className="mb-3 text-sm text-muted-foreground">
                Carrega fornecedores, 14 ingredientes (um sem alergênicos confirmados), 7 fichas
                aprovadas com preço, lotes (um vencido e um perto do vencimento), uma compra
                prevista e a semana seguinte aberta para vendas. Útil para o teste de aceite.
              </p>
              <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
                <Database className="mr-2 size-4" /> Carregar demonstração
              </Button>
            </Section>
          )}
        </TabsContent>
        {isAdmin && (
          <TabsContent value="lgpd">
            <Section title="Solicitações dos titulares">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Titular</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data!.privacy.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{dateTimeBR(r.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.customer_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{r.kind}</TableCell>
                      <TableCell className="text-sm">{r.details}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        {r.status === "aberta" && (
                          <>
                            {r.kind === "exclusao" ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  confirm(
                                    "Remover os dados pessoais e alimentares deste titular? Esta ação não pode ser desfeita.",
                                  ) &&
                                  privacy.mutate({
                                    id: r.id,
                                    customer: r.customer_id,
                                    action: "anonimizar",
                                  })
                                }
                              >
                                Excluir dados
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  privacy.mutate({
                                    id: r.id,
                                    customer: r.customer_id,
                                    action: "atender",
                                  })
                                }
                              >
                                Marcar atendida
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                privacy.mutate({
                                  id: r.id,
                                  customer: r.customer_id,
                                  action: "recusar",
                                })
                              }
                            >
                              Recusar
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="auditoria">
            <Section title="Alterações relevantes (últimas 100)">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data!.audit.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{dateTimeBR(a.changed_at)}</TableCell>
                      <TableCell>{a.table_name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {a.record_id?.slice(0, 8)}
                      </TableCell>
                      <TableCell>{a.action}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {a.changed_by?.slice(0, 8) ?? "sistema"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
