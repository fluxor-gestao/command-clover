import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  Field,
  Forbidden,
  Loading,
  PageHeader,
  Section,
  StatusBadge,
} from "@/components/platform/ui";
import { errorText, list, rpc } from "@/lib/platform/db";
import { ACTIVITY_LABEL, GOAL_LABEL, MEAL_LABEL } from "@/lib/platform/labels";
import { dateTimeBR, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/nutri/planos")({
  component: NutriPlanosPage,
});

type Snapshot = {
  weight_kg?: number | null;
  height_cm?: number | null;
  age_range?: string | null;
  goal?: string | null;
  activity_level?: string | null;
  training_frequency?: number | null;
  training_type?: string | null;
  allergies?: string[] | null;
  restrictions?: string[] | null;
};
type Queue = {
  plan_id: string;
  customer_id: string;
  customer_name: string;
  version: number;
  status: string;
  origin: string;
  created_at: string;
  published_version: number | null;
};
type Targets = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
type Dist = { meal_type: string; pct: number; kcal: number; protein_g: number };
type Sub = { de?: string; para?: string; note?: string };
type Adj = { dish?: string | undefined; factor?: number | undefined; note?: string | undefined };
type Plan = {
  id: string;
  customer_id: string;
  version: number;
  status: string;
  origin: string;
  notes: string | null;
  created_at: string;
  profile_snapshot: Snapshot;
  targets: Targets;
  meal_distribution: Dist[];
  substitutions: Sub[];
  portion_adjustments: Adj[];
};

const ORIGIN: Record<string, string> = {
  solicitacao: "Pedido do cliente",
  alteracao_perfil: "Mudança relevante no perfil",
  revisao_nutricionista: "Revisão do nutricionista",
};

