import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, Loading, PageHeader, Section, Stat } from "@/components/platform/ui";
import { errorText, list, rpc } from "@/lib/platform/db";
import { MEAL_LABEL } from "@/lib/platform/labels";
import { dateBR, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cliente/plano")({ component: PlanoPage });

type Plan = {
  id: string;
  version: number;
  status: string;
  published_at: string | null;
  notes: string | null;
  targets: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  meal_distribution: { meal_type: string; pct: number; kcal: number; protein_g: number }[];
  substitutions: { de?: string; para?: string; note?: string }[];
  portion_adjustments: { dish?: string; factor?: number; note?: string }[];
};

function PlanoPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-plan"],
    queryFn: async () => ({
      status: await rpc<{ pending_review: boolean; published_version: number | null }>(
        "my_plan_status",
      ),
      plans: await list<Plan>("nutrition_plans", (x) => x.order("version", { ascending: false })),
    }),
  });
  const request = useMutation({
    mutationFn: () => rpc("request_nutrition_plan"),
    onSuccess: () => {
      toast.success("Pedido enviado ao nutricionista");
      qc.invalidateQueries({ queryKey: ["my-plan"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (q.isLoading || !q.data) return <Loading />;
  const published = q.data.plans.find((p) => p.status === "publicado");

  return (
    <>
      <PageHeader
        title="Plano alimentar individualizado"
        description="O sistema organiza seus dados e propõe metas a partir dos parâmetros do nutricionista. O plano só aparece aqui depois que o profissional revisa e aprova."
        actions={
          !q.data.status.pending_review && (
            <Button onClick={() => request.mutate()} disabled={request.isPending}>
              {published ? "Pedir nova revisão" : "Solicitar plano"}
            </Button>
          )
        }
      />

      {q.data.status.pending_review && (
        <Alert className="mb-6">
          <Clock className="size-4" />
          <AlertTitle>Em revisão pelo nutricionista</AlertTitle>
          <AlertDescription>
            Há uma nova versão do seu plano aguardando revisão. Mudanças relevantes no perfil (peso,
            objetivo, alergias, rotina de treino) geram uma nova revisão automaticamente.
          </AlertDescription>
        </Alert>
      )}

      {!published ? (
        <Empty title="Você ainda não tem plano publicado">
          Preencha peso, altura e objetivo no{" "}
          <Link to="/cliente/perfil" className="underline">
            perfil alimentar
          </Link>{" "}
          e solicite o plano.
        </Empty>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Versão {published.version} · publicada em {dateBR(published.published_at)}
          </p>
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Energia diária" value={`${num(published.targets.kcal)} kcal`} />
            <Stat label="Proteínas" value={`${num(published.targets.protein_g)} g`} />
            <Stat label="Carboidratos" value={`${num(published.targets.carbs_g)} g`} />
            <Stat label="Gorduras" value={`${num(published.targets.fat_g)} g`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Distribuição nas refeições do kit">
              <ul className="divide-y text-sm">
                {published.meal_distribution.map((m) => (
                  <li key={m.meal_type} className="flex justify-between py-2">
                    <span>{MEAL_LABEL[m.meal_type] ?? m.meal_type}</span>
                    <span className="tabular-nums">
                      {num(m.kcal)} kcal · {num(m.protein_g)} g proteína ({num(m.pct * 100)}% do
                      dia)
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Orientações do nutricionista">
              {published.notes && <p className="mb-3 text-sm">{published.notes}</p>}
              {published.substitutions.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {published.substitutions.map((s, i) => (
                    <li key={i}>
                      {s.de} → {s.para}
                      {s.note ? ` (${s.note})` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {published.portion_adjustments.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {published.portion_adjustments.map((s, i) => (
                    <li key={i}>
                      {s.dish}: porção × {s.factor}
                      {s.note ? ` — ${s.note}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {!published.notes &&
                !published.substitutions.length &&
                !published.portion_adjustments.length && (
                  <p className="text-sm text-muted-foreground">Sem orientações adicionais.</p>
                )}
            </Section>
          </div>
        </div>
      )}
    </>
  );
}
