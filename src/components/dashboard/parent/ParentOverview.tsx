import { useMemo } from "react";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  Link2,
  Mail,
  Megaphone,
  MessageSquare,
  Users,
  Wallet,
} from "lucide-react";
import { displayName, initials, useAuth } from "@/lib/auth";
import { formatETB } from "@/lib/access";
import { computeFeeStatus, formatCompactDate, resolveGradeBand } from "@/lib/owner/logic";
import type { ParentSubmenuId } from "@/lib/parent/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/dashboard/ui";
import type { ParentDataHandle } from "./useParentData";

export function ParentOverview({
  data,
  onNavigate,
}: {
  data: ParentDataHandle;
  onNavigate: (id: ParentSubmenuId) => void;
}) {
  const { user, profile } = useAuth();
  const ws = data.workspace;
  const firstName = profile ? displayName(profile).split(" ")[0] : "Parent";
  const child = data.activeChild;
  const childName = child.profile ? displayName(child.profile) : "Linked Child";
  const todayIso = new Date().toISOString().slice(0, 10);

  const familyStats = useMemo(() => {
    const childSummaries = data.linkedChildIds.map((cid) => {
      const cp = data.maps.childProfilesById.get(cid);
      const meta = ws?.studentMetaByChild[cid];
      const cls = meta?.classSectionId ? data.maps.classesById.get(meta.classSectionId) : null;
      const enrolledIds = new Set<string>([
        ...data.db.enrollments.filter((e) => e.user_id === cid).map((e) => e.course_id),
        ...(ws?.enrolledCourseByChild[cid] ?? []),
      ]);
      const completedLessons = data.db.progress.filter((p) => p.user_id === cid).length;
      const totalLessons = [...enrolledIds].reduce(
        (sum, courseId) => sum + (data.maps.lessonsByCourse.get(courseId)?.length ?? 0),
        0,
      );
      const pct = totalLessons ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0;
      const attRows = (ws?.attendance ?? []).filter((a) => a.personId === cid);
      const present = attRows.filter((a) => a.status === "present" || a.status === "late").length;
      const attPct = attRows.length ? Math.round((present / attRows.length) * 100) : null;
      const outstanding = (ws?.feePlans ?? [])
        .filter((f) => f.studentId === cid)
        .reduce((sum, f) => sum + Math.max(0, f.amount - f.discount - f.paidAmount), 0);

      return {
        id: cid,
        name: cp ? displayName(cp) : "Linked Student",
        avatarUrl: cp?.avatar_url ?? null,
        initialsText: cp ? initials(cp) : "ST",
        studentCode: meta?.studentCode ?? `STU-${cid.slice(0, 6).toUpperCase()}`,
        className: cls?.name ?? "Unassigned Section",
        status: cp?.status ?? "active",
        enrolledCount: enrolledIds.size,
        progressPct: pct,
        attPct,
        outstanding,
      };
    });

    const totalFamilyOutstanding = childSummaries.reduce((s, c) => s + c.outstanding, 0);
    return { childSummaries, totalFamilyOutstanding };
  }, [data.db.enrollments, data.db.progress, data.linkedChildIds, data.maps, ws]);

  const activeStats = useMemo(() => {
    const totalLessons = child.courses.reduce(
      (sum, c) => sum + (data.maps.lessonsByCourse.get(c.id)?.length ?? 0),
      0,
    );
    const completedLessons = child.progress.filter((p) =>
      child.enrolledCourseIdSet.has(p.course_id),
    ).length;
    const overallProgressPct = totalLessons
      ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
      : 0;

    const totalAtt = child.attendance.length;
    const presentAtt = child.attendance.filter(
      (a) => a.status === "present" || a.status === "late",
    ).length;
    const attendanceRate = totalAtt ? Math.round((presentAtt / totalAtt) * 100) : null;

    const avgGrade = child.grades.length
      ? Math.round(
          child.grades.reduce(
            (sum, g) => sum + (g.maxScore > 0 ? (g.score / g.maxScore) * 100 : 0),
            0,
          ) / child.grades.length,
        )
      : null;

    const outstandingBalance = child.feePlans.reduce(
      (sum, f) => sum + Math.max(0, f.amount - f.discount - f.paidAmount),
      0,
    );
    const overdueCount = child.feePlans.filter(
      (f) => computeFeeStatus(f.amount, f.discount, f.paidAmount, f.dueDate) === "overdue",
    ).length;
    const pendingVerifications = child.payments.filter((p) => p.status === "pending").length;

    return {
      totalLessons,
      completedLessons,
      overallProgressPct,
      totalAtt,
      presentAtt,
      attendanceRate,
      avgGrade,
      outstandingBalance,
      overdueCount,
      pendingVerifications,
    };
  }, [child, data.maps.lessonsByCourse]);

  const upcomingItems = useMemo(() => {
    const items: {
      id: string;
      kind: "Class" | "Live Session" | "Assignment" | "Exam";
      title: string;
      meta: string;
      dateLabel: string;
      target: ParentSubmenuId;
    }[] = [];

    for (const lc of ws?.liveClasses ?? []) {
      const relevant =
        child.enrolledCourseIdSet.has(lc.courseId) ||
        (lc.classSectionId !== null && child.assignedClassIdSet.has(lc.classSectionId)) ||
        lc.participantIds.includes(child.childId);
      if (relevant && lc.scheduledDate >= todayIso && lc.status !== "cancelled") {
        items.push({
          id: `lc-${lc.id}`,
          kind: "Live Session",
          title: lc.title,
          meta: data.maps.coursesById.get(lc.courseId)?.title ?? "Course Session",
          dateLabel: `${lc.scheduledDate} · ${lc.startTime}`,
          target: "timetables",
        });
      }
    }

    const subByAssignment = new Map(
      child.assignmentSubmissions.map((s) => [s.assignmentId, s]),
    );
    for (const a of ws?.assignments ?? []) {
      const relevant =
        child.enrolledCourseIdSet.has(a.courseId) ||
        (a.classSectionId !== null && child.assignedClassIdSet.has(a.classSectionId));
      if (relevant && a.status === "published" && (!a.dueDate || a.dueDate >= todayIso)) {
        const sub = subByAssignment.get(a.id);
        items.push({
          id: `asg-${a.id}`,
          kind: "Assignment",
          title: a.title,
          meta: `${data.maps.coursesById.get(a.courseId)?.title ?? "Course"} · ${sub?.status ?? "pending"}`,
          dateLabel: a.dueDate || "Open deadline",
          target: "assignments-exams",
        });
      }
    }

    for (const ex of ws?.exams ?? []) {
      const relevant =
        child.enrolledCourseIdSet.has(ex.courseId) ||
        (ex.classSectionId !== null &&
          ex.classSectionId !== undefined &&
          child.assignedClassIdSet.has(ex.classSectionId));
      if (
        relevant &&
        (ex.status === "scheduled" || ex.status === "active") &&
        ex.scheduledDate >= todayIso
      ) {
        items.push({
          id: `ex-${ex.id}`,
          kind: "Exam",
          title: ex.title,
          meta: `${ex.examType.toUpperCase()} · ${ex.durationMinutes} min`,
          dateLabel: `${ex.scheduledDate} · ${ex.startTime || "Scheduled"}`,
          target: "assignments-exams",
        });
      }
    }

    for (const slot of ws?.timetables ?? []) {
      const relevant =
        (slot.courseId !== null && child.enrolledCourseIdSet.has(slot.courseId)) ||
        (slot.classSectionId !== null && child.assignedClassIdSet.has(slot.classSectionId));
      if (relevant) {
        items.push({
          id: `tt-${slot.id}`,
          kind: "Class",
          title: slot.title,
          meta: `${slot.dayOfWeek} · ${slot.room || "Online"}`,
          dateLabel: `${slot.startTime}–${slot.endTime}`,
          target: "timetables",
        });
      }
    }

    return items.slice(0, 6);
  }, [child, data.maps.coursesById, todayIso, ws]);

  const unreadAlerts = useMemo(() => {
    if (!user) return [];
    return (ws?.notifications ?? []).filter((n) => !n.readBy.includes(user.id)).slice(0, 5);
  }, [user, ws?.notifications]);

  const recentTeacherMsgs = useMemo(
    () =>
      (ws?.parentMessages ?? [])
        .filter((pm) => !pm.studentId || pm.studentId === child.childId)
        .slice(0, 4),
    [child.childId, ws?.parentMessages],
  );

  const defaultScale = ws?.gradingScales.find((s) => s.isDefault) ?? ws?.gradingScales[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Monitor your children's academic progress, attendance, grades, tuition balances, and academy messages."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.linkedChildIds.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => onNavigate("switch-child")}>
                Switch Child
              </Button>
            )}
            <Button variant="emerald" size="sm" onClick={() => onNavigate("make-payment")}>
              <CreditCard className="h-4 w-4" />
              Make a Payment
            </Button>
          </div>
        }
      />

      {data.linkedChildIds.length === 0 ? (
        <EmptyState
          title="No officially linked children yet"
          text="Your parent account has no verified student links yet. Submit a link verification request or message the academy administrator."
          icon={Link2}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="emerald" onClick={() => onNavigate("linked-children")}>
                Request Child Link
              </Button>
              <Button variant="outline" onClick={() => onNavigate("messages-admin")}>
                Message Admin
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Linked Children Quick Switcher Strip */}
          <Panel
            title={`Linked Children (${familyStats.childSummaries.length})`}
            actions={
              <button
                type="button"
                onClick={() => onNavigate("all-children")}
                className="text-xs font-semibold text-primary hover:underline"
              >
                View All Children
              </button>
            }
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {familyStats.childSummaries.map((c) => {
                const selected = c.id === child.childId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => data.setSelectedChildId(c.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-background hover:bg-secondary/50",
                    )}
                  >
                    {c.avatarUrl ? (
                      <img
                        src={c.avatarUrl}
                        alt={c.name}
                        className="h-11 w-11 shrink-0 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-deep font-display text-sm font-bold text-gold">
                        {c.initialsText}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-foreground">{c.name}</p>
                        {selected && (
                          <Badge variant="default" className="shrink-0 text-[10px]">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{c.studentCode}</span> · {c.className}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                        <span>{c.enrolledCount} courses</span>
                        <span>{c.progressPct}% progress</span>
                        <span>{c.attPct !== null ? `${c.attPct}% att.` : "Att. N/A"}</span>
                        {c.outstanding > 0 && (
                          <span className="font-semibold text-amber-700">
                            {formatETB(c.outstanding)} due
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Active Child KPI Grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Enrolled Courses"
              value={child.courses.length}
              icon={BookOpen}
              hint={`${activeStats.overallProgressPct}% overall progress · ${activeStats.completedLessons}/${activeStats.totalLessons} lessons`}
              index={0}
            />
            <StatCard
              label="Attendance Rate"
              value={
                activeStats.attendanceRate !== null ? `${activeStats.attendanceRate}%` : "N/A"
              }
              icon={CalendarDays}
              hint={
                activeStats.totalAtt
                  ? `${activeStats.presentAtt} of ${activeStats.totalAtt} sessions`
                  : "No attendance logged yet"
              }
              tone="gold"
              index={1}
            />
            <StatCard
              label="Academic Average"
              value={activeStats.avgGrade !== null ? `${activeStats.avgGrade}%` : "N/A"}
              icon={FileSpreadsheet}
              hint={
                child.grades.length
                  ? `${child.grades.length} graded assessments · ${child.certificates.length} certificates`
                  : "No released grades yet"
              }
              tone="deep"
              index={2}
            />
            <StatCard
              label="Outstanding Fees"
              value={formatETB(activeStats.outstandingBalance)}
              icon={Wallet}
              hint={`Family total: ${formatETB(familyStats.totalFamilyOutstanding)} · ${activeStats.pendingVerifications} pending receipt(s)`}
              tone="plain"
              index={3}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            {/* Course Progress Breakdown */}
            <Panel
              title={`${childName} — Course Progress`}
              actions={
                <button
                  type="button"
                  onClick={() => onNavigate("course-progress")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Full Progress
                </button>
              }
            >
              {child.courses.length === 0 ? (
                <EmptyState
                  title="No enrolled courses"
                  text="When your child enrolls in a course, lesson progress and completion milestones appear here."
                  icon={BookOpen}
                />
              ) : (
                <div className="space-y-4">
                  {child.courses.slice(0, 5).map((course) => {
                    const total = data.maps.lessonsByCourse.get(course.id)?.length ?? 0;
                    const done = child.progress.filter((p) => p.course_id === course.id).length;
                    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
                    return (
                      <div key={course.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-semibold text-foreground">
                            {course.title}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                            {done}/{total} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            {/* Recent Grades & Performance */}
            <Panel
              title="Recent Grades & Results"
              actions={
                <button
                  type="button"
                  onClick={() => onNavigate("grades-report-cards")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Report Cards
                </button>
              }
            >
              {child.grades.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No graded assessments recorded yet for {childName}.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {child.grades.slice(0, 5).map((g) => {
                    const pct = g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : 0;
                    const band = defaultScale ? resolveGradeBand(pct, defaultScale) : null;
                    return (
                      <div
                        key={g.id}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{g.assessmentTitle}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {data.maps.coursesById.get(g.courseId)?.title ?? "Course"} ·{" "}
                            {formatCompactDate(g.gradedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 tabular-nums">
                          <span className="font-mono text-xs font-semibold">
                            {g.score}/{g.maxScore}
                          </span>
                          <Badge variant={pct >= 75 ? "success" : pct >= 60 ? "gold" : "destructive"}>
                            {band ? `${band.letter} (${pct}%)` : `${pct}%`}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Upcoming Classes, Assignments & Exams */}
            <Panel
              title="Upcoming Classes, Assignments & Exams"
              actions={
                <button
                  type="button"
                  onClick={() => onNavigate("timetables")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View Schedule
                </button>
              }
            >
              {upcomingItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No upcoming scheduled sessions, assignments, or examinations for {childName}.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {upcomingItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.target)}
                      className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-secondary/40 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {item.kind}
                          </Badge>
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.meta}</p>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                        {item.dateLabel}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Panel>

            {/* Recent Teacher Messages & Announcements */}
            <Panel
              title="Recent Announcements & Teacher Messages"
              actions={
                <button
                  type="button"
                  onClick={() => onNavigate("teacher-communication")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Open Inbox
                </button>
              }
            >
              <div className="space-y-3">
                {recentTeacherMsgs.map((pm) => (
                  <div key={pm.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{pm.subject}</p>
                      <Badge variant={pm.read ? "outline" : "gold"} className="text-[10px]">
                        {pm.senderRole}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{pm.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      From {data.maps.resolvePersonName(pm.senderId)} ·{" "}
                      {formatCompactDate(pm.createdAt)}
                    </p>
                  </div>
                ))}
                {data.db.announcements.slice(0, 3).map((a) => (
                  <div key={a.id} className="rounded-xl border border-border/80 bg-secondary/30 p-3">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <p className="truncate text-sm font-semibold">{a.title}</p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                  </div>
                ))}
                {recentTeacherMsgs.length === 0 && data.db.announcements.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No recent messages or academy announcements.
                  </p>
                )}
              </div>
            </Panel>
          </div>

          {/* Alerts + Quick Actions */}
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel
              title="Unread Academic & Fee Notifications"
              actions={
                <button
                  type="button"
                  onClick={() => onNavigate("notifications")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  All Alerts
                </button>
              }
            >
              {unreadAlerts.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>You are all caught up on notifications.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {unreadAlerts.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border p-3"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{n.title}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void data.mutateWorkspace({ type: "mark_notification_read", id: n.id })
                        }
                      >
                        Mark read
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Quick Parent Actions">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {(
                  [
                    {
                      id: "child-profiles",
                      label: "Child Profiles & Info",
                      icon: GraduationCap,
                    },
                    {
                      id: "attendance-tracking",
                      label: "Attendance Tracking",
                      icon: CalendarClock,
                    },
                    {
                      id: "grades-report-cards",
                      label: "Grades & Report Cards",
                      icon: FileSpreadsheet,
                    },
                    {
                      id: "assignments-exams",
                      label: "Assignments & Exams",
                      icon: ClipboardCheck,
                    },
                    {
                      id: "make-payment",
                      label: "Make a Fee Payment",
                      icon: CreditCard,
                    },
                    {
                      id: "messages-instructors",
                      label: "Message Instructors",
                      icon: Mail,
                    },
                    {
                      id: "messages-admin",
                      label: "Message Academy Admin",
                      icon: MessageSquare,
                    },
                    {
                      id: "certificates",
                      label: "Certificates",
                      icon: Award,
                    },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onNavigate(id)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border px-3.5 py-2.5 text-left text-xs font-semibold text-foreground transition-colors hover:bg-secondary/60"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span>{label}</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
