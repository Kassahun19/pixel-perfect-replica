import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  BookOpen,
  Eye,
  GraduationCap,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Unlink,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, ROLE_LABEL, ROLE_ORDER, useAuth, type AppRole } from "@/lib/auth";
import { logAudit } from "@/lib/csv";
import { downloadExcelXls } from "@/lib/export";
import { computeAttendanceStats, computeGradeOutcome, paginateRows } from "@/lib/owner/logic";
import type { ProfileRow } from "@/lib/owner/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  ConfirmButton,
  EmptyState,
  PageHeader,
  Pager,
  Panel,
  STATUS_BADGE,
  StatCard,
} from "@/components/dashboard/ui";
import type { OwnerDataHandle } from "./useOwnerData";

/* ========================================================================== */
/* 3.1 USER MANAGEMENT                                                        */
/* ========================================================================== */

export function UserManagementModule({ data }: { data: OwnerDataHandle }) {
  const { user, roles: callerRoles, isStaff } = useAuth();
  const isCallerOwner = callerRoles.includes("owner");
  const { db, maps, callUserApi, can, mutating } = data;
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    role: "student" as AppRole,
    status: "active" as ProfileRow["status"],
  });

  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    bio: "",
    status: "active" as ProfileRow["status"],
    roles: ["student"] as AppRole[],
  });

  const canCreate = can("users", "create");
  const canEdit = can("users", "edit");
  const canDelete = can("users", "delete");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.profiles.filter((p) => {
      const assigned = maps.rolesByUser.get(p.id) ?? [];
      if (roleFilter !== "all" && !assigned.includes(roleFilter as AppRole)) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return `${p.first_name} ${p.last_name} ${p.email} ${p.phone ?? ""}`.toLowerCase().includes(q);
    });
  }, [db.profiles, maps.rolesByUser, search, roleFilter, statusFilter]);

  const paged = paginateRows(filtered, page, 10);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (createForm.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    await callUserApi(
      {
        action: "create",
        ...createForm,
      },
      `Account created for ${createForm.first_name} ${createForm.last_name}`,
    );
    setCreateOpen(false);
    setCreateForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      role: "student",
      status: "active",
    });
  }

  function openEdit(p: ProfileRow) {
    setEditing(p);
    setEditForm({
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone ?? "",
      bio: p.bio ?? "",
      status: p.status,
      roles: maps.rolesByUser.get(p.id)?.length ? [...maps.rolesByUser.get(p.id)!] : ["student"],
    });
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.roles.length) {
      toast.error("Assign at least one role.");
      return;
    }
    await callUserApi(
      {
        action: "update",
        user_id: editing.id,
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        phone: editForm.phone.trim() || null,
        bio: editForm.bio.trim() || null,
        status: editForm.status,
        roles: editForm.roles,
      },
      "User account updated",
    );
    setEditing(null);
  }

  async function handleQuickStatus(p: ProfileRow, status: ProfileRow["status"]) {
    const roles = maps.rolesByUser.get(p.id) ?? ["student"];
    await callUserApi(
      {
        action: "update",
        user_id: p.id,
        first_name: p.first_name || "User",
        last_name: p.last_name || "Account",
        phone: p.phone,
        bio: p.bio,
        status,
        roles,
      },
      `${displayName(p)} marked ${status}`,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Create, edit, search, filter, assign roles, and activate or suspend academy user accounts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{db.profiles.length} total users</Badge>
            {canCreate && isStaff && (
              <Button variant="emerald" size="sm" onClick={() => setCreateOpen(true)}>
                <UserPlus className="h-4 w-4" /> Create User
              </Button>
            )}
          </div>
        }
      />

      <Panel>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, or phone…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All Roles</option>
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {paged.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((person) => {
                  const assigned = maps.rolesByUser.get(person.id) ?? [];
                  const targetIsOwner = assigned.includes("owner");
                  const rowLocked = targetIsOwner && !isCallerOwner;
                  return (
                    <TableRow key={person.id}>
                      <TableCell>
                        <p className="font-semibold">{displayName(person)}</p>
                        <p className="text-xs text-muted-foreground">
                          {person.email}
                          {person.phone ? ` · ${person.phone}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {assigned.length ? (
                            assigned.map((r) => (
                              <Badge key={r} variant={r === "owner" ? "gold" : "outline"}>
                                {ROLE_LABEL[r]}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="muted">Unassigned</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={STATUS_BADGE[person.status] ?? "muted"}
                          className="capitalize"
                        >
                          {person.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {new Date(person.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {rowLocked ? (
                            <Badge variant="muted">Owner protected</Badge>
                          ) : (
                            <>
                              {canEdit && (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEdit(person)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" /> Edit
                                  </Button>
                                  {person.status === "active" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      disabled={mutating || person.id === user?.id}
                                      onClick={() => void handleQuickStatus(person, "suspended")}
                                    >
                                      Suspend
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      disabled={mutating}
                                      onClick={() => void handleQuickStatus(person, "active")}
                                    >
                                      Activate
                                    </Button>
                                  )}
                                </>
                              )}
                              {canDelete && person.id !== user?.id && (
                                <ConfirmButton
                                  title={`Delete ${displayName(person)}?`}
                                  description="This permanently removes the user account and role access."
                                  confirmLabel="Delete user"
                                  onConfirm={() =>
                                    void callUserApi(
                                      { action: "delete", user_id: person.id },
                                      "User account removed",
                                    )
                                  }
                                  trigger={
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  }
                                />
                              )}
                            </>
                          )}
                        </div>
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
            title="No users found"
            text="Try adjusting the search or role filter."
            icon={Users}
          />
        )}
      </Panel>

      {/* Create User Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Academy User</DialogTitle>
            <DialogDescription>
              Create a verified login account and assign their primary academy role.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void handleCreateUser(e)}>
            <label className="space-y-1 text-sm font-medium">
              First name
              <Input
                required
                value={createForm.first_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Last name
              <Input
                required
                value={createForm.last_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Email address
              <Input
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Phone
              <Input
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+251 9…"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Initial password
              <Input
                type="password"
                required
                minLength={8}
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Role
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as AppRole }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {ROLE_ORDER.filter((r) => isCallerOwner || r !== "owner").map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Account status
              <select
                value={createForm.status}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, status: e.target.value as ProfileRow["status"] }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <DialogFooter className="mt-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={mutating}>
                {mutating ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User Account</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void handleUpdateUser(e)}>
            <label className="space-y-1 text-sm font-medium">
              First name
              <Input
                required
                value={editForm.first_name}
                onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Last name
              <Input
                required
                value={editForm.last_name}
                onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Phone
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Status
              <select
                value={editForm.status}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, status: e.target.value as ProfileRow["status"] }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Assigned Roles</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_ORDER.filter((r) => isCallerOwner || r !== "owner").map((r) => {
                  const checked = editForm.roles.includes(r);
                  return (
                    <label
                      key={r}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setEditForm((f) => ({
                            ...f,
                            roles: e.target.checked
                              ? [...f.roles, r]
                              : f.roles.filter((x) => x !== r),
                          }));
                        }}
                      />
                      {ROLE_LABEL[r]}
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Bio / Notes
              <Textarea
                rows={2}
                value={editForm.bio}
                onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={mutating}>
                {mutating ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 3.2 STUDENT RECORDS                                                        */
/* ========================================================================== */

export function StudentRecordsModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, callUserApi, can, mutating } = data;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    studentCode: "",
    classSectionId: "",
    guardianName: "",
    guardianPhone: "",
  });

  const [inspectStudent, setInspectStudent] = useState<ProfileRow | null>(null);
  const [editStudent, setEditStudent] = useState<ProfileRow | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    status: "active" as ProfileRow["status"],
    studentCode: "",
    classSectionId: "",
    academicYearId: "",
    guardianName: "",
    guardianPhone: "",
    address: "",
    dateOfBirth: "",
    notes: "",
  });

  const students = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.profiles
      .filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("student"))
      .filter((p) => {
        const meta = workspace?.studentMeta[p.id];
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (classFilter !== "all" && meta?.classSectionId !== classFilter) return false;
        if (!q) return true;
        return `${p.first_name} ${p.last_name} ${p.email} ${meta?.studentCode ?? ""} ${meta?.guardianName ?? ""}`
          .toLowerCase()
          .includes(q);
      });
  }, [db.profiles, maps.rolesByUser, workspace?.studentMeta, search, statusFilter, classFilter]);

  const paged = paginateRows(students, page, 10);
  const defaultScale =
    workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];

  function openEdit(p: ProfileRow) {
    const meta = workspace?.studentMeta[p.id];
    setEditStudent(p);
    setEditForm({
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone ?? "",
      status: p.status,
      studentCode: meta?.studentCode ?? `STU-${p.id.slice(0, 6).toUpperCase()}`,
      classSectionId: meta?.classSectionId ?? "",
      academicYearId:
        meta?.academicYearId ?? workspace?.academicYears.find((y) => y.isCurrent)?.id ?? "",
      guardianName: meta?.guardianName ?? "",
      guardianPhone: meta?.guardianPhone ?? "",
      address: meta?.address ?? "",
      dateOfBirth: meta?.dateOfBirth ?? "",
      notes: meta?.notes ?? "",
    });
  }

  async function saveStudentRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!editStudent) return;
    await callUserApi({
      action: "update",
      user_id: editStudent.id,
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim(),
      phone: editForm.phone.trim() || null,
      bio: editStudent.bio,
      status: editForm.status,
      roles: maps.rolesByUser.get(editStudent.id) ?? ["student"],
    });
    await mutateWorkspace(
      {
        type: "upsert_student_meta",
        payload: {
          userId: editStudent.id,
          studentCode:
            editForm.studentCode.trim() || `STU-${editStudent.id.slice(0, 6).toUpperCase()}`,
          classSectionId: editForm.classSectionId || null,
          academicYearId: editForm.academicYearId || null,
          guardianName: editForm.guardianName.trim(),
          guardianPhone: editForm.guardianPhone.trim(),
          address: editForm.address.trim(),
          dateOfBirth: editForm.dateOfBirth,
          notes: editForm.notes.trim(),
        },
      },
      "Student record saved",
    );
    setEditStudent(null);
  }

  async function handleRegisterStudent(e: React.FormEvent) {
    e.preventDefault();
    const res = (await callUserApi(
      {
        action: "create",
        first_name: newStudent.first_name,
        last_name: newStudent.last_name,
        email: newStudent.email,
        phone: newStudent.phone,
        password: newStudent.password,
        role: "student",
        status: "active",
      },
      "Student registered",
    )) as { userId?: string };

    if (res?.userId) {
      await mutateWorkspace({
        type: "upsert_student_meta",
        payload: {
          userId: res.userId,
          studentCode: newStudent.studentCode || `STU-${res.userId.slice(0, 6).toUpperCase()}`,
          classSectionId: newStudent.classSectionId || null,
          academicYearId: workspace?.academicYears.find((y) => y.isCurrent)?.id ?? null,
          guardianName: newStudent.guardianName,
          guardianPhone: newStudent.guardianPhone,
          address: "",
          dateOfBirth: "",
          notes: "",
        },
      });
    }
    setRegisterOpen(false);
  }

  function exportStudents() {
    if (!students.length) {
      toast.error("No student records to export.");
      return;
    }
    downloadExcelXls(
      "ezana-student-records.xls",
      "Students",
      students.map((s) => {
        const meta = workspace?.studentMeta[s.id];
        const enrollments = db.enrollments.filter((e) => e.user_id === s.id).length;
        const completed = db.progress.filter((p) => p.user_id === s.id).length;
        return {
          StudentCode: meta?.studentCode ?? `STU-${s.id.slice(0, 6).toUpperCase()}`,
          Name: displayName(s),
          Email: s.email,
          Phone: s.phone ?? "",
          Class: meta?.classSectionId
            ? (maps.classesById.get(meta.classSectionId)?.name ?? "")
            : "",
          Guardian: meta?.guardianName ?? "",
          EnrolledCourses: enrollments,
          LessonsCompleted: completed,
          Status: s.status,
        };
      }),
      "Ezana Academy — Student Records",
    );
    toast.success("Student records exported to Excel");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Records"
        description="Register students, inspect enrollment history and course progress, edit academic details, and export records."
        actions={
          <div className="flex flex-wrap gap-2">
            {can("students", "export") && (
              <Button variant="outline" size="sm" onClick={exportStudents}>
                <ArrowDownToLine className="h-4 w-4" /> Export Excel
              </Button>
            )}
            {can("students", "create") && (
              <Button variant="emerald" size="sm" onClick={() => setRegisterOpen(true)}>
                <UserPlus className="h-4 w-4" /> Register Student
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Students" value={students.length} icon={GraduationCap} index={0} />
        <StatCard
          label="Active Learners"
          value={students.filter((s) => s.status === "active").length}
          icon={UserCheck}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Total Course Enrollments"
          value={db.enrollments.length}
          icon={BookOpen}
          tone="deep"
          index={2}
        />
      </div>

      <Panel>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search student name, ID, email…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All Classes</option>
              {(workspace?.classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {paged.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID / Student</TableHead>
                  <TableHead>Class / Guardian</TableHead>
                  <TableHead>Enrollments & Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((st) => {
                  const meta = workspace?.studentMeta[st.id];
                  const enrolled = db.enrollments.filter((e) => e.user_id === st.id);
                  const completed = db.progress.filter((p) => p.user_id === st.id).length;
                  const attendance = computeAttendanceStats(
                    (workspace?.attendance ?? []).filter((a) => a.personId === st.id),
                  );
                  return (
                    <TableRow key={st.id}>
                      <TableCell>
                        <p className="font-mono text-xs text-muted-foreground">
                          {meta?.studentCode ?? `STU-${st.id.slice(0, 6).toUpperCase()}`}
                        </p>
                        <p className="font-semibold">{displayName(st)}</p>
                        <p className="text-xs text-muted-foreground">{st.email}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p className="font-medium">
                          {meta?.classSectionId
                            ? (maps.classesById.get(meta.classSectionId)?.name ?? "Unassigned")
                            : "Unassigned"}
                        </p>
                        <p className="text-muted-foreground">
                          {meta?.guardianName
                            ? `Guardian: ${meta.guardianName}`
                            : st.phone || "No contact"}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        <p className="font-semibold">
                          {enrolled.length} courses · {completed} lessons done
                        </p>
                        <p className="text-muted-foreground">
                          Attendance:{" "}
                          {attendance.total > 0 ? `${attendance.attendanceRate}%` : "No logs"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[st.status] ?? "muted"} className="capitalize">
                          {st.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setInspectStudent(st)}>
                            <Eye className="h-3.5 w-3.5" /> Record
                          </Button>
                          {can("students", "edit") && (
                            <Button size="sm" variant="outline" onClick={() => openEdit(st)}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                          )}
                        </div>
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
            title="No student records found"
            text="Register a student or assign the Student role to an existing user."
            icon={GraduationCap}
          />
        )}
      </Panel>

      {/* Register Student Modal */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register New Student</DialogTitle>
            <DialogDescription>
              Creates a student login account and academic profile.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => void handleRegisterStudent(e)}
          >
            <label className="space-y-1 text-sm font-medium">
              First name
              <Input
                required
                value={newStudent.first_name}
                onChange={(e) => setNewStudent((s) => ({ ...s, first_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Last name
              <Input
                required
                value={newStudent.last_name}
                onChange={(e) => setNewStudent((s) => ({ ...s, last_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Email
              <Input
                type="email"
                required
                value={newStudent.email}
                onChange={(e) => setNewStudent((s) => ({ ...s, email: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Password
              <Input
                type="password"
                required
                minLength={8}
                value={newStudent.password}
                onChange={(e) => setNewStudent((s) => ({ ...s, password: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Student Code
              <Input
                value={newStudent.studentCode}
                onChange={(e) => setNewStudent((s) => ({ ...s, studentCode: e.target.value }))}
                placeholder="e.g. EZA-2026-001"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Assign Class
              <select
                value={newStudent.classSectionId}
                onChange={(e) => setNewStudent((s) => ({ ...s, classSectionId: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {(workspace?.classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Guardian Name
              <Input
                value={newStudent.guardianName}
                onChange={(e) => setNewStudent((s) => ({ ...s, guardianName: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Guardian Phone
              <Input
                value={newStudent.guardianPhone}
                onChange={(e) => setNewStudent((s) => ({ ...s, guardianPhone: e.target.value }))}
              />
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={mutating}>
                {mutating ? "Saving…" : "Register student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Student Record */}
      <Dialog open={!!editStudent} onOpenChange={(open) => !open && setEditStudent(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student Record</DialogTitle>
            <DialogDescription>{editStudent?.email}</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void saveStudentRecord(e)}>
            <label className="space-y-1 text-sm font-medium">
              First name
              <Input
                required
                value={editForm.first_name}
                onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Last name
              <Input
                required
                value={editForm.last_name}
                onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Student ID Code
              <Input
                value={editForm.studentCode}
                onChange={(e) => setEditForm((f) => ({ ...f, studentCode: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Phone
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Class / Section
              <select
                value={editForm.classSectionId}
                onChange={(e) => setEditForm((f) => ({ ...f, classSectionId: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {(workspace?.classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Academic Year
              <select
                value={editForm.academicYearId}
                onChange={(e) => setEditForm((f) => ({ ...f, academicYearId: e.target.value }))}
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
              Guardian Name
              <Input
                value={editForm.guardianName}
                onChange={(e) => setEditForm((f) => ({ ...f, guardianName: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Guardian Phone
              <Input
                value={editForm.guardianPhone}
                onChange={(e) => setEditForm((f) => ({ ...f, guardianPhone: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Address
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Academic Notes
              <Textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditStudent(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={mutating}>
                Save Student Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inspect Student History Modal */}
      <Dialog open={!!inspectStudent} onOpenChange={(open) => !open && setInspectStudent(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {inspectStudent ? displayName(inspectStudent) : "Student Record"}
            </DialogTitle>
            <DialogDescription>
              Enrollment history, course progress, attendance, and assessment results.
            </DialogDescription>
          </DialogHeader>
          {inspectStudent && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 rounded-xl border border-border bg-secondary/40 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Email & Phone</p>
                  <p className="font-medium">
                    {inspectStudent.email} {inspectStudent.phone ? `· ${inspectStudent.phone}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Guardian Contact</p>
                  <p className="font-medium">
                    {workspace?.studentMeta[inspectStudent.id]?.guardianName || "Not set"}{" "}
                    {workspace?.studentMeta[inspectStudent.id]?.guardianPhone
                      ? `(${workspace.studentMeta[inspectStudent.id]!.guardianPhone})`
                      : ""}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-semibold">Course Enrollments & Progress</h4>
                {db.enrollments.filter((e) => e.user_id === inspectStudent.id).length > 0 ? (
                  <div className="space-y-2">
                    {db.enrollments
                      .filter((e) => e.user_id === inspectStudent.id)
                      .map((e) => {
                        const course = maps.coursesById.get(e.course_id);
                        const total = (maps.lessonsByCourse.get(e.course_id) ?? []).length;
                        const done = db.progress.filter(
                          (p) => p.user_id === inspectStudent.id && p.course_id === e.course_id,
                        ).length;
                        const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
                        return (
                          <div
                            key={e.id}
                            className="flex items-center justify-between rounded-lg border border-border p-3"
                          >
                            <div>
                              <p className="font-medium">{course?.title ?? "Course"}</p>
                              <p className="text-xs text-muted-foreground">
                                Enrolled {e.created_at.slice(0, 10)}
                              </p>
                            </div>
                            <span className="font-semibold tabular-nums">
                              {done}/{total} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No course enrollments recorded yet.</p>
                )}
              </div>

              <div>
                <h4 className="mb-2 font-semibold">Recent Academic Grades</h4>
                {(workspace?.grades ?? []).filter((g) => g.studentId === inspectStudent.id).length >
                0 ? (
                  <div className="space-y-2">
                    {(workspace?.grades ?? [])
                      .filter((g) => g.studentId === inspectStudent.id)
                      .map((g) => {
                        const out = defaultScale
                          ? computeGradeOutcome(g.score, g.maxScore, defaultScale)
                          : { percent: Math.round((g.score / g.maxScore) * 100), letter: "—" };
                        return (
                          <div
                            key={g.id}
                            className="flex items-center justify-between rounded-lg border border-border p-2.5"
                          >
                            <span>
                              {g.assessmentTitle} (
                              {maps.coursesById.get(g.courseId)?.title ?? "Course"})
                            </span>
                            <span className="font-semibold tabular-nums">
                              {g.score}/{g.maxScore} · {out.percent}% ({out.letter})
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No assessment grades recorded yet.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 3.3 INSTRUCTOR MANAGEMENT                                                  */
/* ========================================================================== */

export function InstructorManagementModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, callUserApi, refreshAll, can, mutating } = data;
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newInst, setNewInst] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    qualifications: "",
    experienceYears: "3",
    expertise: "",
  });

  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [editForm, setEditForm] = useState({
    qualifications: "",
    experienceYears: "1",
    expertise: "",
    departmentId: "",
    weeklyHoursLimit: "20",
    scheduleSummary: "",
    hourlyRate: "0",
    status: "active" as ProfileRow["status"],
    assignedCourseIds: [] as string[],
  });

  const instructors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.profiles
      .filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("instructor"))
      .filter((p) => {
        const meta = workspace?.instructorMeta[p.id];
        if (!q) return true;
        return `${p.first_name} ${p.last_name} ${p.email} ${meta?.qualifications ?? ""} ${(meta?.expertise ?? []).join(" ")}`
          .toLowerCase()
          .includes(q);
      });
  }, [db.profiles, maps.rolesByUser, workspace?.instructorMeta, search]);

  function openEdit(inst: ProfileRow) {
    const meta = workspace?.instructorMeta[inst.id];
    const assignedCourses = db.courses.filter((c) => c.instructor_id === inst.id).map((c) => c.id);
    setEditing(inst);
    setEditForm({
      qualifications: meta?.qualifications ?? "",
      experienceYears: String(meta?.experienceYears ?? 1),
      expertise: (meta?.expertise ?? []).join(", "),
      departmentId: meta?.departmentId ?? "",
      weeklyHoursLimit: String(meta?.weeklyHoursLimit ?? 20),
      scheduleSummary: meta?.scheduleSummary ?? "",
      hourlyRate: String(meta?.hourlyRate ?? 0),
      status: inst.status,
      assignedCourseIds: assignedCourses,
    });
  }

  async function handleAddInstructor(e: React.FormEvent) {
    e.preventDefault();
    const res = (await callUserApi(
      {
        action: "create",
        first_name: newInst.first_name,
        last_name: newInst.last_name,
        email: newInst.email,
        phone: newInst.phone,
        password: newInst.password,
        role: "instructor",
        status: "active",
      },
      "Instructor account created",
    )) as { userId?: string };

    if (res?.userId) {
      await mutateWorkspace({
        type: "upsert_instructor_meta",
        payload: {
          userId: res.userId,
          qualifications: newInst.qualifications,
          experienceYears: Number(newInst.experienceYears) || 0,
          expertise: newInst.expertise
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          departmentId: workspace?.departments[0]?.id ?? null,
          weeklyHoursLimit: 20,
          scheduleSummary: "Mon–Fri flexible online/lab hours",
          hourlyRate: 0,
        },
      });
    }
    setAddOpen(false);
  }

  async function saveInstructor(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    await callUserApi({
      action: "update",
      user_id: editing.id,
      first_name: editing.first_name,
      last_name: editing.last_name,
      phone: editing.phone,
      bio: editing.bio,
      status: editForm.status,
      roles: maps.rolesByUser.get(editing.id) ?? ["instructor"],
    });

    // Update course instructor assignments in Supabase
    for (const course of db.courses) {
      const shouldBeAssigned = editForm.assignedCourseIds.includes(course.id);
      if (shouldBeAssigned && course.instructor_id !== editing.id) {
        await supabase.from("courses").update({ instructor_id: editing.id }).eq("id", course.id);
      } else if (!shouldBeAssigned && course.instructor_id === editing.id) {
        await supabase.from("courses").update({ instructor_id: null }).eq("id", course.id);
      }
    }

    await mutateWorkspace(
      {
        type: "upsert_instructor_meta",
        payload: {
          userId: editing.id,
          qualifications: editForm.qualifications.trim(),
          experienceYears: Number(editForm.experienceYears) || 0,
          expertise: editForm.expertise
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          departmentId: editForm.departmentId || null,
          weeklyHoursLimit: Number(editForm.weeklyHoursLimit) || 20,
          scheduleSummary: editForm.scheduleSummary.trim(),
          hourlyRate: Number(editForm.hourlyRate) || 0,
        },
      },
      "Instructor profile and course assignments updated",
    );
    await refreshAll();
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instructor Management"
        description="Manage instructor qualifications, expertise, course & class assignments, schedules, and teaching activity."
        actions={
          can("instructors", "create") ? (
            <Button variant="emerald" size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add Instructor
            </Button>
          ) : undefined
        }
      />

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search instructor, qualification, expertise…"
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{instructors.length} instructors</Badge>
        </div>

        {instructors.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instructor</TableHead>
                <TableHead>Qualifications & Expertise</TableHead>
                <TableHead>Assigned Courses & Classes</TableHead>
                <TableHead>Teaching Performance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructors.map((inst) => {
                const meta = workspace?.instructorMeta[inst.id];
                const courses = db.courses.filter((c) => c.instructor_id === inst.id);
                const courseIds = new Set(courses.map((c) => c.id));
                const learnerCount = new Set(
                  db.enrollments.filter((e) => courseIds.has(e.course_id)).map((e) => e.user_id),
                ).size;
                const classes = (workspace?.classes ?? []).filter(
                  (c) => c.instructorId === inst.id,
                );
                return (
                  <TableRow key={inst.id}>
                    <TableCell>
                      <p className="font-semibold">{displayName(inst)}</p>
                      <p className="text-xs text-muted-foreground">{inst.email}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p className="font-medium">
                        {meta?.qualifications || "Pending qualification entry"}
                      </p>
                      <p className="text-muted-foreground">
                        {meta?.experienceYears ?? 0} yrs exp ·{" "}
                        {meta?.expertise.length ? meta.expertise.join(", ") : "General"}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p className="font-medium">
                        {courses.length ? courses.map((c) => c.title).join(", ") : "No courses"}
                      </p>
                      <p className="text-muted-foreground">
                        {classes.length
                          ? `Classes: ${classes.map((c) => c.sectionCode).join(", ")}`
                          : meta?.scheduleSummary || "Schedule not set"}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <p className="font-semibold">{learnerCount} learners</p>
                      <p className="text-muted-foreground">
                        {
                          (workspace?.timetables ?? []).filter((t) => t.instructorId === inst.id)
                            .length
                        }{" "}
                        scheduled slots
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[inst.status] ?? "muted"} className="capitalize">
                        {inst.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {can("instructors", "edit") && (
                        <Button size="sm" variant="outline" onClick={() => openEdit(inst)}>
                          <Pencil className="h-3.5 w-3.5" /> Manage
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No instructors found"
            text="Add a new instructor or assign the Instructor role in User Management."
            icon={UserCheck}
          />
        )}
      </Panel>

      {/* Add Instructor Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Instructor</DialogTitle>
            <DialogDescription>
              Create an instructor account and record credentials.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void handleAddInstructor(e)}>
            <label className="space-y-1 text-sm font-medium">
              First name
              <Input
                required
                value={newInst.first_name}
                onChange={(e) => setNewInst((i) => ({ ...i, first_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Last name
              <Input
                required
                value={newInst.last_name}
                onChange={(e) => setNewInst((i) => ({ ...i, last_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Email
              <Input
                type="email"
                required
                value={newInst.email}
                onChange={(e) => setNewInst((i) => ({ ...i, email: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Password
              <Input
                type="password"
                required
                minLength={8}
                value={newInst.password}
                onChange={(e) => setNewInst((i) => ({ ...i, password: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Qualifications
              <Input
                value={newInst.qualifications}
                onChange={(e) => setNewInst((i) => ({ ...i, qualifications: e.target.value }))}
                placeholder="e.g. MSc Computer Science"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Years of Experience
              <Input
                type="number"
                min="0"
                value={newInst.experienceYears}
                onChange={(e) => setNewInst((i) => ({ ...i, experienceYears: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Expertise (comma-separated)
              <Input
                value={newInst.expertise}
                onChange={(e) => setNewInst((i) => ({ ...i, expertise: e.target.value }))}
                placeholder="Excel, Windows, IT Basics"
              />
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={mutating}>
                Add Instructor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Instructor Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Instructor: {editing ? displayName(editing) : ""}</DialogTitle>
            <DialogDescription>
              Update qualifications, schedules, account status, and assigned courses.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void saveInstructor(e)}>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Qualifications
              <Input
                value={editForm.qualifications}
                onChange={(e) => setEditForm((f) => ({ ...f, qualifications: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Experience (Years)
              <Input
                type="number"
                min="0"
                value={editForm.experienceYears}
                onChange={(e) => setEditForm((f) => ({ ...f, experienceYears: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Account Status
              <select
                value={editForm.status}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, status: e.target.value as ProfileRow["status"] }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Areas of Expertise (comma-separated)
              <Input
                value={editForm.expertise}
                onChange={(e) => setEditForm((f) => ({ ...f, expertise: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Department
              <select
                value={editForm.departmentId}
                onChange={(e) => setEditForm((f) => ({ ...f, departmentId: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">None</option>
                {(workspace?.departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Weekly Hours Limit
              <Input
                type="number"
                min="1"
                value={editForm.weeklyHoursLimit}
                onChange={(e) => setEditForm((f) => ({ ...f, weeklyHoursLimit: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Schedule Availability
              <Input
                value={editForm.scheduleSummary}
                onChange={(e) => setEditForm((f) => ({ ...f, scheduleSummary: e.target.value }))}
                placeholder="e.g. Mon–Fri 9:00 AM – 4:00 PM"
              />
            </label>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Assign to Courses</Label>
              <div className="grid max-h-36 gap-1.5 overflow-y-auto rounded-lg border border-border p-3">
                {db.courses.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.assignedCourseIds.includes(c.id)}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          assignedCourseIds: e.target.checked
                            ? [...f.assignedCourseIds, c.id]
                            : f.assignedCourseIds.filter((id) => id !== c.id),
                        }))
                      }
                    />
                    <span>{c.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={mutating}>
                Save Instructor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 3.4 PARENT MANAGEMENT                                                      */
/* ========================================================================== */

export function ParentManagementModule({ data }: { data: OwnerDataHandle }) {
  const { db, maps, callUserApi, refreshAll, can, mutating } = data;
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [newParent, setNewParent] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [linkForm, setLinkForm] = useState({
    parent_id: "",
    student_id: "",
    relationship: "Parent",
  });

  const parents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.profiles
      .filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("parent"))
      .filter((p) =>
        !q
          ? true
          : `${p.first_name} ${p.last_name} ${p.email} ${p.phone ?? ""}`.toLowerCase().includes(q),
      );
  }, [db.profiles, maps.rolesByUser, search]);

  const students = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("student")),
    [db.profiles, maps.rolesByUser],
  );

  async function handleCreateParent(e: React.FormEvent) {
    e.preventDefault();
    await callUserApi(
      {
        action: "create",
        ...newParent,
        role: "parent",
        status: "active",
      },
      "Parent account created",
    );
    setCreateOpen(false);
  }

  async function handleLinkChild(e: React.FormEvent) {
    e.preventDefault();
    if (!linkForm.parent_id || !linkForm.student_id) {
      toast.error("Select both a parent and a student.");
      return;
    }
    const { error } = await supabase.from("parent_links").insert({
      parent_id: linkForm.parent_id,
      student_id: linkForm.student_id,
      relationship: linkForm.relationship.trim() || "Parent",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("parent_child_linked", "parent_links", linkForm.student_id, {
      parent_id: linkForm.parent_id,
      relationship: linkForm.relationship,
    });
    setLinkOpen(false);
    await refreshAll("Child linked to parent account");
  }

  async function unlinkChild(linkId: string) {
    const { error } = await supabase.from("parent_links").delete().eq("id", linkId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("parent_child_unlinked", "parent_links", linkId, {});
    await refreshAll("Child link removed");
  }

  async function toggleParentStatus(p: ProfileRow) {
    const nextStatus = p.status === "active" ? "suspended" : "active";
    await callUserApi(
      {
        action: "update",
        user_id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        phone: p.phone,
        bio: p.bio,
        status: nextStatus,
        roles: maps.rolesByUser.get(p.id) ?? ["parent"],
      },
      `Parent account ${nextStatus}`,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent Management"
        description="Manage parent accounts, link parents to their children, and oversee child academic activity."
        actions={
          <div className="flex flex-wrap gap-2">
            {can("parents", "edit") && (
              <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
                <Link2 className="h-4 w-4" /> Link Child
              </Button>
            )}
            {can("parents", "create") && (
              <Button variant="emerald" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create Parent Account
              </Button>
            )}
          </div>
        }
      />

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parents…"
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{parents.length} parents</Badge>
        </div>

        {parents.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parent Account</TableHead>
                <TableHead>Linked Children & Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parents.map((parent) => {
                const links = db.parentLinks.filter((l) => l.parent_id === parent.id);
                return (
                  <TableRow key={parent.id}>
                    <TableCell>
                      <p className="font-semibold">{displayName(parent)}</p>
                      <p className="text-xs text-muted-foreground">
                        {parent.email} {parent.phone ? `· ${parent.phone}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      {links.length ? (
                        <div className="space-y-1.5">
                          {links.map((link) => {
                            const child = maps.profilesById.get(link.student_id);
                            const enrolled = db.enrollments.filter(
                              (e) => e.user_id === link.student_id,
                            ).length;
                            const done = db.progress.filter(
                              (p) => p.user_id === link.student_id,
                            ).length;
                            return (
                              <div
                                key={link.id}
                                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs"
                              >
                                <div>
                                  <span className="font-semibold">
                                    {child ? displayName(child) : "Student"}
                                  </span>{" "}
                                  <span className="text-muted-foreground">
                                    ({link.relationship}) · {enrolled} courses · {done} lessons
                                  </span>
                                </div>
                                {can("parents", "edit") && (
                                  <ConfirmButton
                                    title="Unlink child from parent?"
                                    description="The parent will no longer see this child's dashboard."
                                    confirmLabel="Unlink"
                                    onConfirm={() => void unlinkChild(link.id)}
                                    trigger={
                                      <button
                                        type="button"
                                        className="text-destructive hover:underline"
                                        title="Unlink"
                                      >
                                        <Unlink className="h-3.5 w-3.5" />
                                      </button>
                                    }
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No children linked yet
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_BADGE[parent.status] ?? "muted"}
                        className="capitalize"
                      >
                        {parent.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {can("parents", "edit") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mutating}
                          onClick={() => void toggleParentStatus(parent)}
                        >
                          {parent.status === "active" ? "Suspend" : "Activate"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No parent accounts found"
            text="Create a parent account and link them to their children."
            icon={Users}
          />
        )}
      </Panel>

      {/* Create Parent Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Parent Account</DialogTitle>
            <DialogDescription>Register a parent with guardian contact details.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void handleCreateParent(e)}>
            <label className="space-y-1 text-sm font-medium">
              First name
              <Input
                required
                value={newParent.first_name}
                onChange={(e) => setNewParent((p) => ({ ...p, first_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Last name
              <Input
                required
                value={newParent.last_name}
                onChange={(e) => setNewParent((p) => ({ ...p, last_name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Email
              <Input
                type="email"
                required
                value={newParent.email}
                onChange={(e) => setNewParent((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Phone
              <Input
                value={newParent.phone}
                onChange={(e) => setNewParent((p) => ({ ...p, phone: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Initial Password
              <Input
                type="password"
                required
                minLength={8}
                value={newParent.password}
                onChange={(e) => setNewParent((p) => ({ ...p, password: e.target.value }))}
              />
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={mutating}>
                Create Parent
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Link Child Dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Parent to Student</DialogTitle>
            <DialogDescription>
              Connect a verified parent account with their child&apos;s student profile.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void handleLinkChild(e)}>
            <label className="block space-y-1 text-sm font-medium">
              Parent
              <select
                required
                value={linkForm.parent_id}
                onChange={(e) => setLinkForm((f) => ({ ...f, parent_id: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select parent…</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayName(p)} ({p.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Student
              <select
                required
                value={linkForm.student_id}
                onChange={(e) => setLinkForm((f) => ({ ...f, student_id: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {displayName(s)} ({s.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Relationship
              <Input
                value={linkForm.relationship}
                onChange={(e) => setLinkForm((f) => ({ ...f, relationship: e.target.value }))}
                placeholder="Mother, Father, Guardian…"
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald">
                Link Accounts
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
