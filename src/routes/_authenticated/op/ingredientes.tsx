import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Chips, Field, Forbidden, Loading, PageHeader } from "@/components/platform/ui";
import { db, errorText, list, unwrap } from "@/lib/platform/db";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/op/ingredientes")({
  component: IngredientesPage,
});

type Ingredient = {
  id: string;
  name: string;
  purchase_unit: string;
  usage_unit: string;
  conversion_factor: number;
  usage_unit_grams: number;
  default_supplier_id: string | null;
  unit_cost: number;
  yield_pct: number;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  sodium_mg_per_100g: number;
  allergens: string[];
  may_contain: string[];
  allergen_info_complete: boolean;
  storage: string;
  active: boolean;
};

const EMPTY: Omit<Ingredient, "id"> = {
  name: "",
  purchase_unit: "kg",
  usage_unit: "g",
  conversion_factor: 1000,
  usage_unit_grams: 1,
  default_supplier_id: null,
  unit_cost: 0,
  yield_pct: 1,
  kcal_per_100g: 0,
  protein_per_100g: 0,
  carbs_per_100g: 0,
  fat_per_100g: 0,
  fiber_per_100g: 0,
  sodium_mg_per_100g: 0,
  allergens: [],
  may_contain: [],
  allergen_info_complete: false,
  storage: "refrigerado",
  active: true,
};

