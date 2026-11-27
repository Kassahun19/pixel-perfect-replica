import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  LogOut,
  Menu,
  RefreshCw,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, initials, ROLE_LABEL, useAuth, type AppRole } from "@/lib/auth";
import type { StudentGroupId, StudentSubmenuId } from "@/lib/student/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorBlock, LoadingBlock } from "@/components/dashboard/ui";
import { PrintableSheetDialog } from "@/components/dashboard/owner/PrintableSheetDialog";
import {
  ALL_STUDENT_SUBMENU_ITEMS,
  STUDENT_NAV_GROUPS,
  findStudentNavMeta,
} from "./nav-config";
import { useStudentWorkspace } from "./useStudentData";
import { StudentOverview } from "./StudentOverview";
import {
  StudentContinueLearningModule,
  StudentCourseMaterialsModule,
  StudentExploreCoursesModule,
  StudentLearningScheduleModule,
  StudentLiveClassesModule,
  StudentMyCoursesModule,
  StudentResourcesModule,
} from "./StudentLearningModules";
import {
  StudentAssignmentsModule,
  StudentAttendanceModule,
  StudentCertificatesModule,
  StudentExamResultsModule,
  StudentExamsModule,
  StudentGradesReportCardsModule,
  StudentLearningProgressModule,
  StudentTimetableModule,
} from "./StudentAcademicModules";
import {
  StudentAccountSettingsModule,
  StudentAnnouncementsModule,
  StudentChangePasswordModule,
  StudentDiscussionForumsModule,
  StudentFeesModule,
  StudentInvoicesReceiptsModule,
  StudentMakePaymentModule,
  StudentMessagesModule,
  StudentNotificationsModule,
  StudentParentCommModule,
  StudentPaymentHistoryModule,
  StudentProfileModule,
} from "./StudentCommFinanceAccountModules";

const VALID_SUBMENUS = new Set<string>(ALL_STUDENT_SUBMENU_ITEMS.map((item) => item.id));

function readInitialMenu(): StudentSubmenuId {
  if (typeof window === "undefined") return "overview";
  const raw = new URLSearchParams(window.location.search).get("menu");
  if (raw && VALID_SUBMENUS.has(raw)) {
    return raw as StudentSubmenuId;
  }
  return "overview";
}

function isAlwaysAccessibleMenu(id: StudentSubmenuId): boolean {
  return (
    id === "overview" ||
    id === "notifications" ||
    id === "my-profile" ||
    id === "account-settings" ||
    id === "change-password"
  );
}

