import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PortfolioSummary = Database["public"]["Views"]["v_portfolio_summary"]["Row"];
export type OperationPosition = Database["public"]["Views"]["v_operation_position"]["Row"];

const unwrap = <T,>({ data, error }: { data: T[] | null; error: { message: string } | null }): T[] => {
  if (error) throw new Error(error.message);
  return data ?? [];
};

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ["portfolio-summary"],
    queryFn: async (): Promise<PortfolioSummary | null> => {
      const { data, error } = await supabase.from("v_portfolio_summary").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return data as PortfolioSummary | null;
    },
  });
}

export type PortfolioScope = { year: number } | { scope: "all" };

export interface PortfolioMetrics {
  scope_year: number | null;
  total_invested: number;
  total_received: number;
  capital_to_recover: number;
  total_previsto_carteira: number;
  total_a_receber: number;
  overdue_receivable: number;
  future_receivable: number;
  realized_profit: number;
  projected_result: number;
  recovery_percentage: number;
  total_operations: number;
  overdue_installments: number;
  total_installments: number;
}

/** Camada única de agregação financeira: por ano ou carteira completa. */
export function getPortfolioMetricsKey(scope: PortfolioScope) {
  return ["portfolio-metrics", "year" in scope ? scope.year : "all"] as const;
}

export function usePortfolioMetrics(scope: PortfolioScope) {
  return useQuery({
    queryKey: getPortfolioMetricsKey(scope),
    queryFn: async (): Promise<PortfolioMetrics | null> => {
      const { data, error } = await supabase.rpc("get_portfolio_metrics" as never, {
        p_year: "year" in scope ? scope.year : null,
      } as never);
      if (error) throw new Error(error.message);
      const row = (data as PortfolioMetrics[] | null)?.[0] ?? null;
      if (!row) return null;
      return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, key === "scope_year" ? value : Number(value ?? 0)]),
      ) as unknown as PortfolioMetrics;
    },
  });
}

export function usePortfolioYears() {
  return useQuery({
    queryKey: ["portfolio-years"],
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase.rpc("get_portfolio_years" as never);
      if (error) throw new Error(error.message);
      return ((data as { year: number }[] | null) ?? []).map((row) => Number(row.year));
    },
  });
}

/** Soma dos recebimentos efetivos (data real) dentro do mês informado (YYYY-MM). */
export function useReceivedInMonth(month: string) {
  return useQuery({
    queryKey: ["received-in-month", month],
    queryFn: async (): Promise<number> => {
      const start = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const end = new Date(Date.UTC(m === 12 ? y! + 1 : y!, m === 12 ? 0 : m!, 1)).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("investment_receipts")
        .select("total_amount")
        .is("cancelled_at", null)
        .gte("receipt_date", start)
        .lt("receipt_date", end)
        .limit(5000);
      if (error) throw new Error(error.message);
      return (data ?? []).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
    },
    enabled: Boolean(month),
  });
}

export function useOperations() {
  return useQuery({
    queryKey: ["operations"],
    queryFn: async () =>
      unwrap(
        await supabase.from("v_operation_position").select("*").order("reference", { ascending: true }),
      ),
  });
}

