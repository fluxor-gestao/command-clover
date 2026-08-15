import { createClient } from '@supabase/supabase-js';
import { addMonthsClamped } from './src/lib/finance/contract';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("Iniciando script direto de backfill...");
  
  const { data: ops } = await supabase
    .from("investment_operations")
    .select("id, reference, first_due_date, installment_count, last_due_date, due_day, installment_value");

  console.log(`Analisando ${ops?.length ?? 0} operações.`);
  
  for (const op of (ops ?? [])) {
    const { data: installments } = await supabase
      .from("investment_installments")
      .select("due_date, expected_amount")
      .eq("operation_id", op.id)
      .order("due_date", { ascending: true });

    if (installments && installments.length > 0) {
      const firstDate = installments[0].due_date;
      const lastDate = installments[installments.length - 1].due_date;
      const count = installments.length;
      const value = Number(installments[0].expected_amount);
      
      console.log(`Atualizando ${op.reference}: ${firstDate} -> ${lastDate} (${count} parcelas)`);
      
      await supabase
        .from("investment_operations")
        .update({ 
          first_due_date: firstDate,
          last_due_date: lastDate,
          installment_count: count,
          installment_value: value
        })
        .eq("id", op.id);
    }
  }
  console.log("Concluído.");
}

run();
