import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  FolderKanban,
  Loader2,
  Megaphone,
  Pencil,
  PlayCircle,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, useAuth } from "@/lib/auth";
import { courseCoverUrl, fallbackCourseToken } from "@/lib/course-image";
import { logAudit } from "@/lib/csv";
import { downloadExcelXls } from "@/lib/export";
import { paginateRows } from "@/lib/owner/logic";
import type {
  CourseMaterial,
  CourseRow,
  LearningResource,
  ResourceAccess,
  ResourceType,
} from "@/lib/owner/types";
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
import type { InstructorDataHandle } from "./useInstructorData";

function slugify(val: string) {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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

/* ========================================================================== */
/* MY COURSES & CREATE NEW COURSE                                             */
/* ========================================================================== */

export function InstructorCoursesModule({
  data,
  mode = "list",
}: {
  data: InstructorDataHandle;
  mode?: "list" | "create";
}) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, refreshAll, can } = data;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const [editorOpen, setEditorOpen] = useState(mode === "create");
  const [editing, setEditing] = useState<CourseRow | null>(null);
  const [rosterCourse, setRosterCourse] = useState<CourseRow | null>(null);
  const [lessonsCourse, setLessonsCourse] = useState<CourseRow | null>(null);
  const [newLessonForm, setNewLessonForm] = useState({
    title: "",
    description: "",
    duration_minutes: "15",
    video_url: "",
  });

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
    category_id: "",
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

  const canApprovePublish = can("courses", "approve");

  useEffect(() => {
    if (mode === "create") {
      openCourseEditor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const filtered = useMemo(() => {
    return db.courses.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!search.trim()) return true;
      return `${c.title} ${c.short_description} ${c.level}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    });
  }, [db.courses, search, statusFilter]);

  const paged = useMemo(() => paginateRows(filtered, page, 8), [filtered, page]);

  function openCourseEditor(course: CourseRow | null) {
    setEditing(course);
    setYoutubeVideos([]);
    setSelectedVideoIds([]);
    setGeneratedPreview(undefined);
    const meta = course ? workspace?.courseMeta[course.id] : undefined;
    const globalKey =
      typeof window !== "undefined" ? (localStorage.getItem("ezana_yt_key_global") ?? "") : "";
    const globalChannel =
      typeof window !== "undefined" ? (localStorage.getItem("ezana_yt_channel_global") ?? "") : "";
    const globalPlaylist =
      typeof window !== "undefined" ? (localStorage.getItem("ezana_yt_playlist_global") ?? "") : "";

    const savedKey = course
      ? ((typeof window !== "undefined" ? localStorage.getItem(`ezana_yt_key_${course.id}`) : null) ??
          meta?.youtubeApiKey ??
          globalKey)
      : globalKey;
    const savedChannel = course
      ? ((typeof window !== "undefined"
          ? localStorage.getItem(`ezana_yt_channel_${course.id}`)
          : null) ??
          meta?.youtubeChannelId ??
          globalChannel)
      : globalChannel;
    const savedPlaylist = course
      ? ((typeof window !== "undefined"
          ? localStorage.getItem(`ezana_yt_playlist_${course.id}`)
          : null) ??
          meta?.youtubePlaylistId ??
          globalPlaylist)
      : globalPlaylist;

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
      category_id: course?.category_id ?? db.categories[0]?.id ?? "",
      maxCapacity: meta?.maxCapacity ? String(meta.maxCapacity) : "",
      coverFile: null,
      generatedCoverFile: null,
      youtubeApiKey: savedKey,
      youtubeChannelId: savedChannel,
      youtubePlaylistId: savedPlaylist,
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
      if (!token) throw new Error("Sign in session required to generate AI cover.");
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
    if (
      !form.youtubeApiKey.trim() ||
      (!form.youtubeChannelId.trim() && !form.youtubePlaylistId.trim())
    ) {
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
      toast.error(err instanceof Error ? err.message : "Failed to load YouTube videos.");
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
      } else if (lessons.length > 0) {
        const { data: media } = await supabase
          .from("lesson_media")
          .select("lesson_id,video_url")
          .in(
            "lesson_id",
            lessons.map((l) => l.id),
          );
        const ytIds = (media ?? [])
          .map((m) => getYouTubeId(m.video_url))
          .filter((id): id is string => !!id);
        if (ytIds.length > 0) {
          const details = await fetchYouTubeVideoDetails(apiKey, ytIds);
          ytVideos = [...details.values()];
        }
      }

      const { data: media } = lessons.length
        ? await supabase
            .from("lesson_media")
            .select("lesson_id,video_url")
            .in(
              "lesson_id",
              lessons.map((l) => l.id),
            )
        : { data: [] as Array<{ lesson_id: string; video_url: string }> };

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
      await refreshAll(
        `Synced YouTube: updated ${updatedCount}, auto-added ${addedCount} new video(s)`,
      );
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
        if (uploadFile.size > 10 * 1024 * 1024) {
          throw new Error("Course cover images must be 10 MB or smaller.");
        }
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
        .map((line) => line.trim())
        .filter(Boolean);

      const safeStatus: CourseRow["status"] =
        form.status === "published" && !canApprovePublish ? "draft" : form.status;

      const payload = {
        title: form.title.trim(),
        slug: slugify(form.slug || form.title),
        short_description: form.short_description.trim(),
        description: form.description.trim(),
        objectives,
        image_url: imageUrl,
        level: form.level,
        duration_hours: Number(form.duration_hours) || 0,
        status: safeStatus,
        instructor_id: user.id,
        category_id: form.category_id || null,
      };

      const res = editing
        ? await supabase
            .from("courses")
            .update(payload)
            .eq("id", editing.id)
            .eq("instructor_id", user.id)
        : await supabase.from("courses").insert(payload).select("id").single();
      if (res.error) throw new Error(res.error.message);

      const savedId = editing?.id ?? ("data" in res ? res.data?.id : undefined);
      if (savedId) {
        if (typeof window !== "undefined") {
          if (form.youtubeApiKey.trim())
            localStorage.setItem("ezana_yt_key_global", form.youtubeApiKey.trim());
          if (form.youtubeChannelId.trim())
            localStorage.setItem("ezana_yt_channel_global", form.youtubeChannelId.trim());
          if (form.youtubePlaylistId.trim())
            localStorage.setItem("ezana_yt_playlist_global", form.youtubePlaylistId.trim());

          localStorage.setItem(`ezana_yt_key_${savedId}`, form.youtubeApiKey.trim());
          localStorage.setItem(`ezana_yt_channel_${savedId}`, form.youtubeChannelId.trim());
          localStorage.setItem(`ezana_yt_playlist_${savedId}`, form.youtubePlaylistId.trim());
        }

        const existingMeta = workspace?.courseMeta[savedId];
        await mutateWorkspace({
          type: "upsert_course_meta",
          payload: {
            courseId: savedId,
            priceEtb: existingMeta?.priceEtb ?? 218,
            enrollmentMode: existingMeta?.enrollmentMode ?? "open",
            maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : null,
            classSectionId: existingMeta?.classSectionId ?? null,
            academicTermId: existingMeta?.academicTermId ?? null,
            youtubeApiKey: form.youtubeApiKey.trim() || null,
            youtubeChannelId: form.youtubeChannelId.trim() || null,
            youtubePlaylistId: form.youtubePlaylistId.trim() || null,
          },
        });

        const selected = youtubeVideos.filter((v) => selectedVideoIds.includes(v.id));
        if (selected.length > 0) {
          const startPos = (maps.lessonsByCourse.get(savedId) ?? []).reduce(
            (max, l) => Math.max(max, l.position),
            0,
          );
          const { data: createdLessons, error: lErr } = await supabase
            .from("lessons")
            .insert(
              selected.map((v, i) => ({
                course_id: savedId,
                title: replaceChannelBranding(v.title),
                description: v.description ? replaceChannelBranding(v.description) : null,
                position: startPos + i + 1,
                duration_minutes: v.durationMinutes,
              })),
            )
            .select("id,position");
          if (lErr) throw new Error(lErr.message);
          if (createdLessons?.length) {
            await supabase.from("lesson_media").insert(
              createdLessons.map((l) => ({
                lesson_id: l.id,
                video_url: `https://www.youtube.com/watch?v=${selected[l.position - startPos - 1]!.id}`,
              })),
            );
          }
        }
        await logAudit(
          editing ? "instructor_course_updated" : "instructor_course_created",
          "course",
          savedId,
          { title: form.title.trim(), status: safeStatus },
        );
      }

      setEditorOpen(false);
      await refreshAll(
        editing
          ? "Course updated"
          : safeStatus === "draft"
            ? "Course saved as draft for approval"
            : "Course published",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save course.");
    } finally {
      setBusy(false);
    }
  }

  async function addLessonToCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonsCourse || !newLessonForm.title.trim()) return;
    setBusy(true);
    try {
      const existing = maps.lessonsByCourse.get(lessonsCourse.id) ?? [];
      const nextPos = existing.reduce((max, l) => Math.max(max, l.position), 0) + 1;
      const { data: created, error } = await supabase
        .from("lessons")
        .insert({
          course_id: lessonsCourse.id,
          title: newLessonForm.title.trim(),
          description: newLessonForm.description.trim() || null,
          position: nextPos,
          duration_minutes: Math.max(1, Number(newLessonForm.duration_minutes) || 15),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const videoUrl = safeHref(newLessonForm.video_url);
      if (created && videoUrl) {
        await supabase.from("lesson_media").insert({
          lesson_id: created.id,
          video_url: videoUrl,
        });
      }
      await logAudit("lesson_added", "lesson", created?.id, { course_id: lessonsCourse.id });
      setNewLessonForm({ title: "", description: "", duration_minutes: "15", video_url: "" });
      await refreshAll("Lesson added to course");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add lesson.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLesson(lessonId: string) {
    setBusy(true);
    try {
      await supabase.from("lesson_media").delete().eq("lesson_id", lessonId);
      const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
      if (error) throw new Error(error.message);
      await logAudit("lesson_deleted", "lesson", lessonId);
      await refreshAll("Lesson removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete lesson.");
    } finally {
      setBusy(false);
    }
  }

  function exportMyCourses() {
    downloadExcelXls(
      "ezana-instructor-courses",
      "My Courses",
      filtered.map((c) => ({
        Title: c.title,
        Level: c.level,
        Status: c.status,
        Lessons: (maps.lessonsByCourse.get(c.id) ?? []).length,
        EnrolledStudents: db.enrollments.filter((e) => e.course_id === c.id).length,
        DurationHours: c.duration_hours,
      })),
      "Instructor Assigned Courses",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "create" ? "Create New Course" : "My Courses"}
        description={
          mode === "create"
            ? "Design a new course with learning objectives, lessons, cover artwork, and optional YouTube channel or playlist import."
            : "Manage your assigned courses, organize lesson topics, review enrolled learners, and sync course content."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {can("courses", "export") && filtered.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={exportMyCourses}>
                <ArrowDownToLine className="h-4 w-4" />
                Export Excel
              </Button>
            )}
            {can("courses", "create") && (
              <Button type="button" variant="emerald" size="sm" onClick={() => openCourseEditor(null)}>
                <PlusCircle className="h-4 w-4" />
                New Course
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Assigned Courses" value={db.courses.length} icon={BookOpen} index={0} />
        <StatCard
          label="Published"
          value={db.courses.filter((c) => c.status === "published").length}
          icon={CheckCircle2}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Total Lessons"
          value={db.lessons.length}
          icon={PlayCircle}
          tone="deep"
          index={2}
        />
      </div>

      <Panel
        title="Assigned Courses"
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search courses…"
                className="h-9 w-48 pl-8 text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft / Pending</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        }
      >
        {paged.items.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {paged.items.map((course) => {
                const lessons = maps.lessonsByCourse.get(course.id) ?? [];
                const courseEnrollments = db.enrollments.filter((e) => e.course_id === course.id);
                const courseProgress = db.progress.filter((p) => p.course_id === course.id);
                const completionPct =
                  courseEnrollments.length > 0 && lessons.length > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (courseProgress.length / (courseEnrollments.length * lessons.length)) *
                            100,
                        ),
                      )
                    : 0;
                return (
                  <div
                    key={course.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start gap-3">
                      <CourseThumbnail
                        imageUrl={course.image_url}
                        course={course}
                        alt={course.title}
                        className="h-16 w-24 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-display text-base font-semibold">
                            {course.title}
                          </h3>
                          <Badge variant={STATUS_BADGE[course.status] ?? "muted"}>
                            {course.status}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {course.short_description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                          <span>{lessons.length} lessons</span>
                          <span>{courseEnrollments.length} enrolled</span>
                          <span>{completionPct}% avg completion</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRosterCourse(course)}
                      >
                        <Users className="h-3.5 w-3.5" />
                        Learners ({courseEnrollments.length})
                      </Button>
                      {can("courses", "edit") && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setLessonsCourse(course)}
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            Lessons ({lessons.length})
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openCourseEditor(course)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <Pager page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title="No assigned courses match"
            text="Courses assigned to you or created by you will appear here."
            icon={BookOpen}
            action={
              can("courses", "create") ? (
                <Button type="button" variant="emerald" onClick={() => openCourseEditor(null)}>
                  Create Your First Course
                </Button>
              ) : undefined
            }
          />
        )}
      </Panel>

      {/* Course Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Course: ${editing.title}` : "Create New Course"}</DialogTitle>
            <DialogDescription>
              {canApprovePublish
                ? "Configure course details, objectives, cover media, and YouTube lessons."
                : "New courses save as Draft for Academy Owner/Admin approval before public listing."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void saveCourse(e)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Course Title
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Introduction to Data Analysis"
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                URL Slug
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder={slugify(form.title) || "auto-generated"}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1 text-sm font-medium">
                Category
                <select
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Uncategorized</option>
                  {db.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Level
                <select
                  value={form.level}
                  onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Status
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as CourseRow["status"] }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="draft">Draft / Pending Review</option>
                  {canApprovePublish && <option value="published">Published</option>}
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-sm font-medium">
              Short Summary
              <Input
                required
                value={form.short_description}
                onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
                placeholder="One-sentence summary of what learners will achieve"
              />
            </label>

            <label className="block space-y-1 text-sm font-medium">
              Full Course Description
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>

            <label className="block space-y-1 text-sm font-medium">
              Learning Objectives (one per line)
              <Textarea
                rows={3}
                value={form.objectivesText}
                onChange={(e) => setForm((f) => ({ ...f, objectivesText: e.target.value }))}
                placeholder={"Understand core concepts\nComplete practical projects"}
              />
            </label>

            <div className="rounded-xl border border-border p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Cover Image</p>
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
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    coverFile: e.target.files?.[0] ?? null,
                    generatedCoverFile: null,
                  }))
                }
              />
              {(generatedPreview || form.image_url) && (
                <CourseThumbnail
                  imageUrl={generatedPreview || form.image_url}
                  course={{ title: form.title, short_description: form.short_description }}
                  alt="Cover preview"
                  className="h-28 w-48 rounded-xl"
                />
              )}
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
              <p className="text-sm font-semibold">Import / Sync YouTube Lessons</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  type="password"
                  placeholder="YouTube API Key"
                  value={form.youtubeApiKey}
                  onChange={(e) => setForm((f) => ({ ...f, youtubeApiKey: e.target.value }))}
                />
                <Input
                  placeholder="Channel ID (UC...)"
                  value={form.youtubeChannelId}
                  onChange={(e) => setForm((f) => ({ ...f, youtubeChannelId: e.target.value }))}
                />
                <Input
                  placeholder="Playlist ID (PL... optional)"
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
                  {loadingYt ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PlayCircle className="h-3.5 w-3.5" />
                  )}
                  Load Channel / Playlist Videos
                </Button>
                {editing && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={syncingYt}
                    onClick={() => void syncLessonsFromYoutube()}
                  >
                    {syncingYt ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Sync Titles & Auto-Add New Videos
                  </Button>
                )}
              </div>
              {youtubeVideos.length > 0 && (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
                  {youtubeVideos.map((v) => {
                    const checked = selectedVideoIds.includes(v.id);
                    return (
                      <label
                        key={v.id}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-secondary/50"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedVideoIds((prev) =>
                                e.target.checked
                                  ? [...prev, v.id]
                                  : prev.filter((id) => id !== v.id),
                              )
                            }
                          />
                          <span className="truncate">{replaceChannelBranding(v.title)}</span>
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {formatVideoDuration(v.durationMinutes)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={busy}>
                {busy ? "Saving…" : editing ? "Save Course Changes" : "Save Course"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Course Enrolled Roster Dialog */}
      <Dialog open={!!rosterCourse} onOpenChange={(o) => !o && setRosterCourse(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enrolled Students — {rosterCourse?.title}</DialogTitle>
            <DialogDescription>
              Learners currently enrolled in this course and their lesson completion progress.
            </DialogDescription>
          </DialogHeader>
          {rosterCourse && (
            <div className="max-h-96 overflow-y-auto">
              {db.enrollments.filter((e) => e.course_id === rosterCourse.id).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Lessons Done</TableHead>
                      <TableHead>Enrolled Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {db.enrollments
                      .filter((e) => e.course_id === rosterCourse.id)
                      .map((e) => {
                        const stu = maps.profilesById.get(e.user_id);
                        const totalLessons = (maps.lessonsByCourse.get(rosterCourse.id) ?? []).length;
                        const done = db.progress.filter(
                          (p) => p.user_id === e.user_id && p.course_id === rosterCourse.id,
                        ).length;
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">
                              {stu ? displayName(stu) : "Student"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {stu?.email ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {done} / {totalLessons}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(e.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  title="No students enrolled yet"
                  text="Students enrolled in this course will appear here."
                  icon={Users}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Course Lessons & Topics Organizer Dialog */}
      <Dialog open={!!lessonsCourse} onOpenChange={(o) => !o && setLessonsCourse(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Course Lessons & Topics — {lessonsCourse?.title}</DialogTitle>
            <DialogDescription>
              Organize lessons, topics, durations, and video links for this course.
            </DialogDescription>
          </DialogHeader>
          {lessonsCourse && (
            <div className="space-y-4">
              <form className="space-y-3 rounded-xl border border-border p-3" onSubmit={(e) => void addLessonToCourse(e)}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Add Lesson Topic
                </p>
                <div className="grid gap-2 sm:grid-cols-[1fr_110px]">
                  <Input
                    required
                    placeholder="Lesson title"
                    value={newLessonForm.title}
                    onChange={(e) => setNewLessonForm((f) => ({ ...f, title: e.target.value }))}
                  />
                  <Input
                    type="number"
                    min={1}
                    placeholder="Minutes"
                    value={newLessonForm.duration_minutes}
                    onChange={(e) =>
                      setNewLessonForm((f) => ({ ...f, duration_minutes: e.target.value }))
                    }
                  />
                </div>
                <Input
                  placeholder="Optional video URL (https://... or /videos/...)"
                  value={newLessonForm.video_url}
                  onChange={(e) => setNewLessonForm((f) => ({ ...f, video_url: e.target.value }))}
                />
                <Textarea
                  rows={2}
                  placeholder="Lesson notes / topic outline (optional)"
                  value={newLessonForm.description}
                  onChange={(e) => setNewLessonForm((f) => ({ ...f, description: e.target.value }))}
                />
                <Button type="submit" size="sm" variant="emerald" disabled={busy}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Lesson
                </Button>
              </form>

              <div className="space-y-2">
                {(maps.lessonsByCourse.get(lessonsCourse.id) ?? []).map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {lesson.position}. {lesson.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lesson.duration_minutes} min
                        {lesson.description ? ` · ${lesson.description}` : ""}
                      </p>
                    </div>
                    <ConfirmButton
                      title="Delete Lesson?"
                      description={`Remove "${lesson.title}" from this course?`}
                      onConfirm={() => void deleteLesson(lesson.id)}
                      trigger={
                        <Button type="button" variant="ghost" size="sm" aria-label="Delete lesson">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      }
                    />
                  </div>
                ))}
                {(maps.lessonsByCourse.get(lessonsCourse.id) ?? []).length === 0 && (
                  <p className="text-center text-xs text-muted-foreground">No lessons added yet.</p>
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
/* COURSE MATERIALS                                                           */
/* ========================================================================== */

export function InstructorMaterialsModule({ data }: { data: InstructorDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [courseFilter, setCourseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<CourseMaterial | null>(null);
  const [editing, setEditing] = useState<CourseMaterial | null>(null);
  const [form, setForm] = useState({
    courseId: "",
    lessonId: "",
    topic: "",
    title: "",
    type: "pdf" as ResourceType,
    url: "",
    fileSizeLabel: "",
    description: "",
    visibleToEnrolled: true,
  });

  const materials = useMemo(() => {
    return (workspace?.courseMaterials ?? []).filter((m) => {
      if (courseFilter !== "all" && m.courseId !== courseFilter) return false;
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (!search.trim()) return true;
      return `${m.title} ${m.topic} ${m.description}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    });
  }, [workspace?.courseMaterials, courseFilter, typeFilter, search]);

  const paged = useMemo(() => paginateRows(materials, page, 10), [materials, page]);

  function openEditor(mat: CourseMaterial | null) {
    setEditing(mat);
    setForm({
      courseId: mat?.courseId ?? db.courses[0]?.id ?? "",
      lessonId: mat?.lessonId ?? "",
      topic: mat?.topic ?? "",
      title: mat?.title ?? "",
      type: mat?.type ?? "pdf",
      url: mat?.url ?? "",
      fileSizeLabel: mat?.fileSizeLabel ?? "",
      description: mat?.description ?? "",
      visibleToEnrolled: mat?.visibleToEnrolled ?? true,
    });
    setEditorOpen(true);
  }

  async function saveMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!form.courseId || !form.title.trim()) {
      toast.error("Select a course and enter a material title.");
      return;
    }
    const cleanUrl = safeHref(form.url);
    if (form.url.trim() && !cleanUrl) {
      toast.error("Enter a valid http/https or site-relative file URL.");
      return;
    }
    const now = new Date().toISOString();
    await mutateWorkspace(
      {
        type: "upsert_course_material",
        payload: {
          id: editing?.id ?? crypto.randomUUID(),
          courseId: form.courseId,
          lessonId: form.lessonId || null,
          topic: form.topic.trim() || "General",
          title: form.title.trim(),
          type: form.type,
          url: cleanUrl,
          storagePath: null,
          fileSizeLabel: form.fileSizeLabel.trim() || "Digital file",
          description: form.description.trim(),
          visibleToEnrolled: form.visibleToEnrolled,
          uploadedBy: user?.id ?? null,
          createdAt: editing?.createdAt ?? now,
          updatedAt: now,
        },
      },
      editing ? "Course material updated" : "Course material added",
    );
    setEditorOpen(false);
  }

  async function toggleVisibility(mat: CourseMaterial) {
    await mutateWorkspace(
      {
        type: "upsert_course_material",
        payload: { ...mat, visibleToEnrolled: !mat.visibleToEnrolled },
      },
      mat.visibleToEnrolled ? "Material hidden from students" : "Material shared with enrolled students",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Materials"
        description="Upload and organize videos, PDFs, documents, slides, and links by course, lesson, and topic."
        actions={
          can("courses", "edit") && (
            <Button
              type="button"
              variant="emerald"
              size="sm"
              disabled={db.courses.length === 0}
              onClick={() => openEditor(null)}
            >
              <Plus className="h-4 w-4" />
              Add Material
            </Button>
          )
        }
      />

      <Panel
        title="Materials Library"
        actions={
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search title or topic…"
              className="h-9 w-44 text-xs"
            />
            <select
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">All my courses</option>
              {db.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">All types</option>
              <option value="video">Video</option>
              <option value="pdf">PDF</option>
              <option value="document">Document</option>
              <option value="presentation">Presentation</option>
              <option value="link">Link</option>
            </select>
          </div>
        }
      >
        {paged.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title & Topic</TableHead>
                  <TableHead>Course / Lesson</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((mat) => {
                  const course = maps.coursesById.get(mat.courseId);
                  const lesson = (maps.lessonsByCourse.get(mat.courseId) ?? []).find(
                    (l) => l.id === mat.lessonId,
                  );
                  return (
                    <TableRow key={mat.id}>
                      <TableCell>
                        <p className="font-semibold text-sm">{mat.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Topic: {mat.topic} · {mat.fileSizeLabel}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p className="font-medium">{course?.title ?? "Course"}</p>
                        <p className="text-muted-foreground">
                          {lesson ? `Lesson ${lesson.position}: ${lesson.title}` : "Course-wide"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{mat.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => void toggleVisibility(mat)}
                          className="text-xs font-medium"
                        >
                          <Badge variant={mat.visibleToEnrolled ? "success" : "muted"}>
                            {mat.visibleToEnrolled ? "Enrolled Students" : "Hidden"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewItem(mat)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </Button>
                          {can("courses", "edit") && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openEditor(mat)}
                            >
                              Edit
                            </Button>
                          )}
                          {can("courses", "delete") && (
                            <ConfirmButton
                              title="Delete Course Material?"
                              description={`Remove "${mat.title}" permanently?`}
                              onConfirm={() =>
                                void mutateWorkspace(
                                  { type: "delete_course_material", id: mat.id },
                                  "Material deleted",
                                )
                              }
                              trigger={
                                <Button type="button" variant="ghost" size="sm" aria-label="Delete material">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              }
                            />
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
            title="No course materials added"
            text="Add lecture slides, PDF handouts, videos, or study guides for your assigned courses."
            icon={FileText}
          />
        )}
      </Panel>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit / Replace Course Material" : "Add Course Material"}</DialogTitle>
            <DialogDescription>
              Organize files and video links under an assigned course, lesson, and topic.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void saveMaterial(e)}>
            <label className="block space-y-1 text-sm font-medium">
              Assigned Course
              <select
                required
                value={form.courseId}
                onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value, lessonId: "" }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {db.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Lesson (optional)
                <select
                  value={form.lessonId}
                  onChange={(e) => setForm((f) => ({ ...f, lessonId: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Course-wide material</option>
                  {(maps.lessonsByCourse.get(form.courseId) ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.position}. {l.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Topic
                <Input
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="Week 1: Foundations"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Title
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Material Type
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ResourceType }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="pdf">PDF Document</option>
                  <option value="video">Video</option>
                  <option value="presentation">Presentation / Slides</option>
                  <option value="document">Word / Worksheet</option>
                  <option value="link">Reference Link</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <label className="block space-y-1 text-sm font-medium">
                File / Resource URL
                <Input
                  required
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://... or /files/guide.pdf"
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Size Label
                <Input
                  value={form.fileSizeLabel}
                  onChange={(e) => setForm((f) => ({ ...f, fileSizeLabel: e.target.value }))}
                  placeholder="2.4 MB"
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm font-medium">
              Description
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.visibleToEnrolled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, visibleToEnrolled: e.target.checked }))
                }
              />
              Make available to enrolled students immediately
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                Save Material
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewItem} onOpenChange={(o) => !o && setPreviewItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{previewItem?.title}</DialogTitle>
            <DialogDescription>
              Topic: {previewItem?.topic} · {previewItem?.type.toUpperCase()} ·{" "}
              {previewItem?.fileSizeLabel}
            </DialogDescription>
          </DialogHeader>
          {previewItem && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {previewItem.description || "No additional notes provided."}
              </p>
              {safeHref(previewItem.url) ? (
                <a
                  href={safeHref(previewItem.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
                >
                  Open Material File <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No external URL attached.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* E-LEARNING RESOURCES                                                       */
/* ========================================================================== */

export function InstructorResourcesModule({ data }: { data: InstructorDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LearningResource | null>(null);
  const [form, setForm] = useState({
    title: "",
    type: "pdf" as ResourceType,
    courseId: "",
    subjectId: "",
    categoryId: "",
    url: "",
    fileSizeLabel: "",
    accessLevel: "enrolled" as ResourceAccess,
    description: "",
  });

  const resources = useMemo(() => {
    return (workspace?.resources ?? []).filter((r) => {
      if (courseFilter !== "all" && r.courseId !== courseFilter) return false;
      if (!search.trim()) return true;
      return `${r.title} ${r.description}`.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [workspace?.resources, courseFilter, search]);

  function openEditor(res: LearningResource | null) {
    setEditing(res);
    setForm({
      title: res?.title ?? "",
      type: res?.type ?? "pdf",
      courseId: res?.courseId ?? db.courses[0]?.id ?? "",
      subjectId: res?.subjectId ?? "",
      categoryId: res?.categoryId ?? "",
      url: res?.url ?? "",
      fileSizeLabel: res?.fileSizeLabel ?? "",
      accessLevel: res?.accessLevel ?? "enrolled",
      description: res?.description ?? "",
    });
    setEditorOpen(true);
  }

  async function saveResource(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const cleanUrl = safeHref(form.url);
    if (form.url.trim() && !cleanUrl) {
      toast.error("Please enter a valid http/https or relative resource URL.");
      return;
    }
    await mutateWorkspace(
      {
        type: "upsert_resource",
        payload: {
          id: editing?.id ?? crypto.randomUUID(),
          title: form.title.trim(),
          type: form.type,
          courseId: form.courseId || db.courses[0]?.id || null,
          subjectId: form.subjectId || null,
          categoryId: form.categoryId || null,
          url: cleanUrl,
          storagePath: null,
          fileSizeLabel: form.fileSizeLabel.trim() || "Digital",
          accessLevel: form.accessLevel,
          description: form.description.trim(),
          createdAt: editing?.createdAt ?? new Date().toISOString(),
        },
      },
      editing ? "E-learning resource updated" : "E-learning resource published",
    );
    setEditorOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="E-Learning Resources"
        description="Organize digital learning resources by subject, course, and category for your assigned students."
        actions={
          can("resources", "create") && (
            <Button
              type="button"
              variant="emerald"
              size="sm"
              disabled={db.courses.length === 0}
              onClick={() => openEditor(null)}
            >
              <Plus className="h-4 w-4" />
              Add Resource
            </Button>
          )
        }
      />

      <Panel
        title="Digital Resource Repository"
        actions={
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources…"
              className="h-9 w-44 text-xs"
            />
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">All courses</option>
              {db.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {resources.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {resources.map((r) => {
              const link = safeHref(r.url);
              return (
                <div
                  key={r.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm">{r.title}</h4>
                      <Badge variant="outline">{r.type}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.courseId ? (maps.coursesById.get(r.courseId)?.title ?? "Course") : "Shared"} ·{" "}
                      {r.accessLevel.replace("_", " ")}
                    </p>
                    {r.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {r.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        Open / Download <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">No URL</span>
                    )}
                    <div className="flex items-center gap-1">
                      {can("resources", "edit") && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openEditor(r)}
                        >
                          Edit
                        </Button>
                      )}
                      {can("resources", "delete") && (
                        <ConfirmButton
                          title="Delete Resource?"
                          description={`Delete "${r.title}"?`}
                          onConfirm={() =>
                            void mutateWorkspace(
                              { type: "delete_resource", id: r.id },
                              "Resource deleted",
                            )
                          }
                          trigger={
                            <Button type="button" variant="ghost" size="sm" aria-label="Delete resource">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No digital resources yet"
            text="Publish reference books, slides, and practice datasets for your students."
            icon={FolderKanban}
          />
        )}
      </Panel>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Resource" : "Add E-Learning Resource"}</DialogTitle>
            <DialogDescription>
              Share curated learning resources with students in your assigned courses.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void saveResource(e)}>
            <label className="block space-y-1 text-sm font-medium">
              Resource Title
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Assigned Course
                <select
                  required
                  value={form.courseId}
                  onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {db.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Subject
                <select
                  value={form.subjectId}
                  onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">General</option>
                  {(workspace?.subjects ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Type
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ResourceType }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="pdf">PDF</option>
                  <option value="video">Video</option>
                  <option value="document">Document</option>
                  <option value="presentation">Presentation</option>
                  <option value="link">Web Link</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Visibility
                <select
                  value={form.accessLevel}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, accessLevel: e.target.value as ResourceAccess }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="enrolled">Enrolled Students</option>
                  <option value="pro_paid">Paid / Pro Learners</option>
                  <option value="public">Public Preview</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1 text-sm font-medium">
              Resource URL
              <Input
                required
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Description
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                Save Resource
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* COURSE / CLASS ANNOUNCEMENTS                                               */
/* ========================================================================== */

export function InstructorAnnouncementsModule({
  data,
  scope = "course",
}: {
  data: InstructorDataHandle;
  scope?: "course" | "class";
}) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, refreshAll, can } = data;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetId, setTargetId] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const targets =
    scope === "course"
      ? db.courses.map((c) => ({ id: c.id, name: c.title }))
      : (workspace?.classes ?? []).map((cl) => ({
          id: cl.id,
          name: `${cl.name} (${cl.sectionCode})`,
        }));

  const relevantAnnouncements = useMemo(() => {
    const courseIds = new Set(db.courses.map((c) => c.id));
    const classIds = new Set((workspace?.classes ?? []).map((c) => c.id));
    return db.announcements.filter((a) => {
      const meta = workspace?.announcementMeta[a.id];
      if (scope === "course") {
        return (
          (meta?.targetCourseId && courseIds.has(meta.targetCourseId)) ||
          a.created_by === user?.id
        );
      }
      return (
        (meta?.targetClassId && classIds.has(meta.targetClassId)) || a.created_by === user?.id
      );
    });
  }, [db.announcements, db.courses, scope, user?.id, workspace]);

  async function submitAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !title.trim() || !body.trim()) return;
    const chosenTarget = targetId || targets[0]?.id || "";
    if (!chosenTarget) {
      toast.error(
        scope === "course"
          ? "Create or receive an assigned course first."
          : "You need an assigned class section first.",
      );
      return;
    }
    setBusy(true);
    try {
      const publishIso = publishAt ? new Date(publishAt).toISOString() : new Date().toISOString();
      let annId = editingId;
      if (editingId) {
        const { error } = await supabase
          .from("announcements")
          .update({
            title: title.trim(),
            body: body.trim(),
            publish_at: publishIso,
          })
          .eq("id", editingId)
          .eq("created_by", user.id);
        if (error) throw new Error(error.message);
      } else {
        const { data: created, error } = await supabase
          .from("announcements")
          .insert({
            title: title.trim(),
            body: body.trim(),
            audience: "student",
            published: true,
            publish_at: publishIso,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        annId = created.id;
      }

      if (annId) {
        await mutateWorkspace({
          type: "upsert_announcement_meta",
          payload: {
            announcementId: annId,
            targetCourseId: scope === "course" ? chosenTarget : null,
            targetClassId: scope === "class" ? chosenTarget : null,
          },
        });
        if (!editingId && notifyStudents) {
          await mutateWorkspace({
            type: "create_notification",
            payload: {
              title: title.trim(),
              message: body.trim(),
              category: "academic",
              targetRole: "student",
              targetCourseId: scope === "course" ? chosenTarget : null,
              targetClassId: scope === "class" ? chosenTarget : null,
            },
          });
        }
        await logAudit(
          editingId ? "announcement_updated" : "announcement_published",
          "announcement",
          annId,
          { scope, targetId: chosenTarget },
        );
      }

      setTitle("");
      setBody("");
      setPublishAt("");
      setEditingId(null);
      await refreshAll(editingId ? "Announcement updated" : "Announcement published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish announcement.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnnouncement(id: string) {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id)
        .eq("created_by", user.id);
      if (error) throw new Error(error.message);
      await logAudit("announcement_deleted", "announcement", id);
      await refreshAll("Announcement deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete announcement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={scope === "course" ? "Course Announcements" : "Class Announcements"}
        description={
          scope === "course"
            ? "Publish, schedule, edit, and notify enrolled students about course updates and lessons."
            : "Share class schedules, exam reminders, and important updates with your assigned classes."
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        {can("communication", "create") && (
          <Panel title={editingId ? "Edit Announcement" : "New Announcement"}>
            <form className="space-y-3" onSubmit={(e) => void submitAnnouncement(e)}>
              <label className="block space-y-1 text-sm font-medium">
                {scope === "course" ? "Target Course" : "Target Class / Section"}
                <select
                  value={targetId || targets[0]?.id || ""}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {targets.length === 0 && (
                    <option value="">
                      {scope === "course" ? "No courses assigned" : "No classes assigned"}
                    </option>
                  )}
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-sm font-medium">
                Title
                <Input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Upcoming Quiz & Study Guide Posted"
                />
              </label>

              <label className="block space-y-1 text-sm font-medium">
                Message
                <Textarea
                  required
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Share schedule details, reading notes, or deadlines…"
                />
              </label>

              <label className="block space-y-1 text-sm font-medium">
                Schedule Publish Time (optional)
                <Input
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                />
              </label>

              {!editingId && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={notifyStudents}
                    onChange={(e) => setNotifyStudents(e.target.checked)}
                  />
                  Send in-app notification to students immediately
                </label>
              )}

              <div className="flex gap-2">
                <Button type="submit" variant="emerald" disabled={busy || targets.length === 0}>
                  <Megaphone className="h-4 w-4" />
                  {editingId ? "Update" : "Publish Announcement"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setTitle("");
                      setBody("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Panel>
        )}

        <Panel title="Published & Scheduled Notices">
          {relevantAnnouncements.length > 0 ? (
            <div className="space-y-3">
              {relevantAnnouncements.map((a) => {
                const meta = workspace?.announcementMeta[a.id];
                const label = meta?.targetCourseId
                  ? maps.coursesById.get(meta.targetCourseId)?.title
                  : meta?.targetClassId
                    ? maps.classesById.get(meta.targetClassId)?.name
                    : "General";
                return (
                  <div key={a.id} className="rounded-xl border border-border p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{a.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {label} · {new Date(a.publish_at).toLocaleString()}
                        </p>
                      </div>
                      {a.created_by === user?.id && (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(a.id);
                              setTitle(a.title);
                              setBody(a.body);
                              setTargetId(meta?.targetCourseId ?? meta?.targetClassId ?? "");
                            }}
                          >
                            Edit
                          </Button>
                          <ConfirmButton
                            title="Delete Announcement?"
                            description={`Remove "${a.title}"?`}
                            onConfirm={() => void deleteAnnouncement(a.id)}
                            trigger={
                              <Button type="button" variant="ghost" size="sm" aria-label="Delete announcement">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            }
                          />
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{a.body}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No announcements yet"
              text="Publish updates to keep enrolled learners informed."
              icon={Megaphone}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
