import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, MoreHorizontal } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useInstallments } from "@/lib/data/hooks";
import { brl, dateBR } from "@/lib/format";

const searchSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  competence: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/parcelas")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Parcelas · Nova Era Investimentos" },
      {
        name: "description",
        content:
          "Cronograma consolidado de parcelas com filtros por situação, competência e operação, incluindo atrasos e saldos.",
      },
      { property: "og:title", content: "Parcelas · Nova Era Investimentos" },
      { property: "og:description", content: "Cronograma consolidado de parcelas da carteira." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InstallmentsPage,
});

function InstallmentsPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const installments = useInstallments();
  const queryClient = useQueryClient();

  const [partialRow, setPartialRow] = useState<any | null>(null);
  const [partialValue, setPartialValue] = useState("");

  const updateStatus = useMutation({
    mutationFn: async ({ id, receivedAmount }: { id: string; receivedAmount: number }) => {
      const { error } = await supabase
        .from("investment_installments")
        .update({ received_amount: receivedAmount })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Situação da parcela atualizada");
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const savePartial = () => {
    if (!partialRow) return;
    const parsed = Number(partialValue.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Informe um valor recebido válido");
      return;
    }
    updateStatus.mutate({ id: partialRow.id, receivedAmount: parsed });
    setPartialRow(null);
  };


  
  const search = searchParams.search || "";
  const status = searchParams.status || "TODAS";
  const competence = searchParams.competence || "TODAS";

  const setSearch = (v: string) => navigate({ to: ".", search: (prev: any) => ({ ...prev, search: v || undefined }), replace: true });
  const setStatus = (v: string) => navigate({ to: ".", search: (prev: any) => ({ ...prev, status: v === "TODAS" ? undefined : v }), replace: true });
  const setCompetence = (v: string) => navigate({ to: ".", search: (prev: any) => ({ ...prev, competence: v === "TODAS" ? undefined : v }), replace: true });

  const rows = installments.data ?? [];
  const competences = useMemo(
    () => [...new Set(rows.map((row) => row.competence).filter(Boolean))].sort() as string[],
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const matchSearch = (row.reference ?? "").toLowerCase().includes(search.toLowerCase());
        const matchStatus = status === "TODAS" || row.financial_status === status;
        const matchCompetence = competence === "TODAS" || row.competence === competence;
        return matchSearch && matchStatus && matchCompetence;
      }),
    [rows, search, status, competence],
  );

  const totals = filtered.reduce(
    (acc, row) => ({
      expected: acc.expected + (row.expected_amount ?? 0),
      received: acc.received + (row.received_amount ?? 0),
      outstanding: acc.outstanding + (row.outstanding_amount ?? 0),
    }),
    { expected: 0, received: 0, outstanding: 0 },
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Parcelas</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} parcelas · previsto {brl(totals.expected)} · recebido {brl(totals.received)} · saldo{" "}
          {brl(totals.outstanding)}
        </p>
      </header>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Buscar operação..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as situações</SelectItem>
                <SelectItem value="A_VENCER">A vencer</SelectItem>
                <SelectItem value="VENCIDA">Vencida</SelectItem>
                <SelectItem value="PAGA">Paga</SelectItem>
                <SelectItem value="PARCIAL">Parcial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={competence} onValueChange={setCompetence}>
              <SelectTrigger>
                <SelectValue placeholder="Competência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as competências</SelectItem>
                {competences.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operação</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Previsto</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Atraso</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 500).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.reference}</TableCell>
                    <TableCell>{row.category ?? "—"}</TableCell>
                    <TableCell>{row.installment_number}</TableCell>
                    <TableCell>{dateBR(row.due_date)}</TableCell>
                    <TableCell className="text-right">{brl(row.expected_amount)}</TableCell>
                    <TableCell className="text-right">{brl(row.received_amount)}</TableCell>
                    <TableCell className="text-right">{brl(row.outstanding_amount)}</TableCell>
                    <TableCell className="text-right">
                      {(row.days_overdue ?? 0) > 0 ? `${row.days_overdue} dias` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.financial_status === "INADIMPLENTE" ? "destructive" : "secondary"}>
                        {row.financial_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link 
                          to="/recebimentos" 
                          search={{ operationId: row.operation_id ?? undefined }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"
                          title="Registrar recebimento"
                        >
                          <Receipt className="h-4 w-4" />
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" title="Alterar situação">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Alterar situação</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatus.mutate({
                                  id: row.id!,
                                  receivedAmount: Number(row.expected_amount ?? 0),
                                })
                              }
                            >
                              Marcar como Paga
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatus.mutate({ id: row.id!, receivedAmount: 0 })}
                            >
                              Marcar como Em aberto
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setPartialRow(row);
                                setPartialValue(String(row.received_amount ?? 0));
                              }}
                            >
                              Marcar como Parcial…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-sm text-muted-foreground">
                      Nenhuma parcela encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
