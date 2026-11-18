import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rpc } from "./db";
import type { Role } from "./labels";

export type Session = {
  userId: string;
  email: string;
  roles: Role[];
  isStaff: boolean;
  has: (...roles: Role[]) => boolean;
};

export async function loadSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  await rpc("ensure_my_customer_records").catch(() => undefined);
  const roles = ((await rpc<Role[]>("my_roles").catch(() => [])) ?? []) as Role[];
  const isAdmin = roles.includes("admin");
  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    roles,
    isStaff: roles.some((r) => r !== "cliente"),
    has: (...wanted: Role[]) => isAdmin || wanted.some((r) => roles.includes(r)),
  };
}

export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: loadSession, staleTime: 60_000 });
}
