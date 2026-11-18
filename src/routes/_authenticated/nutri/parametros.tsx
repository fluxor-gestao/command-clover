import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Forbidden, Loading, PageHeader } from "@/components/platform/ui";
import { db, errorText, list, unwrap } from "@/lib/platform/db";
import { ACTIVITY_LABEL, GOAL_LABEL } from "@/lib/platform/labels";
import { dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/nutri/parametros")({
  component: ParametrosPage,
});

type P = {
  goal: string;
  activity_level: string;
  kcal_per_kg: number;
  protein_g_per_kg: number;
  carbs_pct: number;
  fat_pct: number;
  updated_at: string;
};

function ParametrosPage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["nutri-params"],
    enabled: session.has("nutricionista"),
    queryFn: () => list<P>("nutrition_parameters", (x) => x.order("goal").order("activity_level")),
  });
  const save = useMutation({
    mutationFn: async ({ row, patch }: { row: P; patch: Partial<P> }) =>
      unwrap(
        await db
          .from("nutrition_parameters")
          .update({ ...patch, updated_by: session.userId, updated_at: new Date().toISOString() })
          .eq("goal", row.goal)
          .eq("activity_level", row.activity_level),
      ),
    onSuccess: () => {
      toast.success("Parâmetro atualizado. Vale para as próximas propostas.");
      qc.invalidateQueries({ queryKey: ["nutri-params"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  if (!session.has("nutricionista")) return <Forbidden />;
  if (q.isLoading || !q.data) return <Loading />;
  const cell = (row: P, key: keyof P, pct = false) => (
    <Input
      type="number"
      step="0.01"
      className="h-8 w-24"
      defaultValue={pct ? Math.round(Number(row[key]) * 100) : Number(row[key])}
      onBlur={(e) => {
        const v = Number(e.target.value) / (pct ? 100 : 1);
        if (v !== Number(row[key])) save.mutate({ row, patch: { [key]: v } });
      }}
    />
  );
  return (
    <>
      <PageHeader
        title="Parâmetros do plano"
        description="Base que o sistema usa para gerar a proposta de cada cliente (por objetivo e nível de atividade). Os valores iniciais são exemplos e precisam da sua revisão profissional."
      />
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Objetivo</TableHead>
              <TableHead>Atividade</TableHead>
              <TableHead>kcal por kg</TableHead>
              <TableHead>Proteína g/kg</TableHead>
              <TableHead>Carboidrato % kcal</TableHead>
              <TableHead>Gordura % kcal</TableHead>
              <TableHead>Atualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((r) => (
              <TableRow key={r.goal + r.activity_level}>
                <TableCell className="font-medium">{GOAL_LABEL[r.goal]}</TableCell>
                <TableCell>{ACTIVITY_LABEL[r.activity_level]}</TableCell>
                <TableCell>{cell(r, "kcal_per_kg")}</TableCell>
                <TableCell>{cell(r, "protein_g_per_kg")}</TableCell>
                <TableCell>{cell(r, "carbs_pct", true)}</TableCell>
                <TableCell>{cell(r, "fat_pct", true)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {dateTimeBR(r.updated_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
