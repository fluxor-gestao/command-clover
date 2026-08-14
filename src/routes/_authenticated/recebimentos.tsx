import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { Search, Receipt, History, RotateCcw, Edit2, Calendar, Building2, Plus, ArrowRight } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCancelReceipt, useInstallments, useOperations, useReceipts, useRegisterReceipt, useUpdateReceipt } from "@/lib/data/hooks";
import { brl, dateBR, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  operationId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/recebimentos")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Recebimentos · Nova Era Investimentos" },
      {
        name: "description",
        content: "Baixa de parcelas, histórico de recebimentos e estorno de lançamentos da carteira Nova Era.",
      },
    ],
  }),
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const { operationId: searchOperationId } = Route.useSearch();
  const operations = useOperations();
  const receipts = useReceipts();
  const register = useRegisterReceipt();
  const cancel = useCancelReceipt();

  const [operationId, setOperationId] = useState(searchOperationId || "");
  const [receiptDate, setReceiptDate] = useState(todayISO());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const installments = useInstallments(operationId || undefined);

  useEffect(() => {
    if (searchOperationId) setOperationId(searchOperationId);
  }, [searchOperationId]);

  const { overdue, current, future } = useMemo(() => {
    const list = (installments.data ?? []).filter((row) => (row.outstanding_amount ?? 0) > 0.004);
    const today = todayISO();
    
    return {
      overdue: list.filter(r => r.due_date && r.due_date < today),
      current: list.filter(r => r.due_date === today),
      future: list.filter(r => r.due_date && r.due_date > today),
    };
  }, [installments.data]);

  const openInstallments = useMemo(() => [...overdue, ...current, ...future], [overdue, current, future]);

  const totalAllocated = useMemo(() => {
    return Object.values(amounts).reduce((acc, val) => acc + (Number(val) || 0), 0);
  }, [amounts]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const allocations = Object.entries(amounts)
      .map(([installment_id, value]) => ({ installment_id, amount: Number(value || 0) }))
      .filter((item) => item.amount > 0);
    
    if (!operationId || allocations.length === 0) {
      toast.error("Selecione a operação e informe pelo menos um valor.");
      return;
    }

    try {
      await register.mutateAsync({ operationId, receiptDate, notes: null, allocations });
      toast.success("Recebimento registrado com sucesso.");
      setAmounts({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao registrar recebimento.");
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success text-white">
            <Receipt className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fluxo de Recebimentos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gestão de entradas e baixas de parcelas</p>
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden bg-card/50">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Novo Lançamento</CardTitle>
                  <CardDescription>Selecione a operação para distribuir o recebimento</CardDescription>
                </div>
                {totalAllocated > 0 && (
                  <Badge variant="outline" className="h-6 border-success/30 text-success bg-success/5 font-bold tabular-nums">
                    {brl(totalAllocated)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form className="space-y-6" onSubmit={submit}>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Operação Principal</Label>
                    <Select value={operationId} onValueChange={setOperationId}>
                      <SelectTrigger className="h-10 border-none bg-muted/50 focus:ring-1">
                        <SelectValue placeholder="Selecione a operação" />
                      </SelectTrigger>
                      <SelectContent>
                        {(operations.data ?? []).map((op) => (
                          <SelectItem key={op.operation_id} value={op.operation_id ?? ""}>
                            {op.reference}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="receiptDate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Data da Entrada</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 size-4 text-muted-foreground/50" />
                      <Input
                        id="receiptDate"
                        type="date"
                        value={receiptDate}
                        onChange={(event) => setReceiptDate(event.target.value)}
                        className="h-10 pl-10 border-none bg-muted/50 focus:ring-1"
                      />
                    </div>
                  </div>
                </div>

                {operationId && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-px flex-1 bg-border/50" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Distribuição de Parcelas</span>
                      <div className="h-px flex-1 bg-border/50" />
                    </div>
                    
                    <div className="rounded-xl border border-border/50 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="w-16 text-[10px] uppercase font-bold tracking-wider">Parcela</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold tracking-wider">Vencimento</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">Saldo</TableHead>
                            <TableHead className="text-right w-36 text-[10px] uppercase font-bold tracking-wider pr-4">Receber</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {overdue.length > 0 && (
                            <TableRow className="bg-destructive/5 hover:bg-destructive/5 border-none">
                              <TableCell colSpan={4} className="py-1 px-4 text-[9px] font-bold uppercase tracking-widest text-destructive">Parcelas Atrasadas</TableCell>
                            </TableRow>
                          )}
                          {overdue.map((row) => (
                            <InstallmentRow 
                              key={row.id} 
                              row={row} 
                              value={amounts[row.id ?? ""] ?? ""} 
                              onChange={(val) => setAmounts(prev => ({ ...prev, [row.id ?? ""]: val }))}
                              isOverdue
                            />
                          ))}

                          {current.length > 0 && (
                            <TableRow className="bg-success/5 hover:bg-success/5 border-none">
                              <TableCell colSpan={4} className="py-1 px-4 text-[9px] font-bold uppercase tracking-widest text-success">Vencendo Hoje</TableCell>
                            </TableRow>
                          )}
                          {current.map((row) => (
                            <InstallmentRow 
                              key={row.id} 
                              row={row} 
                              value={amounts[row.id ?? ""] ?? ""} 
                              onChange={(val) => setAmounts(prev => ({ ...prev, [row.id ?? ""]: val }))}
                            />
                          ))}

                          {future.length > 0 && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30 border-none">
                              <TableCell colSpan={4} className="py-1 px-4 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Parcelas Futuras</TableCell>
                            </TableRow>
                          )}
                          {future.map((row) => (
                            <InstallmentRow 
                              key={row.id} 
                              row={row} 
                              value={amounts[row.id ?? ""] ?? ""} 
                              onChange={(val) => setAmounts(prev => ({ ...prev, [row.id ?? ""]: val }))}
                            />
                          ))}

                          {openInstallments.length === 0 && !installments.isLoading && (
                            <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center">
                                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                  <Building2 className="size-6 opacity-20" />
                                  <p className="text-xs font-medium italic">Nenhuma parcela pendente nesta operação.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {totalAllocated > 0 && (
                      <div className="flex justify-between items-center p-4 rounded-xl bg-success/5 border border-success/10 transition-all animate-in zoom-in-95">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-success/70">Total Distribuído</p>
                          <p className="text-sm font-medium text-muted-foreground">Confirmar baixa de parcelas</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-success tabular-nums tracking-tight">{brl(totalAllocated)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className={cn(
                    "w-full h-11 rounded-xl font-bold transition-all",
                    totalAllocated > 0 ? "bg-success hover:bg-success/90 text-white shadow-lg shadow-success/20" : ""
                  )} 
                  disabled={register.isPending || totalAllocated === 0}
                >
                  <Plus className="mr-2 size-4" /> Registrar Recebimento
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card className="h-full border-none shadow-sm bg-card/50 overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Histórico</CardTitle>
                <History className="size-4 text-muted-foreground/50" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {(receipts.data ?? []).slice(0, 20).map((receipt) => (
                  <div key={receipt.id} className="flex flex-col gap-3 p-3.5 rounded-xl border border-border/50 bg-card/80 hover:bg-muted/50 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-success/40" />
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-bold leading-none tracking-tight">{receipt.investment_operations?.reference ?? "—"}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          <Calendar className="size-3" />
                          <span>{dateBR(receipt.receipt_date)}</span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                          <span className="uppercase tracking-widest">{receipt.source}</span>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-success tabular-nums">{brl(receipt.total_amount)}</p>
                    </div>
                    
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/30 mt-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                      <EditReceiptDialog receipt={receipt} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                        disabled={cancel.isPending}
                        onClick={async () => {
                          if (confirm("Deseja realmente estornar este recebimento?")) {
                            try {
                              await cancel.mutateAsync(receipt.id);
                              toast.success("Recebimento estornado.");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Falha ao estornar.");
                            }
                          }
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {(receipts.data ?? []).length === 0 && !receipts.isLoading && (
                  <div className="h-48 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
                    <Receipt className="h-10 w-10 mb-3 opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest opacity-40">Sem lançamentos</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EditReceiptDialog({ receipt }: { receipt: any }) {
  const update = useUpdateReceipt();
  const [open, setOpen] = useState(false);
  const [receiptDate, setReceiptDate] = useState(receipt.receipt_date);
  const [notes, setNotes] = useState(receipt.notes || "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        receiptId: receipt.id,
        receiptDate,
        notes: notes || null,
        allocations: [], // Em uma implementação completa, carregaríamos as alocações atuais para edição
      });
      toast.success("Recebimento atualizado.");
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
          <Edit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Recebimento</DialogTitle>
          <DialogDescription>
            Altere a data ou observações do lançamento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motivo da alteração..." />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>Salvar Alterações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InstallmentRow({ row, value, onChange, isOverdue }: { row: any, value: string, onChange: (val: string) => void, isOverdue?: boolean }) {
  return (
    <TableRow className={cn("group hover:bg-muted/30 border-border/50", isOverdue && "bg-destructive/[0.02]")}>
      <TableCell className="font-mono text-xs text-muted-foreground">{row.installment_number}</TableCell>
      <TableCell className={cn("text-xs font-medium tabular-nums", isOverdue && "text-destructive font-bold")}>
        {dateBR(row.due_date)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs font-bold">{brl(row.outstanding_amount)}</TableCell>
      <TableCell className="text-right pr-4">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-[10px] font-bold text-muted-foreground/40 italic pointer-events-none">R$</span>
          <Input
            type="number"
            step="0.01"
            className="h-8 pl-8 text-right font-mono text-xs border-none bg-muted/50 group-hover:bg-background transition-colors focus:ring-1"
            placeholder="0,00"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
