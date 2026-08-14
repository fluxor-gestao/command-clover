import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { 
  ChevronLeft, 
  MoreVertical, 
  AlertTriangle, 
  History, 
  Settings2,
  CalendarCheck,
  TrendingUp,
  Receipt
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useInstallments, useOperation, useGenerateSchedule } from "@/lib/data/hooks";
import { brl, dateBR, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacoes/")({
  head: () => ({
    meta: [
      { title: "Detalhe da operação · Nova Era" },
      {
        name: "description",
        content: "Ficha completa da operação: capital, cronograma de parcelas, recebimentos e situação atual.",
      },
    ],
  }),
  component: OperationDetail,
});

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ATIVA: { label: "Ativa", variant: "default" },
  INADIMPLENTE: { label: "Inadimplente", variant: "destructive" },
  EM_REVISAO: { label: "Em revisão", variant: "outline" },
  ENCERRADA: { label: "Encerrada", variant: "secondary" },
};

function OperationDetail() {
  const { id } = Route.useParams();
  const operation = useOperation(id);
  const installments = useInstallments(id);
  const generateSchedule = useGenerateSchedule();
  
  const [showRegenerateAlert, setShowRegenerateAlert] = useState(false);
  
  const op = operation.data;
  const status = STATUS_CONFIG[op?.computed_status ?? "ATIVA"] ?? STATUS_CONFIG["ATIVA"];

  const handleRegenerate = async () => {
    try {
      await generateSchedule.mutateAsync(id);
      toast.success("Cronograma regerado com sucesso.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao regerar cronograma.");
    }
  };

  const hasReceivedPayments = (installments.data ?? []).some(i => (i.received_amount ?? 0) > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/operacoes">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{op?.reference ?? "Operação"}</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{op?.category ?? "Sem categoria"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setShowRegenerateAlert(true)}>
                <History className="mr-2 h-4 w-4" />
                Regerar Cronograma
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Settings2 className="mr-2 h-4 w-4" />
                Editar Contrato
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" disabled>
                Arquivar Operação
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button asChild>
            <Link to="/recebimentos" search={{ operationId: id }}>
              <Receipt className="mr-2 h-4 w-4" />
              Lançar Recebimento
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric 
          label="Investimento" 
          value={brl(op?.total_invested)} 
          description={op?.investment_date ? `Em ${dateBR(op.investment_date)}` : undefined}
          icon={TrendingUp}
        />
        <Metric 
          label="Total Recebido" 
          value={brl(op?.total_received)} 
          progress={op?.recovery_percentage}
          icon={CalendarCheck}
        />
        <Metric 
          label="Saldo Devedor" 
          value={brl(op?.capital_to_recover)} 
          description="Capital a recuperar"
          icon={Receipt}
        />
        <Metric 
          label="Atrasado" 
          value={brl(op?.overdue_receivable)} 
          variant={ (op?.overdue_receivable ?? 0) > 0 ? "destructive" : "default" }
          description={`${op?.overdue_installments ?? 0} parcelas vencidas`}
          icon={AlertTriangle}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base">Cronograma de Pagamentos</CardTitle>
            <CardDescription>
              Previsão de recebimentos e fluxo de caixa contratado.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Vlr. Parcela</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="w-[120px]">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(installments.data ?? []).map((installment) => (
                <TableRow key={installment.id}>
                  <TableCell className="font-mono text-muted-foreground">
                    {String(installment.installment_number).padStart(2, '0')}
                  </TableCell>
                  <TableCell className="font-medium">
                    {dateBR(installment.due_date)}
                  </TableCell>
                  <TableCell className="text-right">{brl(installment.expected_amount)}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {installment.received_amount ? brl(installment.received_amount) : "—"}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right",
                    (installment.outstanding_amount ?? 0) > 0 ? "font-medium" : "text-muted-foreground"
                  )}>
                    {brl(installment.outstanding_amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      installment.financial_status === "VENCIDA" ? "destructive" : 
                      installment.financial_status === "PAGA" ? "default" : "secondary"
                    }>
                      {installment.financial_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(installments.data ?? []).length === 0 && !installments.isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhuma parcela gerada para esta operação.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={showRegenerateAlert} onOpenChange={setShowRegenerateAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Cuidado: Regerar Cronograma
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Esta ação irá apagar as parcelas existentes e criar novas com base nos dados do contrato.
              </p>
              {hasReceivedPayments && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium">
                  Atenção: Esta operação já possui pagamentos recebidos. Regerar o cronograma pode causar inconsistências nos lançamentos financeiros vinculados.
                </div>
              )}
              <p>Deseja continuar?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRegenerate}
              className={cn(hasReceivedPayments && "bg-destructive hover:bg-destructive/90")}
            >
              Confirmar Regeração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ 
  label, 
  value, 
  description, 
  progress, 
  variant = "default",
  icon: Icon
}: { 
  label: string; 
  value: string; 
  description?: string;
  progress?: number | null;
  variant?: "default" | "destructive";
  icon?: any;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase text-muted-foreground">{label}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className={cn("text-xl font-bold", variant === "destructive" && "text-destructive")}>
          {value}
        </div>
        {progress !== undefined && progress !== null && (
          <div className="mt-2 space-y-1">
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right">{pct(progress)} recuperado</p>
          </div>
        )}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}
