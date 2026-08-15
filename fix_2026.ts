import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("--- VINCULANDO OPERAÇÕES FALTANTES CARTEIRA 2026 ---");
  
  // Buscar referências por nomes comuns na planilha para 2026
  const { data: allOps } = await supabase
    .from("investment_operations")
    .select("id, reference");
  
  const targets = allOps?.filter(o => 
    /Barreto/i.test(o.reference) || 
    /Moto/i.test(o.reference) || 
    /Marcos/i.test(o.reference) || 
    /Ricardo/i.test(o.reference) ||
    /Biz/i.test(o.reference) ||
    /Helton/i.test(o.reference)
  ) || [];

  console.log(`Candidatos encontrados: ${targets.map(t => t.reference).join(', ')}`);

  for (const op of targets) {
    const { error } = await supabase.from("portfolio_memberships").upsert(
      { operation_id: op.id, portfolio_year: 2026, is_active: true },
      { onConflict: "operation_id,portfolio_year" }
    );
    if (!error) console.log(`[OK] ${op.reference} vinculado.`);
  }

  const { count } = await supabase.from("portfolio_memberships")
    .select("*", { count: "exact", head: true })
    .eq("portfolio_year", 2026)
    .eq("is_active", true);

  console.log(`CONTAGEM FINAL CARTEIRA 2026: ${count}`);
}

run();
