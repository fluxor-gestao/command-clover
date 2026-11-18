import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cliente")({
  beforeLoad: ({ context }) => {
    if (!context.session.roles.includes("cliente")) throw redirect({ to: "/inicio" });
  },
  component: Outlet,
});
