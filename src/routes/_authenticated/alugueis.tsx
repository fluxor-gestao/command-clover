import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  useRegisterRentalReceipt,
  useRentalProperties,
  useRentalReceipts,
  useSaveRentalProperty,
  type RentalProperty,
} from "@/lib/data/hooks";
import { brl, dateBR, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/alugueis")({
  head: () => ({
    meta: [
      { title: "Aluguéis · Nova Era Investimentos" },
      {
        name: "description",
        content:
          "Gestão dos imóveis próprios: inquilino, valor do aluguel, vigência do contrato, próximo reajuste e recebimentos mensais.",
      },
      { property: "og:title", content: "Aluguéis · Nova Era Investimentos" },
      { property: "og:description", content: "Patrimônio de aluguéis separado da carteira de investimentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RentalsPage,
});

const STATUS_LABEL: Record<string, string> = {
  ATIVO: "Ativo",
  VAGO: "Vago",
  EM_REAJUSTE: "Em reajuste",
  ENCERRADO: "Encerrado",
};

const emptyForm = {
  id: undefined as string | undefined,
  name: "",
  tenant_name: "",
  due_day: "",
  current_rent: "",
  contract_start: "",
  contract_end: "",
  next_adjustment_date: "",
  status: "ATIVO",
  notes: "",
};

function RentalsPage() {
  const properties = useRentalProperties();
  const receipts = useRentalReceipts();
  const saveProperty = useSaveRentalProperty();
  const registerReceipt = useRegisterRentalReceipt();

  const [form, setForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState(false);
  const [receiptFor, setReceiptFor] = useState<RentalProperty | null>(null);
  const [receiptForm, setReceiptForm] = useState({ competence: todayISO().slice(0, 7), receipt_date: todayISO(), amount: "", notes: "" });

  const totals = useMemo(() => {
    const rows = properties.data ?? [];
    const active = rows.filter((row) => row.status !== "ENCERRADO");
    return {
      count: rows.length,
      active: active.length,
      monthly: active.reduce((sum, row) => sum + Number(row.current_rent ?? 0), 0),
      receivedYear: rows.reduce((sum, row) => sum + Number(row.received_year ?? 0), 0),
      receivableYear: rows.reduce((sum, row) => sum + Number(row.receivable_year ?? 0), 0),
    };
  }, [properties.data]);

  const openEdit = (row?: RentalProperty) => {
    setForm(
      row
        ? {
            id: row.id,
            name: row.name,
            tenant_name: row.tenant_name ?? "",
            due_day: row.due_day ? String(row.due_day) : "",
            current_rent: row.current_rent ? String(row.current_rent) : "",
            contract_start: row.contract_start ?? "",
            contract_end: row.contract_end ?? "",
            next_adjustment_date: row.next_adjustment_date ?? "",
            status: row.status,
            notes: row.notes ?? "",
          }
        : { ...emptyForm },
    );
    setEditing(true);
  };

  const submitProperty = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do imóvel.");
      return;
    }
    try {
      await saveProperty.mutateAsync({
        ...(form.id ? { id: form.id } : {}),
        name: form.name.trim(),
        tenant_name: form.tenant_name.trim() || null,
        due_day: form.due_day ? Number(form.due_day) : null,
        current_rent: form.current_rent ? Number(form.current_rent) : 0,
        contract_start: form.contract_start || null,
        contract_end: form.contract_end || null,
        next_adjustment_date: form.next_adjustment_date || null,
        status: form.status,
        notes: form.notes.trim() || null,
      });
      toast.success(form.id ? "Imóvel atualizado." : "Imóvel cadastrado.");
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o imóvel.");
    }
  };

  const submitReceipt = async () => {
    if (!receiptFor) return;
    const amount = Number(receiptForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Informe o valor recebido.");
      return;
    }
    try {
      await registerReceipt.mutateAsync({
        property_id: receiptFor.id,
        competence: `${receiptForm.competence}-01`,
        receipt_date: receiptForm.receipt_date,
        amount,
        notes: receiptForm.notes.trim() || null,
      });
      toast.success("Aluguel recebido registrado.");
      setReceiptFor(null);
      setReceiptForm({ competence: todayISO().slice(0, 7), receipt_date: todayISO(), amount: "", notes: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o recebimento.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aluguéis</h1>
          <p className="text-sm text-muted-foreground">
            Imóveis próprios e sua renda mensal. Estes valores nunca entram nos indicadores da carteira de investimentos.
          </p>
        </div>
        <Button onClick={() => openEdit()}>Novo imóvel</Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Imóveis" value={`${totals.active} ativos de ${totals.count}`} />
        <KpiCard label="Renda mensal contratada" value={brl(totals.monthly)} />
        <KpiCard label="Recebido no ano" value={brl(totals.receivedYear)} />
        <KpiCard label="A receber no ano" value={brl(totals.receivableYear)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carteira de imóveis</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Inquilino</TableHead>
                  <TableHead className="text-right">Aluguel</TableHead>
                  <TableHead className="text-center">Vencimento</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Próximo reajuste</TableHead>
                  <TableHead className="text-right">Recebido no ano</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(properties.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.tenant_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(row.current_rent)}</TableCell>
                    <TableCell className="text-center">{row.due_day ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dateBR(row.contract_start)} → {dateBR(row.contract_end)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{dateBR(row.next_adjustment_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(row.received_year)}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "ATIVO" ? "default" : "secondary"}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReceiptFor(row);
                          setReceiptForm((prev) => ({ ...prev, amount: String(row.current_rent ?? "") }));
                        }}
                      >
                        Receber
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(properties.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                      {properties.isLoading ? "Carregando…" : "Nenhum imóvel cadastrado."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recebimentos de aluguel</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(receipts.data ?? []).slice(0, 50).map((row) => (
                  <TableRow key={String(row["id"])}>
                    <TableCell>{(row["rental_properties"] as { name?: string } | null)?.name ?? "—"}</TableCell>
                    <TableCell>{dateBR(String(row["competence"] ?? "")).slice(3)}</TableCell>
                    <TableCell>{dateBR(String(row["receipt_date"] ?? ""))}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(Number(row["amount"] ?? 0))}</TableCell>
                    <TableCell className="text-muted-foreground">{String(row["notes"] ?? "—")}</TableCell>
                  </TableRow>
                ))}
                {(receipts.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum recebimento de aluguel registrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{form.id ? "Editar imóvel" : "Novo imóvel"}</SheetTitle>
            <SheetDescription>Dados contratuais do imóvel próprio.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <Field label="Imóvel">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Inquilino">
              <Input value={form.tenant_name} onChange={(e) => setForm({ ...form, tenant_name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor do aluguel">
                <Input
                  type="number"
                  step="0.01"
                  value={form.current_rent}
                  onChange={(e) => setForm({ ...form, current_rent: e.target.value })}
                />
              </Field>
              <Field label="Dia de vencimento">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.due_day}
                  onChange={(e) => setForm({ ...form, due_day: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início do contrato">
                <Input type="date" value={form.contract_start} onChange={(e) => setForm({ ...form, contract_start: e.target.value })} />
              </Field>
              <Field label="Fim do contrato">
                <Input type="date" value={form.contract_end} onChange={(e) => setForm({ ...form, contract_end: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Próximo reajuste">
                <Input
                  type="date"
                  value={form.next_adjustment_date}
                  onChange={(e) => setForm({ ...form, next_adjustment_date: e.target.value })}
                />
              </Field>
              <Field label="Situação">
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Observações">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <SheetFooter>
            <Button onClick={() => void submitProperty()} disabled={saveProperty.isPending}>
              {saveProperty.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(receiptFor)} onOpenChange={(open) => !open && setReceiptFor(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Registrar aluguel recebido</SheetTitle>
            <SheetDescription>{receiptFor?.name}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <Field label="Competência">
              <Input
                type="month"
                value={receiptForm.competence}
                onChange={(e) => setReceiptForm({ ...receiptForm, competence: e.target.value })}
              />
            </Field>
            <Field label="Data do recebimento">
              <Input
                type="date"
                value={receiptForm.receipt_date}
                onChange={(e) => setReceiptForm({ ...receiptForm, receipt_date: e.target.value })}
              />
            </Field>
            <Field label="Valor">
              <Input
                type="number"
                step="0.01"
                value={receiptForm.amount}
                onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
              />
            </Field>
            <Field label="Observações">
              <Textarea value={receiptForm.notes} onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })} />
            </Field>
          </div>
          <SheetFooter>
            <Button onClick={() => void submitReceipt()} disabled={registerReceipt.isPending}>
              {registerReceipt.isPending ? "Registrando…" : "Registrar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
