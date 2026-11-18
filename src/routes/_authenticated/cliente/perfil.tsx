import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Chips, Field, Loading, PageHeader, Section } from "@/components/platform/ui";
import { db, errorText, list, rpc, unwrap } from "@/lib/platform/db";
import {
  ACTIVITY_LABEL,
  GOAL_LABEL,
  MEAL_LABEL,
  MEAL_TYPES,
  PREFERENCE_TAGS,
  RESTRICTION_TAGS,
  WEEKDAYS,
} from "@/lib/platform/labels";

export const Route = createFileRoute("/_authenticated/cliente/perfil")({ component: PerfilPage });

type Profile = {
  weight_kg: number | null;
  height_cm: number | null;
  age_range: string | null;
  training_frequency: number | null;
  training_type: string | null;
  activity_level: string;
  goal: string;
  preferences: string[];
  avoid_ingredient_ids: string[];
  allergies: string[];
  restrictions: string[];
  meal_types: string[];
  delivery_weekdays: number[];
  personalization_mode: string;
};
type Account = {
  full_name: string | null;
  phone: string | null;
  address: string | null;
  delivery_notes: string | null;
};

const AGE_RANGES = ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"];

function PerfilPage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const [profile, account, allergens, ingredients] = await Promise.all([
        db
          .from("customer_profiles")
          .select("*")
          .eq("customer_id", session.userId)
          .maybeSingle()
          .then(unwrap<Profile>),
        db
          .from("customer_accounts")
          .select("*")
          .eq("customer_id", session.userId)
          .maybeSingle()
          .then(unwrap<Account>),
        list<{ code: string; name: string }>("allergens", (x) => x.order("name")),
        rpc<{ id: string; name: string }[]>("ingredient_names"),
      ]);
      return { profile, account, allergens, ingredients };
    },
  });

  const [p, setP] = useState<Profile | null>(null);
  const [a, setA] = useState<Account | null>(null);
  useEffect(() => {
    if (q.data) {
      setP(q.data.profile);
      setA(q.data.account);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!p || !a) return;
      unwrap(await db.from("customer_accounts").update(a).eq("customer_id", session.userId));
      const { weight_kg, height_cm, ...rest } = p;
      unwrap(
        await db
          .from("customer_profiles")
          .update({ ...rest, weight_kg: weight_kg || null, height_cm: height_cm || null })
          .eq("customer_id", session.userId),
      );
    },
    onSuccess: () => {
      toast.success("Perfil salvo. O kit sugerido já considera as mudanças.");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (q.isLoading || !p || !a) return <Loading />;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <PageHeader
        title="Perfil alimentar"
        description="Essas informações montam a sugestão do seu kit. Peso, altura e objetivos só são vistos por você e pelo nutricionista."
        actions={
          <Button disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar perfil"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Contato e entrega">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo">
              <Input
                value={a.full_name ?? ""}
                onChange={(e) => setA({ ...a, full_name: e.target.value })}
                required
              />
            </Field>
            <Field label="Telefone / WhatsApp">
              <Input
                value={a.phone ?? ""}
                onChange={(e) => setA({ ...a, phone: e.target.value })}
              />
            </Field>
            <Field label="Endereço de entrega" className="sm:col-span-2">
              <Input
                value={a.address ?? ""}
                onChange={(e) => setA({ ...a, address: e.target.value })}
              />
            </Field>
            <Field label="Observações para a entrega" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={a.delivery_notes ?? ""}
                onChange={(e) => setA({ ...a, delivery_notes: e.target.value })}
              />
            </Field>
          </div>
        </Section>

        <Section title="Corpo e treino">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Peso (kg)">
              <Input
                type="number"
                step="0.1"
                min={30}
                max={300}
                value={p.weight_kg ?? ""}
                onChange={(e) => set("weight_kg", e.target.value ? Number(e.target.value) : null)}
              />
            </Field>
            <Field label="Altura (cm)">
              <Input
                type="number"
                step="0.5"
                min={120}
                max={230}
                value={p.height_cm ?? ""}
                onChange={(e) => set("height_cm", e.target.value ? Number(e.target.value) : null)}
              />
            </Field>
            <Field label="Faixa etária">
              <Select value={p.age_range ?? ""} onValueChange={(v) => set("age_range", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_RANGES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r} anos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Objetivo">
              <Select value={p.goal} onValueChange={(v) => set("goal", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Treinos por semana">
              <Input
                type="number"
                min={0}
                max={14}
                value={p.training_frequency ?? ""}
                onChange={(e) =>
                  set("training_frequency", e.target.value ? Number(e.target.value) : null)
                }
              />
            </Field>
            <Field label="Tipo de treino">
              <Input
                placeholder="Musculação, corrida, funcional…"
                value={p.training_type ?? ""}
                onChange={(e) => set("training_type", e.target.value)}
              />
            </Field>
            <Field label="Nível de atividade" className="sm:col-span-2" group>
              <Chips
                options={Object.entries(ACTIVITY_LABEL).map(([value, label]) => ({ value, label }))}
                value={[p.activity_level]}
                onChange={(v) => {
                  const last = v[v.length - 1];
                  if (last) set("activity_level", last);
                }}
              />
            </Field>
          </div>
        </Section>

        <Section title="Alergias e restrições" className="lg:col-span-2">
          <div className="space-y-5">
            <Field
              label="Alergias"
              hint="Pratos com o alergênico, com risco de contato cruzado ou com informação incompleta deixam de ser oferecidos para você."
              group
            >
              <Chips
                options={q.data!.allergens.map((x) => ({ value: x.code, label: x.name }))}
                value={p.allergies}
                onChange={(v) => set("allergies", v)}
              />
            </Field>
            <Field
              label="Restrições alimentares"
              hint="Só aparecem pratos que atendem a todas as restrições marcadas."
              group
            >
              <Chips
                options={RESTRICTION_TAGS}
                value={p.restrictions}
                onChange={(v) => set("restrictions", v)}
              />
            </Field>
            <Field label="Preferências" group>
              <Chips
                options={PREFERENCE_TAGS}
                value={p.preferences}
                onChange={(v) => set("preferences", v)}
              />
            </Field>
            <Field label="Ingredientes que prefiro evitar" group>
              <Chips
                options={q.data!.ingredients.map((i) => ({ value: i.id, label: i.name }))}
                value={p.avoid_ingredient_ids}
                onChange={(v) => set("avoid_ingredient_ids", v)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Refeições e dias de entrega" className="lg:col-span-2">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Quais refeições quero receber" group>
              <Chips
                options={MEAL_TYPES.map((m) => ({ value: m, label: MEAL_LABEL[m] ?? m }))}
                value={p.meal_types}
                onChange={(v) => set("meal_types", v)}
              />
            </Field>
            <Field label="Em quais dias" group>
              <Chips
                options={WEEKDAYS.map((d) => ({ value: d.value, label: d.short }))}
                value={p.delivery_weekdays}
                onChange={(v) => set("delivery_weekdays", v)}
              />
            </Field>
          </div>
        </Section>
      </div>
    </form>
  );
}
