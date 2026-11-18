import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Field, Loading, PageHeader, Section, StatusBadge } from "@/components/platform/ui";
import { db, errorText, list, rpc, unwrap } from "@/lib/platform/db";
import { dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cliente/privacidade")({
  component: PrivacidadePage,
});

const KIND: Record<string, string> = {
  acesso: "Acesso aos meus dados",
  correcao: "Correção de dados",
  exclusao: "Exclusão de dados",
};

function PrivacidadePage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const [kind, setKind] = useState("acesso");
  const [details, setDetails] = useState("");
  const q = useQuery({
    queryKey: ["my-privacy"],
    queryFn: () =>
      list<{
        id: string;
        kind: string;
        status: string;
        details: string | null;
        response: string | null;
        created_at: string;
      }>("privacy_requests", (x) => x.order("created_at", { ascending: false })),
  });
  const create = useMutation({
    mutationFn: async () =>
      unwrap(
        await db.from("privacy_requests").insert({ customer_id: session.userId, kind, details }),
      ),
    onSuccess: () => {
      toast.success("Solicitação registrada");
      setDetails("");
      qc.invalidateQueries({ queryKey: ["my-privacy"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const download = useMutation({
    mutationFn: () => rpc<unknown>("export_my_data"),
    onSuccess: (data) => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "meus-dados.json";
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <>
      <PageHeader
        title="Privacidade e dados pessoais"
        description="Seu perfil alimentar é usado só para montar o cardápio e prestar o serviço. Peso, altura e objetivos ficam restritos a você e ao nutricionista; a cozinha vê apenas alergias e restrições ligadas ao preparo."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Baixar meus dados">
          <p className="mb-3 text-sm text-muted-foreground">
            Arquivo com conta, perfil alimentar, planos publicados, assinaturas, pedidos e
            pagamentos.
          </p>
          <Button variant="outline" onClick={() => download.mutate()} disabled={download.isPending}>
            <Download className="mr-2 size-4" /> Baixar agora
          </Button>
        </Section>
        <Section title="Nova solicitação">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Field label="Tipo">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Detalhes"
              hint={
                kind === "exclusao"
                  ? "Pedidos e pagamentos são mantidos de forma anonimizada pelo prazo exigido pela legislação fiscal."
                  : undefined
              }
            >
              <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
            </Field>
            <Button disabled={create.isPending}>Enviar</Button>
          </form>
        </Section>
      </div>
      <Section title="Minhas solicitações" className="mt-6">
        {q.isLoading ? (
          <Loading />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resposta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{dateTimeBR(r.created_at)}</TableCell>
                  <TableCell>{KIND[r.kind]}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.response ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}
