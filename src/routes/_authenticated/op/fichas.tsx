import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Chips,
  Field,
  Forbidden,
  Loading,
  PageHeader,
  StatusBadge,
} from "@/components/platform/ui";
import { db, errorText, list, rpc, unwrap } from "@/lib/platform/db";
import { MEAL_LABEL, MEAL_TYPES, PREFERENCE_TAGS } from "@/lib/platform/labels";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/op/fichas")({ component: FichasPage });

type Facts = {
  dish_id: string;
  code: string | null;
  name: string;
  meal_type: string;
  status: string;
  version: number;
  portions: number;
  final_yield_g: number;
  portion_weight_g: number;
  cost_per_portion: number;
  ingredient_cost_per_portion: number;
  packaging_cost_per_portion: number;
  labor_cost_per_portion: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  allergens: string[];
  may_contain: string[];
  allergen_info_incomplete: boolean;
};
type Dish = {
  id?: string;
  code: string | null;
  name: string;
  description: string | null;
  meal_type: string;
  tags: string[];
  status: string;
  final_yield_g: number;
  portions: number;
  packaging_desc: string | null;
  packaging_cost: number;
  labor_minutes: number;
  shelf_life_days: number;
  storage_instructions: string;
  cross_contact_risk: string[];
  change_note: string | null;
  version?: number;
};
type Item = { id?: string; ingredient_id: string; quantity: number; prep_loss_pct: number | null };

const EMPTY: Dish = {
  code: null,
  name: "",
  description: null,
  meal_type: "almoco",
  tags: [],
  status: "rascunho",
  final_yield_g: 0,
  portions: 10,
  packaging_desc: "Pote 500 ml",
  packaging_cost: 1,
  labor_minutes: 60,
  shelf_life_days: 5,
  storage_instructions: "Manter refrigerado entre 0 °C e 5 °C. Aquecer antes de consumir.",
  cross_contact_risk: [],
  change_note: null,
};

