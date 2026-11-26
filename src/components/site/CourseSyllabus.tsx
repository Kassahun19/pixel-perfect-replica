import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Lock,
  PlayCircle,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { isFreeLesson } from "@/lib/access";
import {
  filterAndSortLessons,
  formatMinutesSummary,
  getPageNumbers,
  type LessonAccessFilter,
  type LessonSortOption,
  type SyllabusLesson,
} from "@/lib/syllabus";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  lessons: SyllabusLesson[];
  courseSlug: string;
  isSignedIn: boolean;
};

const ROW_SIZE_OPTIONS = [8, 10, 15, 25, 0] as const;

export function CourseSyllabus({ lessons, courseSlug, isSignedIn }: Props) {
  const [query, setQuery] = useState("");
  const [accessFilter, setAccessFilter] = useState<LessonAccessFilter>("all");
  const [sortBy, setSortBy] = useState<LessonSortOption>("order-asc");
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const freeCount = useMemo(() => lessons.filter((_, i) => isFreeLesson(i)).length, [lessons]);
  const proCount = lessons.length - freeCount;

  const processed = useMemo(
    () => filterAndSortLessons(lessons, { query, accessFilter, sortBy }),
    [lessons, query, accessFilter, sortBy],
  );

  const totalFilteredMinutes = useMemo(
    () => processed.reduce((sum, l) => sum + Math.max(0, l.duration_minutes), 0),
    [processed],
  );

  const effectivePageSize = rowsPerPage === 0 ? Math.max(1, processed.length) : rowsPerPage;
  const totalPages = Math.max(1, Math.ceil(processed.length / effectivePageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [query, accessFilter, sortBy, rowsPerPage, courseSlug]);

  const startIndex = (safePage - 1) * effectivePageSize;
  const visibleLessons = processed.slice(startIndex, startIndex + effectivePageSize);
  const showingFrom = processed.length === 0 ? 0 : startIndex + 1;
  const showingTo = startIndex + visibleLessons.length;
  const pageNumbers = getPageNumbers(safePage, totalPages);
  const hasActiveFilters =
    query.trim().length > 0 || accessFilter !== "all" || sortBy !== "order-asc";

  function resetFilters() {
    setQuery("");
    setAccessFilter("all");
    setSortBy("order-asc");
    setPage(1);
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold">Course content</h2>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {processed.length} of {lessons.length} video{lessons.length === 1 ? "" : "s"}
            <span aria-hidden="true"> · </span>
            {formatMinutesSummary(totalFilteredMinutes)} total
          </p>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset filters
          </button>
        )}
      </div>

      {/* Filter & toolbar surface */}
      <div className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter lessons by title or topic…"
              aria-label="Filter lessons by title or topic"
              className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear lesson search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">Sort lessons</span>
              <select
                aria-label="Sort lessons"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as LessonSortOption)}
                className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="order-asc">Lesson order (1 → {lessons.length})</option>
                <option value="order-desc">Reverse ({lessons.length} → 1)</option>
                <option value="duration-asc">Shortest first</option>
                <option value="duration-desc">Longest first</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="hidden sm:inline">Rows</span>
              <select
                aria-label="Lessons per page"
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="h-10 rounded-xl border border-input bg-background px-2.5 text-xs font-semibold tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ROW_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size === 0 ? `All (${lessons.length})` : `${size} / page`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Access filter tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div
            role="tablist"
            aria-label="Filter lessons by access"
            className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-secondary/80 p-1"
          >
            {(
              [
                { id: "all", label: `All (${lessons.length})` },
                { id: "free", label: `Free previews (${freeCount})` },
                { id: "pro", label: `Ezana Pro (${proCount})` },
              ] as const
            ).map((tab) => {
              const active = accessFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setAccessFilter(tab.id)}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground tabular-nums">
            Showing {showingFrom}–{showingTo} of {processed.length}
          </p>
        </div>
      </div>

      {/* Lesson list */}
      {visibleLessons.length > 0 ? (
        <ol className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {visibleLessons.map((l) => {
            const lessonNumber = String(l.originalIndex + 1).padStart(2, "0");
            const durationText = l.duration_minutes > 0 ? `${l.duration_minutes} min` : "< 1 min";
            const rowBody = (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-bold tabular-nums text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  {lessonNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-[15px]">
                    {l.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground tabular-nums sm:hidden">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {durationText}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{l.isFree ? "Free preview" : "Ezana Pro"}</span>
                  </div>
                </div>
                <span className="hidden shrink-0 items-center gap-1.5 text-xs font-medium tabular-nums text-muted-foreground sm:inline-flex">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {durationText}
                </span>
                {l.isFree ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-bold text-success">
                    <PlayCircle className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Watch free</span>
                    <span className="sm:hidden">Free</span>
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Pro</span>
                  </span>
                )}
              </>
            );

            return (
              <li key={l.id}>
                {l.isFree ? (
                  isSignedIn ? (
                    <Link
                      to="/dashboard/learn/$slug"
                      params={{ slug: courseSlug }}
                      search={{ lesson: l.id }}
                      className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                    >
                      {rowBody}
                    </Link>
                  ) : (
                    <Link
                      to="/register"
                      className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                    >
                      {rowBody}
                    </Link>
                  )
                ) : (
                  <Link
                    to="/pro"
                    search={{ course: courseSlug }}
                    className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                  >
                    {rowBody}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-4 rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <p className="font-display text-lg font-semibold text-foreground">No matching lessons</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No lessons match your current search or filter settings.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5" /> Show all lessons
          </Button>
        </div>
      )}

      {/* Pagination footer */}
      {totalPages > 1 && (
        <nav
          aria-label="Course lessons pagination"
          className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft sm:flex-row"
        >
          <p className="text-xs font-medium text-muted-foreground tabular-nums">
            Page <span className="font-semibold text-foreground">{safePage}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span>
            <span aria-hidden="true"> · </span>
            {showingFrom}–{showingTo} of {processed.length}
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              aria-label="First page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            <div className="hidden items-center gap-1 sm:flex">
              {pageNumbers.map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-current={item === safePage ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-xs font-semibold tabular-nums transition-colors",
                      item === safePage
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              aria-label="Next page"
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              aria-label="Last page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
