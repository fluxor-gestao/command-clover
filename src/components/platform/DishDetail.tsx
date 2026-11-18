import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loading } from "@/components/platform/ui";
import { rpc } from "@/lib/platform/db";
import { num } from "@/lib/format";

export function DishDetail({ dishId, onClose }: { dishId: string | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["dish-public", dishId],
    enabled: !!dishId,
    queryFn: () =>
      rpc<{
        name: string;
        description: string | null;
        ingredients: string[];
        portion_weight_g: number;
        kcal: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        fiber_g: number;
        sodium_mg: number;
        allergens: string[];
        may_contain: string[];
        allergen_info_incomplete: boolean;
        storage_instructions: string;
        shelf_life_days: number;
      }>("dish_public_details", { p_dish_id: dishId }),
  });
  const d = q.data;
  return (
    <Dialog open={!!dishId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{d?.name ?? "Prato"}</DialogTitle>
          {d?.description && <DialogDescription>{d.description}</DialogDescription>}
        </DialogHeader>
        {!d ? (
          <Loading />
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 font-medium">Ingredientes</p>
              <p className="text-muted-foreground">{d.ingredients.join(", ")}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Porção", `${num(d.portion_weight_g)} g`],
                ["Energia", `${num(d.kcal)} kcal`],
                ["Proteínas", `${num(d.protein_g, 1)} g`],
                ["Carboidratos", `${num(d.carbs_g, 1)} g`],
                ["Gorduras", `${num(d.fat_g, 1)} g`],
                ["Sódio", `${num(d.sodium_mg)} mg`],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-muted p-2">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className="font-semibold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 font-medium">Alergênicos</p>
              <p className="text-muted-foreground">
                {d.allergens.length
                  ? `Contém: ${d.allergens.join(", ")}.`
                  : "Nenhum alergênico declarado."}{" "}
                {d.may_contain.length > 0 && `Pode conter: ${d.may_contain.join(", ")}.`}
                {d.allergen_info_incomplete &&
                  " Informação de alergênicos incompleta em algum ingrediente."}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {d.storage_instructions} Validade de {d.shelf_life_days} dias a partir do preparo.
              Valores nutricionais calculados pela ficha técnica.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
