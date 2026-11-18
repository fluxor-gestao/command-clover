import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

// Área de operação: só equipe interna. Clientes voltam para a própria área.
export const Route = createFileRoute("/_authenticated/op")({
  beforeLoad: ({ context }) => {
    if (!context.session.isStaff) throw redirect({ to: "/inicio" });
  },
  component: Outlet,
});
