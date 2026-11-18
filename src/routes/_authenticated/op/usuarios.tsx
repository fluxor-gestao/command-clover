import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Chips, Forbidden, Loading, PageHeader } from "@/components/platform/ui";
import { errorText, rpc } from "@/lib/platform/db";
import { ROLE_LABEL, type Role } from "@/lib/platform/labels";
import { dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/op/usuarios")({ component: UsuariosPage });

type U = {
  user_id: string;
  email: string;
  full_name: string | null;
  roles: Role[];
  created_at: string;
  last_sign_in_at: string | null;
};
const ROLES = (Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

function UsuariosPage() {
  const { session } = Route.useRouteContext();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const q = useQuery({
    queryKey: ["platform-users"],
    enabled: session.roles.includes("admin"),
    queryFn: () => rpc<U[]>("list_platform_users"),
  });
  const set = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: Role[] }) =>
      rpc("set_user_roles", { p_user_id: id, p_roles: roles }),
    onSuccess: () => {
      toast.success("Acessos atualizados");
      qc.invalidateQueries({ queryKey: ["platform-users"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  if (!session.roles.includes("admin")) return <Forbidden />;
  if (q.isLoading || !q.data) return <Loading />;
  const rows = q.data.filter((u) =>
    `${u.email} ${u.full_name ?? ""}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Usuários e acessos"
        description="Cada pessoa vê só o que sua função precisa. A cozinha vê produção e restrições do preparo; peso, altura e objetivos ficam com o cliente e o nutricionista. Novas contas entram como Cliente."
      />
      <Input
        placeholder="Buscar por e-mail ou nome…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 max-w-sm"
      />
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead>Funções</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.user_id}>
                <TableCell>
                  <p className="font-medium">{u.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell className="text-sm">{dateTimeBR(u.last_sign_in_at)}</TableCell>
                <TableCell>
                  <Chips
                    options={ROLES}
                    value={u.roles}
                    onChange={(roles) => set.mutate({ id: u.user_id, roles })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
