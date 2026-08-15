import { supabase } from "@/integrations/supabase/client";
import { addMonthsClamped } from "./contract";

export async function backfillContractDates() {
  console.log("Iniciando backfill de datas contratuais...");
  
  const { data: ops, error } = await supabase
    .from("investment_operations")
    .select("id, reference, first_due_date, installment_count, last_due_date, due_day");

  if (error) {
    console.error("Erro ao buscar operações:", error.message);
    return;
  }

  console.log(`Encontradas ${ops?.length ?? 0} operações sem data final.`);
  
  let filledCount = 0;
  
  for (const op of (ops ?? [])) {
    let firstDate = op.first_due_date;
    
    // Se não tem data inicial na operação, tenta pegar da primeira parcela
    if (!firstDate) {
      const { data: firstInst } = await supabase
        .from("investment_installments")
        .select("due_date")
        .eq("operation_id", op.id)
        .order("due_date", { ascending: true })
        .limit(1)
        .single();
        
      if (firstInst) {
        firstDate = firstInst.due_date;
        // Aproveita para atualizar a first_due_date também
        await supabase
          .from("investment_operations")
          .update({ first_due_date: firstDate })
          .eq("id", op.id);
      }
    }

    if (firstDate && op.installment_count && op.installment_count > 0) {
      const lastDate = addMonthsClamped(firstDate, op.installment_count - 1, op.due_day);
      
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
