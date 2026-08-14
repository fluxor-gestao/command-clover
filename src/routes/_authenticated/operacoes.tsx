import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Info,
  Calculator,
  TrendingUp,
  Calendar,
  MoreHorizontal,
  Eye,
  Edit,
  Receipt,
  PlusCircle,
  Search,
  Filter,
  X,
  Trash2,
  Building2,
  Star,
} from "lucide-react";


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
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReferenceCombobox } from "@/components/import/ReferenceCombobox";
import { useCategories, useCreateOperation, useOperations } from "@/lib/data/hooks";
import { brl, dateBR, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/operacoes")({
  validateSearch: (search) => searchSchema.parse(search),
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
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const operations = useOperations();
  
  const search = searchParams.search || "";
  const status = searchParams.status || "TODOS";
  const category = searchParams.category || "TODAS";

  const setSearch = (v: string) => navigate({ 
    to: ".", 
    search: (prev: any) => ({ ...prev, search: v || undefined }),
    replace: true 
  });
  const setStatus = (v: string) => navigate({ 
    to: ".", 
    search: (prev: any) => ({ ...prev, status: v === "TODOS" ? undefined : v }),
    replace: true
  });
  const setCategory = (v: string) => navigate({ 
    to: ".", 
    search: (prev: any) => ({ ...prev, category: v === "TODAS" ? undefined : v }),
    replace: true
  });

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
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Carteira de Operações</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
              <span>{filtered.length} ativos em gestão</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
              <span>{brl(filtered.reduce((acc, op) => acc + Number(op.total_invested), 0))} alocados</span>
            </div>
          </div>
        </div>
        <NewOperationDialog />
      </header>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border bg-card/50 p-3 backdrop-blur-sm">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por referência..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 pl-9 text-xs border-none bg-muted/50 focus-visible:ring-1"
              />
            </div>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-full md:w-40 text-xs border-none bg-muted/50">
                <Filter className="mr-2 size-3 text-muted-foreground" />
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
              <SelectTrigger className="h-9 w-full md:w-44 text-xs border-none bg-muted/50">
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

            {(search || status !== "TODOS" || category !== "TODAS") && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setSearch(""); setStatus("TODOS"); setCategory("TODAS"); }}
                className="h-8 px-2 text-[10px] uppercase font-bold tracking-wider"
              >
                <X className="mr-1 size-3" /> Limpar filtros
              </Button>
            )}
          </div>
        </div>

        <Card className="border-none shadow-sm overflow-hidden bg-card/50">
          <CardContent className="p-0">
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky left-0 bg-muted/30 z-20 text-[10px] uppercase font-bold tracking-wider">Referência</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-wider">Categoria</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">Investido</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">Recebido</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">A recuperar</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">Vencido</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">Retorno</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-wider">Vencimento</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-wider">Status</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((op) => {
                    const badge = STATUS_CONFIG[op.financial_status ?? "EM_DIA"] ?? STATUS_CONFIG["ATIVA"]!;
                    return (
                      <TableRow key={op.operation_id} className="group transition-colors hover:bg-muted/50">
                        <TableCell className="sticky left-0 bg-card group-hover:bg-muted/50 transition-colors z-10 font-medium">
                          <Link
                            to="/operacoes/$id"
                            params={{ id: op.operation_id ?? "" }}
                            className="underline-offset-4 decoration-muted-foreground/30 hover:underline hover:decoration-primary"
                          >
                            {op.reference}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{op.category ?? "—"}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{brl(op.total_invested)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-success">{brl(op.total_received)}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">{brl(op.capital_to_recover)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-destructive font-bold">{brl(op.overdue_receivable)}</TableCell>
                        <TableCell className="text-right text-xs">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-bold">{pct(op.recovery_percentage)}</span>
                            <Progress value={Number(op.recovery_percentage) * 100} className="h-1 w-12" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs tabular-nums text-muted-foreground">{dateBR(op.last_installment_due)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "h-5 text-[10px] font-bold uppercase tracking-wider px-2",
                              op.financial_status === "EM_DIA" && "border-success/30 text-success bg-success/5",
                              op.financial_status === "INADIMPLENTE" && "border-destructive/30 text-destructive bg-destructive/5",
                              op.financial_status === "LIQUIDADA" && "border-muted-foreground/30 text-muted-foreground bg-muted/5"
                            )}
                          >
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <OperationActions operation={op} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Search className="size-8 text-muted-foreground/20" />
                          <p className="text-sm text-muted-foreground font-medium">Nenhuma operação encontrada.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
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
