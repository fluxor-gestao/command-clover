import { supabase } from "@/integrations/supabase/client";
import { addMonthsClamped } from "./contract";

export async function backfillContractDates() {
  console.log("Iniciando backfill de datas contratuais...");
  
  const { data: ops, error } = await supabase
    .from("investment_operations")
    .select("id, reference, first_due_date, installment_count, last_due_date, due_day, installment_value");

  if (error) {
    console.error("Erro ao buscar operações:", error.message);
    return;
  }

  console.log(`Analisando ${ops?.length ?? 0} operações.`);
  
  let filledCount = 0;
  
  for (const op of (ops ?? [])) {
    let firstDate = op.first_due_date;
    let count = op.installment_count;
    let value = op.installment_value;
    
    // Busca todas as parcelas da operação para reconstruir o contrato
    const { data: installments } = await supabase
      .from("investment_installments")
      .select("due_date, expected_amount")
      .eq("operation_id", op.id)
      .order("due_date", { ascending: true });

    if (installments && installments.length > 0) {
      if (!firstDate && installments[0]) firstDate = installments[0].due_date;
      if (!count) count = installments.length;
      if (!value && installments[0]) value = Number(installments[0].expected_amount);
      
      const lastDateFromInst = installments[installments.length - 1]?.due_date;
      
      const { error: updateError } = await supabase
        .from("investment_operations")
        .update({ 
          first_due_date: firstDate,
          last_due_date: lastDateFromInst,
          installment_count: count,
          installment_value: value
        } as any)
        .eq("id", op.id);
        
      if (!updateError) {
        filledCount++;
      } else {
        console.error(`Erro ao atualizar ${op.reference}:`, updateError.message);
      }
    }
  }

  console.log(`Backfill concluído: ${filledCount} operações atualizadas.`);
  return {
    total: ops?.length ?? 0,
    filled: filledCount,
    remaining: (ops?.length ?? 0) - filledCount
  };
}
