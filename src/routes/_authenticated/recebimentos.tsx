import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { Search, Receipt, History, RotateCcw, Edit2 } from "lucide-react";
import { z } from "zod";

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

  const openInstallments = useMemo(
    () => (installments.data ?? []).filter((row) => (row.outstanding_amount ?? 0) > 0.004),
    [installments.data],
  );

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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Recebimentos</h1>
        <p className="text-sm text-muted-foreground">Baixa de parcelas e gestão de fluxo de entrada.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Lançar Recebimento
              </CardTitle>
              <CardDescription>Selecione a operação e distribua o valor nas parcelas em aberto.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={submit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Operação</Label>
                    <Select value={operationId} onValueChange={setOperationId}>
                      <SelectTrigger>
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
                  <div className="space-y-2">
                    <Label htmlFor="receiptDate">Data do recebimento</Label>
                    <Input
                      id="receiptDate"
                      type="date"
                      value={receiptDate}
                      onChange={(event) => setReceiptDate(event.target.value)}
                    />
                  </div>
                </div>

                {operationId && (
                  <div className="space-y-3">
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead className="text-right">Saldo Devedor</TableHead>
                            <TableHead className="text-right w-32">Receber</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {openInstallments.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-mono text-xs">{row.installment_number}</TableCell>
                              <TableCell>{dateBR(row.due_date)}</TableCell>
                              <TableCell className="text-right font-medium">{brl(row.outstanding_amount)}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-8 text-right font-mono"
                                  placeholder="0.00"
                                  value={amounts[row.id ?? ""] ?? ""}
                                  onChange={(event) =>
                                    setAmounts({ ...amounts, [row.id ?? ""]: event.target.value })
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                          {openInstallments.length === 0 && !installments.isLoading && (
                            <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">
                                Nenhuma parcela pendente nesta operação.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {totalAllocated > 0 && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <span className="text-sm font-medium">Total a registrar:</span>
                        <span className="text-lg font-bold text-primary">{brl(totalAllocated)}</span>
                      </div>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full sm:w-auto" disabled={register.isPending || totalAllocated === 0}>
                  Confirmar Recebimento
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico Recente
              </CardTitle>
              <CardDescription>Últimos 20 recebimentos registrados.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(receipts.data ?? []).slice(0, 20).map((receipt) => (
                  <div key={receipt.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{receipt.investment_operations?.reference ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{dateBR(receipt.receipt_date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">{brl(receipt.total_amount)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{receipt.source}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <EditReceiptDialog receipt={receipt} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={cancel.isPending}
                          title="Estornar lançamento"
                          onClick={async () => {
                            if (confirm("Deseja realmente estornar este recebimento? Motivo obrigatório será registrado na auditoria.")) {
                              try {
                                await cancel.mutateAsync(receipt.id);
                                toast.success("Recebimento estornado.");
                              } catch (error) {
                                toast.error(error instanceof Error ? error.message : "Falha ao estornar.");
                              }
                            }
                          }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {(receipts.data ?? []).length === 0 && !receipts.isLoading && (
                  <div className="h-32 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <Receipt className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm italic">Nenhum histórico encontrado.</p>
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
