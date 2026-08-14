import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fluxor · Área de trabalho em branco" },
      {
        name: "description",
        content:
          "Área em branco da Diretoria CA, pronta para receber os próximos comandos e construções.",
      },
      { property: "og:title", content: "Fluxor · Área de trabalho em branco" },
      {
        property: "og:description",
        content: "Espaço limpo pronto para receber comandos e novas construções.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = Route.useNavigate();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Nova Era
          </h1>
          <p className="text-lg text-muted-foreground">
            Sistema de Gestão de Investimentos
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Acessar Sistema
          </button>
        </div>
      </div>
    </main>
  );
}
