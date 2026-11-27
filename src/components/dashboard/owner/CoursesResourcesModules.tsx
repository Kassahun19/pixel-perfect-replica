import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArrowDownToLine,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  FolderKanban,
  Loader2,
  Pencil,
  PlayCircle,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, useAuth } from "@/lib/auth";
import { formatETB } from "@/lib/access";
import { courseCoverUrl, courseImageUrl, fallbackCourseToken } from "@/lib/course-image";
import { downloadExcelXls, logAudit } from "@/lib/export";
import { dataUrlToFile, streamImage } from "@/lib/stream-image";
import {
  fetchYouTubeChannelVideos,
  fetchYouTubePlaylistVideos,
  fetchYouTubeVideoDetails,
  formatVideoDuration,
  getYouTubeId,
  replaceChannelBranding,
  type YouTubeChannelVideo,
} from "@/lib/youtube";
import { buildReportCard, computeAttendanceStats, computeGradeOutcome } from "@/lib/owner/logic";
import type {
  AttendanceRecord,
  AttendanceStatus,
  CourseExtensionMeta,
  CourseRow,
  GradeAssessmentType,
  GradeEntry,
  GradingScale,
  LearningResource,
  ResourceAccess,
  ResourceType,
} from "@/lib/owner/types";
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
  Panel,
  STATUS_BADGE,
  StatCard,
} from "@/components/dashboard/ui";
import type { OwnerDataHandle } from "./useOwnerData";