export function StudentDashboard({
  role,
  roles,
  onSwitchRole,
}: {
  role: AppRole;
  roles: AppRole[];
  onSwitchRole: (nextRole: AppRole) => void;
}) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const data = useStudentWorkspace(roles);
  const [activeMenu, setActiveMenu] = useState<StudentSubmenuId>(readInitialMenu);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<StudentGroupId>>(() => {
    const initial = findStudentNavMeta(readInitialMenu());
    return new Set<StudentGroupId>(["dashboard", "learning", "academics", initial.groupId]);
  });
  const [menuSearch, setMenuSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const visibleGroups = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return STUDENT_NAV_GROUPS.map((group) => {
      const permitted = group.items.filter(
        (item) => isAlwaysAccessibleMenu(item.id) || data.can(item.module, "view"),
      );
      const matching = q
        ? permitted.filter(
            (i) =>
              i.label.toLowerCase().includes(q) ||
              group.label.toLowerCase().includes(q) ||
              i.description.toLowerCase().includes(q),
          )
        : permitted;
      return { ...group, items: matching };
    }).filter((g) => g.items.length > 0);
  }, [data, menuSearch]);

  const activeMeta = useMemo(() => findStudentNavMeta(activeMenu), [activeMenu]);
  const hasActiveViewAccess =
    isAlwaysAccessibleMenu(activeMenu) || data.can(activeMeta.module, "view");

  const unreadNotifications = useMemo(() => {
    const notifs = data.workspace?.notifications ?? [];
    if (!user) return 0;
    return notifs.filter((n) => !n.readBy.includes(user.id)).length;
  }, [data.workspace?.notifications, user]);

  const pendingAssignmentsCount = useMemo(() => {
    const assignments = data.workspace?.assignments ?? [];
    const subByAssignment = new Map(
      (data.workspace?.assignmentSubmissions ?? []).map((s) => [s.assignmentId, s]),
    );
    return assignments.filter((a) => {
      if (a.status !== "published") return false;
      const sub = subByAssignment.get(a.id);
      return !sub || sub.status === "pending" || sub.status === "returned";
    }).length;
  }, [data.workspace?.assignmentSubmissions, data.workspace?.assignments]);

  const unreadMessagesCount = useMemo(() => {
    const msgs = data.workspace?.internalMessages ?? [];
    if (!user) return 0;
    return msgs.filter((m) => m.recipientId === user.id && !m.read && !m.deleted).length;
  }, [data.workspace?.internalMessages, user]);

  const unreadParentMessagesCount = useMemo(() => {
    const msgs = data.workspace?.parentMessages ?? [];
    if (!user) return 0;
    return msgs.filter((m) => m.senderId !== user.id && !m.read).length;
  }, [data.workspace?.parentMessages, user]);

  const navigateToMenu = useCallback((id: StudentSubmenuId) => {
    const meta = findStudentNavMeta(id);
    setActiveMenu(id);
    setExpandedGroups((prev) => {
      if (prev.has(meta.groupId)) return prev;
      const next = new Set(prev);
      next.add(meta.groupId);
      return next;
    });
    setMobileOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id === "overview") url.searchParams.delete("menu");
      else url.searchParams.set("menu", id);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  const openCourseLesson = useCallback(
    (courseId: string, lessonId?: string) => {
      setSelectedCourseId(courseId);
      setSelectedLessonId(lessonId ?? null);
      navigateToMenu("continue-learning");
    },
    [navigateToMenu],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => setActiveMenu(readInitialMenu());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function toggleGroup(groupId: StudentGroupId) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  async function handleLogout() {
    setSigningOut(true);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setSigningOut(false);
    toast.success("Signed out of Ezana Academy");
    void navigate({ to: "/login", replace: true });
  }

  if (data.isLoading && !data.workspace) {
    return <LoadingBlock label="Loading Ezana Academy Student Dashboard…" />;
  }
  if (data.error) {
    return <ErrorBlock error={data.error} />;
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-deep p-3.5 text-deep-foreground">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold font-display text-sm font-bold text-deep">
          {profile ? initials(profile) : <GraduationCap className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {data.workspace?.platformName || "Ezana Academy"}
          </p>
          <p className="truncate text-[11px] text-deep-muted">
            {data.workspace?.myStudentMeta.studentCode || "Student Portal"}
          </p>
        </div>
      </div>

      {roles.length > 1 && (
        <label className="mb-3 block px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace Role
          <select
            aria-label="Choose dashboard role"
            value={role}
            onChange={(e) => onSwitchRole(e.target.value as AppRole)}
            className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs font-semibold normal-case tracking-normal text-foreground"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={menuSearch}
          onChange={(e) => setMenuSearch(e.target.value)}
          placeholder="Find menu or module…"
          aria-label="Filter student menus"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <nav
        aria-label="Student dashboard navigation"
        className="flex-1 space-y-1.5 overflow-y-auto pr-1"
      >
        {visibleGroups.map((group) => {
          const GroupIcon = group.icon;
          const isSingle =
            group.items.length === 1 && group.id !== "account" && !menuSearch.trim();
          const isOpen =
            Boolean(menuSearch.trim()) ||
            expandedGroups.has(group.id) ||
            group.items.some((i) => i.id === activeMenu);

          if (isSingle) {
            const single = group.items[0]!;
            const active = activeMenu === single.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => navigateToMenu(single.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-foreground/85 hover:bg-secondary",
                )}
              >
                <GroupIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{group.label}</span>
              </button>
            );
          }

          return (
            <div key={group.id} className="rounded-xl border border-border/60 bg-background/40">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-bold tracking-tight text-foreground hover:bg-secondary/60"
                aria-expanded={isOpen}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <GroupIcon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{group.label}</span>
                </span>
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>

              {isOpen && (
                <div className="space-y-0.5 border-t border-border/50 px-1.5 py-1.5">
                  {group.items.map((item) => {
                    const SubIcon = item.icon;
                    const active = activeMenu === item.id;
                    const badgeCount =
                      item.id === "my-assignments"
                        ? pendingAssignmentsCount
                        : item.id === "messages"
                          ? unreadMessagesCount
                          : item.id === "parent-communication"
                            ? unreadParentMessagesCount
                            : item.id === "notifications"
                              ? unreadNotifications
                              : 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateToMenu(item.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <SubIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {badgeCount > 0 && (
                          <span
                            className={cn(
                              "inline-flex min-w-4 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums",
                              active ? "bg-gold text-deep" : "bg-gold/25 text-foreground",
                            )}
                          >
                            {badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {group.id === "account" && (
                    <button
                      type="button"
                      disabled={signingOut}
                      onClick={() => void handleLogout()}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <LogOut className="h-3.5 w-3.5 shrink-0" />
                      <span>{signingOut ? "Signing out…" : "Logout"}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-3 border-t border-border px-2 pt-3 text-xs text-muted-foreground">
        <p className="truncate font-semibold text-foreground">
          {displayName(profile) || user?.email}
        </p>
        <p className="truncate text-[11px]">{user?.email}</p>
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[276px_minmax(0,1fr)] print:block">
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden max-h-[calc(100vh-7.5rem)] self-start overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-soft lg:sticky lg:top-24 lg:flex lg:flex-col print:hidden">
        {sidebarContent}
      </aside>

      {/* Mobile Navigation Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-80 p-4">
          <SheetHeader className="sr-only">
            <SheetTitle>Student Dashboard Menu</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="min-w-0 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {activeMeta.groupLabel}
              </p>
              <p className="truncate font-display text-base font-semibold text-foreground">
                {activeMeta.label}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Quick jump to student module"
              value={activeMenu}
              onChange={(e) => navigateToMenu(e.target.value as StudentSubmenuId)}
              className="hidden h-9 max-w-[220px] rounded-lg border border-border bg-background px-2.5 text-xs font-medium sm:block"
            >
              {visibleGroups.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {g.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="relative"
              onClick={() => navigateToMenu("notifications")}
              aria-label="View student notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
              {unreadNotifications > 0 && (
                <Badge variant="gold" className="ml-0.5 px-1.5 py-0 text-[10px]">
                  {unreadNotifications}
                </Badge>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void data.refreshAll("Student records refreshed")}
              aria-label="Refresh student data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sync</span>
            </Button>
          </div>
        </header>

        <main className="min-w-0">
          {!hasActiveViewAccess ? (
            <ErrorBlock
              error={
                new Error(
                  `Access restricted: your Student role does not currently hold "${activeMeta.module}" view permission. Contact the Academy Owner or Admin to grant access.`,
                )
              }
            />
          ) : (
            <>
              {activeMenu === "overview" && (
                <StudentOverview data={data} onNavigate={navigateToMenu} />
              )}

              {activeMenu === "my-courses" && (
                <StudentMyCoursesModule
                  data={data}
                  onNavigate={navigateToMenu}
                  onStartCourse={openCourseLesson}
                />
              )}
              {activeMenu === "explore-courses" && (
                <StudentExploreCoursesModule data={data} onStartCourse={openCourseLesson} />
              )}
              {activeMenu === "continue-learning" && (
                <StudentContinueLearningModule
                  data={data}
                  selectedCourseId={selectedCourseId}
                  selectedLessonId={selectedLessonId}
                  onSelectTarget={openCourseLesson}
                  onNavigate={navigateToMenu}
                />
              )}
              {activeMenu === "course-materials" && <StudentCourseMaterialsModule data={data} />}
              {activeMenu === "elearning-resources" && <StudentResourcesModule data={data} />}
              {activeMenu === "live-classes" && <StudentLiveClassesModule data={data} />}
              {activeMenu === "learning-schedule" && (
                <StudentLearningScheduleModule data={data} onNavigate={navigateToMenu} />
              )}

              {activeMenu === "my-timetable" && <StudentTimetableModule data={data} />}
              {activeMenu === "my-attendance" && <StudentAttendanceModule data={data} />}
              {activeMenu === "my-assignments" && <StudentAssignmentsModule data={data} />}
              {activeMenu === "quizzes-exams" && (
                <StudentExamsModule data={data} onNavigate={navigateToMenu} />
              )}
              {activeMenu === "exam-results" && <StudentExamResultsModule data={data} />}
              {activeMenu === "grades-report-cards" && (
                <StudentGradesReportCardsModule data={data} />
              )}
              {activeMenu === "learning-progress" && (
                <StudentLearningProgressModule data={data} onStartCourse={openCourseLesson} />
              )}
              {activeMenu === "my-certificates" && <StudentCertificatesModule data={data} />}

              {activeMenu === "messages" && <StudentMessagesModule data={data} />}
              {activeMenu === "parent-communication" && <StudentParentCommModule data={data} />}
              {activeMenu === "discussion-forums" && (
                <StudentDiscussionForumsModule data={data} />
              )}
              {activeMenu === "announcements" && <StudentAnnouncementsModule data={data} />}
              {activeMenu === "notifications" && (
                <StudentNotificationsModule data={data} onNavigate={navigateToMenu} />
              )}

              {activeMenu === "my-fees" && (
                <StudentFeesModule data={data} onNavigate={navigateToMenu} />
              )}
              {activeMenu === "make-payment" && (
                <StudentMakePaymentModule data={data} onNavigate={navigateToMenu} />
              )}
              {activeMenu === "payment-history" && <StudentPaymentHistoryModule data={data} />}
              {activeMenu === "invoices-receipts" && <StudentInvoicesReceiptsModule data={data} />}

              {activeMenu === "my-profile" && <StudentProfileModule data={data} />}
              {activeMenu === "account-settings" && <StudentAccountSettingsModule data={data} />}
              {activeMenu === "change-password" && (
                <StudentChangePasswordModule
                  minLength={data.workspace?.minPasswordLength ?? 8}
                />
              )}
            </>
          )}
        </main>
      </div>

      <PrintableSheetDialog
        payload={data.printable}
        academyName={data.workspace?.platformName || "Ezana Academy"}
        onClose={() => data.setPrintable(null)}
      />
    </div>
  );
}
