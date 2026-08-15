import { supabase } from "@/integrations/supabase/client";
import { addMonthsClamped } from "./contract";

export async function backfillContractDates() {
  console.log("Iniciando backfill de datas contratuais...");
  
  const { data: ops, error } = await supabase
    .from("investment_operations")
    .select("id, reference, first_due_date, installment_count, last_due_date, due_day")
    .is("last_due_date", null);

  if (error) {
    console.error("Erro ao buscar operações:", error.message);
    return;
  }

  console.log(`Encontradas ${ops?.length ?? 0} operações sem data final.`);
  
  let filledCount = 0;
  
  for (const op of (ops ?? [])) {
    if (op.first_due_date && op.installment_count && op.installment_count > 0) {
      const lastDate = addMonthsClamped(op.first_due_date, op.installment_count - 1, op.due_day);
      
      const { error: updateError } = await supabase
        .from("investment_operations")
        .update({ last_due_date: lastDate })
        .eq("id", op.id);
        
      if (!updateError) {
        filledCount++;
      } else {
        console.error(`Erro ao atualizar ${op.reference}:`, updateError.message);
      }
    }
  }

  console.log(`Backfill concluído: ${filledCount} datas preenchidas.`);
  return {
    total: ops?.length ?? 0,
    filled: filledCount,
    remaining: (ops?.length ?? 0) - filledCount
  };
}
