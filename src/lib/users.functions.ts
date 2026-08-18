import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "moderator", "user"]),
});

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // We use the admin client to check the role to bypass RLS
    // but the userId comes from the verified auth token in context.
    const { data: roleData, error: roleQueryError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleQueryError) {
      console.error("[adminCreateUser] Role check error:", roleQueryError);
      throw new Error(`Database error: ${roleQueryError.message}`);
    }

    if (!roleData) {
      console.error(`[adminCreateUser] Unauthorized access attempt by user ${userId}`);
      throw new Error("Forbidden: Admin role required");
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

    if (createError) {
      throw new Error(`Error creating user: ${createError.message}`);
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: newUser.user.id,
        role: data.role,
      });

    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`Error assigning role: ${roleError.message}`);
    }

    return { id: newUser.user.id, email: newUser.user.email };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    const { data: roleData, error: roleQueryError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleQueryError) {
      console.error("[adminDeleteUser] Role check error:", roleQueryError);
      throw new Error(`Database error: ${roleQueryError.message}`);
    }

    if (!roleData) throw new Error("Forbidden");

    if (userId === data.userId) {
      throw new Error("Cannot delete your own account");
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);

    if (deleteError) {
      throw new Error(`Error deleting user: ${deleteError.message}`);
    }

    return { success: true };
  });

export const adminUpdateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "moderator", "user"]) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    const { data: roleData, error: roleQueryError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleQueryError) {
      console.error("[adminUpdateUserRole] Role check error:", roleQueryError);
      throw new Error(`Database error: ${roleQueryError.message}`);
    }

    if (!roleData) throw new Error("Forbidden");

    const { error: updateError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: data.userId, role: data.role },
        { onConflict: "user_id" }
      );

    if (updateError) {
      throw new Error(`Error updating role: ${updateError.message}`);
    }

    return { success: true };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    // Verify if caller is admin using supabaseAdmin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      throw new Error("Forbidden: Admin role required");
    }

    const { data: users, error: usersError } = await supabaseAdmin.rpc("list_users_with_roles");

    if (usersError) {
      throw new Error(`Database error: ${usersError.message}`);
    }

    return users as any[];
  });
