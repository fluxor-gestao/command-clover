import { createFileRoute, Navigate } from "@tanstack/react-router";

const TITLE = "Nova Era · Gestão de Investimentos";
const DESCRIPTION =
  "Sistema de gestão e controle de investimentos da Imobiliária Nova Era.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://novaerainvestimentos.fluxorbi.com/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://novaerainvestimentos.fluxorbi.com/" }],
  }),
  component: () => <Navigate to="/auth" replace />,
});
