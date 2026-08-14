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
      return data;
    },
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
      "operations",
      "operation",
      "installments",
      "monthly-flow",
      "receipts",
      "contributions",
      "imports",
      "import-issues",
      "audit-log",
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

export interface OperationInput {
  reference: string;
  category_id: string | null;
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
        .insert({ ...input, source: "SISTEMA", import_status: "VALIDADO" })
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
