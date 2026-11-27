import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowDownToLine,
  Building2,
  CheckCircle2,
  KeyRound,
  Plug,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, ROLE_LABEL, ROLE_ORDER, useAuth, type AppRole } from "@/lib/auth";
import { courseCoverUrl } from "@/lib/course-image";
import { downloadExcelXls, logAudit } from "@/lib/export";
import {
  ALL_PERMISSION_ACTIONS,
  ALL_PERMISSION_MODULES,
  createDefaultRolePermissions,
  paginateRows,
} from "@/lib/owner/logic";
import type {
  AcademySettingsRow,
  AccountPreferences,
  IntegrationConfig,
  PermissionAction,
  PermissionModule,
  RolePermissionMatrix,
  SystemSettings,
} from "@/lib/owner/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, PageHeader, Pager, Panel } from "@/components/dashboard/ui";
import type { OwnerDataHandle } from "./useOwnerData";

/* ========================================================================== */
/* 6.0 USER ROLES                                                             */
/* ========================================================================== */

const ROLE_DESCRIPTIONS: Record<AppRole, { level: string; scope: string }> = {
  owner: {
    level: "Full System Authority",
    scope: "Unrestricted access across academy settings, permissions, financials, users, and audit controls.",
  },
  admin: {
    level: "Operations Administrator",
    scope: "Manages day-to-day users, academics, enrollments, finance, and communications within Owner-assigned permissions.",
  },
  instructor: {
    level: "Academic Faculty",
    scope: "Manages assigned courses, lessons, student attendance, grades, exams, and course announcements.",
  },
  parent: {
    level: "Guardian Portal",
    scope: "Monitors linked children's attendance, grades, report cards, tuition balances, and messages.",
  },
  student: {
    level: "Learner Portal",
    scope: "Accesses enrolled courses, video lessons, assessments, progress tracking, and payment receipts.",
  },
};

