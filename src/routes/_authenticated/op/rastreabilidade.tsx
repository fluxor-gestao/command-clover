import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, Loading, PageHeader, StatusBadge } from "@/components/platform/ui";
import { list } from "@/lib/platform/db";
import { dateBR, qty } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/op/rastreabilidade")({
  component: RastreioPage,
});

type Trace = {
  order_id: string;
  order_code: string;
  order_status: string;
  dish_name: string;
  delivery_date: string;
  batch_lot_code: string;
  production_date: string;
  batch_expires_at: string;
  ingredient_lot_code: string | null;
  ingredient_name: string | null;
  ingredient_lot_expires_at: string | null;
  supplier_name: string | null;
  batch_lot_quantity: number | null;
};

const MODES = {
  pedido: { label: "Pedido → ingredientes", column: "order_code", placeholder: "PED-1A2B3C4D" },
  lote_insumo: {
    label: "Lote de insumo → pedidos",
    column: "ingredient_lot_code",
    placeholder: "Código do lote do fornecedor",
  },
  lote_producao: {
    label: "Lote de refeição → pedidos",
    column: "batch_lot_code",
    placeholder: "P261124-DEMO2",
  },
} as const;

function RastreioPage() {
  const [mode, setMode] = useState<keyof typeof MODES>("pedido");
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState<{ mode: keyof typeof MODES; term: string } | null>(
    null,
  );
  const q = useQuery({
    queryKey: ["trace", submitted],
    enabled: !!submitted?.term,
    queryFn: () =>
      list<Trace>("v_trace", (x) =>
        x.ilike(MODES[submitted!.mode].column, `%${submitted!.term.trim()}%`).limit(500),
      ),
  });
  const accounts = useQuery({
    queryKey: ["trace-accounts", q.data?.length],
    enabled: !!q.data?.length && submitted?.mode !== "pedido",
    queryFn: async () => {
      const ids = await list<{ id: string; customer_id: string }>(
        "orders",
        (x) => x.in("id", [...new Set(q.data!.map((t) => t.order_id))]),
        "id,customer_id",
      );
      const acc = await list<{
        customer_id: string;
        full_name: string | null;
        phone: string | null;
      }>("customer_accounts", (x) =>
        x.in(
          "customer_id",
          ids.map((i) => i.customer_id),
        ),
      );
      return new Map(ids.map((i) => [i.id, acc.find((a) => a.customer_id === i.customer_id)]));
    },
  });

  const rows = q.data ?? [];
  return (
    <>
      <PageHeader
        title="Rastreabilidade"
        description="Quais lotes de ingredientes foram usados em uma refeição, e quais pedidos receberam um determinado lote."
      />
      <Tabs value={mode} onValueChange={(v) => setMode(v as keyof typeof MODES)}>
        <TabsList>
          {Object.entries(MODES).map(([k, m]) => (
            <TabsTrigger key={k} value={k}>
              {m.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <form
        className="my-4 flex max-w-lg gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted({ mode, term });
        }}
      >
        <Input
          placeholder={MODES[mode].placeholder}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <Button>
          <Search className="mr-2 size-4" /> Rastrear
        </Button>
      </form>
      {q.isLoading ? (
        <Loading />
      ) : !submitted ? null : rows.length === 0 ? (
        <Empty title="Nada encontrado">
          O pedido precisa ter entrado em produção para ter lotes vinculados.
        </Empty>
      ) : submitted.mode === "pedido" ? (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Prato</TableHead>
                <TableHead>Lote da refeição</TableHead>
                <TableHead>Ingrediente</TableHead>
                <TableHead>Lote do insumo</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Validade insumo</TableHead>
                <TableHead className="text-right">Qtd no lote</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.order_code}</TableCell>
                  <TableCell>
                    {r.dish_name}
                    <p className="text-xs text-muted-foreground">
                      entrega {dateBR(r.delivery_date)}
                    </p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.batch_lot_code}
                    <p className="text-muted-foreground">val. {dateBR(r.batch_expires_at)}</p>
                  </TableCell>
                  <TableCell>{r.ingredient_name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ingredient_lot_code}</TableCell>
                  <TableCell className="text-xs">{r.supplier_name}</TableCell>
                  <TableCell>{dateBR(r.ingredient_lot_expires_at)}</TableCell>
                  <TableCell className="text-right">
                    {r.batch_lot_quantity ? qty(r.batch_lot_quantity) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Prato</TableHead>
                <TableHead>Lote da refeição</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ...new Map(rows.map((r) => [`${r.order_code}-${r.batch_lot_code}`, r])).values(),
              ].map((r) => {
                const acc = accounts.data?.get(r.order_id);
                return (
                  <TableRow key={`${r.order_code}-${r.batch_lot_code}`}>
                    <TableCell className="font-medium">{r.order_code}</TableCell>
                    <TableCell>
                      {acc?.full_name ?? "—"}
                      <p className="text-xs text-muted-foreground">{acc?.phone}</p>
                    </TableCell>
                    <TableCell>{r.dish_name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.batch_lot_code}</TableCell>
                    <TableCell>{dateBR(r.delivery_date)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.order_status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
