import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Empty, Field, Loading, PageHeader } from "@/components/platform/ui";
import { list } from "@/lib/platform/db";
import { APP_NAME } from "@/lib/platform/labels";
import { dateBR, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/op/etiquetas")({
  validateSearch: (s: Record<string, unknown>): { lote?: string } =>
    typeof s["lote"] === "string" ? { lote: s["lote"] } : {},
  component: EtiquetasPage,
});

type Label = {
  batch_id: string;
  lot_code: string;
  production_date: string;
  expires_at: string;
  storage_instructions: string;
  portions_planned: number;
  portions_produced: number | null;
  dish_name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion_weight_g: number;
  allergens: string[];
  may_contain: string[];
  delivery_date: string;
};

function EtiquetasPage() {
  const { lote } = Route.useSearch();
  const [batchId, setBatchId] = useState<string | undefined>(lote);
  const [copies, setCopies] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["labels"],
    queryFn: () =>
      list<Label>("v_batch_labels", (x) =>
        x.order("production_date", { ascending: false }).limit(60),
      ),
  });
  if (q.isLoading) return <Loading />;
  const b = q.data?.find((x) => x.batch_id === batchId);
  const n = copies ?? b?.portions_produced ?? b?.portions_planned ?? 0;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Etiquetas"
          description="Identificação do prato, lote, data de preparo, validade e instruções de conservação."
        />
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <Field label="Lote de produção">
            <Select
              value={batchId ?? ""}
              onValueChange={(v) => {
                setBatchId(v);
                setCopies(null);
              }}
            >
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(q.data ?? []).map((l) => (
                  <SelectItem key={l.batch_id} value={l.batch_id}>
                    {l.lot_code} · {l.dish_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cópias">
            <Input
              type="number"
              className="w-24"
              value={n}
              onChange={(e) => setCopies(Number(e.target.value))}
            />
          </Field>
          <Button disabled={!b} onClick={() => window.print()}>
            <Printer className="mr-2 size-4" /> Imprimir
          </Button>
        </div>
      </div>
      {!b ? (
        <Empty title="Escolha um lote para gerar as etiquetas" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 print:grid-cols-3 print:gap-2">
          {Array.from({ length: Math.min(n, 300) }, (_, i) => (
            <div
              key={i}
              className="break-inside-avoid rounded-md border border-foreground/40 p-3 text-[11px] leading-tight print:rounded-none"
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {APP_NAME}
              </p>
              <p className="mt-0.5 text-sm font-bold leading-snug">{b.dish_name}</p>
              <p className="mt-1">
                Lote <b className="font-mono">{b.lot_code}</b>
              </p>
              <p>
                Preparo {dateBR(b.production_date)} · <b>Validade {dateBR(b.expires_at)}</b>
              </p>
              <p className="mt-1">
                {num(b.portion_weight_g)} g · {num(b.kcal)} kcal · P {num(b.protein_g, 1)} g · C{" "}
                {num(b.carbs_g, 1)} g · G {num(b.fat_g, 1)} g
              </p>
              {(b.allergens.length > 0 || b.may_contain.length > 0) && (
                <p className="mt-1 font-semibold">
                  {b.allergens.length > 0 &&
                    `ALÉRGICOS: CONTÉM ${b.allergens.join(", ").toUpperCase()}. `}
                  {b.may_contain.length > 0 &&
                    `PODE CONTER ${b.may_contain.join(", ").toUpperCase()}.`}
                </p>
              )}
              <p className="mt-1">{b.storage_instructions}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
