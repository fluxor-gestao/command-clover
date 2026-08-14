import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCategories, useCreateOperation, useOperations } from "@/lib/data/hooks";
import { brl, dateBR, pct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/operacoes")({
  head: () => ({
    meta: [
      { title: "Operações · Nova Era Investimentos" },
      {
        name: "description",
        content:
          "Cadastro e acompanhamento das operações de investimento: capital aplicado, parcelas, retorno e situação de cada contrato.",
      },
      { property: "og:title", content: "Operações · Nova Era Investimentos" },
      {
        property: "og:description",
        content: "Gestão completa das operações da carteira Nova Era.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OperationsPage,
});

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ATIVA: { label: "Ativa", variant: "default" },
  INADIMPLENTE: { label: "Inadimplente", variant: "destructive" },
  EM_REVISAO: { label: "Em revisão", variant: "outline" },
  ENCERRADA: { label: "Encerrada", variant: "secondary" },
};

function OperationsPage() {
  const operations = useOperations();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("TODOS");
  const [category, setCategory] = useState("TODAS");

  const filtered = useMemo(() => {
    return (operations.data ?? []).filter((op) => {
      const matchSearch = (op.reference ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = status === "TODOS" || op.computed_status === status;
      const matchCategory = category === "TODAS" || op.category === category;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [operations.data, search, status, category]);

  const categories = [...new Set((operations.data ?? []).map((op) => op.category).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operações</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {operations.data?.length ?? 0} operações
          </p>
        </div>
        <NewOperationDialog />
      </header>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Buscar por referência..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todas as situações</SelectItem>
                <SelectItem value="ATIVA">Ativa</SelectItem>
                <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
                <SelectItem value="EM_REVISAO">Em revisão</SelectItem>
                <SelectItem value="ENCERRADA">Encerrada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as categorias</SelectItem>
                {categories.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Investido</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">A recuperar</TableHead>
                <TableHead className="text-right">Vencido</TableHead>
                <TableHead className="text-right">Retorno</TableHead>
                <TableHead>Últ. venc.</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((op) => {
                const badge = STATUS_LABEL[op.computed_status ?? "ATIVA"] ?? STATUS_LABEL["ATIVA"]!;
                return (
                  <TableRow key={op.operation_id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/operacoes/$id"
                        params={{ id: op.operation_id ?? "" }}
                        className="underline-offset-4 hover:underline"
                      >
                        {op.reference}
                      </Link>
                    </TableCell>
                    <TableCell>{op.category ?? "—"}</TableCell>
                    <TableCell className="text-right">{brl(op.total_invested)}</TableCell>
                    <TableCell className="text-right">{brl(op.total_received)}</TableCell>
                    <TableCell className="text-right">{brl(op.capital_to_recover)}</TableCell>
                    <TableCell className="text-right text-destructive">{brl(op.overdue_receivable)}</TableCell>
                    <TableCell className="text-right">{pct(op.recovery_percentage)}</TableCell>
                    <TableCell>{dateBR(op.last_installment_due)}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-sm text-muted-foreground">
                    Nenhuma operação encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NewOperationDialog() {
  const categories = useCategories();
  const create = useCreateOperation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    reference: "",
    category_id: "",
    due_day: "",
    initial_capital: "",
    investment_date: "",
    first_due_date: "",
    installment_count: "",
    installment_value: "",
    description: "",
    notes: "",
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await create.mutateAsync({
        reference: form.reference.trim(),
        category_id: form.category_id || null,
        due_day: form.due_day ? Number(form.due_day) : null,
        initial_capital: Number(form.initial_capital || 0),
        investment_date: form.investment_date || null,
        first_due_date: form.first_due_date || null,
        installment_count: form.installment_count ? Number(form.installment_count) : null,
        installment_value: form.installment_value ? Number(form.installment_value) : null,
        description: form.description || null,
        notes: form.notes || null,
      });
      toast.success("Operação cadastrada e cronograma gerado.");
      setOpen(false);
      setForm({
        reference: "",
        category_id: "",
        due_day: "",
        initial_capital: "",
        investment_date: "",
        first_due_date: "",
        installment_count: "",
        installment_value: "",
        description: "",
        notes: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a operação.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nova operação</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova operação</DialogTitle>
          <DialogDescription>
            Informe o contrato. Com primeiro vencimento, quantidade e valor da parcela o cronograma é gerado
            automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="reference">Referência *</Label>
            <Input
              id="reference"
              required
              value={form.reference}
              onChange={(event) => setForm({ ...form, reference: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={(value) => setForm({ ...form, category_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="initial_capital">Capital investido (R$) *</Label>
            <Input
              id="initial_capital"
              type="number"
              step="0.01"
              required
              value={form.initial_capital}
              onChange={(event) => setForm({ ...form, initial_capital: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="investment_date">Data do investimento</Label>
            <Input
              id="investment_date"
              type="date"
              value={form.investment_date}
              onChange={(event) => setForm({ ...form, investment_date: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_day">Dia de vencimento</Label>
            <Input
              id="due_day"
              type="number"
              min={1}
              max={31}
              value={form.due_day}
              onChange={(event) => setForm({ ...form, due_day: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="first_due_date">1º vencimento</Label>
            <Input
              id="first_due_date"
              type="date"
              value={form.first_due_date}
              onChange={(event) => setForm({ ...form, first_due_date: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="installment_count">Qtd. de parcelas</Label>
            <Input
              id="installment_count"
              type="number"
              min={1}
              value={form.installment_count}
              onChange={(event) => setForm({ ...form, installment_count: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="installment_value">Valor da parcela (R$)</Label>
            <Input
              id="installment_value"
              type="number"
              step="0.01"
              value={form.installment_value}
              onChange={(event) => setForm({ ...form, installment_value: event.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              Salvar operação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
