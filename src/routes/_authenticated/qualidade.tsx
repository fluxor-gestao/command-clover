import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { HomologacaoFinanceira } from "@/components/homolog/HomologacaoFinanceira";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useImportIssues, useResolveIssue } from "@/lib/data/hooks";
import { dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/qualidade")({
  head: () => ({
    meta: [
      { title: "Qualidade da base · Nova Era Investimentos" },
      {
        name: "description",
        content: "Apontamentos de inconsistências das planilhas importadas com controle de tratamento e resolução.",
      },
      { property: "og:title", content: "Qualidade da base · Nova Era Investimentos" },
      { property: "og:description", content: "Inconsistências detectadas na importação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QualityPage,
});

function QualityPage() {
  const issues = useImportIssues();
  const resolve = useResolveIssue();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Qualidade da base</h1>
        <p className="text-sm text-muted-foreground">{issues.data?.length ?? 0} apontamentos registrados.</p>
      </header>

      <Tabs defaultValue="apontamentos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="apontamentos">Apontamentos</TabsTrigger>
          <TabsTrigger value="homologacao">Homologação financeira</TabsTrigger>
        </TabsList>

        <TabsContent value="homologacao">
          <HomologacaoFinanceira />
        </TabsContent>

        <TabsContent value="apontamentos">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apontamentos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(issues.data ?? []).map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell>{issue.issue_type}</TableCell>
                  <TableCell>{issue.reference ?? "—"}</TableCell>
                  <TableCell className="max-w-md text-sm">{issue.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {issue.source_sheet ?? "—"} {issue.source_row ? `· linha ${issue.source_row}` : ""}
                  </TableCell>
                  <TableCell>{dateBR(issue.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={issue.status === "PENDENTE" ? "destructive" : "secondary"}>{issue.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await resolve.mutateAsync({
                            id: issue.id,
                            status: issue.status === "PENDENTE" ? "RESOLVIDO" : "PENDENTE",
                          });
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Falha ao atualizar.");
                        }
                      }}
                    >
                      {issue.status === "PENDENTE" ? "Marcar resolvido" : "Reabrir"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(issues.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">
                    Nenhum apontamento — base consistente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
