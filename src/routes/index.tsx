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
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Área em branco
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pronta para receber seus comandos.
          </p>
        </div>
      </div>
    </main>
  );
}
