import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Edit2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useContributions, useCreateContribution, useOperations, useUpdateContribution } from "@/lib/data/hooks";
import { brl, dateBR, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/aportes")({
  head: () => ({
    meta: [
      { title: "Aportes · Nova Era Investimentos" },
      {
        name: "description",
        content: "Registro de aportes adicionais e reinvestimentos por operação da carteira Nova Era.",
      },
      { property: "og:title", content: "Aportes · Nova Era Investimentos" },
      { property: "og:description", content: "Aportes e reinvestimentos por operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContributionsPage,
});

function ContributionsPage() {
  const operations = useOperations();
  const contributions = useContributions();
  const create = useCreateContribution();
  const [form, setForm] = useState({
    operation_id: "",
    contribution_date: todayISO(),
    type: "APORTE",
    amount: "",
    notes: "",
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await create.mutateAsync({
        operation_id: form.operation_id,
        contribution_date: form.contribution_date,
        type: form.type,
        amount: Number(form.amount || 0),
        notes: form.notes || null,
      });
      toast.success("Aporte registrado.");
      setForm({ ...form, amount: "", notes: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao registrar aporte.");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Aportes</h1>
        <p className="text-sm text-muted-foreground">Capital adicional injetado em operações existentes.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo aporte</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4" onSubmit={submit}>
            <div className="space-y-2 md:col-span-2">
              <Label>Operação</Label>
              <Select
                value={form.operation_id}
                onValueChange={(value) => setForm({ ...form, operation_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APORTE">Aporte</SelectItem>
                  <SelectItem value="REINVESTIMENTO">Reinvestimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={form.contribution_date}
                onChange={(event) => setForm({ ...form, contribution_date: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                required
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={create.isPending}>
                Registrar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de aportes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(contributions.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{dateBR(row.contribution_date)}</TableCell>
                  <TableCell>{row.investment_operations?.reference ?? "—"}</TableCell>
                  <TableCell>{row.type}</TableCell>
                   <TableCell className="text-right">{brl(row.amount)}</TableCell>
                   <TableCell className="text-right">
                     <EditContributionDialog contribution={row} />
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

function EditContributionDialog({ contribution }: { contribution: any }) {
  const update = useUpdateContribution();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    contribution_date: contribution.contribution_date,
    type: contribution.type,
    amount: String(contribution.amount),
    notes: contribution.notes || "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: contribution.id,
        input: {
          ...form,
          amount: Number(form.amount),
          notes: form.notes || null,
        },
      });
      toast.success("Aporte atualizado.");
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Edit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Aporte</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.contribution_date} onChange={(e) => setForm({ ...form, contribution_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="APORTE">Aporte</SelectItem>
                  <SelectItem value="REINVESTIMENTO">Reinvestimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
