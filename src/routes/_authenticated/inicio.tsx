import { createFileRoute, redirect } from "@tanstack/react-router";
import { Empty } from "@/components/platform/ui";

// Encaminha cada perfil para a sua área inicial.
export const Route = createFileRoute("/_authenticated/inicio")({
  beforeLoad: ({ context }) => {
    const s = context.session;
    if (s.has("operacao", "cozinha", "financeiro")) throw redirect({ to: "/op/painel" });
    if (s.has("nutricionista")) throw redirect({ to: "/nutri/planos" });
    if (s.roles.includes("cliente")) throw redirect({ to: "/cliente/kit" });
  },
  component: () => (
    <Empty title="Sua conta ainda não tem um perfil de acesso">
      Saia e entre de novo. Se continuar assim, fale com o administrador.
    </Empty>
  ),
});
