import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  Empty,
  Field,
  Forbidden,
  Loading,
  PageHeader,
  Section,
  StatusBadge,
} from "@/components/platform/ui";
import { db, errorText, list, rpc, unwrap } from "@/lib/platform/db";
import { parseNfe, type NfeLot } from "@/lib/platform/nfe";
import { brl, dateBR, num, qty } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/op/recebimento")({
  component: RecebimentoPage,
});

type Ing = {
  id: string;
  name: string;
  purchase_unit: string;
  usage_unit: string;
  conversion_factor: number;
  default_supplier_id: string | null;
};
type Import = {
  id: string;
  number: string;
  supplier_name: string;
  issued_at: string;
  total_amount: number;
  status: string;
  due_date: string | null;
};
type NItem = {
  id: string;
  item_number: number;
  supplier_code: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
  ingredient_id: string | null;
  conversion_factor: number | null;
  lots: NfeLot[];
  status: string;
  divergence_note: string | null;
};

function RecebimentoPage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const [openImport, setOpenImport] = useState<string | null>(null);
  const base = useQuery({
    queryKey: ["receiving"],
    queryFn: async () => ({
      imports: await list<Import>("nfe_imports", (x) =>
        x.order("created_at", { ascending: false }).limit(50),
      ),
      ingredients: await list<Ing>("ingredients", (x) => x.eq("active", true).order("name")),
      suppliers: await list<{ id: string; name: string }>("suppliers", (x) => x.order("name")),
      pos: await list<{
        id: string;
        expected_date: string;
        status: string;
        notes: string | null;
        suppliers: { name: string } | null;
        purchase_order_items: {
          id: string;
          quantity: number;
          quantity_received: number;
          ingredients: { name: string; usage_unit: string };
        }[];
      }>(
        "purchase_orders",
        (x) => x.order("expected_date", { ascending: false }).limit(50),
        "*,suppliers(name),purchase_order_items(id,quantity,quantity_received,ingredients(name,usage_unit))",
      ),
    }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const xml = await file.text();
      const { header, items } = parseNfe(xml);
      return rpc<string>("import_nfe", { p_header: header, p_items: items, p_raw_xml: xml });
    },
    onSuccess: (id) => {
      toast.success("NF-e importada. Confira os itens recebidos.");
      setOpenImport(id);
      qc.invalidateQueries({ queryKey: ["receiving"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (!session.has("operacao")) return <Forbidden />;
  if (base.isLoading || !base.data) return <Loading />;

  return (
    <>
      <PageHeader
        title="Compras e recebimento"
        description="Importe o XML da NF-e, confira o produto físico, registre um ou mais lotes por item e complete validade quando faltar. O estoque disponível só muda após a conferência."
        actions={
          <label className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <FileUp className="mr-2 size-4" />{" "}
            {upload.isPending ? "Importando…" : "Importar XML da NF-e"}
            <input
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = "";
              }}
            />
          </label>
        }
      />
      <Tabs defaultValue="notas">
        <TabsList>
          <TabsTrigger value="notas">Notas fiscais</TabsTrigger>
          <TabsTrigger value="manual">Entrada manual</TabsTrigger>
          <TabsTrigger value="previstas">Compras previstas</TabsTrigger>
        </TabsList>

        <TabsContent value="notas" className="space-y-4">
          {openImport && (
            <Conference
              importId={openImport}
              ingredients={base.data.ingredients}
              onClose={() => setOpenImport(null)}
            />
          )}
          {base.data.imports.length === 0 ? (
            <Empty title="Nenhuma NF-e importada" />
          ) : (
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NF-e</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {base.data.imports.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.number}</TableCell>
                      <TableCell>{i.supplier_name}</TableCell>
                      <TableCell>{dateBR(i.issued_at)}</TableCell>
                      <TableCell>{dateBR(i.due_date)}</TableCell>
                      <TableCell className="text-right">{brl(i.total_amount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={i.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setOpenImport(i.id)}>
                          {i.status === "em_conferencia" ? "Conferir" : "Ver"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual">
          <ManualLot ingredients={base.data.ingredients} suppliers={base.data.suppliers} />
        </TabsContent>

        <TabsContent value="previstas" className="space-y-4">
          <NewPurchase ingredients={base.data.ingredients} suppliers={base.data.suppliers} />
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Previsão</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Itens (recebido / previsto)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {base.data.pos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{dateBR(p.expected_date)}</TableCell>
                    <TableCell>{p.suppliers?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {p.purchase_order_items.map((i) => (
                        <div key={i.id}>
                          {i.ingredients.name}: {qty(i.quantity_received, i.ingredients.usage_unit)}{" "}
                          / {qty(i.quantity, i.ingredients.usage_unit)}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Conference({
  importId,
  ingredients,
  onClose,
}: {
  importId: string;
  ingredients: Ing[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["nfe-items", importId],
    queryFn: async () => ({
      header: (await list<Import>("nfe_imports", (x) => x.eq("id", importId)))[0],
      items: await list<NItem>("nfe_items", (x) =>
        x.eq("import_id", importId).order("item_number"),
      ),
    }),
  });
  if (!q.data?.header) return <Loading />;
  return (
    <Section
      title={`Conferência · NF-e ${q.data.header.number} · ${q.data.header.supplier_name}`}
      actions={
        <Button size="sm" variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-4">
        {q.data.items.map((it) => (
          <ItemConference
            key={it.id}
            item={it}
            ingredients={ingredients}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["nfe-items", importId] });
              qc.invalidateQueries({ queryKey: ["receiving"] });
            }}
          />
        ))}
      </div>
    </Section>
  );
}

function ItemConference({
  item,
  ingredients,
  onDone,
}: {
  item: NItem;
  ingredients: Ing[];
  onDone: () => void;
}) {
  const guess =
    item.ingredient_id ??
    ingredients.find((i) =>
      item.description.toLowerCase().includes(i.name.toLowerCase().split(" ")[0] ?? "~"),
    )?.id ??
    "";
  const [ingId, setIngId] = useState(guess);
  const ing = ingredients.find((i) => i.id === ingId);
  const [factor, setFactor] = useState<string>(
    String(item.conversion_factor ?? ing?.conversion_factor ?? ""),
  );
  const [lots, setLots] = useState<NfeLot[]>(
    item.lots.length
      ? item.lots
      : [
          {
            lot_code: "",
            quantity: Number(item.quantity),
            manufactured_at: null,
            expires_at: null,
          },
        ],
  );
  const [note, setNote] = useState("");
  const done = item.status !== "pendente";

  const confirm = useMutation({
    mutationFn: () =>
      rpc("confirm_nfe_item", {
        p_item_id: item.id,
        p_ingredient_id: ingId,
        p_conversion_factor: Number(factor),
        p_lots: lots,
        p_divergence_note: note || null,
      }),
    onSuccess: () => {
      toast.success("Item conferido e lotes disponíveis");
      onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const ignore = useMutation({
    mutationFn: () =>
      rpc("ignore_nfe_item", { p_item_id: item.id, p_note: note || "Não é insumo de produção" }),
    onSuccess: onDone,
    onError: (e) => toast.error(errorText(e)),
  });
  const totalLots = lots.reduce((s, l) => s + Number(l.quantity || 0), 0);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {item.item_number}. {item.description}
          </p>
          <p className="text-xs text-muted-foreground">
            Cód. {item.supplier_code} · {num(item.quantity, 3)} {item.unit} × {brl(item.unit_price)}{" "}
            = {brl(item.total)}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      {done ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {item.lots
            .map(
              (l) =>
                `${l.lot_code} (${num(l.quantity, 3)} ${item.unit}, val. ${dateBR(l.expires_at)})`,
            )
            .join(" · ")}
          {item.divergence_note && (
            <span className="block text-warning-foreground">{item.divergence_note}</span>
          )}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Ingrediente cadastrado">
              <Select
                value={ingId}
                onValueChange={(v) => {
                  setIngId(v);
                  const i = ingredients.find((x) => x.id === v);
                  if (i && !item.conversion_factor) setFactor(String(i.conversion_factor));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular a…" />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label={`1 ${item.unit || "un"} da nota = ? ${ing?.usage_unit ?? ""}`}
              hint="Fica salvo para as próximas notas deste fornecedor."
            >
              <Input
                type="number"
                step="0.0001"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
              />
            </Field>
            <Field label="Divergência (opcional)">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: 1 caixa avariada"
              />
            </Field>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">
              Lotes recebidos{" "}
              <span className="font-normal text-muted-foreground">
                ({num(totalLots, 3)} de {num(item.quantity, 3)} {item.unit})
              </span>
            </p>
            {lots.map((l, i) => (
              <div
                key={i}
                className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_0.8fr_1fr_1fr_auto]"
              >
                <Input
                  placeholder="Lote"
                  value={l.lot_code}
                  onChange={(e) =>
                    setLots(lots.map((x, j) => (j === i ? { ...x, lot_code: e.target.value } : x)))
                  }
                />
                <Input
                  type="number"
                  step="0.001"
                  placeholder="Qtd"
                  value={String(l.quantity)}
                  onChange={(e) =>
                    setLots(
                      lots.map((x, j) =>
                        j === i ? { ...x, quantity: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <Input
                  type="date"
                  title="Fabricação"
                  value={l.manufactured_at ?? ""}
                  onChange={(e) =>
                    setLots(
                      lots.map((x, j) =>
                        j === i ? { ...x, manufactured_at: e.target.value || null } : x,
                      ),
                    )
                  }
                />
                <Input
                  type="date"
                  title="Validade"
                  required
                  value={l.expires_at ?? ""}
                  className={!l.expires_at ? "border-warning" : ""}
                  onChange={(e) =>
                    setLots(
                      lots.map((x, j) =>
                        j === i ? { ...x, expires_at: e.target.value || null } : x,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setLots(lots.filter((_, j) => j !== i))}
                  disabled={lots.length === 1}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setLots([
                  ...lots,
                  { lot_code: "", quantity: 0, manufactured_at: null, expires_at: null },
                ])
              }
            >
              <Plus className="mr-1 size-4" /> Outro lote
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!ingId || confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              Confirmar recebimento
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={ignore.isPending}
              onClick={() => ignore.mutate()}
            >
              Não é insumo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManualLot({
  ingredients,
  suppliers,
}: {
  ingredients: Ing[];
  suppliers: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    ingredient_id: "",
    supplier_id: "",
    lot_code: "",
    quantity: "",
    total_cost: "",
    expires_at: "",
    manufactured_at: "",
  });
  const ing = ingredients.find((i) => i.id === f.ingredient_id);
  const m = useMutation({
    mutationFn: () =>
      rpc("receive_manual_lot", {
        p_ingredient_id: f.ingredient_id,
        p_supplier_id: f.supplier_id || null,
        p_lot_code: f.lot_code,
        p_quantity_purchase_unit: Number(f.quantity),
        p_total_cost: Number(f.total_cost),
        p_expires_at: f.expires_at,
        p_manufactured_at: f.manufactured_at || null,
      }),
    onSuccess: () => {
      toast.success("Lote registrado. Reservas pendentes desse insumo foram realocadas.");
      setF({ ...f, lot_code: "", quantity: "", total_cost: "" });
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  return (
    <Section title="Registrar lote sem NF-e">
      <form
        className="grid gap-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <Field label="Ingrediente" className="sm:col-span-2">
          <Select value={f.ingredient_id} onValueChange={(v) => setF({ ...f, ingredient_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {ingredients.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Fornecedor" className="sm:col-span-2">
          <Select value={f.supplier_id} onValueChange={(v) => setF({ ...f, supplier_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Opcional" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Código do lote">
          <Input
            required
            value={f.lot_code}
            onChange={(e) => setF({ ...f, lot_code: e.target.value })}
          />
        </Field>
        <Field label={`Quantidade (${ing?.purchase_unit ?? "un. compra"})`}>
          <Input
            required
            type="number"
            step="0.001"
            value={f.quantity}
            onChange={(e) => setF({ ...f, quantity: e.target.value })}
          />
        </Field>
        <Field label="Custo total (R$)">
          <Input
            required
            type="number"
            step="0.01"
            value={f.total_cost}
            onChange={(e) => setF({ ...f, total_cost: e.target.value })}
          />
        </Field>
        <Field label="Validade">
          <Input
            required
            type="date"
            value={f.expires_at}
            onChange={(e) => setF({ ...f, expires_at: e.target.value })}
          />
        </Field>
        <Field label="Fabricação">
          <Input
            type="date"
            value={f.manufactured_at}
            onChange={(e) => setF({ ...f, manufactured_at: e.target.value })}
          />
        </Field>
        <div className="flex items-end sm:col-span-3">
          <Button disabled={!f.ingredient_id || m.isPending}>Registrar entrada</Button>
        </div>
      </form>
    </Section>
  );
}

function NewPurchase({
  ingredients,
  suppliers,
}: {
  ingredients: Ing[];
  suppliers: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    supplier_id: "",
    expected_date: "",
    ingredient_id: "",
    quantity: "",
  });
  const ing = ingredients.find((i) => i.id === f.ingredient_id);
  const m = useMutation({
    mutationFn: async () => {
      const po = unwrap<{ id: string }>(
        await db
          .from("purchase_orders")
          .insert({ supplier_id: f.supplier_id || null, expected_date: f.expected_date })
          .select("id")
          .single(),
      );
      unwrap(
        await db.from("purchase_order_items").insert({
          purchase_order_id: po.id,
          ingredient_id: f.ingredient_id,
          quantity: Number(f.quantity) * Number(ing!.conversion_factor),
        }),
      );
    },
    onSuccess: () => {
      toast.success(
        "Compra prevista registrada. Ela já pode cobrir reservas de pedidos com produção após a chegada.",
      );
      setF({ ...f, ingredient_id: "", quantity: "" });
      qc.invalidateQueries({ queryKey: ["receiving"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  return (
    <Section title="Nova compra prevista">
      <form
        className="grid gap-4 sm:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <Field label="Fornecedor">
          <Select value={f.supplier_id} onValueChange={(v) => setF({ ...f, supplier_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Opcional" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Chegada prevista">
          <Input
            required
            type="date"
            value={f.expected_date}
            onChange={(e) => setF({ ...f, expected_date: e.target.value })}
          />
        </Field>
        <Field label="Ingrediente">
          <Select value={f.ingredient_id} onValueChange={(v) => setF({ ...f, ingredient_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {ingredients.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={`Quantidade (${ing?.purchase_unit ?? "un. compra"})`}>
          <Input
            required
            type="number"
            step="0.001"
            value={f.quantity}
            onChange={(e) => setF({ ...f, quantity: e.target.value })}
          />
        </Field>
        <div className="flex items-end">
          <Button disabled={!f.ingredient_id || m.isPending}>Registrar</Button>
        </div>
      </form>
    </Section>
  );
}
