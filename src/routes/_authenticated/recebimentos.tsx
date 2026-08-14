import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCancelReceipt, useInstallments, useOperations, useReceipts, useRegisterReceipt } from "@/lib/data/hooks";
import { brl, dateBR, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/recebimentos")({
  head: () => ({
    meta: [
      { title: "Recebimentos · Nova Era Investimentos" },
      {
        name: "description",
        content: "Baixa de parcelas, histórico de recebimentos e estorno de lançamentos da carteira Nova Era.",
      },
      { property: "og:title", content: "Recebimentos · Nova Era Investimentos" },
      { property: "og:description", content: "Registro e histórico de recebimentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const operations = useOperations();
  const receipts = useReceipts();
  const register = useRegisterReceipt();
  const cancel = useCancelReceipt();

  const [operationId, setOperationId] = useState("");
  const [receiptDate, setReceiptDate] = useState(todayISO());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const installments = useInstallments(operationId || undefined);

  const openInstallments = useMemo(
    () => (installments.data ?? []).filter((row) => (row.outstanding_amount ?? 0) > 0.004),
    [installments.data],
  );

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
      toast.success("Recebimento registrado.");
      setAmounts({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao registrar recebimento.");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Recebimentos</h1>
        <p className="text-sm text-muted-foreground">Dê baixa nas parcelas e acompanhe o histórico.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo recebimento</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-3 md:grid-cols-2">
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
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Valor a baixar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openInstallments.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.installment_number}</TableCell>
                        <TableCell>{dateBR(row.due_date)}</TableCell>
                        <TableCell className="text-right">{brl(row.outstanding_amount)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            className="ml-auto w-32"
                            value={amounts[row.id ?? ""] ?? ""}
                            onChange={(event) =>
                              setAmounts({ ...amounts, [row.id ?? ""]: event.target.value })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {openInstallments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-sm text-muted-foreground">
                          Nenhuma parcela em aberto nesta operação.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <Button type="submit" disabled={register.isPending}>
              Registrar recebimento
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(receipts.data ?? []).map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell>{dateBR(receipt.receipt_date)}</TableCell>
                  <TableCell>{receipt.investment_operations?.reference ?? "—"}</TableCell>
                  <TableCell className="text-right">{brl(receipt.total_amount)}</TableCell>
                  <TableCell>{receipt.source}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cancel.isPending}
                      onClick={async () => {
                        try {
                          await cancel.mutateAsync(receipt.id);
                          toast.success("Recebimento estornado.");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Falha ao estornar.");
                        }
                      }}
                    >
                      Estornar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