function IngredientesPage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<(Omit<Ingredient, "id"> & { id?: string }) | null>(null);
  const [filter, setFilter] = useState("");
  const q = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => ({
      items: await list<Ingredient>("ingredients", (x) => x.order("name")),
      allergens: await list<{ code: string; name: string }>("allergens", (x) => x.order("name")),
      suppliers: await list<{ id: string; name: string }>("suppliers", (x) => x.order("name")),
    }),
  });
  const save = useMutation({
    mutationFn: async () => {
      const { id, ...v } = edit!;
      unwrap(
        id
          ? await db.from("ingredients").update(v).eq("id", id)
          : await db.from("ingredients").insert(v),
      );
    },
    onSuccess: () => {
      toast.success(
        "Ingrediente salvo. Fichas aprovadas que usam este item continuam com o custo e a nutrição atualizados.",
      );
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (!session.has("operacao", "nutricionista")) return <Forbidden />;
  if (q.isLoading || !q.data) return <Loading />;
  const allergenName = (c: string) =>
    q.data.allergens.find((a) => a.code === c)?.name.split(" (")[0] ?? c;
  const rows = q.data.items.filter((i) => i.name.toLowerCase().includes(filter.toLowerCase()));
  const set = <K extends keyof Ingredient>(k: K, v: Ingredient[K]) => setEdit({ ...edit!, [k]: v });
  const numField = (k: keyof Ingredient, label: string, step = "0.01") => (
    <Field label={label}>
      <Input
        type="number"
        step={step}
        value={String(edit![k] ?? "")}
        onChange={(e) => set(k, Number(e.target.value) as never)}
      />
    </Field>
  );

  return (
    <>
      <PageHeader
        title="Ingredientes"
        description="Unidades, conversão, custo, rendimento, nutrição e alergênicos. Sem a confirmação de alergênicos, o ingrediente bloqueia pratos para clientes alérgicos."
        actions={
          <Button onClick={() => setEdit({ ...EMPTY })}>
            <Plus className="mr-2 size-4" /> Novo ingrediente
          </Button>
        }
      />
      <Input
        placeholder="Buscar ingrediente…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 max-w-sm"
      />
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ingrediente</TableHead>
              <TableHead>Compra → uso</TableHead>
              <TableHead className="text-right">Custo / un. de uso</TableHead>
              <TableHead className="text-right">Rendimento</TableHead>
              <TableHead className="text-right">kcal/100 g</TableHead>
              <TableHead>Alergênicos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((i) => (
              <TableRow key={i.id} className="cursor-pointer" onClick={() => setEdit(i)}>
                <TableCell className="font-medium">
                  {i.name}
                  {!i.active && (
                    <Badge variant="outline" className="ml-2">
                      inativo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  1 {i.purchase_unit} = {num(i.conversion_factor)} {i.usage_unit}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {brl(i.unit_cost * (i.usage_unit === "g" || i.usage_unit === "ml" ? 1000 : 1))}
                  {i.usage_unit === "g" ? "/kg" : i.usage_unit === "ml" ? "/L" : `/${i.usage_unit}`}
                </TableCell>
                <TableCell className="text-right">{num(i.yield_pct * 100)}%</TableCell>
                <TableCell className="text-right">{num(i.kcal_per_100g)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {!i.allergen_info_complete && (
                      <Badge className="bg-warning/20 text-warning-foreground">
                        <AlertTriangle className="mr-1 size-3" />
                        não confirmado
                      </Badge>
                    )}
                    {i.allergens.map((a) => (
                      <Badge key={a} variant="destructive">
                        {allergenName(a)}
                      </Badge>
                    ))}
                    {i.may_contain.map((a) => (
                      <Badge key={a} variant="outline">
                        pode conter {allergenName(a)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Editar ingrediente" : "Novo ingrediente"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Nome" className="sm:col-span-2">
                  <Input required value={edit.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Armazenamento">
                  <Select value={edit.storage} onValueChange={(v) => set("storage", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ambiente">Ambiente</SelectItem>
                      <SelectItem value="refrigerado">Refrigerado</SelectItem>
                      <SelectItem value="congelado">Congelado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Unidade de compra">
                  <Input
                    value={edit.purchase_unit}
                    onChange={(e) => set("purchase_unit", e.target.value)}
                  />
                </Field>
                <Field label="Unidade de uso na cozinha">
                  <Input
                    value={edit.usage_unit}
                    onChange={(e) => set("usage_unit", e.target.value)}
                  />
                </Field>
                {numField(
                  "conversion_factor",
                  `Fator: 1 ${edit.purchase_unit} = ? ${edit.usage_unit}`,
                  "0.0001",
                )}
                {numField("unit_cost", `Custo por ${edit.usage_unit} (R$)`, "0.000001")}
                {numField("yield_pct", "Rendimento (0–1, após limpeza)", "0.01")}
                {numField("usage_unit_grams", `Gramas por ${edit.usage_unit}`, "0.001")}
                <Field label="Fornecedor padrão" className="sm:col-span-3">
                  <Select
                    value={edit.default_supplier_id ?? "none"}
                    onValueChange={(v) => set("default_supplier_id", v === "none" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {q.data.suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Informação nutricional por 100 g</p>
                <div className="grid gap-3 sm:grid-cols-6">
                  {numField("kcal_per_100g", "kcal")}
                  {numField("protein_per_100g", "Proteína g")}
                  {numField("carbs_per_100g", "Carboidrato g")}
                  {numField("fat_per_100g", "Gordura g")}
                  {numField("fiber_per_100g", "Fibra g")}
                  {numField("sodium_mg_per_100g", "Sódio mg")}
                </div>
              </div>
              <Field label="Contém" group>
                <Chips
                  options={q.data.allergens.map((a) => ({
                    value: a.code,
                    label: allergenName(a.code),
                  }))}
                  value={edit.allergens}
                  onChange={(v) => set("allergens", v)}
                />
              </Field>
              <Field label="Pode conter (contato cruzado no fornecedor)" group>
                <Chips
                  options={q.data.allergens.map((a) => ({
                    value: a.code,
                    label: allergenName(a.code),
                  }))}
                  value={edit.may_contain}
                  onChange={(v) => set("may_contain", v)}
                />
              </Field>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={edit.allergen_info_complete}
                    onCheckedChange={(v) => set("allergen_info_complete", v)}
                  />
                  Alergênicos conferidos com o rótulo / ficha do fornecedor
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={edit.active} onCheckedChange={(v) => set("active", v)} /> Ativo
                </label>
              </div>
              <DialogFooter>
                <Button disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