export function UserRolesModule({
  data,
  isOwner,
}: {
  data: OwnerDataHandle;
  isOwner: boolean;
}) {
  const { db, maps, callUserApi, can, mutating } = data;
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const canAssignRoles = isOwner || can("users", "edit");

  const roleCounts = useMemo(() => {
    const counts: Record<AppRole, number> = {
      owner: 0,
      admin: 0,
      instructor: 0,
      parent: 0,
      student: 0,
    };
    for (const r of db.roles) {
      counts[r.role] = (counts[r.role] ?? 0) + 1;
    }
    return counts;
  }, [db.roles]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.profiles.filter((p) => {
      const assigned = maps.rolesByUser.get(p.id) ?? [];
      if (roleFilter !== "all" && !assigned.includes(roleFilter as AppRole)) return false;
      if (!q) return true;
      return `${displayName(p)} ${p.email}`.toLowerCase().includes(q);
    });
  }, [db.profiles, maps.rolesByUser, search, roleFilter]);

  async function changePrimaryRole(userId: string, newRole: AppRole) {
    const target = maps.profilesById.get(userId);
    if (!target) return;
    const current = maps.rolesByUser.get(userId) ?? [];
    if (!isOwner && (current.includes("owner") || newRole === "owner")) {
      toast.error("Only the Academy Owner can assign or modify Owner accounts.");
      return;
    }
    try {
      await callUserApi(
        {
          action: "update",
          user_id: userId,
          first_name: target.first_name || "User",
          last_name: target.last_name || "Account",
          phone: target.phone,
          bio: target.bio,
          status: target.status,
          roles: [newRole],
        },
        `Assigned ${ROLE_LABEL[newRole]} role to ${displayName(target)}`,
      );
    } catch {
      // Error toast displayed by callUserApi.
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Roles"
        description="Inspect platform role access levels and assign roles according to Owner-granted authority."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ROLE_ORDER.map((r) => (
          <div key={r} className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <Badge variant={r === "owner" ? "gold" : "outline"}>{ROLE_LABEL[r]}</Badge>
              <span className="font-display text-xl font-bold tabular-nums">{roleCounts[r]}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-foreground">{ROLE_DESCRIPTIONS[r].level}</p>
            <p className="mt-1 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r].scope}</p>
          </div>
        ))}
      </div>

      <Panel title="Role Assignments">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user name or email…"
              className="pl-9"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Roles</option>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Current Roles</TableHead>
              <TableHead>Access Level</TableHead>
              <TableHead className="text-right">Assign Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.slice(0, 25).map((person) => {
              const assigned = maps.rolesByUser.get(person.id) ?? [];
              const primary = assigned[0] ?? "student";
              const isLocked = !isOwner && assigned.includes("owner");
              return (
                <TableRow key={person.id}>
                  <TableCell>
                    <p className="font-semibold">{displayName(person)}</p>
                    <p className="text-xs text-muted-foreground">{person.email}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {assigned.map((r) => (
                        <Badge key={r} variant={r === "owner" ? "gold" : "outline"}>
                          {ROLE_LABEL[r]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ROLE_DESCRIPTIONS[primary].level}
                  </TableCell>
                  <TableCell className="text-right">
                    {isLocked ? (
                      <Badge variant="muted">Owner protected</Badge>
                    ) : canAssignRoles ? (
                      <select
                        aria-label={`Assign role for ${displayName(person)}`}
                        disabled={mutating}
                        value={primary}
                        onChange={(e) => void changePrimaryRole(person.id, e.target.value as AppRole)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                      >
                        {ROLE_ORDER.filter((r) => isOwner || r !== "owner").map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant="muted">View only</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 6.1 ROLES & PERMISSIONS                                                    */
/* ========================================================================== */

export function RolesPermissionsModule({
  data,
  isOwner,
}: {
  data: OwnerDataHandle;
  isOwner: boolean;
}) {
  const { workspace, mutateWorkspace, can, mutating } = data;
  const [selectedRole, setSelectedRole] = useState<AppRole>("admin");
  const [draft, setDraft] = useState<RolePermissionMatrix | null>(null);

  const matrix = draft ?? workspace?.rolePermissions ?? createDefaultRolePermissions();
  const rolePerms = matrix[selectedRole];
  const canDelegatedEdit = isOwner || can("platform", "edit");
  const isProtectedRole =
    selectedRole === "owner" || (!isOwner && selectedRole === "admin");
  const canEditSelected = canDelegatedEdit && !isProtectedRole;

  function togglePerm(mod: PermissionModule, action: PermissionAction, value: boolean) {
    if (!canEditSelected) return;
    setDraft((prev) => {
      const base = prev ?? structuredClone(matrix);
      return {
        ...base,
        [selectedRole]: {
          ...base[selectedRole],
          [mod]: {
            ...base[selectedRole][mod],
            [action]: value,
          },
        },
      };
    });
  }

  async function saveMatrix() {
    if (!canDelegatedEdit) {
      toast.error("Permission editing requires Owner authority or delegated platform access.");
      return;
    }
    await mutateWorkspace(
      { type: "update_role_permissions", rolePermissions: matrix },
      "Role permissions saved and enforced on backend APIs",
    );
    setDraft(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Roles & Permissions"
        description="View and manage module and action permissions across academy roles. Changes are enforced by backend API guards."
        actions={
          canDelegatedEdit && (
            <div className="flex gap-2">
              {draft && (
                <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
                  Discard
                </Button>
              )}
              <Button
                size="sm"
                variant="emerald"
                disabled={mutating}
                onClick={() => void saveMatrix()}
              >
                <Save className="h-4 w-4" /> Save Permission Matrix
              </Button>
            </div>
          )
        }
      />

      <div className="flex flex-wrap gap-2">
        {ROLE_ORDER.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={selectedRole === r ? "emerald" : "outline"}
            onClick={() => setSelectedRole(r)}
          >
            <ShieldCheck className="h-4 w-4" /> {ROLE_LABEL[r]}
          </Button>
        ))}
      </div>

      <Panel
        title={`${ROLE_LABEL[selectedRole]} Module Permissions`}
        actions={
          selectedRole === "owner" ? (
            <Badge variant="gold">Owner retains full system authority</Badge>
          ) : !canEditSelected ? (
            <Badge variant="muted">Owner authority required</Badge>
          ) : undefined
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              {ALL_PERMISSION_ACTIONS.map((a) => (
                <TableHead key={a} className="text-center capitalize">
                  {a}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ALL_PERMISSION_MODULES.map((mod) => (
              <TableRow key={mod}>
                <TableCell className="font-semibold capitalize">{mod}</TableCell>
                {ALL_PERMISSION_ACTIONS.map((action) => (
                  <TableCell key={action} className="text-center">
                    <input
                      type="checkbox"
                      aria-label={`${ROLE_LABEL[selectedRole]} ${mod} ${action}`}
                      disabled={!canEditSelected}
                      checked={rolePerms?.[mod]?.[action] ?? false}
                      onChange={(e) => togglePerm(mod, action, e.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-emerald-700 disabled:cursor-not-allowed"
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 6.2 SYSTEM SETTINGS                                                        */
/* ========================================================================== */

export function SystemSettingsModule({
  data,
  isOwner,
}: {
  data: OwnerDataHandle;
  isOwner: boolean;
}) {
  const { workspace, mutateWorkspace, mutating } = data;
  const [form, setForm] = useState<SystemSettings | null>(null);
  const current = form ?? workspace?.systemSettings;

  if (!current) return null;

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !isOwner) return;
    await mutateWorkspace(
      { type: "update_system_settings", systemSettings: current },
      "System settings updated",
    );
    setForm(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure platform defaults, security & authentication policy, localization, currency, and notifications."
        actions={!isOwner ? <Badge variant="muted">Owner edit only</Badge> : undefined}
      />

      <form className="grid gap-6 xl:grid-cols-2" onSubmit={(e) => void saveSettings(e)}>
        <Panel title="Platform & Localization">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Platform Display Name
              <Input
                disabled={!isOwner}
                value={current.platformName}
                onChange={(e) => setForm({ ...current, platformName: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Primary Currency
              <select
                disabled={!isOwner}
                value={current.currency}
                onChange={(e) =>
                  setForm({ ...current, currency: e.target.value as SystemSettings["currency"] })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ETB">ETB — Ethiopian Birr</option>
                <option value="USD">USD — US Dollar</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Default Language
              <select
                disabled={!isOwner}
                value={current.language}
                onChange={(e) =>
                  setForm({ ...current, language: e.target.value as SystemSettings["language"] })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="en">English</option>
                <option value="am">Amharic (አማርኛ)</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Academy Timezone
              <Input
                disabled={!isOwner}
                value={current.timezone}
                onChange={(e) => setForm({ ...current, timezone: e.target.value })}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={current.allowPublicRegistration}
                onChange={(e) => setForm({ ...current, allowPublicRegistration: e.target.checked })}
              />
              Allow public student self-registration
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={current.maintenanceMode}
                onChange={(e) => setForm({ ...current, maintenanceMode: e.target.checked })}
              />
              Enable maintenance mode banner
            </label>
          </div>
        </Panel>

        <Panel title="Security, Academic & Email Defaults">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              Min Password Length
              <Input
                type="number"
                min="8"
                max="32"
                disabled={!isOwner}
                value={current.minPasswordLength}
                onChange={(e) =>
                  setForm({ ...current, minPasswordLength: Number(e.target.value) || 8 })
                }
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Session Timeout (minutes)
              <Input
                type="number"
                min="15"
                disabled={!isOwner}
                value={current.sessionTimeoutMinutes}
                onChange={(e) =>
                  setForm({ ...current, sessionTimeoutMinutes: Number(e.target.value) || 60 })
                }
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Default Academic Year
              <select
                disabled={!isOwner}
                value={current.defaultAcademicYearId ?? ""}
                onChange={(e) =>
                  setForm({ ...current, defaultAcademicYearId: e.target.value || null })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">None</option>
                {(workspace?.academicYears ?? []).map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Default Term
              <select
                disabled={!isOwner}
                value={current.defaultTermId ?? ""}
                onChange={(e) => setForm({ ...current, defaultTermId: e.target.value || null })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">None</option>
                {(workspace?.terms ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Email Sender Name
              <Input
                disabled={!isOwner}
                value={current.emailSenderName}
                onChange={(e) => setForm({ ...current, emailSenderName: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Email Sender Address
              <Input
                type="email"
                disabled={!isOwner}
                value={current.emailSenderAddress}
                onChange={(e) => setForm({ ...current, emailSenderAddress: e.target.value })}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={current.enablePaymentAlerts}
                onChange={(e) => setForm({ ...current, enablePaymentAlerts: e.target.checked })}
              />
              Payment alert notifications
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={current.enableAttendanceAlerts}
                onChange={(e) => setForm({ ...current, enableAttendanceAlerts: e.target.checked })}
              />
              Attendance alert notifications
            </label>
          </div>
        </Panel>

        {isOwner && (
          <div className="xl:col-span-2">
            <Button type="submit" variant="emerald" disabled={mutating}>
              <SlidersHorizontal className="h-4 w-4" /> Save System Settings
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

/* ========================================================================== */
/* 6.3 ACADEMY PROFILE                                                        */
/* ========================================================================== */

export function AcademyProfileModule({
  data,
  isOwner,
}: {
  data: OwnerDataHandle;
  isOwner: boolean;
}) {
  const { db, workspace, mutateWorkspace, refreshAll } = data;
  const [draft, setDraft] = useState<Partial<AcademySettingsRow>>({});
  const [extDraft, setExtDraft] = useState(
    workspace?.academyExt ?? { logoUrl: "", smsSenderId: "EZANA", supportHours: "" },
  );
  const [busy, setBusy] = useState(false);

  const settings = db.settings;
  const current = {
    name: settings?.name ?? "Ezana Academy",
    tagline: settings?.tagline ?? "",
    description: settings?.description ?? "",
    email: settings?.email ?? "",
    phone: settings?.phone ?? "",
    address: settings?.address ?? "",
    website: settings?.website ?? "",
    facebook: settings?.facebook ?? "",
    telegram: settings?.telegram ?? "",
    youtube: settings?.youtube ?? "",
    linkedin: settings?.linkedin ?? "",
    payment_instructions: settings?.payment_instructions ?? "",
    ...draft,
  };

  async function saveAcademy(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("academy_settings")
        .update({
          name: current.name,
          tagline: current.tagline,
          description: current.description,
          email: current.email,
          phone: current.phone,
          address: current.address,
          website: current.website || null,
          facebook: current.facebook || null,
          telegram: current.telegram || null,
          youtube: current.youtube || null,
          linkedin: current.linkedin || null,
          payment_instructions: current.payment_instructions,
        })
        .eq("id", 1);
      if (error) throw new Error(error.message);
      await mutateWorkspace({ type: "update_academy_ext", academyExt: extDraft });
      await logAudit("academy_profile_updated", "academy_settings", "1", { name: current.name });
      await refreshAll("Academy profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save academy profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academy Profile"
        description="Manage academy branding, logo, address, contact channels, social links, and payment instructions."
        actions={!isOwner ? <Badge variant="muted">Owner edit only</Badge> : undefined}
      />

      <Panel title="Academy Identity & Branding">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void saveAcademy(e)}>
          <label className="space-y-1 text-sm font-medium">
            Academy Name
            <Input
              disabled={!isOwner}
              value={current.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Tagline
            <Input
              disabled={!isOwner}
              value={current.tagline}
              onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Contact Email
            <Input
              type="email"
              disabled={!isOwner}
              value={current.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Contact Phone
            <Input
              disabled={!isOwner}
              value={current.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium sm:col-span-2">
            Address
            <Input
              disabled={!isOwner}
              value={current.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Website URL
            <Input
              type="url"
              disabled={!isOwner}
              value={current.website ?? ""}
              onChange={(e) => setDraft({ ...draft, website: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Support Hours
            <Input
              disabled={!isOwner}
              value={extDraft.supportHours}
              onChange={(e) => setExtDraft({ ...extDraft, supportHours: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Telegram Link
            <Input
              disabled={!isOwner}
              value={current.telegram ?? ""}
              onChange={(e) => setDraft({ ...draft, telegram: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            YouTube Link
            <Input
              disabled={!isOwner}
              value={current.youtube ?? ""}
              onChange={(e) => setDraft({ ...draft, youtube: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Facebook Link
            <Input
              disabled={!isOwner}
              value={current.facebook ?? ""}
              onChange={(e) => setDraft({ ...draft, facebook: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            LinkedIn Link
            <Input
              disabled={!isOwner}
              value={current.linkedin ?? ""}
              onChange={(e) => setDraft({ ...draft, linkedin: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium sm:col-span-2">
            Academy Logo URL
            <Input
              disabled={!isOwner}
              value={extDraft.logoUrl}
              onChange={(e) => setExtDraft({ ...extDraft, logoUrl: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <label className="space-y-1 text-sm font-medium sm:col-span-2">
            Academy Description
            <Textarea
              rows={3}
              disabled={!isOwner}
              value={current.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium sm:col-span-2">
            Public Payment Instructions
            <Textarea
              rows={2}
              disabled={!isOwner}
              value={current.payment_instructions}
              onChange={(e) => setDraft({ ...draft, payment_instructions: e.target.value })}
            />
          </label>
          {isOwner && (
            <div className="sm:col-span-2">
              <Button type="submit" variant="emerald" disabled={busy}>
                <Building2 className="h-4 w-4" /> Save Academy Profile
              </Button>
            </div>
          )}
        </form>
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 6.4 INTEGRATIONS                                                           */
/* ========================================================================== */

export function IntegrationsModule({ data, isOwner }: { data: OwnerDataHandle; isOwner: boolean }) {
  const { workspace, mutateWorkspace, mutating } = data;
  const integrations = workspace?.integrations ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Configure payment gateways, email delivery, YouTube Data API, and live conferencing. Keys are masked and never exposed to browsers."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((cfg) => (
          <IntegrationCard
            key={cfg.id}
            cfg={cfg}
            isOwner={isOwner}
            busy={mutating}
            onSave={(payload) =>
              void mutateWorkspace(
                { type: "update_integration", payload },
                payload.testConnection
                  ? `${cfg.name} connection verified`
                  : `${cfg.name} settings saved`,
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function IntegrationCard({
  cfg,
  isOwner,
  busy,
  onSave,
}: {
  cfg: IntegrationConfig;
  isOwner: boolean;
  busy: boolean;
  onSave: (payload: {
    id: IntegrationConfig["id"];
    enabled: boolean;
    mode: "live" | "sandbox";
    endpointOrHost: string;
    accountOrSender: string;
    statusText: string;
    newSecret?: string;
    testConnection?: boolean;
  }) => void;
}) {
  const [enabled, setEnabled] = useState(cfg.enabled);
  const [mode, setMode] = useState<"live" | "sandbox">(cfg.mode);
  const [endpoint, setEndpoint] = useState(cfg.endpointOrHost);
  const [account, setAccount] = useState(cfg.accountOrSender);
  const [newSecret, setNewSecret] = useState("");

  return (
    <Panel
      title={cfg.name}
      actions={
        <Badge variant={enabled ? "success" : "muted"}>
          {enabled ? `Enabled (${mode})` : "Disabled"}
        </Badge>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">{cfg.category} integration</span>
          <span>
            Env Secret:{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">{cfg.envVarName}</code>
          </span>
        </div>
        <label className="block space-y-1 text-xs font-medium">
          Endpoint / Host
          <Input
            disabled={!isOwner}
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-xs font-medium">
          Account / Sender / Channel
          <Input disabled={!isOwner} value={account} onChange={(e) => setAccount(e.target.value)} />
        </label>
        <label className="block space-y-1 text-xs font-medium">
          API Secret / Credential {cfg.hasSecret ? `(Configured: ${cfg.secretMask})` : "(Not set)"}
          <Input
            type="password"
            disabled={!isOwner}
            value={newSecret}
            onChange={(e) => setNewSecret(e.target.value)}
            placeholder="Enter new key to rotate masked hint (prefer Settings > Secrets)"
          />
        </label>
        <div className="flex items-center justify-between gap-2 pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              disabled={!isOwner}
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Integration enabled
          </label>
          <select
            disabled={!isOwner}
            value={mode}
            onChange={(e) => setMode(e.target.value as "live" | "sandbox")}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="live">Live</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          {cfg.statusText}
          {cfg.lastTestedAt ? ` · Last tested ${new Date(cfg.lastTestedAt).toLocaleString()}` : ""}
        </p>
        {isOwner && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="emerald"
              disabled={busy}
              onClick={() => {
                onSave({
                  id: cfg.id,
                  enabled,
                  mode,
                  endpointOrHost: endpoint,
                  accountOrSender: account,
                  statusText: cfg.statusText,
                  ...(newSecret ? { newSecret } : {}),
                });
                setNewSecret("");
              }}
            >
              <Plug className="h-3.5 w-3.5" /> Save Config
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                onSave({
                  id: cfg.id,
                  enabled,
                  mode,
                  endpointOrHost: endpoint,
                  accountOrSender: account,
                  statusText: cfg.statusText,
                  testConnection: true,
                })
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Verify Status
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ========================================================================== */
/* 6.5 AUDIT LOGS                                                             */
/* ========================================================================== */

export function AuditLogsModule({ data }: { data: OwnerDataHandle }) {
  const { db, maps, can } = data;
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [page, setPage] = useState(1);

  const entities = useMemo(() => [...new Set(db.audit.map((a) => a.entity))], [db.audit]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.audit.filter((a) => {
      if (actorFilter !== "all" && a.actor_id !== actorFilter) return false;
      if (entityFilter !== "all" && a.entity !== entityFilter) return false;
      if (dateFrom && a.created_at.slice(0, 10) < dateFrom) return false;
      if (!q) return true;
      const actor = a.actor_id ? maps.profilesById.get(a.actor_id) : undefined;
      return `${a.action} ${a.entity} ${JSON.stringify(a.details ?? {})} ${actor ? displayName(actor) : ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [db.audit, maps.profilesById, search, actorFilter, entityFilter, dateFrom]);

  const paged = paginateRows(filtered, page, 15);

  function exportLogs() {
    if (!filtered.length) {
      toast.error("No audit records to export.");
      return;
    }
    downloadExcelXls(
      "ezana-audit-logs.xls",
      "AuditLogs",
      filtered.map((a) => ({
        Timestamp: a.created_at,
        Actor:
          a.actor_id && maps.profilesById.get(a.actor_id)
            ? displayName(maps.profilesById.get(a.actor_id)!)
            : "System",
        Action: a.action,
        Entity: a.entity,
        EntityId: a.entity_id ?? "",
        Details: JSON.stringify(a.details ?? {}),
      })),
      "Ezana Academy — Security & Activity Audit Logs",
    );
    toast.success("Audit logs exported");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Complete chronological trail of role changes, user edits, financial actions, and system updates."
        actions={
          can("audit", "export") ? (
            <Button size="sm" variant="outline" onClick={exportLogs}>
              <ArrowDownToLine className="h-4 w-4" /> Export Excel
            </Button>
          ) : undefined
        }
      />

      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search action or details…"
              className="pl-9"
            />
          </div>
          <select
            value={actorFilter}
            onChange={(e) => {
              setActorFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Users</option>
            {db.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {displayName(p)}
              </option>
            ))}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Entities</option>
            {entities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {paged.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action & Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((item) => {
                  const actor = item.actor_id ? maps.profilesById.get(item.actor_id) : undefined;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {actor ? displayName(actor) : "System"}
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold capitalize">
                          {item.action.replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.entity}
                          {item.entity_id ? ` · #${item.entity_id.slice(0, 8)}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                        {item.details ? JSON.stringify(item.details) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pager page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title="No audit events match"
            text="Administrative and payment actions automatically record here."
            icon={Activity}
          />
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 7.1 MY PROFILE                                                             */
/* ========================================================================== */

export function MyProfileModule() {
  const { profile, refresh } = useAuth();
  const [form, setForm] = useState({
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    phone: profile?.phone ?? "",
    avatar_url: profile?.avatar_url ?? "",
    bio: profile?.bio ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function uploadPhoto(file: File) {
    if (!profile) return;
    setBusy(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `avatars/${profile.id}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage
        .from("course-covers")
        .upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      setForm((f) => ({ ...f, avatar_url: courseCoverUrl(path) }));
      toast.success("Profile photo uploaded — click Save Profile to apply");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
        bio: form.bio.trim() || null,
      })
      .eq("id", profile.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success("Your profile has been updated");
  }

  if (!profile) return <EmptyState title="Profile unavailable" icon={UserRound} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Manage your personal identity, photo, contact details, and bio."
      />
      <Panel title="Personal Details">
        <form className="grid max-w-2xl gap-4 sm:grid-cols-2" onSubmit={(e) => void saveProfile(e)}>
          <label className="space-y-1 text-sm font-medium">
            First Name
            <Input
              required
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Last Name
            <Input
              required
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Email Address
            <Input value={profile.email} disabled />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Phone Number
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Profile Photo</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadPhoto(file);
              }}
            />
            <Input
              value={form.avatar_url}
              onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))}
              placeholder="Photo URL (optional)"
            />
          </div>
          <label className="space-y-1 text-sm font-medium sm:col-span-2">
            Bio
            <Textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" variant="emerald" disabled={busy}>
              Save Profile
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 7.2 ACCOUNT SETTINGS                                                       */
/* ========================================================================== */

export function AccountSettingsModule({ data }: { data: OwnerDataHandle }) {
  const { user } = useAuth();
  const { workspace, mutateWorkspace, mutating } = data;
  const saved: AccountPreferences = (user && workspace?.accountPrefsByUser[user.id]) || {
    language: "en",
    timezone: workspace?.systemSettings.timezone ?? "Africa/Addis_Ababa",
    emailNotifications: true,
    inAppNotifications: true,
    paymentReviewDigest: true,
    weeklyExecutiveSummary: true,
  };
  const [prefs, setPrefs] = useState<AccountPreferences | null>(null);
  const current = prefs ?? saved;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Settings"
        description="Customize your personal language, timezone, and executive notification preferences."
      />
      <Panel title="Personal Preferences">
        <form
          className="max-w-xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void mutateWorkspace(
              { type: "update_account_prefs", prefs: current },
              "Account preferences saved",
            ).then(() => setPrefs(null));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              Preferred Language
              <select
                value={current.language}
                onChange={(e) => setPrefs({ ...current, language: e.target.value as "en" | "am" })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="en">English</option>
                <option value="am">Amharic (አማርኛ)</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Personal Timezone
              <Input
                value={current.timezone}
                onChange={(e) => setPrefs({ ...current, timezone: e.target.value })}
              />
            </label>
          </div>
          <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={current.inAppNotifications}
                onChange={(e) => setPrefs({ ...current, inAppNotifications: e.target.checked })}
              />
              Show in-app executive notifications
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={current.emailNotifications}
                onChange={(e) => setPrefs({ ...current, emailNotifications: e.target.checked })}
              />
              Receive email notifications for support tickets
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={current.paymentReviewDigest}
                onChange={(e) => setPrefs({ ...current, paymentReviewDigest: e.target.checked })}
              />
              Alert me when new payment receipts arrive
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={current.weeklyExecutiveSummary}
                onChange={(e) => setPrefs({ ...current, weeklyExecutiveSummary: e.target.checked })}
              />
              Weekly academy revenue & attendance summary
            </label>
          </div>
          <Button type="submit" variant="emerald" disabled={mutating}>
            <Settings className="h-4 w-4" /> Save Preferences
          </Button>
        </form>
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 7.3 CHANGE PASSWORD                                                        */
/* ========================================================================== */

export function ChangePasswordModule() {
  const { profile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const strengthScore =
    (nextPassword.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(nextPassword) ? 1 : 0) +
    (/\d/.test(nextPassword) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(nextPassword) ? 1 : 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Enter your current password.");
      return;
    }
    if (nextPassword.length < 8 || !/[A-Za-z]/.test(nextPassword) || !/\d/.test(nextPassword)) {
      toast.error("New password must be at least 8 characters and include a letter and number.");
      return;
    }
    if (nextPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setBusy(true);
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: profile?.email ?? "",
      password: currentPassword,
    });
    if (verifyErr) {
      setBusy(false);
      toast.error("Current password is incorrect.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: nextPassword });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("password_changed", "auth", profile?.id, {});
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    toast.success("Password updated successfully");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Change Password"
        description="Verify your current sign-in credentials and set a strong replacement password."
      />
      <Panel title="Update Sign-In Password">
        <form className="max-w-md space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <label className="block space-y-1 text-sm font-medium">
            Current Password
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            New Password
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={nextPassword}
              onChange={(e) => setNextPassword(e.target.value)}
            />
          </label>
          {nextPassword && (
            <div className="space-y-1 text-xs">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 flex-1 rounded-full ${
                      strengthScore >= step ? "bg-emerald-600" : "bg-secondary"
                    }`}
                  />
                ))}
              </div>
              <p className="text-muted-foreground">
                Strength:{" "}
                {strengthScore <= 1
                  ? "Weak"
                  : strengthScore === 2
                    ? "Fair"
                    : strengthScore === 3
                      ? "Strong"
                      : "Very Strong"}
              </p>
            </div>
          )}
          <label className="block space-y-1 text-sm font-medium">
            Confirm New Password
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          <Button type="submit" variant="emerald" disabled={busy}>
            <KeyRound className="h-4 w-4" /> Update Password
          </Button>
        </form>
      </Panel>
    </div>
  );
}
