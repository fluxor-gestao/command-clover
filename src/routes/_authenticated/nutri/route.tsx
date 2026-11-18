import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/nutri")({
  beforeLoad: ({ context }) => {
    if (!context.session.has("nutricionista")) throw redirect({ to: "/inicio" });
  },
  component: Outlet,
});
