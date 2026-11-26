import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authorizeOwnerApi, recordServerAudit } from "@/lib/owner/store.server";
import type { AppRole } from "@/lib/auth";

const roleEnum = z.enum(["owner", "admin", "instructor", "student", "parent"]);
const statusEnum = z.enum(["active", "inactive", "suspended"]);

const userActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(128),
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(40).optional(),
    role: roleEnum,
    status: statusEnum.default("active"),
  }),
  z.object({
    action: z.literal("update"),
    user_id: z.string().uuid(),
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(40).nullable().optional(),
    bio: z.string().trim().max(1000).nullable().optional(),
    status: statusEnum,
    roles: z.array(roleEnum).min(1),
  }),
  z.object({
    action: z.literal("delete"),
    user_id: z.string().uuid(),
  }),
]);

export const Route = createFileRoute("/api/owner/users")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = userActionSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid user request." },
            { status: 400 },
          );
        }

        const payload = parsed.data;
        const permAction =
          payload.action === "create" ? "create" : payload.action === "delete" ? "delete" : "edit";
        const auth = await authorizeOwnerApi(request, "users", permAction);
        if (!auth.ok) return auth.response;

        const isCallerOwner = auth.roles.includes("owner");
        const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        const supabaseUrl = process.env["SUPABASE_URL"];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (payload.action === "create") {
          if (payload.role === "owner" && !isCallerOwner) {
            return Response.json(
              { error: "Only an Owner can create another Owner account." },
              { status: 403 },
            );
          }

          if (auth.isMock || !serviceKey || !supabaseUrl) {
            if (!auth.isMock && (!serviceKey || !supabaseUrl)) {
              return Response.json(
                {
                  error:
                    "Creating login credentials requires SUPABASE_SERVICE_ROLE_KEY in Settings > Secrets, or ask the user to register via /register.",
                },
                { status: 400 },
              );
            }
            const newId = crypto.randomUUID();
            const { error: profErr } = await auth.supabase.from("profiles").insert({
              id: newId,
              email: payload.email.toLowerCase(),
              first_name: payload.first_name,
              last_name: payload.last_name,
              phone: payload.phone || null,
              status: payload.status,
            });
            if (profErr) return Response.json({ error: profErr.message }, { status: 400 });
            await auth.supabase
              .from("user_roles")
              .insert({ user_id: newId, role: payload.role as AppRole });
            await recordServerAudit(auth.supabase, auth.userId, "user_created", "profile", newId, {
              email: payload.email,
              role: payload.role,
            });
            return Response.json({ ok: true, userId: newId }, { status: 200 });
          }

          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: payload.email.toLowerCase(),
            password: payload.password,
            email_confirm: true,
            user_metadata: {
              first_name: payload.first_name,
              last_name: payload.last_name,
            },
          });
          if (createErr || !created.user) {
            return Response.json(
              { error: createErr?.message ?? "Could not create user account." },
              { status: 400 },
            );
          }
          const uid = created.user.id;
          await supabaseAdmin.from("profiles").upsert({
            id: uid,
            email: payload.email.toLowerCase(),
            first_name: payload.first_name,
            last_name: payload.last_name,
            phone: payload.phone || null,
            status: payload.status,
          });
          await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
          await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: payload.role });
          await recordServerAudit(auth.supabase, auth.userId, "user_created", "profile", uid, {
            email: payload.email,
            role: payload.role,
          });
          return Response.json({ ok: true, userId: uid }, { status: 200 });
        }

        if (payload.action === "update") {
          const client = serviceKey && supabaseUrl ? supabaseAdmin : auth.supabase;
          const { data: currentRoles } = await client
            .from("user_roles")
            .select("id,role")
            .eq("user_id", payload.user_id);
          const hadOwner = (currentRoles ?? []).some((r) => r.role === "owner");
          const wantsOwner = payload.roles.includes("owner");

          if ((hadOwner || wantsOwner) && !isCallerOwner) {
            return Response.json(
              { error: "Only an Owner can assign or modify the Owner role." },
              { status: 403 },
            );
          }
          if (hadOwner && !wantsOwner) {
            const { data: allOwners } = await client
              .from("user_roles")
              .select("user_id")
              .eq("role", "owner");
            if ((allOwners ?? []).length <= 1) {
              return Response.json(
                { error: "The academy must keep at least one Owner account." },
                { status: 400 },
              );
            }
          }

          const { error: profErr } = await client
            .from("profiles")
            .update({
              first_name: payload.first_name,
              last_name: payload.last_name,
              phone: payload.phone ?? null,
              bio: payload.bio ?? null,
              status: payload.status,
            })
            .eq("id", payload.user_id);
          if (profErr) return Response.json({ error: profErr.message }, { status: 400 });

          await client.from("user_roles").delete().eq("user_id", payload.user_id);
          const uniqueRoles = [...new Set(payload.roles)];
          const { error: roleErr } = await client
            .from("user_roles")
            .insert(uniqueRoles.map((role) => ({ user_id: payload.user_id, role })));
          if (roleErr) return Response.json({ error: roleErr.message }, { status: 400 });

          await recordServerAudit(
            auth.supabase,
            auth.userId,
            "user_updated",
            "profile",
            payload.user_id,
            { status: payload.status, roles: uniqueRoles },
          );
          return Response.json({ ok: true }, { status: 200 });
        }

        // delete
        if (payload.user_id === auth.userId) {
          return Response.json(
            { error: "You cannot delete your own active account." },
            { status: 400 },
          );
        }
        const client = serviceKey && supabaseUrl ? supabaseAdmin : auth.supabase;
        const { data: targetRoles } = await client
          .from("user_roles")
          .select("role")
          .eq("user_id", payload.user_id);
        if ((targetRoles ?? []).some((r) => r.role === "owner")) {
          if (!isCallerOwner) {
            return Response.json({ error: "Only an Owner can remove an Owner." }, { status: 403 });
          }
          const { data: owners } = await client
            .from("user_roles")
            .select("user_id")
            .eq("role", "owner");
          if ((owners ?? []).length <= 1) {
            return Response.json(
              { error: "Cannot delete the last remaining Owner account." },
              { status: 400 },
            );
          }
        }

        await client.from("user_roles").delete().eq("user_id", payload.user_id);
        await client.from("profiles").delete().eq("id", payload.user_id);
        if (!auth.isMock && serviceKey && supabaseUrl) {
          await supabaseAdmin.auth.admin.deleteUser(payload.user_id).catch(() => null);
        }
        await recordServerAudit(
          auth.supabase,
          auth.userId,
          "user_deleted",
          "profile",
          payload.user_id,
          {},
        );
        return Response.json({ ok: true }, { status: 200 });
      },
    },
  },
});