export function useOperation(operationId: string) {
  return useQuery({
    queryKey: ["operation", operationId],
    queryFn: async (): Promise<OperationPosition | null> => {
      const { data, error } = await supabase
        .from("v_operation_position")
        .select("*")
        .eq("operation_id", operationId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: Boolean(operationId),
  });
}

export function useInstallments(operationId?: string) {
  return useQuery({
    queryKey: ["installments", operationId ?? "all"],
    queryFn: async () => {
      let query = supabase.from("v_installments").select("*").order("due_date", { ascending: true });
      if (operationId) query = query.eq("operation_id", operationId);
      return unwrap(await query.limit(5000));
    },
  });
}

export function useMonthlyFlow() {
  return useQuery({
    queryKey: ["monthly-flow"],
    queryFn: async () =>
      unwrap(await supabase.from("v_monthly_flow").select("*").order("competence", { ascending: true })),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      unwrap(await supabase.from("investment_categories").select("*").order("name")),
  });
}

export function useReferences(options?: { activeOnly?: boolean; year?: number }) {
  return useQuery({
    queryKey: ["references", options],
    queryFn: async () => {
      let query = supabase.from("investment_references").select(`
        *, 
        investment_categories(name), 
        operations_count:investment_operations(count),
        memberships:portfolio_memberships(portfolio_year)
      `);
      if (options?.activeOnly) query = query.eq("active", true).is("archived_at", null);
      if (options?.year) {
        // Filtro via subquery ou post-process se necessário, mas o join já traz
      }
      return unwrap(await query.order("name"));
    },
  });
}

export function usePortfolioMemberships(year: number) {
  return useQuery({
    queryKey: ["portfolio-memberships", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_portfolio_memberships" as any)
        .select("*")
        .eq("portfolio_year", year);
      if (error) throw new Error(error.message);
      return (data as any[]) ?? [];
    },
  });
}

export function useUpdatePortfolioMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      operationId, 
      year, 
      isActive 
    }: { 
      operationId: string; 
      year: number; 
      isActive: boolean 
    }) => {
      const { error } = await supabase
        .from("portfolio_memberships" as any)
        .upsert(
          { operation_id: operationId, portfolio_year: year, is_active: isActive },
          { onConflict: "operation_id,portfolio_year" }
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["operations"] });
    },
  });
}


export function useCreateReference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; category_id?: string | null; description?: string | null }) => {
      const { data, error } = await supabase
        .from("investment_references")
        .insert({ ...input, source: "SISTEMA" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references"] });
    },
  });
}

export function useReceipts() {
  return useQuery({
    queryKey: ["receipts"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("investment_receipts")
          .select("*, investment_operations(reference)")
          .is("cancelled_at", null)
          .order("receipt_date", { ascending: false })
          .limit(500),
      ),
  });
}

export function useContributions() {
  return useQuery({
    queryKey: ["contributions"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("investment_contributions")
          .select("*, investment_operations(reference)")
          .is("cancelled_at", null)
          .order("contribution_date", { ascending: false })
          .limit(500),
      ),
  });
}

export function useImports() {
  return useQuery({
    queryKey: ["imports"],
    queryFn: async () =>
      unwrap(
        await supabase.from("investment_imports").select("*").order("created_at", { ascending: false }).limit(20),
      ),
  });
}

export function useImportIssues() {
  return useQuery({
    queryKey: ["import-issues"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("investment_import_issues")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000),
      ),
  });
}

export function useAuditLog() {
  return useQuery({
    queryKey: ["audit-log"],
    queryFn: async () =>
      unwrap(
        await supabase.from("investment_audit_log").select("*").order("created_at", { ascending: false }).limit(200),
      ),
  });
}

