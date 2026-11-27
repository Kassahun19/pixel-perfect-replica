import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  applyWorkspaceMutation,
  authorizeOwnerApi,
  getOwnerWorkspaceState,
  recordServerAudit,
  resolvePermissionForMutation,
  type WorkspaceMutationPayload,
} from "@/lib/owner/store.server";

const mutationSchema = z
  .object({
    type: z.string().min(1).max(80),
  })
  .passthrough();

export const Route = createFileRoute("/api/owner/workspace")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authorizeOwnerApi(request, "overview", "view");
        if (!auth.ok) return auth.response;

        const state = getOwnerWorkspaceState();
        return Response.json(state, {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      },
      POST: async ({ request }) => {
        const rawBody = await request.json().catch(() => null);
        const parsed = mutationSchema.safeParse(rawBody);
        if (!parsed.success) {
          return Response.json({ error: "Invalid workspace mutation payload." }, { status: 400 });
        }

        const mutation = parsed.data as unknown as WorkspaceMutationPayload;
        const perm = resolvePermissionForMutation(mutation);
        const auth = await authorizeOwnerApi(request, perm.module, perm.action);
        if (!auth.ok) return auth.response;

        if (
          mutation.type === "update_role_permissions" &&
          !auth.roles.includes("owner") &&
          !auth.roles.includes("admin")
        ) {
          return Response.json(
            { error: "Insufficient role authority to update permissions." },
            { status: 403 },
          );
        }

        try {
          const { state, auditAction, entity, entityId } = applyWorkspaceMutation(
            mutation,
            auth.userId,
            auth.roles,
          );
          await recordServerAudit(auth.supabase, auth.userId, auditAction, entity, entityId, {
            module: perm.module,
          });
          return Response.json({ ok: true, state }, { status: 200 });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Could not save changes." },
            { status: 400 },
          );
        }
      },
    },
  },
});