function slugify(val: string) {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ========================================================================== */
/* 3.6 COURSE MANAGEMENT                                                      */
/* ========================================================================== */

export function CourseManagementModule({ data }: { data: OwnerDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, refreshAll, can } = data;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CourseRow | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    short_description: "",
    description: "",
    objectivesText: "",
    image_url: "",
    level: "Beginner",
    duration_hours: "0",
    status: "draft" as CourseRow["status"],
    instructor_id: "",
    category_id: "",
    priceEtb: "218",
    enrollmentMode: "open" as CourseExtensionMeta["enrollmentMode"],
    maxCapacity: "",
    coverFile: null as File | null,
    generatedCoverFile: null as File | null,
    youtubeApiKey: "",
    youtubeChannelId: "",
    youtubePlaylistId: "",
  });
  const [generatedPreview, setGeneratedPreview] = useState<string | undefined>();
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeChannelVideo[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [loadingYt, setLoadingYt] = useState(false);
  const [syncingYt, setSyncingYt] = useState(false);

  const instructors = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("instructor")),
    [db.profiles, maps.rolesByUser],
  );

  const courses = useMemo(
    () =>
      db.courses.filter((c) => {
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (!search.trim()) return true;
        return `${c.title} ${c.short_description} ${c.level}`
          .toLowerCase()
          .includes(search.trim().toLowerCase());
      }),
    [db.courses, search, statusFilter],
  );

  function openCourseEditor(course: CourseRow | null) {
    setEditing(course);
    setYoutubeVideos([]);
    setSelectedVideoIds([]);
    setGeneratedPreview(undefined);
    const meta = course ? workspace?.courseMeta[course.id] : undefined;
    setForm({
      title: course?.title ?? "",
      slug: course?.slug ?? "",
      short_description: course?.short_description ?? "",
      description: course?.description ?? "",
      objectivesText: (course?.objectives ?? []).join("\n"),
      image_url: course?.image_url ?? "",
      level: course?.level ?? "Beginner",
      duration_hours: String(course?.duration_hours ?? 0),
      status: course?.status ?? "draft",
      instructor_id: course?.instructor_id ?? "",
      category_id: course?.category_id ?? "",
      priceEtb: String(meta?.priceEtb ?? 218),
      enrollmentMode: meta?.enrollmentMode ?? "open",
      maxCapacity: meta?.maxCapacity ? String(meta.maxCapacity) : "",
      coverFile: null,
      generatedCoverFile: null,
      youtubeApiKey: "",
      youtubeChannelId: "",
      youtubePlaylistId: "",
    });
    setEditorOpen(true);
  }

  async function generateThumbnail() {
    if (!form.title.trim()) {
      toast.error("Enter a course title first.");
      return;
    }
    setGeneratingThumb(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Session expired.");
      const dataUrl = await streamImage(
        "/api/generate-course-thumbnail",
        {
          title: form.title.trim(),
          shortDescription: form.short_description.trim() || undefined,
          description: form.description.trim() || undefined,
          level: form.level,
        },
        (url) => setGeneratedPreview(url),
        undefined,
        { Authorization: `Bearer ${token}` },
      );
      const file = dataUrlToFile(dataUrl, `${slugify(form.title) || "course"}-cover.png`);
      setForm((prev) => ({ ...prev, generatedCoverFile: file, coverFile: null }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate thumbnail.");
    } finally {
      setGeneratingThumb(false);
    }
  }

  async function loadYoutube() {
    if (!form.youtubeApiKey.trim() || (!form.youtubeChannelId.trim() && !form.youtubePlaylistId.trim())) {
      toast.error("Enter YouTube API key and either Channel ID or Playlist ID.");
      return;
    }
    setLoadingYt(true);
    try {
      const vids = form.youtubePlaylistId.trim()
        ? await fetchYouTubePlaylistVideos(form.youtubeApiKey, form.youtubePlaylistId)
        : await fetchYouTubeChannelVideos(form.youtubeApiKey, form.youtubeChannelId);
      setYoutubeVideos(vids);
      setSelectedVideoIds(vids.map((v) => v.id));
      toast.success(`Loaded ${vids.length} videos with Ezana Academy branding.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load YouTube channel.");
    } finally {
      setLoadingYt(false);
    }
  }

  async function syncLessonsFromYoutube() {
    if (!editing) return;
    setSyncingYt(true);
    try {
      const apiKey = form.youtubeApiKey.trim();
      const channelId = form.youtubeChannelId.trim();
      const playlistId = form.youtubePlaylistId.trim();

      const lessons = maps.lessonsByCourse.get(editing.id) ?? [];

      if (!apiKey) {
        let updatedCount = 0;
        for (const l of lessons) {
          const nextTitle = replaceChannelBranding(l.title);
          if (nextTitle !== l.title) {
            await supabase.from("lessons").update({ title: nextTitle }).eq("id", l.id);
            updatedCount += 1;
          }
        }
        await refreshAll(`Updated ${updatedCount} lesson titles with Ezana Academy branding`);
        return;
      }

      let ytVideos: YouTubeChannelVideo[] = [];
      if (playlistId) {
        ytVideos = await fetchYouTubePlaylistVideos(apiKey, playlistId);
      } else if (channelId) {
        ytVideos = await fetchYouTubeChannelVideos(apiKey, channelId);
      } else {
        const { data: media } = await supabase
          .from("lesson_media")
          .select("lesson_id,video_url")
          .in(
            "lesson_id",
            lessons.map((l) => l.id),
          );
        const ytIds = (media ?? []).map((m) => getYouTubeId(m.video_url)).filter((id): id is string => !!id);
        if (ytIds.length > 0) {
          const details = await fetchYouTubeVideoDetails(apiKey, ytIds);
          ytVideos = [...details.values()];
        }
      }

      const { data: media } = await supabase
        .from("lesson_media")
        .select("lesson_id,video_url")
        .in(
          "lesson_id",
          lessons.map((l) => l.id),
        );
      const vidMap = new Map<string, string>();
      const existingYtIds = new Set<string>();
      for (const m of media ?? []) {
        const ytId = getYouTubeId(m.video_url);
        if (ytId) {
          vidMap.set(m.lesson_id, ytId);
          existingYtIds.add(ytId);
        }
      }

      let totalMinutes = 0;
      let updatedCount = 0;
      let addedCount = 0;

      for (const l of lessons) {
        const ytId = vidMap.get(l.id);
        const match = ytId ? ytVideos.find((v) => v.id === ytId) : undefined;
        if (match) {
          const nextMin = match.durationMinutes > 0 ? match.durationMinutes : l.duration_minutes;
          totalMinutes += nextMin;
          await supabase
            .from("lessons")
            .update({
              title: match.title || replaceChannelBranding(l.title),
              description: match.description || l.description,
              duration_minutes: nextMin,
            })
            .eq("id", l.id);
          updatedCount += 1;
        } else {
          totalMinutes += l.duration_minutes;
        }
      }

      const newYtVideos = ytVideos.filter((v) => !existingYtIds.has(v.id));
      if (newYtVideos.length > 0) {
        const startPos = lessons.reduce((max, l) => Math.max(max, l.position), 0);
        const { data: createdLessons, error: lErr } = await supabase
          .from("lessons")
          .insert(
            newYtVideos.map((v, i) => ({
              course_id: editing.id,
              title: v.title,
              description: v.description || null,
              position: startPos + i + 1,
              duration_minutes: v.durationMinutes,
            })),
          )
          .select("id,position");
        if (!lErr && createdLessons) {
          await supabase.from("lesson_media").insert(
            createdLessons.map((l) => ({
              lesson_id: l.id,
              video_url: `https://www.youtube.com/watch?v=${newYtVideos[l.position - startPos - 1]!.id}`,
            })),
          );
          for (const v of newYtVideos) {
            totalMinutes += v.durationMinutes;
          }
          addedCount = newYtVideos.length;
        }
      }

      if (totalMinutes > 0) {
        const hrs = Math.max(1, Math.round(totalMinutes / 60));
        await supabase.from("courses").update({ duration_hours: hrs }).eq("id", editing.id);
        setForm((f) => ({ ...f, duration_hours: String(hrs) }));
      }
      await refreshAll(`Synced YouTube: updated ${updatedCount}, auto-added ${addedCount} new video(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingYt(false);
    }
  }

  async function saveCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !form.title.trim()) return;
    setBusy(true);
    try {
      let imageUrl = form.image_url.trim() || null;
      const uploadFile = form.coverFile ?? form.generatedCoverFile;
      if (uploadFile) {
        const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("course-covers")
          .upload(path, uploadFile, { contentType: uploadFile.type });
        if (upErr) throw new Error(upErr.message);
        imageUrl = courseCoverUrl(path);
      }
      if (!imageUrl) {
        imageUrl = fallbackCourseToken({
          title: form.title,
          short_description: form.short_description,
          description: form.description,
        });
      }

      const objectives = form.objectivesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        title: form.title.trim(),
        slug: slugify(form.slug || form.title),
        short_description: form.short_description.trim(),
        description: form.description.trim(),
        objectives,
        image_url: imageUrl,
        level: form.level,
        duration_hours: Number(form.duration_hours) || 0,
        status: form.status,
        instructor_id: form.instructor_id || null,
        category_id: form.category_id || null,
      };

      const res = editing
        ? await supabase.from("courses").update(payload).eq("id", editing.id)
        : await supabase.from("courses").insert(payload).select("id").single();

      if (res.error) throw new Error(res.error.message);
      const savedId = editing?.id ?? ("data" in res ? res.data?.id : undefined);

      if (savedId) {
        await mutateWorkspace({
          type: "upsert_course_meta",
          payload: {
            courseId: savedId,
            priceEtb: Number(form.priceEtb) || 218,
            enrollmentMode: form.enrollmentMode,
            maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : null,
            classSectionId: null,
            academicTermId: null,
          },
        });

        const selectedVideos = youtubeVideos.filter((v) => selectedVideoIds.includes(v.id));
        if (selectedVideos.length > 0) {
          const startPos = (maps.lessonsByCourse.get(savedId) ?? []).reduce(
            (max, l) => Math.max(max, l.position),
            0,
          );
          const { data: createdLessons, error: lErr } = await supabase
            .from("lessons")
            .insert(
              selectedVideos.map((v, i) => ({
                course_id: savedId,
                title: replaceChannelBranding(v.title),
                description: v.description ? replaceChannelBranding(v.description) : null,
                position: startPos + i + 1,
                duration_minutes: v.durationMinutes,
              })),
            )
            .select("id,position");
          if (lErr) throw new Error(lErr.message);
          await supabase.from("lesson_media").insert(
            (createdLessons ?? []).map((l) => ({
              lesson_id: l.id,
              video_url: `https://www.youtube.com/watch?v=${selectedVideos[l.position - startPos - 1]!.id}`,
            })),
          );
        }
      }

      await logAudit(editing ? "course_updated" : "course_created", "course", savedId, {
        title: payload.title,
        status: payload.status,
      });
      setEditorOpen(false);
      await refreshAll(editing ? "Course updated" : "Course created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save course");
    } finally {
      setBusy(false);
    }
  }

  async function setCourseStatus(course: CourseRow, status: CourseRow["status"]) {
    const { error } = await supabase.from("courses").update({ status }).eq("id", course.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit(`course_${status}`, "course", course.id, { title: course.title });
    await refreshAll(`Course marked ${status}`);
  }

  async function deleteCourse(course: CourseRow) {
    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("course_deleted", "course", course.id, { title: course.title });
    await refreshAll(`Deleted "${course.title}"`);
  }

  const previewImg = generatedPreview ?? courseImageUrl(form.image_url);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Management"
        description="Create, publish, archive, price, assign instructors, set learning objectives, and manage video lessons."
        actions={
          can("courses", "create") ? (
            <Button variant="emerald" size="sm" onClick={() => openCourseEditor(null)}>
              <Plus className="h-4 w-4" /> New Course
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {courses.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const meta = workspace?.courseMeta[course.id];
            const inst = course.instructor_id
              ? maps.profilesById.get(course.instructor_id)
              : undefined;
            const lessons = (maps.lessonsByCourse.get(course.id) ?? []).length;
            const learners = new Set(
              db.enrollments.filter((e) => e.course_id === course.id).map((e) => e.user_id),
            ).size;
            return (
              <article
                key={course.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
              >
                <CourseThumbnail
                  imageUrl={course.image_url}
                  course={course}
                  alt={course.title}
                  className="aspect-video w-full"
                />
                <div className="p-5">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug">{course.title}</h3>
                    <Badge variant={STATUS_BADGE[course.status] ?? "muted"}>{course.status}</Badge>
                  </div>
                  <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                    {course.short_description}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-muted-foreground tabular-nums">
                    <span>Price: {formatETB(meta?.priceEtb ?? 218)}</span>
                    <span>Enrollment: {meta?.enrollmentMode ?? "open"}</span>
                    <span>
                      {lessons} lessons · {course.duration_hours} hrs
                    </span>
                    <span>{learners} learners</span>
                    <span className="col-span-2 truncate">
                      Instructor: {inst ? displayName(inst) : "Unassigned"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {can("courses", "edit") && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCourseEditor(course)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        {course.status !== "published" ? (
                          <Button
                            size="sm"
                            variant="emerald"
                            onClick={() => void setCourseStatus(course, "published")}
                          >
                            Publish
                          </Button>
                        ) : (
                          <ConfirmButton
                            title={`Archive "${course.title}"?`}
                            description="Archived courses are hidden from public catalog enrollment."
                            confirmLabel="Archive"
                            onConfirm={() => void setCourseStatus(course, "archived")}
                            trigger={
                              <Button size="sm" variant="outline">
                                <Archive className="h-3.5 w-3.5" /> Archive
                              </Button>
                            }
                          />
                        )}
                      </>
                    )}
                    {can("courses", "delete") && (
                      <ConfirmButton
                        title={`Permanently delete "${course.title}"?`}
                        description="Removes the course and its lessons permanently."
                        confirmLabel="Delete permanently"
                        onConfirm={() => void deleteCourse(course)}
                        trigger={
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No courses found"
          text="Create a course to build your catalog."
          icon={BookOpen}
        />
      )}

      {/* Course Editor Modal */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit: ${editing.title}` : "Create Course"}</DialogTitle>
            <DialogDescription>
              Configure course curriculum, pricing, objectives, and YouTube lessons.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void saveCourse(e)}>
            <label className="space-y-1 text-sm font-medium">
              Title
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Slug
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder={slugify(form.title)}
              />
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Short Description
              <Input
                value={form.short_description}
                onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Full Description
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Learning Objectives (one per line)
              <Textarea
                rows={3}
                value={form.objectivesText}
                onChange={(e) => setForm((f) => ({ ...f, objectivesText: e.target.value }))}
                placeholder="Master Excel formulas&#10;Create structured Word documents"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Price (ETB)
              <Input
                type="number"
                min="0"
                value={form.priceEtb}
                onChange={(e) => setForm((f) => ({ ...f, priceEtb: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Enrollment Policy
              <select
                value={form.enrollmentMode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    enrollmentMode: e.target.value as CourseExtensionMeta["enrollmentMode"],
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="open">Open Self-Enrollment</option>
                <option value="approval">Requires Staff Approval</option>
                <option value="closed">Enrollment Closed</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Level
              <select
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Publication Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as CourseRow["status"] }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Category
              <select
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Uncategorized</option>
                {db.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Assign Instructor
              <select
                value={form.instructor_id}
                onChange={(e) => setForm((f) => ({ ...f, instructor_id: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {displayName(i)}
                  </option>
                ))}
              </select>
            </label>

            {/* Cover Image */}
            <div className="space-y-2 rounded-xl border border-border p-3 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Cover Image</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={generatingThumb}
                  onClick={() => void generateThumbnail()}
                >
                  {generatingThumb ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Generate AI Cover
                </Button>
              </div>
              <Input
                ref={coverRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setForm((f) => ({ ...f, coverFile: e.target.files?.[0] ?? null }))}
              />
              {previewImg && (
                <img
                  src={previewImg}
                  alt="Cover preview"
                  className="aspect-[16/7] w-full rounded-lg border border-border object-cover"
                />
              )}
            </div>

            {/* YouTube Channel Importer */}
            <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3 sm:col-span-2">
              <p className="text-sm font-semibold">
                Import / Sync YouTube Lessons (Ezana Academy Branding)
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  type="password"
                  placeholder="YouTube API Key"
                  value={form.youtubeApiKey}
                  onChange={(e) => setForm((f) => ({ ...f, youtubeApiKey: e.target.value }))}
                />
                <Input
                  placeholder="Channel ID (UC…)"
                  value={form.youtubeChannelId}
                  onChange={(e) => setForm((f) => ({ ...f, youtubeChannelId: e.target.value }))}
                />
                <Input
                  placeholder="Playlist ID (PL… optional)"
                  value={form.youtubePlaylistId}
                  onChange={(e) => setForm((f) => ({ ...f, youtubePlaylistId: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loadingYt}
                  onClick={() => void loadYoutube()}
                >
                  <PlayCircle className="h-3.5 w-3.5" /> Load Channel Videos
                </Button>
                {editing && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={syncingYt}
                    onClick={() => void syncLessonsFromYoutube()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Sync Titles & Durations
                  </Button>
                )}
              </div>
              {youtubeVideos.length > 0 && (
                <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background p-2.5 text-xs">
                  {youtubeVideos.map((v) => (
                    <label key={v.id} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedVideoIds.includes(v.id)}
                        onChange={(e) =>
                          setSelectedVideoIds((prev) =>
                            e.target.checked ? [...prev, v.id] : prev.filter((id) => id !== v.id),
                          )
                        }
                      />
                      <span className="flex-1 truncate">{v.title}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatVideoDuration(v.durationSeconds)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={busy}>
                {busy ? "Saving…" : "Save Course"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 3.9 ATTENDANCE TRACKING                                                    */
/* ========================================================================== */

export function AttendanceTrackingModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, can, mutating } = data;
  const [personType, setPersonType] = useState<"student" | "instructor">("student");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [courseId, setCourseId] = useState(db.courses[0]?.id ?? "");
  const [classId, setClassId] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterPerson, setFilterPerson] = useState("all");
  const [draftStatuses, setDraftStatuses] = useState<Record<string, AttendanceStatus>>({});

  const targetPeople = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes(personType)),
    [db.profiles, maps.rolesByUser, personType],
  );

  const records = useMemo(
    () =>
      (workspace?.attendance ?? []).filter((r) => {
        if (filterDate && r.date !== filterDate) return false;
        if (filterPerson !== "all" && r.personId !== filterPerson) return false;
        return true;
      }),
    [workspace?.attendance, filterDate, filterPerson],
  );

  const summary = useMemo(() => computeAttendanceStats(records), [records]);

  async function submitBatchAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!targetPeople.length) {
      toast.error(`No ${personType}s found to record.`);
      return;
    }
    const batch: AttendanceRecord[] = targetPeople.map((person) => ({
      id: crypto.randomUUID(),
      personId: person.id,
      personType,
      courseId: courseId || null,
      classSectionId: classId || null,
      date,
      status: draftStatuses[person.id] ?? "present",
      notes: "",
      markedBy: null,
    }));
    await mutateWorkspace(
      { type: "upsert_attendance_batch", records: batch },
      `Attendance recorded for ${batch.length} ${personType}s on ${date}`,
    );
  }

  function exportAttendance() {
    if (!records.length) {
      toast.error("No attendance logs to export.");
      return;
    }
    downloadExcelXls(
      "ezana-attendance-report.xls",
      "Attendance",
      records.map((r) => ({
        Date: r.date,
        Person: maps.profilesById.get(r.personId)
          ? displayName(maps.profilesById.get(r.personId)!)
          : "User",
        Type: r.personType,
        Course: r.courseId ? (maps.coursesById.get(r.courseId)?.title ?? "") : "",
        Class: r.classSectionId ? (maps.classesById.get(r.classSectionId)?.name ?? "") : "",
        Status: r.status,
      })),
      "Ezana Academy — Attendance Report",
    );
    toast.success("Attendance report exported");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Tracking"
        description="Record student & instructor attendance, view percentage summaries, and export attendance reports."
        actions={
          can("attendance", "export") ? (
            <Button variant="outline" size="sm" onClick={exportAttendance}>
              <ArrowDownToLine className="h-4 w-4" /> Export Excel
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Attendance Rate"
          value={`${summary.attendanceRate}%`}
          icon={ClipboardCheck}
          index={0}
        />
        <StatCard
          label="Present"
          value={summary.present}
          icon={CheckCircle2}
          tone="gold"
          index={1}
        />
        <StatCard label="Late" value={summary.late} icon={ClipboardCheck} tone="deep" index={2} />
        <StatCard
          label="Absent"
          value={summary.absent}
          icon={ClipboardCheck}
          tone="plain"
          index={3}
        />
      </div>

      {/* Record Attendance Panel */}
      {can("attendance", "create") && (
        <Panel title="Record Daily Attendance">
          <form className="space-y-4" onSubmit={(e) => void submitBatchAttendance(e)}>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-xs font-medium">
                Group
                <select
                  value={personType}
                  onChange={(e) => setPersonType(e.target.value as "student" | "instructor")}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="student">Students</option>
                  <option value="instructor">Instructors</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium">
                Date
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="space-y-1 text-xs font-medium">
                Course
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">All / General</option>
                  {db.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium">
                Class / Section
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">All classes</option>
                  {(workspace?.classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {targetPeople.length > 0 ? (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targetPeople.map((person) => {
                      const val = draftStatuses[person.id] ?? "present";
                      return (
                        <TableRow key={person.id}>
                          <TableCell className="font-medium">{displayName(person)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {(["present", "absent", "late", "excused"] as AttendanceStatus[]).map(
                                (st) => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() =>
                                      setDraftStatuses((prev) => ({ ...prev, [person.id]: st }))
                                    }
                                    className={`rounded-md border px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                                      val === st
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background text-muted-foreground hover:border-primary"
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ),
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No {personType} accounts available.</p>
            )}

            <Button
              type="submit"
              variant="emerald"
              disabled={mutating || targetPeople.length === 0}
            >
              Save Attendance Roll Call
            </Button>
          </form>
        </Panel>
      )}

      {/* Attendance Log History */}
      <Panel
        title={`Attendance History (${records.length})`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-9 w-40"
            />
            <select
              value={filterPerson}
              onChange={(e) => setFilterPerson(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">All people</option>
              {db.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {records.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Course / Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.slice(0, 50).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs tabular-nums">{r.date}</TableCell>
                  <TableCell>
                    <p className="font-medium">
                      {maps.profilesById.get(r.personId)
                        ? displayName(maps.profilesById.get(r.personId)!)
                        : "Member"}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">{r.personType}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.courseId ? maps.coursesById.get(r.courseId)?.title : "General"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "present"
                          ? "success"
                          : r.status === "late"
                            ? "warning"
                            : r.status === "absent"
                              ? "destructive"
                              : "muted"
                      }
                      className="capitalize"
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {can("attendance", "delete") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          void mutateWorkspace(
                            { type: "delete_attendance", id: r.id },
                            "Log deleted",
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No attendance logs yet"
            text="Submit the roll call above to record student or instructor attendance."
            icon={ClipboardCheck}
          />
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 3.10 GRADES & REPORT CARDS                                                 */
/* ========================================================================== */

export function GradesReportCardsModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, setPrintable, can, mutating } = data;
  const [gradeDialog, setGradeDialog] = useState<GradeEntry | null>(null);
  const [scaleDialog, setScaleDialog] = useState<GradingScale | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");

  const students = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("student")),
    [db.profiles, maps.rolesByUser],
  );
  const activeStudentId = selectedStudentId || students[0]?.id || "";
  const defaultScale =
    workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];

  const grades = useMemo(
    () =>
      (workspace?.grades ?? []).filter((g) =>
        courseFilter === "all" ? true : g.courseId === courseFilter,
      ),
    [workspace?.grades, courseFilter],
  );

  const reportCard = useMemo(() => {
    if (!activeStudentId || !defaultScale) return null;
    return buildReportCard(
      activeStudentId,
      workspace?.grades ?? [],
      defaultScale,
      maps.coursesById,
    );
  }, [activeStudentId, defaultScale, workspace?.grades, maps.coursesById]);

  function printStudentReportCard() {
    if (!activeStudentId || !reportCard) {
      toast.error("Select a student first.");
      return;
    }
    const student = maps.profilesById.get(activeStudentId);
    setPrintable({
      title: `Official Academic Report Card`,
      subtitle: `${student ? displayName(student) : "Student"} (${student?.email ?? ""})`,
      meta: [
        { label: "Overall Average", value: `${reportCard.overallPercent}%` },
        { label: "Cumulative GPA", value: String(reportCard.overallGpa.toFixed(2)) },
        { label: "Grading Scale", value: defaultScale?.name ?? "Standard" },
      ],
      columns: ["Course", "Assessments", "Weighted %", "Letter Grade", "GPA", "Remark"],
      rows: reportCard.lines.map((l) => [
        l.courseTitle,
        l.entries.length,
        `${l.weightedPercent}%`,
        l.letter,
        l.gpa.toFixed(2),
        l.remark,
      ]),
      footerNote: "Verified by Ezana Academy Academic Records.",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grades & Report Cards"
        description="Configure grading scales, record assignments/quizzes/exams, and generate printable student report cards."
        actions={
          <div className="flex flex-wrap gap-2">
            {defaultScale && can("grades", "edit") && (
              <Button variant="outline" size="sm" onClick={() => setScaleDialog(defaultScale)}>
                Grading Scale ({defaultScale.name})
              </Button>
            )}
            {can("grades", "create") && (
              <Button
                variant="emerald"
                size="sm"
                onClick={() =>
                  setGradeDialog({
                    id: crypto.randomUUID(),
                    studentId: students[0]?.id ?? "",
                    courseId: db.courses[0]?.id ?? "",
                    termId: workspace?.terms[0]?.id ?? null,
                    assessmentTitle: "",
                    assessmentType: "exam",
                    score: 85,
                    maxScore: 100,
                    weight: 1,
                    remarks: "",
                    gradedAt: new Date().toISOString().slice(0, 10),
                  })
                }
              >
                <Plus className="h-4 w-4" /> Record Grade
              </Button>
            )}
          </div>
        }
      />

      {/* Student Report Card Generator */}
      <Panel
        title="Student Report Card"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {displayName(s)}
                </option>
              ))}
            </select>
            <Button size="sm" variant="emerald" onClick={printStudentReportCard}>
              <Printer className="h-4 w-4" /> Print / PDF Report Card
            </Button>
          </div>
        }
      >
        {reportCard && reportCard.lines.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-6 rounded-xl bg-secondary/50 p-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Overall Average</p>
                <p className="font-display text-2xl font-semibold tabular-nums">
                  {reportCard.overallPercent}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cumulative GPA</p>
                <p className="font-display text-2xl font-semibold tabular-nums">
                  {reportCard.overallGpa.toFixed(2)}
                </p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Assessments</TableHead>
                  <TableHead>Weighted %</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportCard.lines.map((line) => (
                  <TableRow key={line.courseId}>
                    <TableCell className="font-semibold">{line.courseTitle}</TableCell>
                    <TableCell className="tabular-nums">{line.entries.length}</TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {line.weightedPercent}%
                    </TableCell>
                    <TableCell>
                      <Badge variant={line.letter === "F" ? "destructive" : "success"}>
                        {line.letter} ({line.gpa.toFixed(1)})
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{line.remark}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            title="No grades recorded for this student yet"
            text="Record assignment, quiz, or exam scores to automatically build their report card."
            icon={Award}
          />
        )}
      </Panel>

      {/* Gradebook Table */}
      <Panel
        title={`Gradebook Entries (${grades.length})`}
        actions={
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="all">All Courses</option>
            {db.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        }
      >
        {grades.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course & Assessment</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g) => {
                const outcome = defaultScale
                  ? computeGradeOutcome(g.score, g.maxScore, defaultScale)
                  : { percent: Math.round((g.score / g.maxScore) * 100), letter: "—" };
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-semibold">
                      {maps.profilesById.get(g.studentId)
                        ? displayName(maps.profilesById.get(g.studentId)!)
                        : "Student"}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{g.assessmentTitle}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {maps.coursesById.get(g.courseId)?.title ?? "Course"} · {g.assessmentType}{" "}
                        (wt {g.weight})
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {g.score} / {g.maxScore}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <Badge variant={outcome.letter === "F" ? "destructive" : "success"}>
                        {outcome.percent}% ({outcome.letter})
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {can("grades", "edit") && (
                          <Button size="sm" variant="outline" onClick={() => setGradeDialog(g)}>
                            Edit
                          </Button>
                        )}
                        {can("grades", "delete") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() =>
                              void mutateWorkspace(
                                { type: "delete_grade", id: g.id },
                                "Grade removed",
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="Gradebook is empty"
            text="Click Record Grade to enter scores."
            icon={Award}
          />
        )}
      </Panel>

      {/* Grade Entry Modal */}
      <Dialog open={!!gradeDialog} onOpenChange={(o) => !o && setGradeDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Assessment Grade</DialogTitle>
          </DialogHeader>
          {gradeDialog && (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_grade", payload: gradeDialog },
                  "Grade saved",
                ).then(() => setGradeDialog(null));
              }}
            >
              <label className="space-y-1 text-sm font-medium">
                Student
                <select
                  required
                  value={gradeDialog.studentId}
                  onChange={(e) => setGradeDialog({ ...gradeDialog, studentId: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select student…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {displayName(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Course
                <select
                  required
                  value={gradeDialog.courseId}
                  onChange={(e) => setGradeDialog({ ...gradeDialog, courseId: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {db.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium sm:col-span-2">
                Assessment Title
                <Input
                  required
                  value={gradeDialog.assessmentTitle}
                  onChange={(e) =>
                    setGradeDialog({ ...gradeDialog, assessmentTitle: e.target.value })
                  }
                  placeholder="Midterm Practical Exam"
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Type
                <select
                  value={gradeDialog.assessmentType}
                  onChange={(e) =>
                    setGradeDialog({
                      ...gradeDialog,
                      assessmentType: e.target.value as GradeAssessmentType,
                    })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="assignment">Assignment</option>
                  <option value="quiz">Quiz</option>
                  <option value="exam">Exam</option>
                  <option value="project">Project</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Weight
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={gradeDialog.weight}
                  onChange={(e) =>
                    setGradeDialog({ ...gradeDialog, weight: Number(e.target.value) || 1 })
                  }
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Score Obtained
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={gradeDialog.score}
                  onChange={(e) =>
                    setGradeDialog({ ...gradeDialog, score: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Max Possible Score
                <Input
                  type="number"
                  min="1"
                  value={gradeDialog.maxScore}
                  onChange={(e) =>
                    setGradeDialog({ ...gradeDialog, maxScore: Number(e.target.value) || 100 })
                  }
                />
              </label>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setGradeDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald" disabled={mutating}>
                  Save Grade
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Grading Scale Modal */}
      <Dialog open={!!scaleDialog} onOpenChange={(o) => !o && setScaleDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Grading Scale</DialogTitle>
          </DialogHeader>
          {scaleDialog && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_grading_scale", payload: scaleDialog },
                  "Grading scale updated",
                ).then(() => setScaleDialog(null));
              }}
            >
              <label className="block space-y-1 text-sm font-medium">
                Scale Name
                <Input
                  required
                  value={scaleDialog.name}
                  onChange={(e) => setScaleDialog({ ...scaleDialog, name: e.target.value })}
                />
              </label>
              <div className="space-y-2">
                {scaleDialog.bands.map((b, idx) => (
                  <div key={b.letter} className="grid grid-cols-4 items-center gap-2 text-xs">
                    <span className="font-bold">Grade {b.letter}</span>
                    <Input
                      type="number"
                      value={b.minPercent}
                      onChange={(e) => {
                        const nextBands = [...scaleDialog.bands];
                        nextBands[idx] = { ...b, minPercent: Number(e.target.value) };
                        setScaleDialog({ ...scaleDialog, bands: nextBands });
                      }}
                    />
                    <Input
                      type="number"
                      value={b.maxPercent}
                      onChange={(e) => {
                        const nextBands = [...scaleDialog.bands];
                        nextBands[idx] = { ...b, maxPercent: Number(e.target.value) };
                        setScaleDialog({ ...scaleDialog, bands: nextBands });
                      }}
                    />
                    <Input
                      type="number"
                      step="0.1"
                      value={b.gpa}
                      onChange={(e) => {
                        const nextBands = [...scaleDialog.bands];
                        nextBands[idx] = { ...b, gpa: Number(e.target.value) };
                        setScaleDialog({ ...scaleDialog, bands: nextBands });
                      }}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setScaleDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald">
                  Save Scale
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 3.11 E-LEARNING RESOURCES                                                  */
/* ========================================================================== */

export function ELearningResourcesModule({ data }: { data: OwnerDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can, mutating } = data;
  const [courseFilter, setCourseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialog, setDialog] = useState<LearningResource | null>(null);
  const [uploading, setUploading] = useState(false);

  const resources = useMemo(
    () =>
      (workspace?.resources ?? []).filter((r) => {
        if (courseFilter !== "all" && r.courseId !== courseFilter) return false;
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        return true;
      }),
    [workspace?.resources, courseFilter, typeFilter],
  );

  async function handleFileUpload(file: File) {
    if (!user || !dialog) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `resources/${user.id}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage
        .from("course-covers")
        .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
      if (error) throw new Error(error.message);
      const url = courseCoverUrl(storagePath);
      const sizeKb = Math.max(1, Math.round(file.size / 1024));
      setDialog({
        ...dialog,
        url,
        storagePath,
        fileSizeLabel: sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`,
      });
      toast.success("Resource file uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="E-Learning Resources"
        description="Manage videos, PDFs, documents, presentations, and role-based learning resource access across courses."
        actions={
          can("resources", "create") ? (
            <Button
              size="sm"
              variant="emerald"
              onClick={() =>
                setDialog({
                  id: crypto.randomUUID(),
                  title: "",
                  type: "pdf",
                  courseId: db.courses[0]?.id ?? null,
                  subjectId: workspace?.subjects[0]?.id ?? null,
                  categoryId: db.categories[0]?.id ?? null,
                  url: "",
                  storagePath: null,
                  fileSizeLabel: "External / Link",
                  accessLevel: "enrolled",
                  description: "",
                  createdAt: new Date().toISOString(),
                })
              }
            >
              <Plus className="h-4 w-4" /> Add Resource
            </Button>
          ) : undefined
        }
      />

      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Courses</option>
            {db.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Types</option>
            <option value="video">Video</option>
            <option value="pdf">PDF</option>
            <option value="document">Document</option>
            <option value="presentation">Presentation</option>
            <option value="link">Web Link</option>
          </select>
        </div>

        {resources.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource Title</TableHead>
                <TableHead>Course & Subject</TableHead>
                <TableHead>Type & Access</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((res) => (
                <TableRow key={res.id}>
                  <TableCell>
                    <p className="font-semibold">{res.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {res.description || res.fileSizeLabel}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    <p>
                      {res.courseId ? (maps.coursesById.get(res.courseId)?.title ?? "—") : "All"}
                    </p>
                    <p className="text-muted-foreground">
                      {res.categoryId ? maps.categoriesById.get(res.categoryId)?.name : ""}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="uppercase">
                        {res.type}
                      </Badge>
                      <Badge variant="secondary">{res.accessLevel.replace("_", " ")}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {res.url && (
                        <Button asChild size="sm" variant="outline">
                          <a href={res.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" /> Open
                          </a>
                        </Button>
                      )}
                      {can("resources", "edit") && (
                        <Button size="sm" variant="outline" onClick={() => setDialog(res)}>
                          Edit
                        </Button>
                      )}
                      {can("resources", "delete") && (
                        <ConfirmButton
                          title={`Delete "${res.title}"?`}
                          confirmLabel="Delete"
                          onConfirm={() =>
                            void mutateWorkspace(
                              { type: "delete_resource", id: res.id },
                              "Resource deleted",
                            )
                          }
                          trigger={
                            <Button size="sm" variant="ghost" className="text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No supplementary learning resources yet"
            text="Upload PDFs, slide decks, handouts, or reference video links for learners."
            icon={FolderKanban}
          />
        )}
      </Panel>

      {/* Also show current lesson media summary */}
      <Panel title={`Course Video Lessons Inventory (${db.lessons.length})`}>
        {db.lessons.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {db.lessons.slice(0, 12).map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate font-medium">
                    #{l.position} {replaceChannelBranding(l.title)}
                  </span>
                </div>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {l.duration_minutes}m
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No course lessons found.</p>
        )}
      </Panel>

      {/* Resource Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>E-Learning Resource</DialogTitle>
          </DialogHeader>
          {dialog && (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_resource", payload: dialog },
                  "Learning resource saved",
                ).then(() => setDialog(null));
              }}
            >
              <label className="space-y-1 text-sm font-medium sm:col-span-2">
                Title
                <Input
                  required
                  value={dialog.title}
                  onChange={(e) => setDialog({ ...dialog, title: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Type
                <select
                  value={dialog.type}
                  onChange={(e) => setDialog({ ...dialog, type: e.target.value as ResourceType })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="pdf">PDF</option>
                  <option value="document">Document</option>
                  <option value="presentation">Presentation</option>
                  <option value="video">Video</option>
                  <option value="link">Web Link</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Access Control
                <select
                  value={dialog.accessLevel}
                  onChange={(e) =>
                    setDialog({ ...dialog, accessLevel: e.target.value as ResourceAccess })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="public">Public (Everyone)</option>
                  <option value="enrolled">Enrolled Students</option>
                  <option value="pro_paid">Ezana Pro Paid Learners</option>
                  <option value="staff_only">Instructors & Staff Only</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Course
                <select
                  value={dialog.courseId ?? ""}
                  onChange={(e) => setDialog({ ...dialog, courseId: e.target.value || null })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">General</option>
                  {db.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Category
                <select
                  value={dialog.categoryId ?? ""}
                  onChange={(e) => setDialog({ ...dialog, categoryId: e.target.value || null })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {db.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Upload File or Paste URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFileUpload(f);
                    }}
                  />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <Input
                  required
                  placeholder="https://… or uploaded path"
                  value={dialog.url}
                  onChange={(e) => setDialog({ ...dialog, url: e.target.value })}
                />
              </div>
              <label className="space-y-1 text-sm font-medium sm:col-span-2">
                Description
                <Textarea
                  rows={2}
                  value={dialog.description}
                  onChange={(e) => setDialog({ ...dialog, description: e.target.value })}
                />
              </label>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald" disabled={mutating || uploading}>
                  <Upload className="h-4 w-4" /> Save Resource
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