export function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [
      "portfolio-summary",
      "portfolio-metrics",
      "received-in-month",
      "operations",
      "operation",
      "installments",
      "monthly-flow",
      "receipts",
      "contributions",
      "imports",
      "import-issues",
      "audit-log",
      "references",
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

export interface OperationInput {
  reference_id: string;
  due_day: number | null;
  initial_capital: number;
  investment_date: string | null;
  first_due_date: string | null;
  installment_count: number | null;
  installment_value: number | null;
  description: string | null;
  notes: string | null;
}

export function useCreateOperation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: OperationInput) => {
      const { data, error } = await supabase
        .from("investment_operations")
        .insert({ ...input, reference: "", source: "SISTEMA", import_status: "VALIDADO" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (input.first_due_date && input.installment_count && input.installment_value) {
        const { error: rpcError } = await supabase.rpc("generate_schedule", { p_operation_id: data.id });
        if (rpcError) throw new Error(rpcError.message);
      }
      return data.id;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateOperation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<OperationInput> }) => {
      const { error } = await supabase.from("investment_operations").update(input).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useGenerateSchedule() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (operationId: string) => {
      const { data, error } = await supabase.rpc("generate_schedule", { p_operation_id: operationId });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useRegisterReceipt() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (payload: {
      operationId: string;
      receiptDate: string;
      notes: string | null;
      allocations: { installment_id: string; amount: number }[];
    }) => {
      const { data, error } = await supabase.rpc("register_receipt", {
        p_operation_id: payload.operationId,
        p_receipt_date: payload.receiptDate,
        p_allocations: payload.allocations,
        ...(payload.notes ? { p_notes: payload.notes } : {}),
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useCancelReceipt() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (receiptId: string) => {
      const { error } = await supabase.rpc("cancel_receipt", { p_receipt_id: receiptId });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateReceipt() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (payload: {
      receiptId: string;
      receiptDate: string;
      notes: string | null;
      allocations: { installment_id: string; amount: number }[];
    }) => {
      const { error } = await supabase.rpc("update_receipt" as any, {
        p_receipt_id: payload.receiptId,
        p_receipt_date: payload.receiptDate,
        p_notes: payload.notes,
        p_allocations: payload.allocations,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useCreateContribution() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (payload: {
      operation_id: string;
      contribution_date: string;
      type: string;
      amount: number;
      notes: string | null;
    }) => {
      const { error } = await supabase.from("investment_contributions").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateContribution() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: any }) => {
      const { error } = await supabase.from("investment_contributions").update(input).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useResolveIssue() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("investment_import_issues")
        .update({ status, resolved_at: status === "PENDENTE" ? null : new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

/* ------------------------------------------------------------------ */
/* Aluguéis (imóveis próprios) — patrimônio, nunca somado a investimentos */
/* ------------------------------------------------------------------ */

export interface RentalProperty {
  id: string;
  name: string;
  tenant_name: string | null;
  due_day: number | null;
  current_rent: number;
  contract_start: string | null;
  contract_end: string | null;
  next_adjustment_date: string | null;
  status: string;
  notes: string | null;
  received_year?: number;
  receivable_year?: number;
}

export function useRentalProperties() {
  return useQuery({
    queryKey: ["rental-properties"],
    queryFn: async (): Promise<RentalProperty[]> => {
      const { data, error } = await supabase
        .from("v_rental_position" as never)
        .select("*")
        .order("name");
      if (error) throw new Error(error.message);
      return ((data as unknown as RentalProperty[]) ?? []).map((row) => ({
        ...row,
        current_rent: Number(row.current_rent ?? 0),
        received_year: Number(row.received_year ?? 0),
        receivable_year: Number(row.receivable_year ?? 0),
      }));
    },
  });
}

export function useSaveRentalProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RentalProperty> & { name: string }) => {
      const payload = { ...input };
      const { error } = input.id
        ? await supabase.from("rental_properties" as never).update(payload as never).eq("id", input.id)
        : await supabase.from("rental_properties" as never).insert(payload as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rental-properties"] });
      queryClient.invalidateQueries({ queryKey: ["rental-receipts"] });
    },
  });
}

export function useRentalReceipts(propertyId?: string) {
  return useQuery({
    queryKey: ["rental-receipts", propertyId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("rental_receipts" as never)
        .select("*, rental_properties(name)")
        .is("cancelled_at", null)
        .order("competence", { ascending: false });
      if (propertyId) query = query.eq("property_id", propertyId);
      const { data, error } = await query.limit(1000);
      if (error) throw new Error(error.message);
      return (data as unknown as Record<string, unknown>[]) ?? [];
    },
  });
}

export function useRegisterRentalReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      property_id: string;
      competence: string;
      receipt_date: string;
      amount: number;
      notes: string | null;
    }) => {
      const { error } = await supabase.from("rental_receipts" as never).insert(payload as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rental-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["rental-properties"] });
    },
  });
}
