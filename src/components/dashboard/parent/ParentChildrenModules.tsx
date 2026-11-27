import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  FileEdit,
  GraduationCap,
  Link2,
  Printer,
  Search,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { displayName, initials } from "@/lib/auth";
import { formatETB } from "@/lib/access";
import { formatCompactDate } from "@/lib/owner/logic";
import type { ProfileCorrectionRequest } from "@/lib/owner/types";
import type { ParentSubmenuId } from "@/lib/parent/types";
import { cn } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/ui";
import type { ParentDataHandle } from "./useParentData";

export function ParentAllChildrenModule({
  data,
  onNavigate,
}: {
  data: ParentDataHandle;
  onNavigate: (id: ParentSubmenuId) => void;
}) {
  const [search, setSearch] = useState("");
  const ws = data.workspace;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.linkedChildIds
      .map((cid) => {
        const cp = data.maps.childProfilesById.get(cid);
        const meta = ws?.studentMetaByChild[cid];
        const cls = meta?.classSectionId ? data.maps.classesById.get(meta.classSectionId) : null;
        const relationship =
          ws?.relationshipsByChild[cid] ??
          data.maps.linksByChildId.get(cid)?.relationship ??
          "Parent";
        const enrolledIds = new Set<string>([
          ...data.db.enrollments.filter((e) => e.user_id === cid).map((e) => e.course_id),
          ...(ws?.enrolledCourseByChild[cid] ?? []),
        ]);
        const doneLessons = data.db.progress.filter((p) => p.user_id === cid).length;
        const totalLessons = [...enrolledIds].reduce(
          (s, id) => s + (data.maps.lessonsByCourse.get(id)?.length ?? 0),
          0,
        );
        const progressPct = totalLessons
          ? Math.min(100, Math.round((doneLessons / totalLessons) * 100))
          : 0;
        const att = (ws?.attendance ?? []).filter((a) => a.personId === cid);
        const attPresent = att.filter((a) => a.status === "present" || a.status === "late").length;
        const attPct = att.length ? Math.round((attPresent / att.length) * 100) : null;
        const balance = (ws?.feePlans ?? [])
          .filter((f) => f.studentId === cid)
          .reduce((s, f) => s + Math.max(0, f.amount - f.discount - f.paidAmount), 0);

        return {
          id: cid,
          fullName: cp ? displayName(cp) : "Linked Student",
          email: cp?.email ?? "",
          avatarUrl: cp?.avatar_url ?? null,
          initialsText: cp ? initials(cp) : "ST",
          status: cp?.status ?? "active",
          studentCode: meta?.studentCode ?? `STU-${cid.slice(0, 6).toUpperCase()}`,
          className: cls ? `${cls.name} (${cls.sectionCode})` : "Unassigned",
          relationship,
          enrolledCount: enrolledIds.size,
          progressPct,
          attPct,
          balance,
        };
      })
      .filter(
        (r) =>
          !q ||
          r.fullName.toLowerCase().includes(q) ||
          r.studentCode.toLowerCase().includes(q) ||
          r.className.toLowerCase().includes(q),
      );
  }, [data.db.enrollments, data.db.progress, data.linkedChildIds, data.maps, search, ws]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="All My Children"
        description="Officially linked children under your parent account with quick academic and fee access."
        actions={
          <Button variant="outline" size="sm" onClick={() => onNavigate("linked-children")}>
            <Link2 className="h-4 w-4" />
            Manage / Request Links
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by child name, student ID, or class…"
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          Showing {rows.length} linked {rows.length === 1 ? "child" : "children"}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No linked children match"
          text="Official student links created by the academy administrator appear here."
          icon={Users}
          action={
            <Button variant="emerald" onClick={() => onNavigate("linked-children")}>
              Request Child Link
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const isSelected = r.id === data.selectedChildId;
            return (
              <Panel
                key={r.id}
                title={r.fullName}
                actions={
                  <div className="flex items-center gap-1.5">
                    {isSelected && <Badge variant="default">Selected</Badge>}
                    <Badge variant={r.status === "active" ? "success" : "muted"}>
                      {r.status}
                    </Badge>
                  </div>
                }
              >
                <div className="flex items-start gap-3">
                  {r.avatarUrl ? (
                    <img
                      src={r.avatarUrl}
                      alt={r.fullName}
                      className="h-12 w-12 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-deep font-display text-sm font-bold text-gold">
                      {r.initialsText}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1 text-xs">
                    <p className="text-muted-foreground">
                      Student ID: <span className="font-mono font-semibold text-foreground">{r.studentCode}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Class: <span className="font-semibold text-foreground">{r.className}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Relationship: <span className="font-semibold text-foreground">{r.relationship}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl border border-border bg-secondary/30 p-3 text-center tabular-nums">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Courses</p>
                    <p className="text-sm font-bold">{r.enrolledCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Progress</p>
                    <p className="text-sm font-bold">{r.progressPct}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Attendance</p>
                    <p className="text-sm font-bold">{r.attPct !== null ? `${r.attPct}%` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Fee Due</p>
                    <p className="text-sm font-bold">{formatETB(r.balance)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={isSelected ? "emerald" : "outline"}
                    onClick={() => {
                      data.setSelectedChildId(r.id);
                      onNavigate("overview");
                    }}
                  >
                    {isSelected ? "Focused Dashboard" : "Open Dashboard"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      data.setSelectedChildId(r.id);
                      onNavigate("child-profiles");
                    }}
                  >
                    Profile
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      data.setSelectedChildId(r.id);
                      onNavigate("grades-report-cards");
                    }}
                  >
                    Grades
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      data.setSelectedChildId(r.id);
                      onNavigate("child-fees");
                    }}
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Fees
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ParentChildProfilesModule({ data }: { data: ParentDataHandle }) {
  const child = data.activeChild;
  const ws = data.workspace;
  const [corrOpen, setCorrOpen] = useState(false);
  const [field, setField] = useState<ProfileCorrectionRequest["field"]>("dateOfBirth");
  const [requestedValue, setRequestedValue] = useState("");
  const [reason, setReason] = useState("");

  const childInstructors = useMemo(() => {
    const ids = new Set<string>();
    for (const c of child.courses) {
      if (c.instructor_id) ids.add(c.instructor_id);
    }
    if (child.classSection?.instructorId) {
      ids.add(child.classSection.instructorId);
    }
    return [...ids].map((id) => ({
      id,
      name: data.maps.resolvePersonName(id, "Assigned Instructor"),
      info: data.maps.directoryById.get(id),
    }));
  }, [child.classSection?.instructorId, child.courses, data.maps]);

  const correctionHistory = useMemo(
    () =>
      (ws?.profileCorrectionRequests ?? []).filter(
        (r) => r.studentId === child.childId && r.targetType !== "parent",
      ),
    [child.childId, ws?.profileCorrectionRequests],
  );

  const academicYearName =
    ws?.academicYears.find((y) => y.id === child.meta?.academicYearId)?.name ??
    ws?.academicYears.find((y) => y.isCurrent)?.name ??
    "Current Academic Year";

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!child.childId || !requestedValue.trim() || !reason.trim()) return;
    await data.mutateWorkspace(
      {
        type: "request_profile_correction",
        payload: {
          studentId: child.childId,
          requesterId: ws?.parentId ?? "",
          targetType: "student",
          field,
          requestedValue: requestedValue.trim(),
          reason: reason.trim(),
        },
      },
      "Correction request submitted for admin review",
    );
    setRequestedValue("");
    setReason("");
    setCorrOpen(false);
  }

  if (!child.childId) {
    return (
      <EmptyState
        title="Select a linked child"
        text="Link or select a child to inspect their official profile."
        icon={UserCheck}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Child Profiles"
        description="Official student identification, guardian contact details, class assignment, and instructors."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.linkedChildIds.length > 1 && (
              <select
                aria-label="Select child profile"
                value={child.childId}
                onChange={(e) => data.setSelectedChildId(e.target.value)}
                className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold"
              >
                {data.linkedChildIds.map((id) => (
                  <option key={id} value={id}>
                    {data.maps.resolvePersonName(id, "Linked Student")}
                  </option>
                ))}
              </select>
            )}
            <Button variant="outline" size="sm" onClick={() => setCorrOpen(true)}>
              <FileEdit className="h-4 w-4" />
              Request Profile Correction
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Panel title={child.profile ? displayName(child.profile) : "Student Record"}>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Student ID</dt>
              <dd className="font-mono font-semibold">
                {child.meta?.studentCode ?? `STU-${child.childId.slice(0, 6).toUpperCase()}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Account Status</dt>
              <dd>
                <Badge variant={child.profile?.status === "active" ? "success" : "muted"}>
                  {child.profile?.status ?? "active"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="font-medium">{child.profile?.email || "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd className="font-medium">{child.profile?.phone || "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Date of Birth</dt>
              <dd className="font-mono font-medium">
                {child.meta?.dateOfBirth || "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Academic Year & Class</dt>
              <dd className="font-medium">
                {academicYearName} ·{" "}
                {child.classSection
                  ? `${child.classSection.name} (${child.classSection.sectionCode})`
                  : "Unassigned"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Guardian Listed</dt>
              <dd className="font-medium">
                {child.meta?.guardianName || "On file"} ({child.relationship})
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Guardian Contact & Address</dt>
              <dd className="font-medium">
                {[child.meta?.guardianPhone, child.meta?.address].filter(Boolean).join(" · ") ||
                  "Not recorded"}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Assigned Instructors">
          {childInstructors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No instructors currently assigned to {child.profile?.first_name || "this child"}’s courses.
            </p>
          ) : (
            <div className="space-y-3">
              {childInstructors.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{inst.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inst.info?.bio || "Academy Course Instructor"}
                    </p>
                  </div>
                  <Badge variant="secondary">Instructor</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Profile Correction Requests">
        {correctionHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No correction requests submitted for this student yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {correctionHistory.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-semibold">
                    {req.field}: <span className="text-primary">{req.requestedValue}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {req.reason} · {formatCompactDate(req.createdAt)}
                  </p>
                </div>
                <Badge
                  variant={
                    req.status === "approved"
                      ? "success"
                      : req.status === "rejected"
                        ? "destructive"
                        : "gold"
                  }
                >
                  {req.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Dialog open={corrOpen} onOpenChange={setCorrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Child Profile Correction</DialogTitle>
            <DialogDescription>
              Parents cannot edit official student records directly. Submit a request to the
              academy administrator.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitCorrection(e)} className="space-y-3">
            <label className="block text-xs font-semibold">
              Field to Update
              <select
                value={field}
                onChange={(e) => setField(e.target.value as ProfileCorrectionRequest["field"])}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="dateOfBirth">Date of Birth</option>
                <option value="classSection">Class / Section</option>
                <option value="studentCode">Student ID Code</option>
                <option value="guardianName">Guardian Information</option>
                <option value="other">Other Official Field</option>
              </select>
            </label>
            <label className="block text-xs font-semibold">
              Requested Value
              <Input
                value={requestedValue}
                onChange={(e) => setRequestedValue(e.target.value)}
                placeholder="Enter the accurate value"
                required
                className="mt-1"
              />
            </label>
            <label className="block text-xs font-semibold">
              Reason / Supporting Details
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly explain why this update is requested"
                rows={3}
                required
                className="mt-1"
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCorrOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ParentAcademicInfoModule({ data }: { data: ParentDataHandle }) {
  const child = data.activeChild;
  const ws = data.workspace;
  const childName = child.profile ? displayName(child.profile) : "Linked Student";

  const currentYear =
    ws?.academicYears.find((y) => y.id === child.meta?.academicYearId) ??
    ws?.academicYears.find((y) => y.isCurrent) ??
    ws?.academicYears[0];
  const currentTerm = ws?.terms.find((t) => t.isCurrent) ?? ws?.terms[0];

  const relatedSubjects = useMemo(
    () =>
      (ws?.subjects ?? []).filter((s) =>
        s.courseIds.some((cid) => child.enrolledCourseIdSet.has(cid)),
      ),
    [child.enrolledCourseIdSet, ws?.subjects],
  );

  function printSummary() {
    data.setPrintable({
      title: `Academic Information Summary — ${childName}`,
      subtitle: `${child.meta?.studentCode ?? "Student"} · ${currentYear?.name ?? "Academic Year"}`,
      columns: ["Course", "Level", "Instructor", "Completed Lessons", "Standing"],
      rows: child.courses.map((c) => {
        const total = data.maps.lessonsByCourse.get(c.id)?.length ?? 0;
        const done = child.progress.filter((p) => p.course_id === c.id).length;
        const comp = child.completions.find((cc) => cc.courseId === c.id);
        return [
          c.title,
          c.level,
          data.maps.resolvePersonName(c.instructor_id, "Ezana Faculty"),
          `${done}/${total}`,
          comp?.status ?? "active",
        ];
      }),
      footerNote: `Class Section: ${child.classSection?.name ?? "Unassigned"} · Term: ${currentTerm?.name ?? "Current"}`,
    });
  }

  if (!child.childId) {
    return (
      <EmptyState
        title="No child selected"
        text="Select a linked child to view their academic information."
        icon={GraduationCap}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Information"
        description="Enrolled courses, subjects, academic year, term, class section, instructors, and standing."
        actions={
          <Button variant="outline" size="sm" onClick={printSummary}>
            <Printer className="h-4 w-4" />
            Print Academic Summary
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Academic Term & Year">
          <p className="text-sm font-bold">{currentYear?.name ?? "Active Year"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Current Term: <span className="font-semibold text-foreground">{currentTerm?.name ?? "Semester 1"}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Status: <span className="font-semibold text-foreground">{currentYear?.status ?? "active"}</span>
          </p>
        </Panel>
        <Panel title="Class & Room Assignment">
          <p className="text-sm font-bold">
            {child.classSection ? child.classSection.name : "No section assigned"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Code: <span className="font-mono">{child.classSection?.sectionCode ?? "—"}</span> · Room:{" "}
            {child.classSection?.room ?? "Online"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Advisor:{" "}
            {data.maps.resolvePersonName(child.classSection?.instructorId, "Faculty Advisor")}
          </p>
        </Panel>
        <Panel title="Academic Standing">
          <p className="text-sm font-bold capitalize">{child.profile?.status ?? "Active"}</p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {child.courses.length} active courses · {relatedSubjects.length} subjects
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {child.certificates.length} verified certificates earned
          </p>
        </Panel>
      </div>

      <Panel title="Subjects & Course Curriculum">
        {child.courses.length === 0 ? (
          <EmptyState
            title="No courses enrolled yet"
            text="Enrolled courses and subjects for this child will appear here."
            icon={BookOpen}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Course</th>
                  <th className="py-2 pr-4">Instructor</th>
                  <th className="py-2 pr-4">Level</th>
                  <th className="py-2 pr-4 text-right">Lessons</th>
                  <th className="py-2 text-right">Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {child.courses.map((c) => {
                  const total = data.maps.lessonsByCourse.get(c.id)?.length ?? 0;
                  const done = child.progress.filter((p) => p.course_id === c.id).length;
                  const key = `${child.childId}:${c.id}`;
                  const status = ws?.enrollmentMeta[key]?.status ?? "active";
                  return (
                    <tr key={c.id} className="hover:bg-secondary/30">
                      <td className="py-2.5 pr-4 font-semibold">{c.title}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {data.maps.resolvePersonName(c.instructor_id, "Ezana Faculty")}
                      </td>
                      <td className="py-2.5 pr-4">{c.level}</td>
                      <td className="py-2.5 pr-4 text-right font-mono">
                        {done}/{total}
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge variant={status === "completed" ? "success" : "outline"}>
                          {status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function ParentSwitchChildModule({
  data,
  onNavigate,
}: {
  data: ParentDataHandle;
  onNavigate: (id: ParentSubmenuId) => void;
}) {
  const ws = data.workspace;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Switch Child"
        description="Choose which linked child's academic monitoring, attendance, grades, and fees to view."
      />

      {data.linkedChildIds.length === 0 ? (
        <EmptyState
          title="No linked children available"
          text="Request a link to your child's student account to unlock switching."
          icon={ArrowLeftRight}
          action={
            <Button variant="emerald" onClick={() => onNavigate("linked-children")}>
              Request Child Link
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.linkedChildIds.map((cid) => {
            const cp = data.maps.childProfilesById.get(cid);
            const meta = ws?.studentMetaByChild[cid];
            const selected = cid === data.selectedChildId;
            const enrolledCount = new Set([
              ...data.db.enrollments.filter((e) => e.user_id === cid).map((e) => e.course_id),
              ...(ws?.enrolledCourseByChild[cid] ?? []),
            ]).size;
            const gradesCount = (ws?.grades ?? []).filter((g) => g.studentId === cid).length;
            const outstanding = (ws?.feePlans ?? [])
              .filter((f) => f.studentId === cid)
              .reduce((s, f) => s + Math.max(0, f.amount - f.discount - f.paidAmount), 0);

            return (
              <div
                key={cid}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border p-5 transition-colors",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card",
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-deep font-display text-sm font-bold text-gold">
                      {cp ? initials(cp) : "ST"}
                    </span>
                    {selected && (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Active Child
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-3 font-display text-base font-bold">
                    {cp ? displayName(cp) : "Linked Student"}
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground">
                    {meta?.studentCode ?? `STU-${cid.slice(0, 6).toUpperCase()}`}
                  </p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground tabular-nums">
                    <p>Enrolled Courses: {enrolledCount}</p>
                    <p>Released Grades: {gradesCount}</p>
                    <p>Outstanding Balance: {formatETB(outstanding)}</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    className="flex-1"
                    variant={selected ? "emerald" : "outline"}
                    onClick={() => {
                      data.setSelectedChildId(cid);
                      onNavigate("overview");
                    }}
                  >
                    {selected ? "View Dashboard" : "Select Child"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
