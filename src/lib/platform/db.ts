/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cliente sem a tipagem gerada para as tabelas da plataforma de refeições.
 * Depois que as migrations forem aplicadas e os tipos regenerados
 * (src/integrations/supabase/types.ts), dá para trocar por `supabase` tipado.
 */
export const db = supabase as unknown as SupabaseClient<any, "public", any>;

type PgError = { message: string } | null;

export function cleanMessage(message: string) {
  return message.replace(/^.*?ERROR:\s*/i, "").trim();
}

export function unwrap<T>(res: { data: unknown; error: PgError }): T {
  if (res.error) throw new Error(cleanMessage(res.error.message));
  return res.data as T;
}

export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  return unwrap<T>(await db.rpc(fn, args ?? {}));
}

export async function list<T = any>(
  table: string,
  build?: (q: any) => any,
  columns = "*",
): Promise<T[]> {
  let q: any = db.from(table).select(columns);
  if (build) q = build(q);
  return (unwrap<T[]>(await q) ?? []) as T[];
}

export const errorText = (e: unknown) => (e instanceof Error ? cleanMessage(e.message) : String(e));
