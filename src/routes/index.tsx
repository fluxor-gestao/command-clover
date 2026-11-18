import { createFileRoute, Navigate } from "@tanstack/react-router";
import { APP_NAME, APP_TAGLINE } from "@/lib/platform/labels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} · ${APP_TAGLINE}` },
      {
        name: "description",
        content:
          "Kits semanais de refeições fitness com cardápio personalizado pelo seu perfil alimentar.",
      },
      { property: "og:title", content: `${APP_NAME} · ${APP_TAGLINE}` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => <Navigate to="/inicio" replace />,
});
