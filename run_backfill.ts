import { backfillContractDates } from "./src/lib/finance/backfill";

async function run() {
  try {
    const result = await backfillContractDates();
    console.log("Resultado do Backfill:", result);
    process.exit(0);
  } catch (err) {
    console.error("Erro fatal no backfill:", err);
    process.exit(1);
  }
}

run();
