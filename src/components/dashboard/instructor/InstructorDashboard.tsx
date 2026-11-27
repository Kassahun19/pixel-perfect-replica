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
import type { InstructorGroupId, InstructorSubmenuId } from "@/lib/instructor/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorBlock, LoadingBlock } from "@/components/dashboard/ui";
import { PrintableSheetDialog } from "@/components/dashboard/owner/PrintableSheetDialog";
import {
  ALL_INSTRUCTOR_SUBMENU_ITEMS,
  INSTRUCTOR_NAV_GROUPS,
  findInstructorNavMeta,
} from "./nav-config";
import { useInstructorWorkspace } from "./useInstructorData";
import { InstructorOverview } from "./InstructorOverview";
import {
  InstructorAnnouncementsModule,
  InstructorCoursesModule,
  InstructorMaterialsModule,
  InstructorResourcesModule,
} from "./InstructorCourseModules";
import {
  InstructorAttendanceModule,
  InstructorClassesModule,
  InstructorLiveClassesModule,
  InstructorStudentsModule,
  InstructorTimetableModule,
} from "./InstructorClassModules";
import {
  InstructorAssignmentsModule,
  InstructorExamsModule,
  InstructorGradebookModule,
  InstructorQuestionBankModule,
  InstructorSubmissionsModule,
} from "./InstructorAssessmentModules";
import {
  InstructorCourseCompletionModule,
  InstructorLearningActivitiesModule,
  InstructorPerformanceReportsModule,
  InstructorStudentProgressModule,
} from "./InstructorPerformanceModules";
import {
  InstructorAccountSettingsModule,
  InstructorChangePasswordModule,
  InstructorDiscussionForumsModule,
  InstructorEarningsModule,
  InstructorNotificationsModule,
  InstructorParentCommModule,
  InstructorProfileModule,
  InstructorStudentMessagesModule,
} from "./InstructorCommEarningsModules";

const VALID_SUBMENUS = new Set<string>(ALL_INSTRUCTOR_SUBMENU_ITEMS.map((item) => item.id));

function readInitialMenu(): InstructorSubmenuId {
  if (typeof window === "undefined") return "overview";
  const raw = new URLSearchParams(window.location.search).get("menu");
  if (raw && VALID_SUBMENUS.has(raw)) {
    return raw as InstructorSubmenuId;
  }
  return "overview";
}