function FichasPage() {
  const { session } = Route.useRouteContext();
  const canEdit = session.has("operacao", "nutricionista");
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ dish: Dish; items: Item[] } | null>(null);
  const q = useQuery({
    queryKey: ["dishes"],
    queryFn: async () => ({
      facts: await list<Facts>("v_dish_facts", (x) => x.order("name")),
      ingredients: await list<{
        id: string;
        name: string;
        usage_unit: string;
        unit_cost: number;
        yield_pct: number;
      }>("ingredients", (x) => x.eq("active", true).order("name")),
      allergens: await list<{ code: string; name: string }>("allergens"),
    }),
  });

  const open = async (dishId?: string) => {
    if (!dishId) return setEdit({ dish: { ...EMPTY }, items: [] });
    const [dish] = await list<Dish>("dishes", (x) => x.eq("id", dishId));
    const items = await list<Item>("dish_items", (x) => x.eq("dish_id", dishId));
    if (dish) setEdit({ dish, items });
  };

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const { dish, items } = edit!;
      const { id, version: _v, ...fields } = dish;
      void _v;
      let dishId = id;
      if (dishId) unwrap(await db.from("dishes").update(fields).eq("id", dishId));
      else
        dishId = unwrap<{ id: string }>(
          await db.from("dishes").insert(fields).select("id").single(),
        ).id;
      const current = await list<Item>("dish_items", (x) => x.eq("dish_id", dishId));
      const keep = new Set(items.map((i) => i.ingredient_id));
      const removed = current.filter((c) => !keep.has(c.ingredient_id));
      if (removed.length)
        unwrap(
          await db
            .from("dish_items")
            .delete()
            .in(
              "id",
              removed.map((r) => r.id),
            ),
        );
      for (const it of items) {
        const before = current.find((c) => c.ingredient_id === it.ingredient_id);
        if (
          before &&
          Number(before.quantity) === Number(it.quantity) &&
          before.prep_loss_pct === it.prep_loss_pct
        )
          continue;
        unwrap(
          await db.from("dish_items").upsert(
            {
              dish_id: dishId,
              ingredient_id: it.ingredient_id,
              quantity: it.quantity,
              prep_loss_pct: it.prep_loss_pct,
            },
            { onConflict: "dish_id,ingredient_id" },
          ),
        );
      }
      if (submit)
        unwrap(
          await db
            .from("dishes")
            .update({ status: "em_aprovacao" })
            .eq("id", dishId)
            .neq("status", "aprovado"),
        );
    },
    onSuccess: () => {
      toast.success("Ficha técnica salva. Alterações em fichas aprovadas voltam para aprovação.");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["dishes"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const approve = useMutation({
    mutationFn: (id: string) => rpc("approve_dish", { p_dish_id: id }),
    onSuccess: () => {
      toast.success("Ficha aprovada e disponível para o cardápio");
      qc.invalidateQueries({ queryKey: ["dishes"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (q.isLoading || !q.data) return <Loading />;
  const ingById = new Map(q.data.ingredients.map((i) => [i.id, i]));
  const aName = (c: string) => q.data.allergens.find((a) => a.code === c)?.name.split(" (")[0] ?? c;

  const preview = edit
    ? edit.items.reduce(
        (s, it) => s + Number(it.quantity) * Number(ingById.get(it.ingredient_id)?.unit_cost ?? 0),
        0,
      ) / Math.max(1, edit.dish.portions)
    : 0;

  return (
    <>
      <PageHeader
        title="Fichas técnicas"
        description="Ingredientes com peso bruto, perdas, rendimento, porções e embalagem. Custo e nutrição por porção são recalculados a cada alteração."
        actions={
          canEdit && (
            <Button onClick={() => open()}>
              <Plus className="mr-2 size-4" /> Nova ficha
            </Button>
          )
        }
      />
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prato</TableHead>
              <TableHead>Refeição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Porção</TableHead>
              <TableHead className="text-right">Custo/porção</TableHead>
              <TableHead className="text-right">kcal · P · C · G</TableHead>
              <TableHead>Alergênicos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.facts.map((f) => (
              <TableRow key={f.dish_id}>
                <TableCell>
                  <button
                    className="text-left font-medium hover:underline"
                    onClick={() => open(f.dish_id)}
                  >
                    {f.name}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {f.code} · v{f.version} · {f.portions} porções
                  </p>
                </TableCell>
                <TableCell>{MEAL_LABEL[f.meal_type]}</TableCell>
                <TableCell>
                  <StatusBadge status={f.status} />
                </TableCell>
                <TableCell className="text-right">{num(f.portion_weight_g)} g</TableCell>
                <TableCell
                  className="text-right tabular-nums"
                  title={`Insumos ${brl(f.ingredient_cost_per_portion)} · Embalagem ${brl(f.packaging_cost_per_portion)} · Mão de obra ${brl(f.labor_cost_per_portion)}`}
                >
                  {brl(f.cost_per_portion)}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {num(f.kcal)} · {num(f.protein_g)} · {num(f.carbs_g)} · {num(f.fat_g)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {f.allergen_info_incomplete && (
                      <Badge className="bg-warning/20 text-warning-foreground">
                        info incompleta
                      </Badge>
                    )}
                    {f.allergens.map((a) => (
                      <Badge key={a} variant="destructive">
                        {aName(a)}
                      </Badge>
                    ))}
                    {f.may_contain.map((a) => (
                      <Badge key={a} variant="outline">
                        ~{aName(a)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {f.status === "em_aprovacao" && session.has("nutricionista", "operacao") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => approve.mutate(f.dish_id)}
                      disabled={approve.isPending}
                    >
                      <CheckCircle2 className="mr-1 size-4" /> Aprovar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {edit?.dish.id ? `Ficha técnica · ${edit.dish.name}` : "Nova ficha técnica"}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(false);
              }}
            >
              {!canEdit && <Forbidden />}
              {edit.dish.status === "aprovado" && (
                <p className="rounded-lg bg-warning/15 p-3 text-sm">
                  Esta ficha está aprovada. Salvar mudanças em ingredientes, rendimento, porções,
                  embalagem ou mão de obra a envia de volta para aprovação e a retira do cardápio
                  até lá.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Nome do prato" className="sm:col-span-3">
                  <Input
                    required
                    value={edit.dish.name}
                    onChange={(e) =>
                      setEdit({ ...edit, dish: { ...edit.dish, name: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Código">
                  <Input
                    value={edit.dish.code ?? ""}
                    onChange={(e) =>
                      setEdit({ ...edit, dish: { ...edit.dish, code: e.target.value || null } })
                    }
                  />
                </Field>
                <Field label="Refeição">
                  <Select
                    value={edit.dish.meal_type}
                    onValueChange={(v) =>
                      setEdit({ ...edit, dish: { ...edit.dish, meal_type: v } })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEAL_TYPES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {MEAL_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {(
                  [
                    ["final_yield_g", "Rendimento final (g)"],
                    ["portions", "Nº de porções"],
                    ["shelf_life_days", "Validade (dias)"],
                    ["packaging_cost", "Embalagem R$/porção"],
                    ["labor_minutes", "Mão de obra (min/receita)"],
                  ] as const
                ).map(([k, l]) => (
                  <Field key={k} label={l}>
                    <Input
                      type="number"
                      step="0.01"
                      value={String(edit.dish[k])}
                      onChange={(e) =>
                        setEdit({ ...edit, dish: { ...edit.dish, [k]: Number(e.target.value) } })
                      }
                    />
                  </Field>
                ))}
                <Field label="Embalagem" className="sm:col-span-2">
                  <Input
                    value={edit.dish.packaging_desc ?? ""}
                    onChange={(e) =>
                      setEdit({ ...edit, dish: { ...edit.dish, packaging_desc: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Conservação (vai na etiqueta)" className="sm:col-span-2">
                  <Input
                    value={edit.dish.storage_instructions}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        dish: { ...edit.dish, storage_instructions: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Descrição" className="sm:col-span-4">
                  <Textarea
                    rows={2}
                    value={edit.dish.description ?? ""}
                    onChange={(e) =>
                      setEdit({ ...edit, dish: { ...edit.dish, description: e.target.value } })
                    }
                  />
                </Field>
              </div>
              <Field label="Atende às restrições / etiquetas" group>
                <Chips
                  options={PREFERENCE_TAGS}
                  value={edit.dish.tags}
                  onChange={(v) => setEdit({ ...edit, dish: { ...edit.dish, tags: v } })}
                />
              </Field>
              <Field label="Risco de contato cruzado no preparo" group>
                <Chips
                  options={q.data.allergens.map((a) => ({ value: a.code, label: aName(a.code) }))}
                  value={edit.dish.cross_contact_risk}
                  onChange={(v) =>
                    setEdit({ ...edit, dish: { ...edit.dish, cross_contact_risk: v } })
                  }
                />
              </Field>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Ingredientes (receita inteira, peso bruto)</p>
                  <Select
                    onValueChange={(v) =>
                      !edit.items.some((i) => i.ingredient_id === v) &&
                      setEdit({
                        ...edit,
                        items: [
                          ...edit.items,
                          { ingredient_id: v, quantity: 100, prep_loss_pct: null },
                        ],
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-56">
                      <SelectValue placeholder="Adicionar ingrediente…" />
                    </SelectTrigger>
                    <SelectContent>
                      {q.data.ingredients.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente</TableHead>
                      <TableHead className="w-36">Quantidade</TableHead>
                      <TableHead className="w-36">Perda no preparo</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {edit.items.map((it, idx) => {
                      const ing = ingById.get(it.ingredient_id);
                      return (
                        <TableRow key={it.ingredient_id}>
                          <TableCell>{ing?.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="0.01"
                                value={String(it.quantity)}
                                className="h-8"
                                onChange={(e) =>
                                  setEdit({
                                    ...edit,
                                    items: edit.items.map((x, i) =>
                                      i === idx ? { ...x, quantity: Number(e.target.value) } : x,
                                    ),
                                  })
                                }
                              />
                              <span className="text-xs text-muted-foreground">
                                {ing?.usage_unit}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              max={0.95}
                              className="h-8"
                              placeholder={`padrão ${num((1 - Number(ing?.yield_pct ?? 1)) * 100)}%`}
                              value={it.prep_loss_pct ?? ""}
                              onChange={(e) =>
                                setEdit({
                                  ...edit,
                                  items: edit.items.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          prep_loss_pct:
                                            e.target.value === "" ? null : Number(e.target.value),
                                        }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {brl(Number(it.quantity) * Number(ing?.unit_cost ?? 0))}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setEdit({ ...edit, items: edit.items.filter((_, i) => i !== idx) })
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <p className="mt-2 text-right text-sm text-muted-foreground">
                  Insumos por porção (prévia): <b>{brl(preview)}</b> · peso por porção{" "}
                  {num(edit.dish.final_yield_g / Math.max(1, edit.dish.portions))} g
                </p>
              </div>
              <DialogFooter className="gap-2">
                {canEdit &&
                  edit.dish.status !== "aprovado" &&
                  edit.dish.status !== "em_aprovacao" && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={save.isPending || !edit.items.length}
                      onClick={() => save.mutate(true)}
                    >
                      Salvar e enviar para aprovação
                    </Button>
                  )}
                {canEdit && (
                  <Button disabled={save.isPending}>
                    {save.isPending ? "Salvando…" : "Salvar"}
                  </Button>
                )}
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
