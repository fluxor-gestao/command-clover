import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, Loading, PageHeader, StatusBadge } from "@/components/platform/ui";
import { errorText, list, rpc } from "@/lib/platform/db";
import { MOVEMENT_LABEL } from "@/lib/platform/labels";
import { brl, dateBR, dateTimeBR, qty } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/op/estoque")({ component: EstoquePage });

type Lot = {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  usage_unit: string;
  lot_code: string;
  supplier_name: string | null;
  quantity_received: number;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  unit_cost: number;
  received_at: string;
  expires_at: string | null;
  status: string;
  is_expired: boolean;
  expiring_soon: boolean;
  storage: string | null;
};
type Agg = {
  ingredient_id: string;
  name: string;
  usage_unit: string;
  physical: number;
  reserved: number;
  available: number;
  expired: number;
  expiring_soon: number;
  pending_purchase: number;
  reserved_on_purchase: number;
};

function EstoquePage() {
  const qc = useQueryClient();
  const [mv, setMv] = useState<{ lot: Lot; kind: string; quantity: string; reason: string } | null>(
    null,
  );
  const [showEmpty, setShowEmpty] = useState(false);
  const q = useQuery({
    queryKey: ["stock"],
    queryFn: async () => ({
      agg: await list<Agg>("v_stock_ingredients", (x) => x.order("name")),
      lots: await list<Lot>("v_stock_lots", (x) =>
        x.order("ingredient_name").order("expires_at", { nullsFirst: false }),
      ),
      moves: await list<{
        id: number;
        kind: string;
        quantity: number;
        reason: string | null;
        reference: string | null;
        created_at: string;
        created_by: string | null;
        ingredients: { name: string; usage_unit: string };
        ingredient_lots: { lot_code: string } | null;
      }>(
        "stock_movements",
        (x) => x.order("created_at", { ascending: false }).limit(200),
        "*,ingredients(name,usage_unit),ingredient_lots(lot_code)",
      ),
    }),
  });
  const register = useMutation({
    mutationFn: () =>
      rpc<{ warning: string | null }>("register_stock_movement", {
        p_lot_id: mv!.lot.id,
        p_kind: mv!.kind,
        p_quantity: Number(mv!.quantity),
        p_reason: mv!.reason,
      }),
    onSuccess: (r) => {
      if (r?.warning) toast.warning(r.warning);
      else toast.success("Movimento registrado");
      setMv(null);
      qc.invalidateQueries({ queryKey: ["stock"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const block = useMutation({
    mutationFn: (l: Lot) =>
      rpc("set_lot_blocked", {
        p_lot_id: l.id,
        p_blocked: l.status !== "bloqueado",
        p_reason: l.status !== "bloqueado" ? "Bloqueado manualmente" : "Liberado manualmente",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }),
    onError: (e) => toast.error(errorText(e)),
  });

  if (q.isLoading || !q.data) return <Loading />;
  const lots = q.data.lots.filter((l) => showEmpty || Number(l.quantity_on_hand) > 0);

  return (
    <>
      <PageHeader
        title="Estoque por lote"
        description="Saldo físico, reservado pelos pedidos e disponível. Lotes vencidos ficam bloqueados; os de vencimento mais próximo são usados primeiro."
      />
      <Tabs defaultValue="ingredientes">
        <TabsList>
          <TabsTrigger value="ingredientes">Por ingrediente</TabsTrigger>
          <TabsTrigger value="lotes">Lotes</TabsTrigger>
          <TabsTrigger value="movimentos">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="ingredientes" className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead className="text-right">Físico</TableHead>
                <TableHead className="text-right">Reservado</TableHead>
                <TableHead className="text-right">Disponível</TableHead>
                <TableHead className="text-right">Compra prevista</TableHead>
                <TableHead className="text-right">Reservado na compra</TableHead>
                <TableHead>Alertas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.agg.map((a) => (
                <TableRow key={a.ingredient_id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-right">{qty(a.physical, a.usage_unit)}</TableCell>
                  <TableCell className="text-right">{qty(a.reserved, a.usage_unit)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      Number(a.available) <= 0 && "text-destructive",
                    )}
                  >
                    {qty(a.available, a.usage_unit)}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(a.pending_purchase) ? qty(a.pending_purchase, a.usage_unit) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(a.reserved_on_purchase)
                      ? qty(a.reserved_on_purchase, a.usage_unit)
                      : "—"}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {Number(a.expired) > 0 && (
                      <Badge variant="destructive">{qty(a.expired, a.usage_unit)} vencido</Badge>
                    )}
                    {Number(a.expiring_soon) > 0 && (
                      <Badge className="bg-warning/20 text-warning-foreground">
                        {qty(a.expiring_soon, a.usage_unit)} vencendo
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="lotes">
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showEmpty}
              onChange={(e) => setShowEmpty(e.target.checked)}
            />{" "}
            Mostrar lotes zerados
          </label>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-right">Físico</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.ingredient_name}</TableCell>
                    <TableCell>{l.lot_code}</TableCell>
                    <TableCell className="text-xs">{l.supplier_name ?? "—"}</TableCell>
                    <TableCell>{dateBR(l.received_at)}</TableCell>
                    <TableCell
                      className={cn(
                        l.is_expired && "font-medium text-destructive",
                        l.expiring_soon && "text-warning-foreground dark:text-warning",
                      )}
                    >
                      {dateBR(l.expires_at)}
                      {l.is_expired ? " · vencido" : l.expiring_soon ? " · vence logo" : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {qty(l.quantity_on_hand, l.usage_unit)}
                    </TableCell>
                    <TableCell className="text-right">
                      {qty(l.quantity_reserved, l.usage_unit)}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.is_expired || l.status === "bloqueado"
                        ? "0"
                        : qty(l.quantity_available, l.usage_unit)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {brl(
                        Number(l.unit_cost) *
                          (l.usage_unit === "g" || l.usage_unit === "ml" ? 1000 : 1),
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={l.is_expired ? "bloqueado" : l.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setMv({ lot: l, kind: "perda", quantity: "", reason: "" })}
                      >
                        Movimentar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => block.mutate(l)}>
                        {l.status === "bloqueado" ? "Liberar" : "Bloquear"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="movimentos" className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ingrediente</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Motivo / referência</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.moves.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">{dateTimeBR(m.created_at)}</TableCell>
                  <TableCell>{MOVEMENT_LABEL[m.kind] ?? m.kind}</TableCell>
                  <TableCell>{m.ingredients.name}</TableCell>
                  <TableCell>{m.ingredient_lots?.lot_code ?? "—"}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      Number(m.quantity) < 0 && "text-destructive",
                    )}
                  >
                    {qty(m.quantity, m.ingredients.usage_unit)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {[m.reason, m.reference].filter(Boolean).join(" · ")}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {m.created_by?.slice(0, 8) ?? "sistema"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      <Dialog open={!!mv} onOpenChange={(o) => !o && setMv(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentar lote {mv?.lot.lot_code}</DialogTitle>
          </DialogHeader>
          {mv && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                register.mutate();
              }}
            >
              <p className="text-sm text-muted-foreground">
                {mv.lot.ingredient_name} · saldo físico{" "}
                {qty(mv.lot.quantity_on_hand, mv.lot.usage_unit)} · reservado{" "}
                {qty(mv.lot.quantity_reserved, mv.lot.usage_unit)}
              </p>
              <Field label="Tipo">
                <Select value={mv.kind} onValueChange={(v) => setMv({ ...mv, kind: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["perda", "devolucao", "baixa", "ajuste"].map((k) => (
                      <SelectItem key={k} value={k}>
                        {MOVEMENT_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label={`Quantidade (${mv.lot.usage_unit})`}
                hint={
                  mv.kind === "ajuste"
                    ? "Use valor negativo para reduzir e positivo para aumentar o saldo contado."
                    : "Quantidade que sai do estoque."
                }
              >
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={mv.quantity}
                  onChange={(e) => setMv({ ...mv, quantity: e.target.value })}
                />
              </Field>
              <Field label="Motivo">
                <Input
                  required
                  value={mv.reason}
                  onChange={(e) => setMv({ ...mv, reason: e.target.value })}
                  placeholder="Ex.: embalagem violada no recebimento"
                />
              </Field>
              <DialogFooter>
                <Button disabled={register.isPending}>Registrar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