export function InstructorDashboard({
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
  const data = useInstructorWorkspace(roles);
  const [activeMenu, setActiveMenu] = useState<InstructorSubmenuId>(readInitialMenu);
  const [expandedGroups, setExpandedGroups] = useState<Set<InstructorGroupId>>(() => {
    const initial = findInstructorNavMeta(readInitialMenu());
    return new Set<InstructorGroupId>(["dashboard", "courses", "classes", initial.groupId]);
  });
  const [menuSearch, setMenuSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const visibleGroups = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return INSTRUCTOR_NAV_GROUPS.map((group) => {
      const permitted = group.items.filter((item) => {
        if (
          item.id === "overview" ||
          item.id === "my-earnings" ||
          item.id === "payment-history" ||
          item.id === "my-profile" ||
          item.id === "account-settings" ||
          item.id === "change-password"
        ) {
          return true;
        }
        return data.can(item.module, "view");
      });
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

  const activeMeta = useMemo(() => findInstructorNavMeta(activeMenu), [activeMenu]);
  const alwaysAccessible =
    activeMenu === "overview" ||
    activeMenu === "my-earnings" ||
    activeMenu === "payment-history" ||
    activeMenu === "my-profile" ||
    activeMenu === "account-settings" ||
    activeMenu === "change-password";
  const hasActiveViewAccess = alwaysAccessible || data.can(activeMeta.module, "view");

  const unreadNotifications = useMemo(() => {
    const notifs = data.workspace?.notifications ?? [];
    if (!user) return 0;
    return notifs.filter((n) => !n.readBy.includes(user.id)).length;
  }, [data.workspace?.notifications, user]);

  const pendingSubmissionsCount = useMemo(() => {
    const subs = data.workspace?.assignmentSubmissions ?? [];
    return subs.filter((s) => s.status === "submitted" || s.status === "late").length;
  }, [data.workspace?.assignmentSubmissions]);

  const unreadStudentMessagesCount = useMemo(() => {
    const msgs = data.workspace?.internalMessages ?? [];
    if (!user) return 0;
    return msgs.filter((m) => m.recipientId === user.id && !m.read && !m.deleted).length;
  }, [data.workspace?.internalMessages, user]);

  const navigateToMenu = useCallback((id: InstructorSubmenuId) => {
    const meta = findInstructorNavMeta(id);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => setActiveMenu(readInitialMenu());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function toggleGroup(groupId: InstructorGroupId) {
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
    return <LoadingBlock label="Loading Ezana Academy Instructor Dashboard…" />;
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
          <p className="truncate text-sm font-bold">Ezana Academy</p>
          <p className="truncate text-[11px] text-deep-muted">Instructor Workspace</p>
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
          aria-label="Filter instructor menus"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <nav
        aria-label="Instructor dashboard navigation"
        className="flex-1 space-y-1.5 overflow-y-auto pr-1"
      >
        {visibleGroups.map((group) => {
          const GroupIcon = group.icon;
          const isSingle = group.items.length === 1 && group.id !== "account" && !menuSearch.trim();
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
                      item.id === "submissions" || item.id === "grading-evaluation"
                        ? pendingSubmissionsCount
                        : item.id === "student-messages"
                          ? unreadStudentMessagesCount
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
            <SheetTitle>Instructor Dashboard Menu</SheetTitle>
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
              aria-label="Quick jump to instructor module"
              value={activeMenu}
              onChange={(e) => navigateToMenu(e.target.value as InstructorSubmenuId)}
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
              aria-label="View instructor notifications"
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
              onClick={() => void data.refreshAll("Instructor records refreshed")}
              aria-label="Refresh instructor data"
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
                  `Access restricted: your Instructor role does not currently hold "${activeMeta.module}" view permission. Contact the Academy Owner or Admin to grant access.`,
                )
              }
            />
          ) : (
            <>
              {activeMenu === "overview" && (
                <InstructorOverview data={data} onNavigate={navigateToMenu} />
              )}
              {(activeMenu === "my-courses" || activeMenu === "create-course") && (
                <InstructorCoursesModule
                  key={activeMenu}
                  data={data}
                  mode={activeMenu === "create-course" ? "create" : "list"}
                />
              )}
              {activeMenu === "course-materials" && <InstructorMaterialsModule data={data} />}
              {activeMenu === "elearning-resources" && <InstructorResourcesModule data={data} />}
              {activeMenu === "course-announcements" && (
                <InstructorAnnouncementsModule key="course-ann" data={data} scope="course" />
              )}

              {activeMenu === "my-classes" && <InstructorClassesModule data={data} />}
              {(activeMenu === "my-students" || activeMenu === "student-records") && (
                <InstructorStudentsModule
                  key={activeMenu}
                  data={data}
                  mode={activeMenu === "student-records" ? "records" : "students"}
                />
              )}
              {activeMenu === "timetables" && <InstructorTimetableModule data={data} />}
              {activeMenu === "attendance" && <InstructorAttendanceModule data={data} />}
              {activeMenu === "live-classes" && <InstructorLiveClassesModule data={data} />}

              {(activeMenu === "create-assignments" || activeMenu === "manage-assignments") && (
                <InstructorAssignmentsModule
                  key={activeMenu}
                  data={data}
                  mode={activeMenu === "create-assignments" ? "create" : "manage"}
                />
              )}
              {activeMenu === "quizzes-exams" && <InstructorExamsModule data={data} />}
              {activeMenu === "question-bank" && <InstructorQuestionBankModule data={data} />}
              {(activeMenu === "submissions" || activeMenu === "grading-evaluation") && (
                <InstructorSubmissionsModule
                  key={activeMenu}
                  data={data}
                  mode={activeMenu === "grading-evaluation" ? "grading" : "submissions"}
                />
              )}
              {activeMenu === "grades-report-cards" && <InstructorGradebookModule data={data} />}

              {activeMenu === "student-progress" && <InstructorStudentProgressModule data={data} />}
              {activeMenu === "performance-reports" && (
                <InstructorPerformanceReportsModule data={data} />
              )}
              {activeMenu === "learning-activities" && (
                <InstructorLearningActivitiesModule data={data} />
              )}
              {activeMenu === "course-completion" && (
                <InstructorCourseCompletionModule data={data} />
              )}

              {activeMenu === "parent-communication" && <InstructorParentCommModule data={data} />}
              {activeMenu === "student-messages" && <InstructorStudentMessagesModule data={data} />}
              {activeMenu === "discussion-forums" && (
                <InstructorDiscussionForumsModule data={data} />
              )}
              {activeMenu === "class-announcements" && (
                <InstructorAnnouncementsModule key="class-ann" data={data} scope="class" />
              )}
              {activeMenu === "notifications" && <InstructorNotificationsModule data={data} />}

              {(activeMenu === "my-earnings" || activeMenu === "payment-history") && (
                <InstructorEarningsModule
                  key={activeMenu}
                  data={data}
                  mode={activeMenu === "payment-history" ? "history" : "earnings"}
                />
              )}

              {activeMenu === "my-profile" && <InstructorProfileModule data={data} />}
              {activeMenu === "account-settings" && <InstructorAccountSettingsModule data={data} />}
              {activeMenu === "change-password" && <InstructorChangePasswordModule />}
            </>
          )}
        </main>
      </div>

      <PrintableSheetDialog
        payload={data.printable}
        academyName="Ezana Academy"
        onClose={() => data.setPrintable(null)}
      />
    </div>
  );
}
