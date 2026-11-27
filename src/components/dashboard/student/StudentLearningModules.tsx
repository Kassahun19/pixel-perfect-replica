import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileText,
  Film,
  FolderOpen,
  Library,
  Lock,
  PlayCircle,
  Search,
  Send,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, useAuth } from "@/lib/auth";
import { formatETB, FREE_LESSON_LIMIT, isFreeLesson, isLessonLocked } from "@/lib/access";
import { paginateRows } from "@/lib/owner/logic";
import type { CourseRow, LessonRow } from "@/lib/owner/types";
import { replaceChannelBranding } from "@/lib/youtube";
import type { StudentSubmenuId } from "@/lib/student/types";
import { CourseThumbnail } from "@/components/site/CourseThumbnail";
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
import { EmptyState, PageHeader, Pager, Panel, STATUS_BADGE } from "@/components/dashboard/ui";
import { VideoPlayer } from "@/components/dashboard/VideoPlayer";
import type { StudentDataHandle } from "./useStudentData";

function safeHref(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return "";
  }
  return "";
}

function localFallbackVideo(lessonIndex: number): string {
  return isFreeLesson(lessonIndex)
    ? `/videos/lesson-${lessonIndex + 1}.mp4`
    : "/videos/lesson-pro.mp4";
}

/* ========================================================================== */
/* 2.1 MY COURSES                                                             */
/* ========================================================================== */

