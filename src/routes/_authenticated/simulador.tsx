import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deriveContractDates, simulateContract, type ContractMode } from "@/lib/finance/contract";
import { brl, dateBR, pct, todayISO } from "@/lib/format";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/simulador")({
  head: () => ({
    meta: [
      { title: "Simulador gerencial · Nova Era Investimentos" },
      {
        name: "description",
        content:
          "Simule contratos de investimento: capital, parcelas, data final ou primeiro vencimento, lucro, ROI e payback antes de cadastrar.",
      },
      { property: "og:title", content: "Simulador gerencial · Nova Era Investimentos" },
      { property: "og:description", content: "Cálculo de lucro, ROI, payback e cronograma projetado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SimulatorPage,
});

function SimulatorPage() {
  const [mode, setMode] = useState<ContractMode>("PRIMEIRO_VENCIMENTO");
  const [capital, setCapital] = useState("100000");
  const [installmentValue, setInstallmentValue] = useState("3000");
  const [installmentCount, setInstallmentCount] = useState("48");
  const [dueDay, setDueDay] = useState("10");
  const [firstDueDate, setFirstDueDate] = useState(todayISO());
  const [finalDate, setFinalDate] = useState("");

  const dates = useMemo(
    () =>
      deriveContractDates({
        mode,
        firstDueDate: firstDueDate || null,
        finalDate: finalDate || null,
        installmentCount: Number(installmentCount) || null,
        dueDay: Number(dueDay) || null,
      }),
    [mode, firstDueDate, finalDate, installmentCount, dueDay],
  );

  const result = useMemo(
    () =>
      simulateContract({
        capital: Number(capital) || 0,
        installmentValue: Number(installmentValue) || 0,
        installmentCount: Number(installmentCount) || 0,
        firstDueDate: dates.firstDueDate,
        dueDay: Number(dueDay) || null,
      }),
    [capital, installmentValue, installmentCount, dates.firstDueDate, dueDay],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Simulador gerencial</h1>
        <p className="text-sm text-muted-foreground">
          Calcule o contrato antes de cadastrar. Informe o 1º vencimento e o sistema deriva a data final — ou informe a data
          final e ele deriva o 1º vencimento.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parâmetros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Forma de cálculo</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as ContractMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMEIRO_VENCIMENTO">1º vencimento → data final</SelectItem>
                  <SelectItem value="DATA_FINAL">Data final → 1º vencimento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Capital investido</Label>
                <Input type="number" step="0.01" value={capital} onChange={(e) => setCapital(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Valor da parcela</Label>
                  <span className="text-[10px] font-medium text-success">Líquido: {brl(netInstallmentValue)}</span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={installmentValue}
                  onChange={(e) => setInstallmentValue(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nº de parcelas</Label>
                <Input type="number" min={1} value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dia de vencimento</Label>
                <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
              </div>
            </div>

            {mode === "PRIMEIRO_VENCIMENTO" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">1º vencimento</Label>
                <Input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data final do contrato</Label>
                <Input type="date" value={finalDate} onChange={(e) => setFinalDate(e.target.value)} />
              </div>
            )}

            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              {dates.error ? (
                <span className="text-destructive">{dates.error}</span>
              ) : (
                <div className="space-y-1">
                  <p>
                    1º vencimento derivado: <strong>{dateBR(dates.firstDueDate)}</strong>
                  </p>
                  <p>
                    Data final derivada: <strong>{dateBR(dates.finalDate)}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Alerta de Viabilidade */}
            <div
              className={cn(
                "mt-4 flex items-center gap-3 rounded-lg border p-4 transition-all duration-300 animate-in fade-in slide-in-from-top-1",
                result.roiMonthlyAverage >= 0.035
                  ? "border-success/20 bg-success/10 text-success"
                  : "border-destructive/20 bg-destructive/10 text-destructive"
              )}
            >
              {result.roiMonthlyAverage >= 0.035 ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-none">
                  {result.roiMonthlyAverage >= 0.035 ? "Negócio favorável!" : "Analisar viabilidade!"}
                </span>
                <span className="mt-1 text-[10px] opacity-80 uppercase tracking-wider font-medium">
                  Status de Rentabilidade
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 min-w-0">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi label="Total contratado" value={brl(result.contractedTotal)} />
            <Kpi label="Lucro projetado" value={brl(result.profit)} tone={result.profit >= 0 ? "positive" : "negative"} />
            <Kpi label="ROI total" value={pct(result.roiTotal)} />
            <Kpi label="ROI médio mensal" value={pct(result.roiMonthlyAverage, 2)} />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Cronograma projetado</CardTitle>
              <Badge variant="secondary">
                Payback:{" "}
                {result.paybackInstallments
                  ? `${result.paybackInstallments}ª parcela · ${dateBR(result.paybackDate)}`
                  : "não alcançado"}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Parcela</TableHead>
                      <TableHead className="text-right">Acumulado</TableHead>
                      <TableHead className="text-right">Capital a recuperar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.schedule.map((row) => (
                      <TableRow key={row.number}>
                        <TableCell className="text-muted-foreground">{row.number}</TableCell>
                        <TableCell>{dateBR(row.dueDate)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(row.amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(row.accumulated)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(row.remainingCapital)}</TableCell>
                      </TableRow>
                    ))}
                    {result.schedule.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          Preencha os parâmetros para simular.
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
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <Card className="overflow-hidden border-none bg-muted/20 shadow-none">
      <CardContent className="flex flex-col justify-center space-y-0.5 p-3 min-h-[70px]">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80 truncate">
          {label}
        </p>
        <p
          className={
            (tone === "negative" ? "text-destructive " : "text-foreground ") +
            "text-base sm:text-lg font-bold tabular-nums leading-tight truncate"
          }
          title={value}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