function NutriPlanosPage() {
  const { session } = Route.useRouteContext();
  const [selected, setSelected] = useState<string | null>(null);
  const queue = useQuery({
    queryKey: ["nutri-queue"],
    enabled: session.has("nutricionista"),
    queryFn: () => rpc<Queue[]>("nutrition_review_queue"),
  });
  const published = useQuery({
    queryKey: ["nutri-published"],
    enabled: session.has("nutricionista"),
    queryFn: () =>
      list<{
        id: string;
        customer_id: string;
        version: number;
        published_at: string;
        targets: Targets;
      }>("nutrition_plans", (x) =>
        x.eq("status", "publicado").order("published_at", { ascending: false }).limit(50),
      ),
  });
  useEffect(() => {
    if (!selected && queue.data?.[0]) setSelected(queue.data[0].plan_id);
  }, [queue.data, selected]);

  if (!session.has("nutricionista")) return <Forbidden />;
  if (queue.isLoading) return <Loading />;

  return (
    <>
      <PageHeader
        title="Revisão de planos"
        description="Propostas geradas pelo sistema a partir dos seus parâmetros. Ajuste porções, metas, distribuição e substituições; o cliente só vê o plano depois que você publica."
      />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Section title={`Fila (${queue.data?.length ?? 0})`}>
            {!queue.data?.length ? (
              <p className="text-sm text-muted-foreground">Nada para revisar.</p>
            ) : (
              <ul className="space-y-1">
                {queue.data.map((p) => (
                  <li key={p.plan_id}>
                    <button
                      onClick={() => setSelected(p.plan_id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${selected === p.plan_id ? "bg-muted" : ""}`}
                    >
                      <p className="font-medium">{p.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        v{p.version} · {ORIGIN[p.origin] ?? p.origin} · {dateTimeBR(p.created_at)}
                      </p>
                      {p.published_version && (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          publicado: v{p.published_version}
                        </Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Publicados recentes">
            <ul className="space-y-1 text-sm">
              {(published.data ?? []).map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="font-mono text-xs">
                    {p.customer_id.slice(0, 8)} v{p.version}
                  </span>
                  <span className="text-xs text-muted-foreground">{num(p.targets.kcal)} kcal</span>
                  <ReviseButton planId={p.id} onCreated={setSelected} />
                </li>
              ))}
            </ul>
          </Section>
        </div>
        {selected ? (
          <Review key={selected} planId={selected} onDone={() => setSelected(null)} />
        ) : (
          <Empty title="Selecione um plano" />
        )}
      </div>
    </>
  );
}

function ReviseButton({ planId, onCreated }: { planId: string; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => rpc<string>("revise_nutrition_plan", { p_plan_id: planId }),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["nutri-queue"] });
      onCreated(id);
    },
    onError: (e) => toast.error(errorText(e)),
  });
  return (
    <button className="text-xs text-primary hover:underline" onClick={() => m.mutate()}>
      nova revisão
    </button>
  );
}

function Review({ planId, onDone }: { planId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["nutri-plan", planId],
    queryFn: async () => {
      const [plan] = await list<Plan>("nutrition_plans", (x) => x.eq("id", planId));
      const history = plan
        ? await list<Plan>("nutrition_plans", (x) =>
            x
              .eq("customer_id", plan.customer_id)
              .in("status", ["publicado", "substituido"])
              .order("version", { ascending: false })
              .limit(3),
          )
        : [];
      const dishes = await list<{ id: string; name: string }>("dishes", (x) =>
        x.eq("status", "aprovado").order("name"),
      );
      return { plan: plan!, history, dishes };
    },
  });
  const [t, setT] = useState<Targets | null>(null);
  const [dist, setDist] = useState<Dist[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [adj, setAdj] = useState<Adj[]>([]);
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (!q.data?.plan) return;
    setT(q.data.plan.targets);
    setDist(q.data.plan.meal_distribution);
    setSubs(q.data.plan.substitutions);
    setAdj(q.data.plan.portion_adjustments);
    setNotes(q.data.plan.notes ?? "");
  }, [q.data]);

  const save = useMutation({
    mutationFn: (publish: boolean) =>
      rpc("review_nutrition_plan", {
        p_plan_id: planId,
        p_targets: t,
        p_meal_distribution: dist,
        p_portion_adjustments: adj,
        p_substitutions: subs,
        p_notes: notes,
        p_publish: publish,
      }),
    onSuccess: (_, publish) => {
      toast.success(publish ? "Plano aprovado e publicado para o cliente" : "Revisão salva");
      qc.invalidateQueries({ queryKey: ["nutri-queue"] });
      qc.invalidateQueries({ queryKey: ["nutri-published"] });
      if (publish) onDone();
      else qc.invalidateQueries({ queryKey: ["nutri-plan", planId] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (q.isLoading || !q.data?.plan || !t) return <Loading />;
  const p = q.data.plan.profile_snapshot;
  const editable = ["proposta", "em_revisao"].includes(q.data.plan.status);
  const macroKcal = t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9;

  return (
    <div className="space-y-6">
      <Section
        title={`Plano v${q.data.plan.version}`}
        actions={<StatusBadge status={q.data.plan.status} />}
      >
        <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <p>
            Peso: <b>{p.weight_kg ?? "—"} kg</b>
          </p>
          <p>
            Altura: <b>{p.height_cm ?? "—"} cm</b>
          </p>
          <p>
            Faixa etária: <b>{p.age_range ?? "—"}</b>
          </p>
          <p>
            Objetivo: <b>{GOAL_LABEL[String(p.goal)] ?? "—"}</b>
          </p>
          <p>
            Atividade: <b>{ACTIVITY_LABEL[String(p.activity_level)] ?? "—"}</b>
          </p>
          <p>
            Treino:{" "}
            <b>
              {p.training_frequency ?? "—"}×/sem {p.training_type ? `· ${p.training_type}` : ""}
            </b>
          </p>
          <p className="sm:col-span-3">
            Alergias: <b>{p.allergies?.join(", ") || "nenhuma"}</b> · Restrições:{" "}
            <b>{p.restrictions?.join(", ") || "nenhuma"}</b>
          </p>
        </div>
        {q.data.history[0] && (
          <p className="mt-3 text-xs text-muted-foreground">
            Publicado atual (v{q.data.history[0].version}): {num(q.data.history[0].targets.kcal)}{" "}
            kcal · P {num(q.data.history[0].targets.protein_g)} g · C{" "}
            {num(q.data.history[0].targets.carbs_g)} g · G {num(q.data.history[0].targets.fat_g)} g
          </p>
        )}
      </Section>

      <Section title="Metas diárias">
        <div className="grid gap-3 sm:grid-cols-4">
          {(["kcal", "protein_g", "carbs_g", "fat_g"] as const).map((k) => (
            <Field
              key={k}
              label={
                {
                  kcal: "Energia (kcal)",
                  protein_g: "Proteínas (g)",
                  carbs_g: "Carboidratos (g)",
                  fat_g: "Gorduras (g)",
                }[k]
              }
            >
              <Input
                type="number"
                disabled={!editable}
                value={t[k]}
                onChange={(e) => setT({ ...t, [k]: Number(e.target.value) })}
              />
            </Field>
          ))}
        </div>
        <p
          className={`mt-2 text-xs ${Math.abs(macroKcal - t.kcal) > t.kcal * 0.05 ? "text-warning-foreground" : "text-muted-foreground"}`}
        >
          Macros somam {num(macroKcal)} kcal ({num((macroKcal / Math.max(1, t.kcal)) * 100)}% da
          meta).
        </p>
      </Section>

      <Section title="Distribuição nas refeições do kit">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Refeição</TableHead>
              <TableHead>% do dia</TableHead>
              <TableHead>kcal</TableHead>
              <TableHead>Proteína (g)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dist.map((d, i) => (
              <TableRow key={d.meal_type}>
                <TableCell>{MEAL_LABEL[d.meal_type] ?? d.meal_type}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="1"
                    className="h-8 w-24"
                    disabled={!editable}
                    value={Math.round(d.pct * 100)}
                    onChange={(e) => {
                      const pct = Number(e.target.value) / 100;
                      setDist(
                        dist.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                pct,
                                kcal: Math.round(t.kcal * pct),
                                protein_g: Math.round(t.protein_g * pct),
                              }
                            : x,
                        ),
                      );
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="h-8 w-24"
                    disabled={!editable}
                    value={d.kcal}
                    onChange={(e) =>
                      setDist(
                        dist.map((x, j) => (j === i ? { ...x, kcal: Number(e.target.value) } : x)),
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="h-8 w-24"
                    disabled={!editable}
                    value={d.protein_g}
                    onChange={(e) =>
                      setDist(
                        dist.map((x, j) =>
                          j === i ? { ...x, protein_g: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Ajuste de porções"
          actions={
            editable && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAdj([...adj, { dish: q.data.dishes[0]?.name, factor: 1.2 }])}
              >
                <Plus className="size-4" />
              </Button>
            )
          }
        >
          {adj.map((a, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <select
                className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
                disabled={!editable}
                value={a.dish}
                onChange={(e) =>
                  setAdj(adj.map((x, j) => (j === i ? { ...x, dish: e.target.value } : x)))
                }
              >
                {q.data.dishes.map((d) => (
                  <option key={d.id}>{d.name}</option>
                ))}
              </select>
              <Input
                type="number"
                step="0.1"
                className="w-20"
                disabled={!editable}
                value={a.factor ?? 1}
                onChange={(e) =>
                  setAdj(
                    adj.map((x, j) => (j === i ? { ...x, factor: Number(e.target.value) } : x)),
                  )
                }
              />
              {editable && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setAdj(adj.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          {!adj.length && (
            <p className="text-sm text-muted-foreground">Porções padrão das fichas técnicas.</p>
          )}
        </Section>
        <Section
          title="Substituições"
          actions={
            editable && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSubs([...subs, { de: "", para: "" }])}
              >
                <Plus className="size-4" />
              </Button>
            )
          }
        >
          {subs.map((s, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <Input
                placeholder="Trocar"
                disabled={!editable}
                value={s.de ?? ""}
                onChange={(e) =>
                  setSubs(subs.map((x, j) => (j === i ? { ...x, de: e.target.value } : x)))
                }
              />
              <Input
                placeholder="Por"
                disabled={!editable}
                value={s.para ?? ""}
                onChange={(e) =>
                  setSubs(subs.map((x, j) => (j === i ? { ...x, para: e.target.value } : x)))
                }
              />
              {editable && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSubs(subs.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          {!subs.length && <p className="text-sm text-muted-foreground">Sem substituições.</p>}
        </Section>
      </div>

      <Section title="Orientações ao cliente">
        <Textarea
          rows={3}
          disabled={!editable}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {editable && (
          <div className="mt-4 flex gap-2">
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate(false)}>
              Salvar revisão
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate(true)}>
              Aprovar e publicar
            </Button>
          </div>
        )}
      </Section>
    </div>
  );
}
