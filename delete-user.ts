import { supabaseAdmin } from "./integrations/supabase/client.server";

async function run() {
  const userId = "b2c4188b-c96e-4690-ad70-3c0a4bb06200";
  console.log(`Tentando excluir usuário: ${userId}`);
  
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  
  if (error) {
    console.error("Erro ao excluir usuário:", error.message);
    process.exit(1);
  } else {
    console.log("Usuário excluído com sucesso.");
    process.exit(0);
  }
}

run();
