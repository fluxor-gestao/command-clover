import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "moderator", "user"]),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .inputValidator((data) => createUserSchema.parse(data))
  .handler(async ({ data }) => {
    // 1. Verify the caller is an admin
    // We use getWebRequest from @tanstack/react-start/server
    const { getWebRequest } = await import("@tanstack/react-start/server");
    const request = (getWebRequest as any)();
    
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized: No session found");
    }

    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (authError || !user) {
      throw new Error("Unauthorized: Invalid session");
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
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
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { getWebRequest } = await import("@tanstack/react-start/server");
    const request = (getWebRequest as any)();

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (!user) throw new Error("Unauthorized");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Forbidden");

    if (user.id === data.userId) {
      throw new Error("Cannot delete your own account");
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);

    if (deleteError) {
      throw new Error(`Error deleting user: ${deleteError.message}`);
    }

    return { success: true };
  });

export const adminUpdateUserRole = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "moderator", "user"]) }).parse(data))
  .handler(async ({ data }) => {
    const { getWebRequest } = await import("@tanstack/react-start/server");
    const request = (getWebRequest as any)();

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (!user) throw new Error("Unauthorized");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

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
