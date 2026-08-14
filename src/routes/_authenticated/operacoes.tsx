import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Info, Calculator, TrendingUp, Calendar, MoreHorizontal, Eye, Edit, Receipt, PlusCircle, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReferenceCombobox } from "@/components/import/ReferenceCombobox";
import { useCategories, useCreateOperation, useOperations } from "@/lib/data/hooks";
import { brl, dateBR, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacoes")({
  head: () => ({
    meta: [
      { title: "Operações · Nova Era Investimentos" },
      {
        name: "description",
        content:
          "Cadastro e acompanhamento das operações de investimento: capital aplicado, parcelas, retorno e situação de cada contrato.",
      },
    ],
  }),
  component: OperationsPage,
});

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  EM_DIA: { label: "Em dia", variant: "default" },
  INADIMPLENTE: { label: "Inadimplente", variant: "destructive" },
  LIQUIDADA: { label: "Liquidada", variant: "secondary" },
};

function OperationsPage() {
  const operations = useOperations();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("TODOS");
  const [category, setCategory] = useState("TODAS");

  const filtered = useMemo(() => {
    return (operations.data ?? []).filter((op) => {
      const matchSearch = (op.reference ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = status === "TODOS" || op.financial_status === status;
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
                <SelectItem value="EM_DIA">Em dia</SelectItem>
                <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
                <SelectItem value="LIQUIDADA">Liquidada</SelectItem>
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
                <TableHead className="text-right text-destructive">Vencido</TableHead>
                <TableHead className="text-right">Retorno</TableHead>
                <TableHead>Últ. venc.</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((op) => {
                const badge = STATUS_CONFIG[op.financial_status ?? "EM_DIA"] ?? STATUS_CONFIG["ATIVA"]!;
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
                    <TableCell className="text-right text-destructive font-medium">{brl(op.overdue_receivable)}</TableCell>
                    <TableCell className="text-right">{pct(op.recovery_percentage)}</TableCell>
                    <TableCell>{dateBR(op.last_installment_due)}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <OperationActions operation={op} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Nenhuma operação encontrada.
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
    reference_id: "",
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

  const summary = useMemo(() => {
    const capital = Number(form.initial_capital) || 0;
    const count = Number(form.installment_count) || 0;
    const value = Number(form.installment_value) || 0;
    const total = count * value;
    const profit = total - capital;
    const roi = capital > 0 ? profit / capital : 0;
    
    let maturity = "—";
    if (form.first_due_date && count > 0) {
      const date = new Date(form.first_due_date);
      date.setMonth(new Date(form.first_due_date).getMonth() + (count - 1));
      maturity = dateBR(date.toISOString().split("T")[0]);
    }

    return { total, profit, roi, maturity };
  }, [form.initial_capital, form.installment_count, form.installment_value, form.first_due_date]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.reference_id) {
      toast.error("Selecione ou crie uma referência para a operação.");
      return;
    }

    try {
      await create.mutateAsync({
        reference_id: form.reference_id,
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
        reference_id: "",
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nova operação</DialogTitle>
          <DialogDescription>
            Vincule a operação a uma referência e informe os valores do contrato.
          </DialogDescription>
        </DialogHeader>
        
        <form className="grid gap-6 md:grid-cols-2" onSubmit={submit}>
          <div className="space-y-4 md:col-span-1">
            <div className="space-y-2">
              <Label>Referência do Ativo / Contrato *</Label>
              <ReferenceCombobox 
                value={form.reference_id} 
                onChange={(v) => setForm({ ...form, reference_id: v })} 
                categoryId={form.category_id}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="initial_capital">Capital investido (R$) *</Label>
                <Input
                  id="initial_capital"
                  type="number"
                  step="0.01"
                  required
                  value={form.initial_capital}
                  onChange={(event) => setForm({ ...form, initial_capital: event.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="investment_date">Data investimento</Label>
                <Input
                  id="investment_date"
                  type="date"
                  value={form.investment_date}
                  onChange={(event) => setForm({ ...form, investment_date: event.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="first_due_date">1º venc.</Label>
                <Input
                  id="first_due_date"
                  type="date"
                  value={form.first_due_date}
                  onChange={(event) => setForm({ ...form, first_due_date: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installment_count">Qtd. parc.</Label>
                <Input
                  id="installment_count"
                  type="number"
                  min={1}
                  value={form.installment_count}
                  onChange={(event) => setForm({ ...form, installment_count: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installment_value">Vlr. parc.</Label>
                <Input
                  id="installment_value"
                  type="number"
                  step="0.01"
                  value={form.installment_value}
                  onChange={(event) => setForm({ ...form, installment_value: event.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Detalhes internos..."
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4 md:col-span-1">
            <Card className="bg-muted/50 border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Resumo da Operação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total contratado:</span>
                  <span className="font-semibold">{brl(summary.total)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Lucro bruto previsto:</span>
                  <span className={cn("font-semibold", summary.profit >= 0 ? "text-green-600" : "text-destructive")}>
                    {brl(summary.profit)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm border-t pt-2">
                  <span className="text-muted-foreground">ROI (Retorno s/ Inv.):</span>
                  <Badge variant={summary.roi >= 0 ? "outline" : "destructive"} className="font-mono">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    {pct(summary.roi)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Previsão de quitação:</span>
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar className="h-3 w-3" />
                    {summary.maturity}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label>Categoria para filtro</Label>
              <Select value={form.category_id} onValueChange={(value) => setForm({ ...form, category_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="md:col-span-2">
            <Button type="submit" className="w-full md:w-auto" disabled={create.isPending}>
              Confirmar e Gerar Operação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OperationActions({ operation }: { operation: any }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/operacoes/$id" params={{ id: operation.operation_id }}>
            <Eye className="mr-2 h-4 w-4" /> Ver detalhes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Edit className="mr-2 h-4 w-4" /> Editar contrato
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/recebimentos" search={{ operationId: operation.operation_id }}>
            <Receipt className="mr-2 h-4 w-4" /> Registrar recebimento
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/aportes">
            <PlusCircle className="mr-2 h-4 w-4" /> Registrar aporte
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Cancelar operação
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