export function StudentMyCoursesModule({
  data,
  onNavigate,
  onStartCourse,
}: {
  data: StudentDataHandle;
  onNavigate: (menu: StudentSubmenuId) => void;
  onStartCourse: (courseId: string, lessonId?: string) => void;
}) {
  const { db, workspace, maps } = data;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "completed">("all");
  const [page, setPage] = useState(1);
  const [detailCourse, setDetailCourse] = useState<CourseRow | null>(null);

  const enriched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return maps.myCourses
      .map((course) => {
        const lessons = maps.lessonsByCourse.get(course.id) ?? [];
        const completedSet = new Set(
          db.progress.filter((p) => p.course_id === course.id).map((p) => p.lesson_id),
        );
        const completedCount = lessons.filter((l) => completedSet.has(l.id)).length;
        const pct = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;
        const completionRecord = workspace?.courseCompletions.find(
          (cc) => cc.courseId === course.id,
        );
        const isCompleted =
          completionRecord?.status === "completed" ||
          completionRecord?.status === "confirmed" ||
          (lessons.length > 0 && completedCount >= lessons.length);
        const nextLesson = lessons.find((l) => !completedSet.has(l.id)) ?? lessons[0] ?? null;
        const instructor = course.instructor_id ? maps.profilesById.get(course.instructor_id) : null;
        const category = course.category_id ? maps.categoriesById.get(course.category_id) : null;
        const subject = workspace?.subjects.find((s) => s.courseIds.includes(course.id));
        const unlocked = maps.paidCourseIdSet.has(course.id);
        return {
          course,
          lessons,
          completedCount,
          pct,
          isCompleted,
          nextLesson,
          instructorName: instructor ? displayName(instructor) : "Ezana Faculty",
          categoryName: category?.name ?? "General Studies",
          subjectName: subject?.name ?? category?.name ?? "Core Subject",
          unlocked,
        };
      })
      .filter((row) => {
        if (statusFilter === "completed" && !row.isCompleted) return false;
        if (statusFilter === "in_progress" && row.isCompleted) return false;
        if (!q) return true;
        return `${row.course.title} ${row.instructorName} ${row.categoryName} ${row.subjectName}`
          .toLowerCase()
          .includes(q);
      });
  }, [db.progress, maps, search, statusFilter, workspace]);

  const { items: rows, pageCount, page: safePage } = paginateRows(enriched, page, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Courses"
        description="View your enrolled courses, instructors, subjects, learning objectives, and curriculum lessons."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("explore-courses")}>
            <Compass className="h-4 w-4" /> Explore Courses
          </Button>
        }
      />

      <Panel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 rounded-lg bg-secondary/70 p-1">
            {(
              [
                ["all", "All Enrolled"],
                ["in_progress", "In Progress"],
                ["completed", "Completed"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === val
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search my courses…"
              className="pl-9"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={maps.myCourses.length === 0 ? "No enrolled courses yet" : "No matching courses"}
            text="Explore the course catalog to enroll in available courses or submit an enrollment request."
            icon={BookOpen}
            action={
              <Button
                type="button"
                variant="emerald"
                onClick={() => onNavigate("explore-courses")}
              >
                Explore Available Courses
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((item) => (
              <article
                key={item.course.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <CourseThumbnail
                      imageUrl={item.course.image_url}
                      course={item.course}
                      alt={item.course.title}
                      className="h-16 w-24 shrink-0 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {item.subjectName} · {item.course.level} ·{" "}
                        {item.unlocked ? "Full Access" : "Free Preview"}
                      </p>
                      <h3 className="mt-0.5 line-clamp-2 font-display text-base font-semibold">
                        {item.course.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Instructor: {item.instructorName}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                    {item.course.short_description}
                  </p>
                </div>

                <div className="mt-4 space-y-3 border-t border-border pt-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {item.isCompleted ? "Completed" : "In Progress"}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {item.completedCount}/{item.lessons.length} lessons ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="emerald"
                      size="sm"
                      className="flex-1"
                      onClick={() => onStartCourse(item.course.id, item.nextLesson?.id)}
                    >
                      <PlayCircle className="h-4 w-4" />
                      {item.completedCount > 0 ? "Continue Learning" : "Start Course"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailCourse(item.course)}
                    >
                      Syllabus & Details
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <Pager page={safePage} pageCount={pageCount} onPage={setPage} />
      </Panel>

      {/* Course Details & Syllabus Dialog */}
      <Dialog open={!!detailCourse} onOpenChange={(open) => !open && setDetailCourse(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailCourse?.title ?? "Course Syllabus"}</DialogTitle>
            <DialogDescription>
              Course overview, learning objectives, and lesson list.
            </DialogDescription>
          </DialogHeader>
          {detailCourse && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{detailCourse.description}</p>
              <div className="grid gap-3 rounded-xl border border-border bg-secondary/35 p-3.5 text-xs sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Instructor</p>
                  <p className="mt-0.5 font-semibold">
                    {detailCourse.instructor_id && maps.profilesById.get(detailCourse.instructor_id)
                      ? displayName(maps.profilesById.get(detailCourse.instructor_id)!)
                      : "Ezana Faculty"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Level & Duration</p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {detailCourse.level} · {detailCourse.duration_hours} hrs
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Course Access</p>
                  <p className="mt-0.5 font-semibold">
                    {maps.paidCourseIdSet.has(detailCourse.id)
                      ? "Unlocked (Full Access)"
                      : `First ${FREE_LESSON_LIMIT} lessons free`}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Course Lessons ({(maps.lessonsByCourse.get(detailCourse.id) ?? []).length})
                </h4>
                <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {(maps.lessonsByCourse.get(detailCourse.id) ?? []).map((lesson, idx) => {
                    const done = maps.completedLessonIdSet.has(lesson.id);
                    const locked = isLessonLocked(idx, {
                      unlocked: maps.paidCourseIdSet.has(detailCourse.id),
                      signedIn: true,
                    });
                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="w-6 shrink-0 font-mono font-bold text-primary tabular-nums">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate font-medium">
                            {replaceChannelBranding(lesson.title)}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-muted-foreground tabular-nums">
                            {lesson.duration_minutes > 0 ? `${lesson.duration_minutes}m` : "<1m"}
                          </span>
                          {locked ? (
                            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : done ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setDetailCourse(null);
                                onStartCourse(detailCourse.id, lesson.id);
                              }}
                            >
                              Watch
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(maps.lessonsByCourse.get(detailCourse.id) ?? []).length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                      Lessons are being organized by the instructor.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailCourse(null)}>
              Close
            </Button>
            {detailCourse && (
              <Button
                type="button"
                variant="emerald"
                onClick={() => {
                  const id = detailCourse.id;
                  setDetailCourse(null);
                  onStartCourse(id);
                }}
              >
                <PlayCircle className="h-4 w-4" /> Continue Learning
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 2.2 EXPLORE COURSES                                                        */
/* ========================================================================== */

export function StudentExploreCoursesModule({
  data,
  onStartCourse,
}: {
  data: StudentDataHandle;
  onStartCourse: (courseId: string) => void;
}) {
  const { user } = useAuth();
  const { db, workspace, maps, enrollDirectly, mutateWorkspace, mutating } = data;
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [instructorFilter, setInstructorFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [requestCourse, setRequestCourse] = useState<CourseRow | null>(null);
  const [requestNotes, setRequestNotes] = useState("");

  const instructors = useMemo(() => {
    const ids = [
      ...new Set(db.courses.map((c) => c.instructor_id).filter((id): id is string => Boolean(id))),
    ];
    return ids
      .map((id) => maps.profilesById.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [db.courses, maps.profilesById]);

  const requestByCourse = useMemo(() => {
    const m = new Map<string, (typeof workspace extends undefined ? never : NonNullable<typeof workspace>["enrollmentRequests"][number])>();
    for (const r of workspace?.enrollmentRequests ?? []) {
      if (!m.has(r.courseId)) m.set(r.courseId, r);
    }
    return m;
  }, [workspace?.enrollmentRequests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.courses.filter((c) => {
      if (c.status !== "published") return false;
      if (categoryFilter !== "all" && c.category_id !== categoryFilter) return false;
      if (levelFilter !== "all" && c.level !== levelFilter) return false;
      if (instructorFilter !== "all" && c.instructor_id !== instructorFilter) return false;
      if (!q) return true;
      const cat = c.category_id ? maps.categoriesById.get(c.category_id)?.name ?? "" : "";
      const inst = c.instructor_id ? maps.profilesById.get(c.instructor_id) : null;
      return `${c.title} ${c.short_description} ${c.level} ${cat} ${inst ? displayName(inst) : ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [categoryFilter, db.courses, instructorFilter, levelFilter, maps, search]);

  const { items: rows, pageCount, page: safePage } = paginateRows(filtered, page, 6);

  async function submitEnrollmentRequest() {
    if (!user || !requestCourse) return;
    const meta = workspace?.courseMeta[requestCourse.id];
    await mutateWorkspace(
      {
        type: "upsert_enrollment_request",
        payload: {
          studentId: user.id,
          courseId: requestCourse.id,
          classSectionId: meta?.classSectionId ?? null,
          requestedBy: user.id,
          notes: requestNotes.trim() || "Student enrollment request from catalog",
        },
      },
      `Enrollment request submitted for ${requestCourse.title}`,
    );
    setRequestCourse(null);
    setRequestNotes("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Explore Courses"
        description="Search available academy courses by subject, level, or instructor and request or begin enrollment."
      />

      <Panel>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search courses…"
              className="pl-9"
            />
          </div>
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All Subjects / Categories</option>
            {db.categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by level"
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All Levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
          <select
            aria-label="Filter by instructor"
            value={instructorFilter}
            onChange={(e) => {
              setInstructorFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All Instructors</option>
            {instructors.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {displayName(inst)}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No courses match these filters"
            text="Clear your search filters to view all published courses."
            icon={Compass}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((course) => {
              const enrolled = maps.enrolledCourseIdSet.has(course.id);
              const meta = workspace?.courseMeta[course.id];
              const enrollmentMode = meta?.enrollmentMode ?? "open";
              const count = workspace?.courseEnrollmentCounts[course.id] ?? 0;
              const isFull =
                meta?.maxCapacity !== null &&
                meta?.maxCapacity !== undefined &&
                count >= meta.maxCapacity;
              const existingRequest = requestByCourse.get(course.id);
              const instructor = course.instructor_id
                ? maps.profilesById.get(course.instructor_id)
                : null;
              const category = course.category_id ? maps.categoriesById.get(course.category_id) : null;
              const lessonCount = (maps.lessonsByCourse.get(course.id) ?? []).length;

              return (
                <article
                  key={course.id}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      <CourseThumbnail
                        imageUrl={course.image_url}
                        course={course}
                        alt={course.title}
                        className="h-16 w-24 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {category?.name ?? "Ezana Curriculum"} · {course.level} · {lessonCount}{" "}
                          lessons
                        </p>
                        <h3 className="mt-0.5 line-clamp-2 font-display text-base font-semibold">
                          {course.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {instructor ? displayName(instructor) : "Ezana Faculty"} ·{" "}
                          {formatETB(meta?.priceEtb ?? 218)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                      {course.short_description}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {enrollmentMode === "closed"
                        ? "Enrollment closed"
                        : isFull
                          ? `Class full (${count}/${meta?.maxCapacity})`
                          : enrollmentMode === "approval"
                            ? "Approval required"
                            : "Open enrollment"}
                    </span>

                    {enrolled ? (
                      <Button
                        type="button"
                        variant="emerald"
                        size="sm"
                        onClick={() => onStartCourse(course.id)}
                      >
                        <PlayCircle className="h-4 w-4" /> Open Course
                      </Button>
                    ) : existingRequest ? (
                      <Badge
                        variant={STATUS_BADGE[existingRequest.status] ?? "muted"}
                        className="capitalize"
                      >
                        Request {existingRequest.status}
                      </Badge>
                    ) : enrollmentMode === "closed" || isFull ? (
                      <Button type="button" variant="outline" size="sm" disabled>
                        Not Eligible
                      </Button>
                    ) : enrollmentMode === "open" ? (
                      <Button
                        type="button"
                        variant="emerald"
                        size="sm"
                        disabled={mutating}
                        onClick={() => void enrollDirectly(course)}
                      >
                        Enroll Now
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={mutating}
                        onClick={() => {
                          setRequestCourse(course);
                          setRequestNotes("");
                        }}
                      >
                        <Send className="h-3.5 w-3.5" /> Request Enrollment
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <Pager page={safePage} pageCount={pageCount} onPage={setPage} />
      </Panel>

      {/* My Enrollment Requests Table */}
      {(workspace?.enrollmentRequests ?? []).length > 0 && (
        <Panel title="My Enrollment Requests">
          <div className="divide-y divide-border">
            {(workspace?.enrollmentRequests ?? []).map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {maps.coursesById.get(req.courseId)?.title ?? "Course Request"}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Submitted {new Date(req.createdAt).toLocaleDateString()}
                    {req.reviewNote ? ` · Note: ${req.reviewNote}` : ""}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[req.status] ?? "muted"} className="capitalize">
                  {req.status}
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Dialog open={!!requestCourse} onOpenChange={(open) => !open && setRequestCourse(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Course Enrollment</DialogTitle>
            <DialogDescription>
              Submit an enrollment request for {requestCourse?.title}. Staff will review and notify
              you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="enroll-note" className="text-xs font-semibold">
              Note to Academy Admissions (optional)
            </label>
            <Textarea
              id="enroll-note"
              rows={3}
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              placeholder="Share your learning goals or preferred schedule…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRequestCourse(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="emerald"
              disabled={mutating}
              onClick={() => void submitEnrollmentRequest()}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 2.3 CONTINUE LEARNING                                                      */
/* ========================================================================== */

export function StudentContinueLearningModule({
  data,
  selectedCourseId,
  selectedLessonId,
  onSelectTarget,
  onNavigate,
}: {
  data: StudentDataHandle;
  selectedCourseId: string | null;
  selectedLessonId: string | null;
  onSelectTarget: (courseId: string, lessonId?: string) => void;
  onNavigate: (menu: StudentSubmenuId) => void;
}) {
  const { db, maps, markLessonComplete, mutating } = data;
  const activeCourse =
    (selectedCourseId ? maps.coursesById.get(selectedCourseId) : null) ??
    maps.myCourses[0] ??
    null;

  const lessons = useMemo<LessonRow[]>(
    () => (activeCourse ? (maps.lessonsByCourse.get(activeCourse.id) ?? []) : []),
    [activeCourse, maps.lessonsByCourse],
  );

  const recommendedLesson = useMemo(() => {
    if (!lessons.length) return null;
    if (selectedLessonId && lessons.some((l) => l.id === selectedLessonId)) {
      return lessons.find((l) => l.id === selectedLessonId) ?? lessons[0]!;
    }
    return lessons.find((l) => !maps.completedLessonIdSet.has(l.id)) ?? lessons[0]!;
  }, [lessons, maps.completedLessonIdSet, selectedLessonId]);

  const activeIndex = recommendedLesson
    ? Math.max(0, lessons.findIndex((l) => l.id === recommendedLesson.id))
    : 0;
  const unlocked = activeCourse ? maps.paidCourseIdSet.has(activeCourse.id) : false;
  const isLocked = recommendedLesson
    ? isLessonLocked(activeIndex, { unlocked, signedIn: true })
    : false;
  const isComplete = recommendedLesson
    ? maps.completedLessonIdSet.has(recommendedLesson.id)
    : false;

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!recommendedLesson || isLocked) {
      setVideoUrl(null);
      return undefined;
    }
    setVideoLoading(true);
    void (async () => {
      try {
        const { data: media } = await supabase
          .from("lesson_media")
          .select("video_url")
          .eq("lesson_id", recommendedLesson.id)
          .maybeSingle();
        if (!active) return;
        setVideoUrl(media?.video_url?.trim() || null);
      } catch {
        if (!active) return;
        setVideoUrl(null);
      } finally {
        if (active) setVideoLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isLocked, recommendedLesson]);

  const nextLesson = lessons[activeIndex + 1] ?? null;

  if (!activeCourse) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Continue Learning"
          description="Resume your latest course and complete upcoming lessons."
        />
        <Panel>
          <EmptyState
            title="Enroll in a course to start learning"
            text="Browse available courses to unlock video lessons and track your completion progress."
            icon={PlayCircle}
            action={
              <Button
                type="button"
                variant="emerald"
                onClick={() => onNavigate("explore-courses")}
              >
                Explore Courses
              </Button>
            }
          />
        </Panel>
      </div>
    );
  }

  const completedInActive = lessons.filter((l) => maps.completedLessonIdSet.has(l.id)).length;
  const pct = lessons.length ? Math.round((completedInActive / lessons.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Continue Learning"
        description={`Resuming ${activeCourse.title} · ${completedInActive} of ${lessons.length} lessons completed (${pct}%)`}
        actions={
          <select
            aria-label="Select enrolled course"
            value={activeCourse.id}
            onChange={(e) => onSelectTarget(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold"
          >
            {maps.myCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <Panel>
          <div className="overflow-hidden rounded-xl bg-deep">
            {isLocked ? (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center text-deep-foreground">
                <Lock className="h-10 w-10 text-gold" />
                <p className="font-semibold">This lesson requires Ezana Pro access</p>
                <p className="max-w-md text-xs text-deep-muted">
                  The first {FREE_LESSON_LIMIT} lessons are free. Submit your payment receipt in
                  Fees &amp; Payments to unlock the remaining lessons.
                </p>
                <Button type="button" variant="hero" onClick={() => onNavigate("make-payment")}>
                  Unlock Course ({formatETB()})
                </Button>
              </div>
            ) : videoLoading ? (
              <div className="flex aspect-video items-center justify-center text-sm text-deep-muted">
                Loading lesson video…
              </div>
            ) : videoUrl && recommendedLesson ? (
              <VideoPlayer
                key={`${recommendedLesson.id}-${videoUrl}`}
                url={videoUrl}
                title={replaceChannelBranding(recommendedLesson.title)}
                fallbackUrl={localFallbackVideo(activeIndex)}
              />
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 text-deep-foreground">
                <Film className="h-9 w-9 text-gold" />
                <p className="text-sm">No video attached to this lesson yet.</p>
              </div>
            )}
          </div>

          {recommendedLesson && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground tabular-nums">
                  Lesson {activeIndex + 1} of {lessons.length} ·{" "}
                  {recommendedLesson.duration_minutes > 0
                    ? `${recommendedLesson.duration_minutes} min`
                    : "< 1 min"}
                </p>
                <h2 className="font-display text-lg font-semibold">
                  {replaceChannelBranding(recommendedLesson.title)}
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {!isLocked && (
                  <Button
                    type="button"
                    variant={isComplete ? "outline" : "emerald"}
                    size="sm"
                    disabled={isComplete || mutating}
                    onClick={() => void markLessonComplete(activeCourse.id, recommendedLesson.id)}
                  >
                    <Check className="h-4 w-4" />
                    {isComplete ? "Completed" : "Mark Lesson Complete"}
                  </Button>
                )}
                {nextLesson && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectTarget(activeCourse.id, nextLesson.id)}
                  >
                    Next Lesson
                  </Button>
                )}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Course Playlist">
          <div className="max-h-[460px] divide-y divide-border overflow-y-auto">
            {lessons.map((l, idx) => {
              const done = maps.completedLessonIdSet.has(l.id);
              const locked = isLessonLocked(idx, { unlocked, signedIn: true });
              const active = recommendedLesson?.id === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onSelectTarget(activeCourse.id, l.id)}
                  className={`flex w-full items-center gap-3 px-2.5 py-2.5 text-left text-xs transition-colors ${
                    active ? "bg-secondary font-semibold" : "hover:bg-secondary/50"
                  }`}
                >
                  <span className="w-6 shrink-0 font-mono font-bold text-primary tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="line-clamp-2 flex-1">{replaceChannelBranding(l.title)}</span>
                  {locked ? (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <PlayCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
            {lessons.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No lessons published yet for this course.
              </p>
            )}
          </div>

          {db.progress.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground">Recent Activity</p>
              <p className="mt-1 text-xs tabular-nums text-foreground">
                Last completed lesson:{" "}
                {new Date(db.progress[0]!.completed_at).toLocaleDateString()}
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 2.4 COURSE MATERIALS                                                       */
/* ========================================================================== */

export function StudentCourseMaterialsModule({ data }: { data: StudentDataHandle }) {
  const { workspace, maps } = data;
  const [courseFilter, setCourseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<{ title: string; url: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (workspace?.courseMaterials ?? []).filter((m) => {
      if (courseFilter !== "all" && m.courseId !== courseFilter) return false;
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (!q) return true;
      return `${m.title} ${m.topic} ${m.description} ${maps.coursesById.get(m.courseId)?.title ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [courseFilter, maps.coursesById, search, typeFilter, workspace?.courseMaterials]);

  const { items: rows, pageCount, page: safePage } = paginateRows(filtered, page, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Materials"
        description="Access videos, PDFs, slides, and reference guides shared by your course instructors."
      />

      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search materials or topics…"
              className="pl-9"
            />
          </div>
          <select
            aria-label="Filter materials by course"
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All Enrolled Courses</option>
            {maps.myCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter materials by type"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All Formats</option>
            <option value="video">Video</option>
            <option value="pdf">PDF</option>
            <option value="document">Document</option>
            <option value="presentation">Presentation</option>
            <option value="link">Reference Link</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No course materials available yet"
            text="Materials shared by your instructors for your enrolled courses will appear here."
            icon={FolderOpen}
          />
        ) : (
          <div className="divide-y divide-border">
            {rows.map((m) => {
              const link = safeHref(m.url);
              return (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      {m.type === "video" ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{m.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {maps.coursesById.get(m.courseId)?.title ?? "Course"}
                        {m.topic ? ` · ${m.topic}` : ""} · {m.type.toUpperCase()}
                        {m.fileSizeLabel ? ` · ${m.fileSizeLabel}` : ""}
                      </p>
                      {m.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.type === "video" && link && (
                      <Button
                        type="button"
                        size="sm"
                        variant="emerald"
                        onClick={() => setPreviewUrl({ title: m.title, url: link })}
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Play
                      </Button>
                    )}
                    {link && (
                      <Button asChild size="sm" variant="outline">
                        <a href={link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" /> Open / Download
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Pager page={safePage} pageCount={pageCount} onPage={setPage} />
      </Panel>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewUrl?.title ?? "Material Player"}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="overflow-hidden rounded-xl">
              <VideoPlayer url={previewUrl.url} title={previewUrl.title} autoPlay />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 2.5 E-LEARNING RESOURCES                                                   */
/* ========================================================================== */

export function StudentResourcesModule({ data }: { data: StudentDataHandle }) {
  const { db, workspace, maps } = data;
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (workspace?.resources ?? []).filter((r) => {
      if (categoryFilter !== "all" && r.categoryId !== categoryFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!q) return true;
      return `${r.title} ${r.description} ${r.type}`.toLowerCase().includes(q);
    });
  }, [categoryFilter, search, typeFilter, workspace?.resources]);

  const { items: rows, pageCount, page: safePage } = paginateRows(filtered, page, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="E-Learning Resources"
        description="Browse digital textbooks, worksheets, presentations, and study links unlocked for your learning path."
      />

      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search resources…"
              className="pl-9"
            />
          </div>
          <select
            aria-label="Filter resources by category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All Categories</option>
            {db.categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter resources by type"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All Types</option>
            <option value="pdf">PDF</option>
            <option value="document">Document</option>
            <option value="presentation">Presentation</option>
            <option value="video">Video</option>
            <option value="link">Web Resource</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No E-learning resources match your filter"
            text="Authorized digital resources for your courses and public study library will appear here."
            icon={Library}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((r) => {
              const href = safeHref(r.url);
              const cat = r.categoryId ? maps.categoriesById.get(r.categoryId) : null;
              return (
                <div
                  key={r.id}
                  className="flex flex-col justify-between rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {r.type.toUpperCase()} · {cat?.name ?? "General"} ·{" "}
                      {r.accessLevel.replace("_", " ")}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold">{r.title}</h3>
                    {r.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs">
                    <span className="text-muted-foreground">{r.fileSizeLabel || "Digital"}</span>
                    {href ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" /> Access Resource
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">Link pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Pager page={safePage} pageCount={pageCount} onPage={setPage} />
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 2.6 LIVE CLASSES                                                           */
/* ========================================================================== */

export function StudentLiveClassesModule({ data }: { data: StudentDataHandle }) {
  const { workspace, maps } = data;
  const [filter, setFilter] = useState<"all" | "upcoming" | "ended">("all");
  const [recordingView, setRecordingView] = useState<{ title: string; url: string } | null>(null);

  const sessions = useMemo(() => {
    return (workspace?.liveClasses ?? []).filter((lc) => {
      if (filter === "upcoming") return lc.status === "scheduled" || lc.status === "live";
      if (filter === "ended") return lc.status === "ended";
      return true;
    });
  }, [filter, workspace?.liveClasses]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Classes"
        description="Join scheduled live sessions for your enrolled courses and review shared session recordings."
      />

      <Panel>
        <div className="mb-4 flex gap-1.5 rounded-lg bg-secondary/70 p-1 w-fit">
          {(
            [
              ["all", "All Sessions"],
              ["upcoming", "Upcoming & Live"],
              ["ended", "Completed"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            title="No live classes scheduled"
            text="Upcoming live classes and past session recordings for your enrolled courses will appear here."
            icon={Video}
          />
        ) : (
          <div className="space-y-3">
            {sessions.map((lc) => {
              const joinHref = safeHref(lc.meetingUrl);
              const recHref = lc.recordingUrl ? safeHref(lc.recordingUrl) : "";
              const instructor = maps.profilesById.get(lc.instructorId);
              return (
                <div
                  key={lc.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{lc.title}</h3>
                      <Badge variant={STATUS_BADGE[lc.status] ?? "secondary"} className="capitalize">
                        {lc.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {maps.coursesById.get(lc.courseId)?.title ?? "Course"} · {lc.scheduledDate}{" "}
                      · {lc.startTime}–{lc.endTime} ·{" "}
                      {instructor ? displayName(instructor) : "Course Instructor"}
                    </p>
                    {lc.notes && <p className="mt-1 text-xs text-muted-foreground">{lc.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(lc.status === "live" || lc.status === "scheduled") &&
                      (joinHref ? (
                        <Button asChild size="sm" variant={lc.status === "live" ? "emerald" : "outline"}>
                          <a href={joinHref} target="_blank" rel="noopener noreferrer">
                            <Video className="h-3.5 w-3.5" />{" "}
                            {lc.status === "live" ? "Join Live Now" : "Meeting Link"}
                          </a>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => toast.info("Meeting link will be shared shortly.")}
                        >
                          Link Pending
                        </Button>
                      ))}
                    {recHref && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRecordingView({ title: lc.title, url: recHref })}
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Watch Recording
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Dialog open={!!recordingView} onOpenChange={(open) => !open && setRecordingView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{recordingView?.title ?? "Session Recording"}</DialogTitle>
          </DialogHeader>
          {recordingView && (
            <div className="overflow-hidden rounded-xl">
              <VideoPlayer url={recordingView.url} title={recordingView.title} autoPlay />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 2.7 MY LEARNING SCHEDULE                                                   */
/* ========================================================================== */

export function StudentLearningScheduleModule({
  data,
  onNavigate,
}: {
  data: StudentDataHandle;
  onNavigate: (menu: StudentSubmenuId) => void;
}) {
  const { workspace, maps } = data;
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [courseFilter, setCourseFilter] = useState("all");

  const items = useMemo(() => {
    const out: {
      id: string;
      kind: "timetable" | "live_class" | "assignment" | "exam" | "calendar";
      title: string;
      courseTitle: string;
      courseId: string | null;
      dateLabel: string;
      timeLabel: string;
      target: StudentSubmenuId;
    }[] = [];

    for (const slot of workspace?.timetables ?? []) {
      if (courseFilter !== "all" && slot.courseId !== courseFilter) continue;
      out.push({
        id: `tt-${slot.id}`,
        kind: "timetable",
        title: slot.title,
        courseTitle: slot.courseId ? maps.coursesById.get(slot.courseId)?.title ?? "Class" : "Cohort",
        courseId: slot.courseId,
        dateLabel: slot.dayOfWeek,
        timeLabel: `${slot.startTime}–${slot.endTime}`,
        target: "my-timetable",
      });
    }

    for (const lc of workspace?.liveClasses ?? []) {
      if (lc.status === "cancelled") continue;
      if (courseFilter !== "all" && lc.courseId !== courseFilter) continue;
      out.push({
        id: `lc-${lc.id}`,
        kind: "live_class",
        title: lc.title,
        courseTitle: maps.coursesById.get(lc.courseId)?.title ?? "Course",
        courseId: lc.courseId,
        dateLabel: lc.scheduledDate,
        timeLabel: `${lc.startTime}–${lc.endTime}`,
        target: "live-classes",
      });
    }

    for (const a of workspace?.assignments ?? []) {
      if (courseFilter !== "all" && a.courseId !== courseFilter) continue;
      out.push({
        id: `asg-${a.id}`,
        kind: "assignment",
        title: `${a.title} (Due)`,
        courseTitle: maps.coursesById.get(a.courseId)?.title ?? "Course",
        courseId: a.courseId,
        dateLabel: a.dueDate,
        timeLabel: `${a.maxScore} pts`,
        target: "my-assignments",
      });
    }

    for (const ex of workspace?.exams ?? []) {
      if (courseFilter !== "all" && ex.courseId !== courseFilter) continue;
      out.push({
        id: `ex-${ex.id}`,
        kind: "exam",
        title: ex.title,
        courseTitle: maps.coursesById.get(ex.courseId)?.title ?? "Course",
        courseId: ex.courseId,
        dateLabel: ex.scheduledDate,
        timeLabel: `${ex.startTime} (${ex.durationMinutes}m)`,
        target: "quizzes-exams",
      });
    }

    if (viewMode === "monthly") {
      for (const ev of workspace?.calendarEvents ?? []) {
        if (courseFilter !== "all") continue;
        out.push({
          id: `cal-${ev.id}`,
          kind: "calendar",
          title: ev.title,
          courseTitle: `Academic Calendar · ${ev.category}`,
          courseId: null,
          dateLabel: ev.date,
          timeLabel: ev.endDate ? `Until ${ev.endDate}` : "All Day",
          target: "announcements",
        });
      }
    }

    if (viewMode === "daily") {
      const todayWeekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const todayIso = new Date().toISOString().slice(0, 10);
      return out.filter(
        (item) => item.dateLabel === todayWeekday || item.dateLabel === todayIso,
      );
    }

    return out;
  }, [courseFilter, maps.coursesById, viewMode, workspace]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Learning Schedule"
        description="Unified daily, weekly, and monthly plan covering live classes, timetable slots, assignments, and exams."
      />

      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5 rounded-lg bg-secondary/70 p-1">
            {(
              [
                ["daily", "Today"],
                ["weekly", "Weekly Agenda"],
                ["monthly", "Term & Calendar"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  viewMode === mode
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter schedule by course"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
          >
            <option value="all">All Enrolled Courses</option>
            {maps.myCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title={
              viewMode === "daily"
                ? "Nothing scheduled for today"
                : "No scheduled activities in this view"
            }
            text="Switch to Weekly Agenda or Term & Calendar to inspect upcoming classes and deadlines."
            icon={CalendarRange}
          />
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <CalendarClock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {item.courseTitle} · {item.dateLabel} · {item.timeLabel}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate(item.target)}
                >
                  Open
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
