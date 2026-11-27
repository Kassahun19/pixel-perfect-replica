import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  applyScopedParentMutation,
  authorizeParentApi,
  resolveParentMutationPermission,
  resolveParentScope,
  scopeWorkspaceForParent,
} from "@/lib/parent/store.server";
import {
  getOwnerWorkspaceState,
  recordServerAudit,
  type WorkspaceMutationPayload,
} from "@/lib/owner/store.server";

const mutationSchema = z
  .object({
    type: z.string().min(1).max(80),
  })
  .passthrough();

export const Route = createFileRoute("/api/parent/workspace")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authorizeParentApi(request, "overview", "view");
        if (!auth.ok) return auth.response;

        const workspace = getOwnerWorkspaceState();
        const scope = await resolveParentScope(
          auth.supabase,
          auth.userId,
          workspace,
          auth.isMock,
        );
        const scopedState = scopeWorkspaceForParent(workspace, scope);
        return Response.json(scopedState, {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      },
      POST: async ({ request }) => {
        const rawBody = await request.json().catch(() => null);
        const parsed = mutationSchema.safeParse(rawBody);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid parent workspace mutation payload." },
            { status: 400 },
          );
        }

        const mutation = parsed.data as unknown as WorkspaceMutationPayload;
        const perm = resolveParentMutationPermission(mutation);
        const auth = await authorizeParentApi(request, perm.module, perm.action);
        if (!auth.ok) return auth.response;

        try {
          const { scopedState, auditAction, entity, entityId } = await applyScopedParentMutation(
            auth.supabase,
            auth.userId,
            auth.roles,
            mutation,
            auth.isMock,
          );
          await recordServerAudit(auth.supabase, auth.userId, auditAction, entity, entityId, {
            module: perm.module,
            role: "parent",
          });
          return Response.json({ ok: true, state: scopedState }, { status: 200 });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Could not save changes.";
          const status = msg.startsWith("Forbidden:") ? 403 : 400;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
