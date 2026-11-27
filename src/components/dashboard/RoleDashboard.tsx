import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity, Archive, ArrowDownToLine, ArrowRight, BadgeCheck, BookOpen, BookOpenCheck,
  Check, CircleDollarSign, ClipboardList, GraduationCap, LayoutDashboard, Loader2, Mail, PlayCircle,
  Megaphone, MessageSquare, Plus, RefreshCw, Search, Settings, Shield, Sparkles, Trash2, UserRound, Users, Wallet, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, displayName, type AppRole } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { downloadCsv } from "@/lib/csv";
import { FREE_LESSON_LIMIT, formatETB } from "@/lib/access";
import { courseCoverUrl, courseImageUrl, fallbackCourseToken } from "@/lib/course-image";
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
import { cn } from "@/lib/utils";
import { CourseThumbnail } from "@/components/site/CourseThumbnail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmButton, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard } from "@/components/dashboard/ui";
import { OwnerDashboard } from "./owner/OwnerDashboard";
import { InstructorDashboard } from "./instructor/InstructorDashboard";
import { StudentDashboard } from "./student/StudentDashboard";

type Profile = Tables<"profiles">;
type UserRole = Tables<"user_roles">;
type Course = Tables<"courses">;
type Enrollment = Tables<"enrollments">;
type Progress = Tables<"lesson_progress">;
type Payment = Tables<"payments">;
type ParentLink = Tables<"parent_links">;
type Announcement = Tables<"announcements">;
type ContactMessage = Tables<"contact_messages">;
type AuditLog = Tables<"audit_logs">;
type Lesson = Tables<"lessons">;
type AcademySettings = Tables<"academy_settings">;

type Section = "overview" | "people" | "courses" | "payments" | "announcements" | "inbox" | "activity" | "learners" | "children" | "learning" | "account" | "academy" | "reports";
type DashboardData = {
  profiles: Profile[];
  roles: UserRole[];
  courses: Course[];
  enrollments: Enrollment[];
  progress: Progress[];
  payments: Payment[];
  parentLinks: ParentLink[];
  announcements: Announcement[];
  messages: ContactMessage[];
  audit: AuditLog[];
  lessons: Lesson[];
  settings: AcademySettings | null;
};

const emptyData: DashboardData = {
  profiles: [], roles: [], courses: [], enrollments: [], progress: [], payments: [],
  parentLinks: [], announcements: [], messages: [], audit: [], lessons: [], settings: null,
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("The academy data could not be loaded.");
  return result.data;
}

async function loadDashboard(role: AppRole, userId: string): Promise<DashboardData> {
  const staff = role === "owner" || role === "admin";
  if (staff) {
    const [profiles, roles, courses, enrollments, progress, payments, announcements, messages, audit, lessons, settings] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("user_roles").select("*"),
      supabase.from("courses").select("*").order("created_at", { ascending: false }),
      supabase.from("enrollments").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("lesson_progress").select("*").limit(5000),
      supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("announcements").select("*").order("publish_at", { ascending: false }),
      supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("lessons").select("*").order("position"),
      supabase.from("academy_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    return {
      ...emptyData,
      profiles: unwrap(profiles), roles: unwrap(roles), courses: unwrap(courses), enrollments: unwrap(enrollments),
      progress: unwrap(progress), payments: unwrap(payments), announcements: unwrap(announcements), messages: unwrap(messages),
      audit: unwrap(audit), lessons: unwrap(lessons), settings: settings.error ? null : settings.data,
    };
  }

  if (role === "instructor") {
    const courses = unwrap(await supabase.from("courses").select("*").eq("instructor_id", userId).order("created_at", { ascending: false }));
    const courseIds = courses.map((c) => c.id);
    if (!courseIds.length) {
      const announcements = unwrap(await supabase.from("announcements").select("*").eq("published", true).order("publish_at", { ascending: false }).limit(20));
      return { ...emptyData, courses, announcements };
    }
    const enrollments = unwrap(await supabase.from("enrollments").select("*").in("course_id", courseIds).order("created_at", { ascending: false }));
    const learnerIds = [...new Set(enrollments.map((e) => e.user_id))];
    const [progress, profiles, lessons, announcements] = await Promise.all([
      supabase.from("lesson_progress").select("*").in("course_id", courseIds),
      learnerIds.length ? supabase.from("profiles").select("*").in("id", learnerIds) : Promise.resolve({ data: [], error: null }),
      supabase.from("lessons").select("*").in("course_id", courseIds).order("position"),
      supabase.from("announcements").select("*").eq("published", true).order("publish_at", { ascending: false }).limit(20),
    ]);
    return { ...emptyData, courses, enrollments, progress: unwrap(progress), profiles: unwrap(profiles), lessons: unwrap(lessons), announcements: unwrap(announcements) };
  }

  if (role === "parent") {
    const parentLinks = unwrap(await supabase.from("parent_links").select("*").eq("parent_id", userId).order("created_at"));
    const childIds = parentLinks.map((l) => l.student_id);
    const announcements = await supabase.from("announcements").select("*").eq("published", true).order("publish_at", { ascending: false }).limit(20);
    if (!childIds.length) return { ...emptyData, parentLinks, announcements: announcements.data ?? [] };
    const [profiles, enrollments, progress, payments, courses, lessons] = await Promise.all([
      supabase.from("profiles").select("*").in("id", childIds),
      supabase.from("enrollments").select("*").in("user_id", childIds),
      supabase.from("lesson_progress").select("*").in("user_id", childIds),
      supabase.from("payments").select("*").in("user_id", childIds).order("created_at", { ascending: false }),
      supabase.from("courses").select("*").eq("status", "published"),
      supabase.from("lessons").select("*").order("position"),
    ]);
    return {
      ...emptyData, parentLinks, profiles: unwrap(profiles), enrollments: unwrap(enrollments), progress: unwrap(progress),
      payments: unwrap(payments), courses: unwrap(courses), lessons: unwrap(lessons), announcements: announcements.data ?? [],
    };
  }

  const [enrollments, progress, payments, courses, lessons, announcements] = await Promise.all([
    supabase.from("enrollments").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("lesson_progress").select("*").eq("user_id", userId).order("completed_at", { ascending: false }),
    supabase.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("courses").select("*").eq("status", "published").order("created_at", { ascending: false }),
    supabase.from("lessons").select("*").order("position"),
    supabase.from("announcements").select("*").eq("published", true).order("publish_at", { ascending: false }).limit(20),
  ]);
  return {
    ...emptyData, enrollments: unwrap(enrollments), progress: unwrap(progress), payments: unwrap(payments),
    courses: unwrap(courses), lessons: unwrap(lessons), announcements: unwrap(announcements),
  };
}

const STAFF_SECTIONS: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "people", label: "People & access", icon: Users },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "inbox", label: "Contact inbox", icon: Mail },
  { id: "reports", label: "Reports", icon: ArrowDownToLine },
  { id: "activity", label: "Audit activity", icon: Activity },
  { id: "academy", label: "Academy profile", icon: Settings },
];

function sectionsFor(role: AppRole): typeof STAFF_SECTIONS {
  if (role === "owner") return STAFF_SECTIONS;
  if (role === "admin") return STAFF_SECTIONS.filter((s) => s.id !== "academy");
  if (role === "instructor") return [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "courses", label: "My courses", icon: BookOpen },
    { id: "learners", label: "Learners", icon: Users },
    { id: "announcements", label: "Announcements", icon: Megaphone },
  ];
  if (role === "parent") return [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "children", label: "My children", icon: Users },
    { id: "learning", label: "Course progress", icon: BookOpenCheck },
    { id: "payments", label: "Payments", icon: Wallet },
    { id: "announcements", label: "Announcements", icon: Megaphone },
  ];
  return [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "learning", label: "My learning", icon: BookOpenCheck },
    { id: "payments", label: "Payments", icon: Wallet },
    { id: "announcements", label: "Announcements", icon: Megaphone },
  ];
}

const ROLE_NAME: Record<AppRole, string> = { owner: "Owner", admin: "Admin", instructor: "Instructor", student: "Student", parent: "Parent" };
const currency = (amount: number) => `${formatETB(0).split(" ")[0]} ${Number(amount || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const roleTone: Record<string, "default" | "secondary" | "gold" | "outline"> = {
  owner: "gold", admin: "default", instructor: "secondary", student: "outline", parent: "outline",
};

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function RoleDashboard() {
  const { roles, primaryRole } = useAuth();
  const [pickedRole, setPickedRole] = useState<AppRole | null>(null);
  const role = (pickedRole && roles.includes(pickedRole) ? pickedRole : primaryRole) ?? "student";
  const staff = role === "owner" || role === "admin";

  if (staff) {
    return (
      <OwnerDashboard
        role={role}
        roles={roles}
        onSwitchRole={(nextRole) => setPickedRole(nextRole)}
      />
    );
  }

  if (role === "instructor") {
    return (
      <InstructorDashboard
        role={role}
        roles={roles}
        onSwitchRole={(nextRole) => setPickedRole(nextRole)}
      />
    );
  }

  if (role === "student") {
    return (
      <StudentDashboard
        role={role}
        roles={roles}
        onSwitchRole={(nextRole) => setPickedRole(nextRole)}
      />
    );
  }

  return (
    <LegacyRoleDashboard
      role={role}
      roles={roles}
      onSwitchRole={(nextRole) => setPickedRole(nextRole)}
    />
  );
}

function LegacyRoleDashboard({
  role,
  roles,
  onSwitchRole,
}: {
  role: AppRole;
  roles: AppRole[];
  onSwitchRole: (nextRole: AppRole) => void;
}) {
  const { user, profile } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [selectedChild, setSelectedChild] = useState("");
  const [search, setSearch] = useState("");
  const [courseDialog, setCourseDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const staff = false;

  const sections = sectionsFor(role);
  const currentSection = sections.some((s) => s.id === section) || section === "account" ? section : "overview";

  const query = useQuery({
    queryKey: ["role-dashboard", role, user?.id],
    enabled: !!user,
    queryFn: () => loadDashboard(role, user!.id),
    staleTime: 30_000,
  });
  const data = query.data ?? emptyData;
  const selectedChildId = selectedChild || data.parentLinks[0]?.student_id || "";
  const selectedChildProfile = data.profiles.find((p) => p.id === selectedChildId);

  const rolesByUser = useMemo(() => {
    const map = new Map<string, UserRole[]>();
    data.roles.forEach((r) => map.set(r.user_id, [...(map.get(r.user_id) ?? []), r]));
    return map;
  }, [data.roles]);
  const coursesById = useMemo(() => new Map(data.courses.map((c) => [c.id, c])), [data.courses]);
  const profilesById = useMemo(() => new Map(data.profiles.map((p) => [p.id, p])), [data.profiles]);
  const lessonsByCourse = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    data.lessons.forEach((l) => map.set(l.course_id, [...(map.get(l.course_id) ?? []), l]));
    return map;
  }, [data.lessons]);

  async function refresh(success?: string) {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["role-dashboard"] }),
      qc.invalidateQueries({ queryKey: ["public"] }),
    ]);
    if (success) toast.success(success);
  }

  async function saveCourse(values: CourseFormValues, course?: Course, youtubeVideos: YoutubeVideo[] = []) {
    if (!user) return;
    setBusy(true);
    let imageUrl = values.image_url.trim() || null;
    let uploadedCoverPath: string | null = null;
    const fileToUpload = values.coverFile ?? values.generatedCoverFile;
    if (fileToUpload) {
      if (fileToUpload.size > 10 * 1024 * 1024) { setBusy(false); toast.error("Course cover images must be 10 MB or smaller"); return; }
      if (!/^image\/(jpeg|png|webp)$/.test(fileToUpload.type)) { setBusy(false); toast.error("Choose a JPG, PNG, or WebP cover image"); return; }
      const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      uploadedCoverPath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("course-covers").upload(uploadedCoverPath, fileToUpload, {
        cacheControl: "3600", contentType: fileToUpload.type, upsert: false,
      });
      if (uploadError) { setBusy(false); toast.error(`Cover image upload failed: ${uploadError.message}`); return; }
      imageUrl = courseCoverUrl(uploadedCoverPath);
    }
    if (!imageUrl) {
      imageUrl = fallbackCourseToken({
        title: values.title,
        short_description: values.short_description,
        description: values.description,
      });
    }
    const payload = {
      title: values.title.trim(), slug: slugify(values.slug || values.title),
      short_description: values.short_description.trim(), description: values.description.trim(),
      image_url: imageUrl, level: values.level,
      duration_hours: Number(values.duration_hours) || 0, status: values.status,
      instructor_id: role === "instructor" ? user.id : values.instructor_id || null,
    };
    const result = course
      ? await supabase.from("courses").update(payload).eq("id", course.id)
      : await supabase.from("courses").insert(payload).select("id").single();
    if (result.error) {
      if (uploadedCoverPath) await supabase.storage.from("course-covers").remove([uploadedCoverPath]);
      setBusy(false); toast.error(result.error.message); return;
    }
    const savedCourseId = course?.id ?? ("data" in result ? result.data?.id : undefined);
    if (savedCourseId) {
      if (values.youtubeApiKey.trim()) localStorage.setItem("ezana_yt_key_global", values.youtubeApiKey.trim());
      if (values.youtubeChannelId.trim()) localStorage.setItem("ezana_yt_channel_global", values.youtubeChannelId.trim());
      if (values.youtubePlaylistId.trim()) localStorage.setItem("ezana_yt_playlist_global", values.youtubePlaylistId.trim());

      localStorage.setItem(`ezana_yt_key_${savedCourseId}`, values.youtubeApiKey.trim());
      localStorage.setItem(`ezana_yt_channel_${savedCourseId}`, values.youtubeChannelId.trim());
      localStorage.setItem(`ezana_yt_playlist_${savedCourseId}`, values.youtubePlaylistId.trim());
    }
    if (youtubeVideos.length && savedCourseId) {
      const lessonStart = (lessonsByCourse.get(savedCourseId) ?? []).reduce((max, lesson) => Math.max(max, lesson.position), 0);
      const lessonRows = youtubeVideos.map((video, index) => ({
        course_id: savedCourseId,
        title: replaceChannelBranding(video.title),
        description: video.description ? replaceChannelBranding(video.description) : null,
        position: lessonStart + index + 1,
        duration_minutes: video.durationMinutes,
      }));
      const createdLessons = await supabase.from("lessons").insert(lessonRows).select("id,position");
      if (createdLessons.error) { setBusy(false); toast.error(`Course saved, but YouTube lessons could not be added: ${createdLessons.error.message}`); return; }
      const mediaResult = await supabase.from("lesson_media").insert(createdLessons.data.map((lesson) => ({
        lesson_id: lesson.id, video_url: `https://www.youtube.com/watch?v=${youtubeVideos[lesson.position - lessonStart - 1]!.id}`,
      })));
      if (mediaResult.error) { setBusy(false); toast.error(`Lessons saved, but video links could not be added: ${mediaResult.error.message}`); return; }
    }
    setBusy(false);
    setCourseDialog(false);
    setEditingCourse(null);
    await refresh(course ? "Course updated" : "Course created");
  }

  async function updateProfileStatus(id: string, status: Profile["status"]) {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    setBusy(false);
    if (error) toast.error(error.message); else await refresh("Account status updated");
  }

  async function changeUserRole(id: string, newRole: AppRole, existing?: UserRole) {
    setBusy(true);
    const result = existing
      ? await supabase.from("user_roles").delete().eq("id", existing.id)
      : await supabase.from("user_roles").insert({ user_id: id, role: newRole });
    setBusy(false);
    if (result.error) toast.error(result.error.message); else await refresh(existing ? "Role removed" : "Role assigned");
  }

  async function reviewPayment(payment: Payment, status: "approved" | "rejected") {
    setBusy(true);
    const { error } = await supabase.from("payments").update({ status }).eq("id", payment.id);
    setBusy(false);
    if (error) toast.error(error.message); else await refresh(`Payment ${status}`);
  }

  async function deletePayment(payment: Payment) {
    if (role !== "owner") return;
    setBusy(true);
    const receiptPath = paymentReceiptPath(payment);
    if (receiptPath) {
      const { error: receiptError } = await supabase.storage.from("payment-receipts").remove([receiptPath]);
      if (receiptError) { setBusy(false); toast.error(`Could not delete the receipt: ${receiptError.message}`); return; }
    }
    const { error } = await supabase.from("payments").delete().eq("id", payment.id);
    setBusy(false);
    if (error) toast.error(error.message); else await refresh("Payment record deleted");
  }

  async function createAnnouncement(values: { title: string; body: string; audience: AppRole | "all" }) {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({
      title: values.title.trim(), body: values.body.trim(), audience: values.audience === "all" ? null : values.audience,
      published: true, created_by: user.id,
    });
    setBusy(false);
    if (error) toast.error(error.message); else await refresh("Announcement published");
  }

  async function updateAnnouncement(id: string, values: { title: string; body: string; audience: AppRole | "all" }) {
    setBusy(true);
    const { error } = await supabase.from("announcements").update({
      title: values.title.trim(), body: values.body.trim(), audience: values.audience === "all" ? null : values.audience,
    }).eq("id", id);
    setBusy(false);
    if (error) toast.error(error.message); else await refresh("Announcement updated");
  }

  async function removeAnnouncement(id: string) {
    setBusy(true);
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    setBusy(false);
    if (error) toast.error(error.message); else await refresh("Announcement deleted");
  }

  async function resolveMessage(message: ContactMessage, reply: string) {
    setBusy(true);
    const { error } = await supabase.from("contact_messages").update({ reply: reply.trim(), status: "resolved" }).eq("id", message.id);
    setBusy(false);
    if (error) toast.error(error.message); else await refresh("Reply saved and inquiry resolved");
  }

  async function updateAcademy(values: Partial<AcademySettings>) {
    setBusy(true);
    const { error } = await supabase.from("academy_settings").update(values).eq("id", 1);
    setBusy(false);
    if (error) toast.error(error.message); else await refresh("Academy profile saved");
  }

  async function enroll(course: Course) {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("enrollments").insert({ user_id: user.id, course_id: course.id });
    setBusy(false);
    if (error) toast.error(error.message); else await refresh(`Enrolled in ${course.title}`);
  }

  async function archiveCourse(course: Course) {
    setBusy(true);
    const { error } = await supabase.from("courses").update({ status: "archived" }).eq("id", course.id);
    setBusy(false);
    if (error) toast.error(error.message); else await refresh("Course archived");
  }

  async function deleteCourse(course: Course) {
    if (!staff) return;
    setBusy(true);
    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    setBusy(false);
    if (error) toast.error(error.message); else await refresh(`Permanently deleted "${course.title}"`);
  }

  async function deleteOtherCourses(ids: string[]) {
    if (!staff || !ids.length) return;
    setBusy(true);
    const { error } = await supabase.from("courses").delete().in("id", ids);
    setBusy(false);
    if (error) toast.error(error.message); else await refresh("Removed all other courses permanently");
  }

  const enrollmentFor = (userId: string, courseId: string) => data.enrollments.some((e) => e.user_id === userId && e.course_id === courseId);
  const courseLearnerCount = (courseId: string) => new Set(data.enrollments.filter((e) => e.course_id === courseId).map((e) => e.user_id)).size;

  if (query.isLoading) return <LoadingBlock label="Preparing your dashboard…" />;
  if (query.error) return <ErrorBlock error={query.error} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="self-start rounded-2xl border border-border bg-card p-3 shadow-soft lg:sticky lg:top-28">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-deep p-4 text-deep-foreground">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground"><GraduationCap className="h-5 w-5" /></span>
          <div className="min-w-0"><p className="truncate text-sm font-bold">Ezana Academy</p><p className="text-xs text-deep-muted">{ROLE_NAME[role]} workspace</p></div>
        </div>
        {roles.length > 1 && (
          <label className="mb-3 block px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            View workspace
            <select aria-label="Choose dashboard role" value={role} onChange={(e) => { onSwitchRole(e.target.value as AppRole); setSection("overview"); }} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm font-medium normal-case tracking-normal text-foreground">
              {roles.map((r) => <option key={r} value={r}>{ROLE_NAME[r]}</option>)}
            </select>
          </label>
        )}
        <nav aria-label="Dashboard sections" className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setSection(id); setSearch(""); }} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${currentSection === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <Icon className="h-4 w-4 shrink-0" /> <span>{label}</span>
            </button>
          ))}
          <button onClick={() => setSection("account")} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${currentSection === "account" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
            <UserRound className="h-4 w-4" /> My account
          </button>
        </nav>
        <div className="mt-4 border-t border-border px-3 pt-3 text-xs text-muted-foreground">Signed in as <span className="font-semibold text-foreground">{displayName(profile) || user?.email}</span></div>
      </aside>

      <main className="min-w-0">
        {currentSection === "overview" && <Overview role={role} data={data} profile={profile} coursesById={coursesById} lessonsByCourse={lessonsByCourse} selectedChildId={selectedChildId} onSelectChild={setSelectedChild} onNavigateSection={setSection} />}
        {currentSection === "people" && staff && <PeopleSection data={data} rolesByUser={rolesByUser} role={role} currentUserId={user?.id ?? ""} search={search} setSearch={setSearch} busy={busy} onStatus={updateProfileStatus} onRole={changeUserRole} />}
        {currentSection === "courses" && <CoursesSection role={role} data={data} userId={user?.id ?? ""} search={search} setSearch={setSearch} onAdd={() => { setEditingCourse(null); setCourseDialog(true); }} onEdit={(course) => { setEditingCourse(course); setCourseDialog(true); }} onArchive={archiveCourse} onDelete={deleteCourse} onDeleteOthers={deleteOtherCourses} onEnroll={enroll} busy={busy} enrollmentFor={enrollmentFor} learnerCount={courseLearnerCount} />}
        {currentSection === "learners" && role === "instructor" && <LearnersSection data={data} coursesById={coursesById} search={search} setSearch={setSearch} />}
        {currentSection === "children" && role === "parent" && <ChildrenSection data={data} selectedChildId={selectedChildId} selectedChildProfile={selectedChildProfile} setSelectedChild={setSelectedChild} coursesById={coursesById} lessonsByCourse={lessonsByCourse} />}
        {currentSection === "learning" && (role === "student" || role === "parent") && <LearningSection role={role} data={data} userId={user?.id ?? ""} childId={role === "parent" ? selectedChildId : undefined} selectedChildProfile={selectedChildProfile} coursesById={coursesById} lessonsByCourse={lessonsByCourse} enrolled={enrollmentFor} onEnroll={enroll} busy={busy} />}
        {currentSection === "payments" && <PaymentsSection role={role} data={data} profilesById={profilesById} coursesById={coursesById} childId={role === "parent" ? selectedChildId : undefined} busy={busy} onReview={reviewPayment} onDelete={deletePayment} />}
        {currentSection === "announcements" && <AnnouncementsSection role={role} data={data} busy={busy} onCreate={createAnnouncement} onUpdate={updateAnnouncement} onDelete={removeAnnouncement} />}
        {currentSection === "inbox" && staff && <InboxSection data={data} busy={busy} onResolve={resolveMessage} />}
        {currentSection === "reports" && staff && <ReportsSection data={data} rolesByUser={rolesByUser} />}
        {currentSection === "activity" && staff && <ActivitySection data={data} profilesById={profilesById} />}
        {currentSection === "academy" && staff && <AcademySection role={role} settings={data.settings} busy={busy} onSave={updateAcademy} />}
        {currentSection === "account" && <AccountSection profile={profile} />}
      </main>

      <CourseEditor
        open={courseDialog}
        course={editingCourse}
        existingLessons={editingCourse ? (lessonsByCourse.get(editingCourse.id) ?? []) : []}
        role={role}
        userId={user?.id ?? ""}
        instructors={data.profiles.filter((p) => (rolesByUser.get(p.id) ?? []).some((r) => r.role === "instructor"))}
        busy={busy}
        onOpenChange={setCourseDialog}
        onSave={saveCourse}
        onSynced={refresh}
      />
    </div>
  );
}

function Overview({ role, data, profile, coursesById, lessonsByCourse, selectedChildId, onSelectChild, onNavigateSection }: {
  role: AppRole; data: DashboardData; profile: Profile | null; coursesById: Map<string, Course>; lessonsByCourse: Map<string, Lesson[]>;
  selectedChildId: string; onSelectChild: (id: string) => void; onNavigateSection: (section: Section) => void;
}) {
  const fullName = profile ? displayName(profile).split(" ")[0] : "there";
  if (role === "owner" || role === "admin") {
    const counts = { owner: 0, admin: 0, instructor: 0, student: 0, parent: 0 };
    data.roles.forEach((r) => { counts[r.role] += 1; });
    const approvedRevenue = data.payments.filter((p) => p.status === "approved").reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingAmount = data.payments.filter((p) => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingCount = data.payments.filter((p) => p.status === "pending").length;
    const openInbox = data.messages.filter((m) => m.status !== "resolved").length;
    const liveCourses = data.courses.filter((c) => c.status === "published").length;
    const recentActivity = data.audit.slice(0, 5);
    return <>
      <PageHeader title={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${fullName}`} description={`${ROLE_NAME[role]} dashboard · Academy operations at a glance.`} actions={<Badge variant={role === "owner" ? "gold" : "secondary"}>{ROLE_NAME[role]} access</Badge>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Learners" value={counts.student} icon={GraduationCap} hint={`${counts.parent} parent accounts`} index={0} />
        <StatCard label="Teaching team" value={counts.instructor} icon={Users} hint={`${counts.admin} admins · ${counts.owner} owners`} tone="gold" index={1} />
        <StatCard label="Published courses" value={liveCourses} icon={BookOpen} hint={`${data.enrollments.length} total enrollments`} tone="deep" index={2} />
        <StatCard label="Approved revenue" value={currency(approvedRevenue)} icon={CircleDollarSign} hint={`${currency(pendingAmount)} pending · ${pendingCount} reviews`} tone="plain" index={3} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Academy snapshot" actions={<span className="text-xs text-muted-foreground">Live records</span>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SnapshotRow icon={BookOpen} label="Course catalog" value={`${data.courses.length} courses`} sub={`${liveCourses} published`} />
            <SnapshotRow icon={ClipboardList} label="Course enrollments" value={data.enrollments.length.toLocaleString()} sub="Across all available courses" />
            <SnapshotRow icon={Wallet} label="Payment reviews" value={`${pendingCount} pending`} sub={`${currency(pendingAmount)} awaiting review`} />
            <SnapshotRow icon={MessageSquare} label="Contact inbox" value={`${openInbox} open`} sub="Learner and family inquiries" />
          </div>
        </Panel>
        <Panel title="Recent platform activity" actions={<button className="text-sm font-semibold text-primary" onClick={() => onNavigateSection("activity")}>View activity</button>}>
          {recentActivity.length ? <div className="space-y-4">{recentActivity.map((item) => <ActivityLine key={item.id} item={item} profile={data.profiles.find((p) => p.id === item.actor_id)} />)}</div> : <EmptyState title="No activity logged yet" text="Important role and payment changes are recorded here." icon={Activity} />}
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Review queue">
          {pendingCount || openInbox ? <div className="space-y-3">
            {pendingCount > 0 && <QueueRow icon={Wallet} title={`${pendingCount} payment request${pendingCount === 1 ? "" : "s"}`} detail={`${currency(pendingAmount)} awaiting review`} onClick={() => onNavigateSection("payments")} />}
            {openInbox > 0 && <QueueRow icon={Mail} title={`${openInbox} contact message${openInbox === 1 ? "" : "s"}`} detail="Needs a reply from the academy team" onClick={() => onNavigateSection("inbox")} />}
          </div> : <p className="text-sm text-muted-foreground">Everything is up to date. There are no pending payment reviews or open inquiries.</p>}
        </Panel>
        <Panel title="Published announcements" actions={<span className="text-xs text-muted-foreground">{data.announcements.filter((a) => a.published).length} total</span>}>
          {data.announcements.filter((a) => a.published).slice(0, 3).map((a) => <div key={a.id} className="border-b border-border py-3 last:border-0"><p className="font-semibold">{a.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.body}</p></div>)}
          {!data.announcements.some((a) => a.published) && <p className="text-sm text-muted-foreground">No announcements published.</p>}
        </Panel>
      </div>
    </>;
  }

  if (role === "instructor") {
    const learners = new Set(data.enrollments.map((e) => e.user_id)).size;
    const completed = data.progress.length;
    const lessons = data.lessons.length;
    return <>
      <PageHeader title={`Welcome, ${fullName}`} description="Your teaching workspace, course activity, and learner progress." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="My courses" value={data.courses.length} icon={BookOpen} index={0} />
        <StatCard label="Enrolled learners" value={learners} icon={Users} tone="gold" index={1} />
        <StatCard label="Lessons completed" value={completed} icon={Check} hint={`${lessons} lessons across your courses`} tone="deep" index={2} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Teaching portfolio">
          {data.courses.length ? <div className="space-y-3">{data.courses.slice(0, 5).map((course) => <CourseSummary key={course.id} course={course} learners={data.enrollments.filter((e) => e.course_id === course.id).length} />)}</div> : <EmptyState title="No courses assigned yet" text="Courses assigned to your instructor account will appear here." icon={BookOpen} />}
        </Panel>
        <Panel title="Recent learner activity"><p className="mb-4 text-sm text-muted-foreground">Lesson completions across your courses.</p>
          {data.progress.length ? <div className="space-y-3">{data.progress.slice(0, 6).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{profilesByLabel(data.profiles, item.user_id)}</p><p className="truncate text-xs text-muted-foreground">{coursesById.get(item.course_id)?.title ?? "Course"}</p></div><span className="shrink-0 text-xs text-muted-foreground">{dateLabel(item.completed_at)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">Completions will appear as learners progress through your lessons.</p>}
        </Panel>
      </div>
    </>;
  }

  if (role === "parent") {
    const child = data.profiles.find((p) => p.id === selectedChildId);
    const enrollments = data.enrollments.filter((e) => e.user_id === selectedChildId);
    const progress = data.progress.filter((p) => p.user_id === selectedChildId);
    const completedCourses = enrollments.filter((e) => {
      const courseLessons = lessonsByCourse.get(e.course_id) ?? [];
      return courseLessons.length > 0 && progress.filter((p) => p.course_id === e.course_id).length >= courseLessons.length;
    }).length;
    const pendingPayments = data.payments.filter((p) => p.user_id === selectedChildId && p.status === "pending");
    return <>
      <PageHeader title={`Welcome, ${fullName}`} description="Follow your child’s course activity and payment requests." actions={data.parentLinks.length > 0 ? <select aria-label="Select child" value={selectedChildId} onChange={(e) => onSelectChild(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-semibold">{data.parentLinks.map((l) => <option key={l.student_id} value={l.student_id}>{data.profiles.find((p) => p.id === l.student_id)?.first_name || "Linked student"}</option>)}</select> : undefined} />
      {child ? <>
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-4"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold text-gold-foreground"><GraduationCap className="h-5 w-5" /></span><div><p className="font-semibold">{displayName(child)}</p><p className="text-sm text-muted-foreground">Linked as {data.parentLinks.find((l) => l.student_id === child.id)?.relationship || "Parent"}</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Enrolled courses" value={enrollments.length} icon={BookOpen} index={0} /><StatCard label="Lessons completed" value={progress.length} icon={Check} tone="gold" index={1} /><StatCard label="Courses completed" value={completedCourses} icon={BadgeCheck} tone="deep" index={2} /><StatCard label="Pending payments" value={pendingPayments.length} icon={Wallet} hint={currency(pendingPayments.reduce((n, p) => n + Number(p.amount), 0))} tone="plain" index={3} /></div>
        <div className="mt-6 grid gap-6 xl:grid-cols-2"><Panel title="Course progress">{enrollments.length ? <div className="space-y-4">{enrollments.map((e) => <ProgressRow key={e.id} course={coursesById.get(e.course_id)} completed={progress.filter((p) => p.course_id === e.course_id).length} total={(lessonsByCourse.get(e.course_id) ?? []).length} />)}</div> : <EmptyState title="No course enrollments" text="When your child joins a course, progress will appear here." icon={BookOpen} />}</Panel><Panel title="Recent updates">{data.announcements.slice(0, 4).map((a) => <AnnouncementLine key={a.id} announcement={a} />)}{!data.announcements.length && <p className="text-sm text-muted-foreground">No recent academy announcements.</p>}</Panel></div>
      </> : <EmptyState title="No linked children yet" text="A verified child link from the academy will appear here." icon={Users} />}
    </>;
  }

  const enrolled = data.enrollments;
  const lessonsCompleted = data.progress.length;
  const totalLessons = enrolled.reduce((n, e) => n + (lessonsByCourse.get(e.course_id)?.length ?? 0), 0);
  const courseIds = new Set(enrolled.map((e) => e.course_id));
  const myCourses = data.courses.filter((c) => courseIds.has(c.id));
  return <>
    <PageHeader title={`Welcome back, ${fullName}`} description="Your learning journey is ready when you are." actions={<Button asChild variant="emerald"><Link to="/courses">Explore courses <ArrowRight /></Link></Button>} />
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="My courses" value={myCourses.length} icon={BookOpen} index={0} /><StatCard label="Lessons completed" value={lessonsCompleted} icon={Check} tone="gold" index={1} /><StatCard label="Learning progress" value={`${totalLessons ? Math.min(100, Math.round((lessonsCompleted / totalLessons) * 100)) : 0}%`} icon={BadgeCheck} hint={`${totalLessons - lessonsCompleted} lessons to go`} tone="deep" index={2} /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]"><Panel title="Continue learning" actions={<Link to="/courses" className="text-sm font-semibold text-primary">Browse catalog</Link>}>{myCourses.length ? <div className="space-y-3">{myCourses.slice(0, 4).map((course) => <StudentCourseRow key={course.id} course={course} completed={data.progress.filter((p) => p.course_id === course.id).length} total={(lessonsByCourse.get(course.id) ?? []).length} />)}</div> : <EmptyState title="Your first course starts here" text={`Explore the catalog and enroll to save a course to your dashboard. The first ${FREE_LESSON_LIMIT} lessons are free.`} icon={BookOpen} action={<Button asChild variant="emerald"><Link to="/courses">Browse courses</Link></Button>} />}</Panel><Panel title="Academy announcements">{data.announcements.slice(0, 4).map((a) => <AnnouncementLine key={a.id} announcement={a} />)}{!data.announcements.length && <p className="text-sm text-muted-foreground">No current announcements.</p>}</Panel></div>
  </>;
}

function profilesByLabel(profiles: Profile[], id: string) { const p = profiles.find((x) => x.id === id); return p ? displayName(p) : "Learner"; }
function SnapshotRow({ icon: Icon, label, value, sub }: { icon: typeof BookOpen; label: string; value: string; sub: string }) { return <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-primary"><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p><p className="text-xs text-muted-foreground">{sub}</p></div></div>; }
function QueueRow({ icon: Icon, title, detail, onClick }: { icon: typeof Wallet; title: string; detail: string; onClick: () => void }) { return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left hover:bg-secondary/60"><Icon className="h-5 w-5 text-primary" /><div className="flex-1"><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">{detail}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></button>; }
function ActivityLine({ item, profile }: { item: AuditLog; profile: Profile | undefined }) { return <div className="flex gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"><Activity className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.action.replaceAll("_", " ")}</p><p className="truncate text-xs text-muted-foreground">{profile ? displayName(profile) : "System"} · {item.entity}</p><p className="text-xs text-muted-foreground">{dateLabel(item.created_at)}</p></div></div>; }
function CourseSummary({ course, learners }: { course: Course; learners: number }) { return <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"><div className="flex min-w-0 items-center gap-3"><CourseThumbnail imageUrl={course.image_url} course={course} alt={course.title} className="h-11 w-16 shrink-0 rounded-lg" /><div className="min-w-0"><p className="truncate font-semibold">{course.title}</p><p className="text-sm text-muted-foreground">{learners} learners · {course.level}</p></div></div><Badge variant={course.status === "published" ? "success" : "muted"}>{course.status}</Badge></div>; }
function ProgressRow({ course, completed, total }: { course: Course | undefined; completed: number; total: number }) { const pct = total ? Math.min(100, Math.round(completed / total * 100)) : 0; return <div><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-semibold">{course?.title ?? "Course"}</span><span className="shrink-0 text-muted-foreground">{completed}/{total} lessons</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div><p className="mt-1 text-right text-xs text-muted-foreground">{pct}% complete</p></div>; }
function StudentCourseRow({ course, completed, total }: { course: Course; completed: number; total: number }) { return <Link to="/dashboard/learn/$slug" params={{ slug: course.slug }} className="flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-secondary/60"><CourseThumbnail imageUrl={course.image_url} course={course} alt={course.title} className="h-12 w-20 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{course.title}</p><p className="text-xs text-muted-foreground">{completed} of {total} lessons complete</p></div><ArrowRight className="h-4 w-4 shrink-0 text-primary" /></Link>; }
function AnnouncementLine({ announcement }: { announcement: Announcement }) { return <article className="border-b border-border py-3 last:border-0"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{announcement.title}</h3><span className="shrink-0 text-xs text-muted-foreground">{dateLabel(announcement.publish_at)}</span></div><p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{announcement.body}</p></article>; }

function SearchBox({ value, onChange, placeholder = "Search records" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" /></div>;
}

function PeopleSection({ data, rolesByUser, role, currentUserId, search, setSearch, busy, onStatus, onRole }: {
  data: DashboardData; rolesByUser: Map<string, UserRole[]>; role: AppRole; currentUserId: string; search: string; setSearch: (s: string) => void;
  busy: boolean; onStatus: (id: string, status: Profile["status"]) => Promise<void>; onRole: (id: string, role: AppRole, existing?: UserRole) => Promise<void>;
}) {
  const [roleChoice, setRoleChoice] = useState<AppRole>("student");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusChoices, setStatusChoices] = useState<Record<string, Profile["status"]>>({});
  const allowedRoles: AppRole[] = role === "owner" ? ["owner", "admin", "instructor", "student", "parent"] : ["instructor", "student", "parent"];
  const filtered = data.profiles.filter((p) => {
    const assigned = rolesByUser.get(p.id) ?? [];
    const matchesText = `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (roleFilter === "all" || assigned.some((r) => r.role === roleFilter));
  });
  return <>
    <PageHeader title="People & access" description="Manage existing academy accounts, access roles, and account status." actions={<Badge variant="secondary">{data.profiles.length} accounts</Badge>} />
    <Panel>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><SearchBox value={search} onChange={setSearch} placeholder="Search name or email" /><select aria-label="Filter users by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm"><option value="all">All roles</option>{allowedRoles.map((r) => <option key={r} value={r}>{ROLE_NAME[r]}</option>)}</select></div>
      {filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3 pr-4">Account</th><th className="pb-3 pr-4">Roles</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Joined</th><th className="pb-3">Access actions</th></tr></thead><tbody className="divide-y divide-border">{filtered.map((person) => {
        const assigned = rolesByUser.get(person.id) ?? [];
        return <tr key={person.id} className="align-top"><td className="py-4 pr-4"><p className="font-semibold">{displayName(person)}</p><p className="text-xs text-muted-foreground">{person.email}</p></td><td className="py-4 pr-4"><div className="flex max-w-56 flex-wrap gap-1">{assigned.length ? assigned.map((r) => <Badge key={r.id} variant={roleTone[r.role]}>{ROLE_NAME[r.role]}</Badge>) : <Badge variant="muted">No role</Badge>}</div></td><td className="py-4 pr-4"><Badge variant={person.status === "active" ? "success" : person.status === "suspended" ? "destructive" : "muted"}>{person.status}</Badge></td><td className="py-4 pr-4 text-muted-foreground">{dateLabel(person.created_at)}</td><td className="py-4"><div className="flex flex-col items-start gap-2">
          <div className="flex gap-1"><select aria-label={`Change status for ${displayName(person)}`} disabled={busy} value={statusChoices[person.id] ?? person.status} onChange={(e) => setStatusChoices((prev) => ({ ...prev, [person.id]: e.target.value as Profile["status"] }))} className="h-8 rounded-md border border-border bg-background px-2 text-xs"><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select>{(statusChoices[person.id] ?? person.status) !== person.status && <ConfirmButton trigger={<Button size="sm" variant="outline" disabled={busy}>Apply</Button>} title="Update this account status?" description={`${displayName(person)} will be marked ${(statusChoices[person.id] ?? person.status).replaceAll("_", " ")}.`} confirmLabel="Update status" onConfirm={() => void onStatus(person.id, statusChoices[person.id] ?? person.status)} />}</div>
          <div className="flex gap-1"><select aria-label={`Choose role for ${displayName(person)}`} value={roleChoice} onChange={(e) => setRoleChoice(e.target.value as AppRole)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">{allowedRoles.map((r) => <option key={r} value={r}>{ROLE_NAME[r]}</option>)}</select><Button size="sm" variant="outline" disabled={busy || assigned.some((r) => r.role === roleChoice)} onClick={() => void onRole(person.id, roleChoice)}><Plus className="h-3.5 w-3.5" /> Assign</Button></div>
          {assigned.filter((r) => allowedRoles.includes(r.role) && !(person.id === currentUserId && r.role === "owner")).map((r) => <ConfirmButton key={r.id} trigger={<button className="text-xs font-medium text-destructive hover:underline">Remove {ROLE_NAME[r.role]} role</button>} title={`Remove ${ROLE_NAME[r.role]} role?`} description="This takes effect immediately and may change the account’s dashboard access." confirmLabel="Remove role" onConfirm={() => void onRole(person.id, r.role, r)} />)}
        </div></td></tr>;
      })}</tbody></table></div> : <EmptyState title="No accounts found" text="Try a different name, email, or role filter." icon={Users} />}
      <p className="mt-4 text-xs text-muted-foreground">New login accounts must be created through the academy’s approved sign-up or admin invitation flow. Role assignment and account status changes are enforced by the database policies.</p>
    </Panel>
  </>;
}

function isPrimaryBasicComputerCourse(course: Course) {
  return course.slug === "basic-computer-skills" || course.title.trim().toLowerCase() === "basic computer skills";
}

function CoursesSection({ role, data, userId, search, setSearch, onAdd, onEdit, onArchive, onDelete, onDeleteOthers, onEnroll, busy, enrollmentFor, learnerCount }: {
  role: AppRole; data: DashboardData; userId: string; search: string; setSearch: (s: string) => void; onAdd: () => void;
  onEdit: (course: Course) => void; onArchive: (course: Course) => Promise<void>; onDelete: (course: Course) => Promise<void>;
  onDeleteOthers: (ids: string[]) => Promise<void>; onEnroll: (course: Course) => Promise<void>;
  busy: boolean; enrollmentFor: (userId: string, courseId: string) => boolean; learnerCount: (courseId: string) => number;
}) {
  const staff = role === "owner" || role === "admin";
  const editable = staff || role === "instructor";
  const courses = data.courses.filter((c) => `${c.title} ${c.short_description} ${c.level}`.toLowerCase().includes(search.toLowerCase()));
  const otherCourseIds = data.courses.filter((c) => !isPrimaryBasicComputerCourse(c)).map((c) => c.id);
  return <>
    <PageHeader
      title={role === "instructor" ? "My courses" : staff ? "Course management" : "Explore courses"}
      description={staff ? "Create and update the live course catalog." : role === "instructor" ? "Manage your assigned courses and see current enrollment." : "Choose a course, enroll, and continue learning."}
      actions={editable ? <div className="flex flex-wrap gap-2">
        {staff && otherCourseIds.length > 0 && (
          <ConfirmButton
            trigger={<Button variant="outline" className="text-destructive" disabled={busy}><Trash2 className="h-4 w-4" /> Remove other courses ({otherCourseIds.length})</Button>}
            title="Permanently remove all other courses?"
            description="Only Basic Computer Skills will remain. All other courses and their lessons will be permanently deleted."
            confirmLabel="Remove all other courses"
            onConfirm={() => void onDeleteOthers(otherCourseIds)}
          />
        )}
        <Button variant="emerald" onClick={onAdd}><Plus /> New course</Button>
      </div> : undefined}
    />
    <div className="mb-4 flex justify-end"><SearchBox value={search} onChange={setSearch} placeholder="Find a course" /></div>
    {courses.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{courses.map((course) => {
      const enrolled = userId ? enrollmentFor(userId, course.id) : false;
      return <article key={course.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <CourseThumbnail imageUrl={course.image_url} course={course} alt={course.title} className="aspect-video w-full" />
        <div className="p-5"><div className="mb-2 flex items-start justify-between gap-2"><h2 className="font-semibold leading-snug">{course.title}</h2><Badge variant={course.status === "published" ? "success" : course.status === "archived" ? "muted" : "gold"}>{course.status}</Badge></div><p className="min-h-10 line-clamp-2 text-sm text-muted-foreground">{course.short_description}</p><div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{course.level} · {course.duration_hours} hours</span>{role !== "student" && <span>{learnerCount(course.id)} learners</span>}</div>
          <div className="mt-4 flex flex-wrap gap-2">{role === "student" && course.status === "published" && <>{enrolled ? <Button asChild size="sm" variant="emerald"><Link to="/dashboard/learn/$slug" params={{ slug: course.slug }}>Continue learning <ArrowRight /></Link></Button> : <Button size="sm" variant="emerald" disabled={busy} onClick={() => void onEnroll(course)}>Enroll</Button>}<Button asChild size="sm" variant="outline"><Link to="/dashboard/learn/$slug" params={{ slug: course.slug }}>Preview</Link></Button></>}
            {editable && <Button size="sm" variant="outline" onClick={() => onEdit(course)}>Edit</Button>}
            {staff && course.status !== "archived" && <ConfirmButton trigger={<Button size="sm" variant="outline" disabled={busy}><Archive className="h-4 w-4" /> Archive</Button>} title="Archive this course?" description="It will no longer appear in the public catalog. Existing course and payment records remain in place." confirmLabel="Archive course" onConfirm={() => void onArchive(course)} />}
            {staff && <ConfirmButton trigger={<Button size="sm" variant="outline" className="text-destructive" disabled={busy}><Trash2 className="h-4 w-4" /> Delete</Button>} title={`Permanently delete "${course.title}"?`} description="This permanently removes the course, its lessons, and related course records from the database." confirmLabel="Delete permanently" onConfirm={() => void onDelete(course)} />}
          </div>
        </div>
      </article>;
    })}</div> : <EmptyState title="No courses match" text="Adjust the search or add a course to the catalog." icon={BookOpen} />}
  </>;
}

type YoutubeVideo = YouTubeChannelVideo;
type CourseFormValues = { title: string; slug: string; short_description: string; description: string; image_url: string; coverFile: File | null; generatedCoverFile: File | null; level: string; duration_hours: string; status: Course["status"]; instructor_id: string; youtubeApiKey: string; youtubeChannelId: string; youtubePlaylistId: string };

function CourseEditor({ open, course, existingLessons, role, userId, instructors, busy, onOpenChange, onSave, onSynced }: {
  open: boolean; course: Course | null; existingLessons: Lesson[]; role: AppRole; userId: string; instructors: Profile[]; busy: boolean;
  onOpenChange: (value: boolean) => void; onSave: (values: CourseFormValues, course?: Course, videos?: YoutubeVideo[]) => Promise<void>;
  onSynced: (message?: string) => Promise<void>;
}) {
  const [values, setValues] = useState<CourseFormValues>(blankCourse);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [youtubeVideos, setYoutubeVideos] = useState<YoutubeVideo[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [loadingYoutube, setLoadingYoutube] = useState(false);
  const [syncingDurations, setSyncingDurations] = useState(false);
  const [autoDurationHours, setAutoDurationHours] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | undefined>();
  const [generatedPreview, setGeneratedPreview] = useState<string | undefined>();
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  const [thumbnailPartial, setThumbnailPartial] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const globalKey = localStorage.getItem("ezana_yt_key_global") ?? "";
    const globalChannel = localStorage.getItem("ezana_yt_channel_global") ?? "";
    const globalPlaylist = localStorage.getItem("ezana_yt_playlist_global") ?? "";

    const savedKey = course ? (localStorage.getItem(`ezana_yt_key_${course.id}`) ?? globalKey) : globalKey;
    const savedChannel = course ? (localStorage.getItem(`ezana_yt_channel_${course.id}`) ?? globalChannel) : globalChannel;
    const savedPlaylist = course ? (localStorage.getItem(`ezana_yt_playlist_${course.id}`) ?? globalPlaylist) : globalPlaylist;

    setValues(course ? { title: course.title, slug: course.slug, short_description: course.short_description, description: course.description, image_url: course.image_url ?? "", coverFile: null, generatedCoverFile: null, level: course.level, duration_hours: String(course.duration_hours), status: course.status, instructor_id: course.instructor_id ?? "", youtubeApiKey: savedKey, youtubeChannelId: savedChannel, youtubePlaylistId: savedPlaylist } : blankCourse);
    setYoutubeVideos([]);
    setSelectedVideoIds([]);
    setAutoDurationHours(!course || course.duration_hours === 0);
    setGeneratedPreview(undefined);
    setGeneratingThumbnail(false);
    setThumbnailPartial(false);
    setThumbnailError(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  }, [open, course]);
  useEffect(() => {
    if (values.coverFile) {
      const localUrl = URL.createObjectURL(values.coverFile);
      setCoverPreview(localUrl);
      return () => URL.revokeObjectURL(localUrl);
    }
    if (generatedPreview) {
      setCoverPreview(generatedPreview);
      return undefined;
    }
    setCoverPreview(courseImageUrl(values.image_url));
    return undefined;
  }, [values.coverFile, generatedPreview, values.image_url]);
  const set = (key: keyof CourseFormValues, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  async function generateAiThumbnail(sourceValues: CourseFormValues): Promise<File | null> {
    if (!sourceValues.title.trim()) {
      toast.error("Enter a course title before generating a thumbnail");
      return null;
    }
    setGeneratingThumbnail(true);
    setThumbnailPartial(true);
    setThumbnailError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const finalDataUrl = await streamImage(
        "/api/generate-course-thumbnail",
        {
          title: sourceValues.title.trim(),
          shortDescription: sourceValues.short_description.trim() || undefined,
          description: sourceValues.description.trim() || undefined,
          level: sourceValues.level,
        },
        (dataUrl, isFinal) => {
          setGeneratedPreview(dataUrl);
          setThumbnailPartial(!isFinal);
        },
        undefined,
        { Authorization: `Bearer ${token}` },
      );
      const generatedFile = dataUrlToFile(finalDataUrl, `${slugify(sourceValues.title) || "course"}-ai-cover.png`);
      setValues((prev) => ({ ...prev, coverFile: null, generatedCoverFile: generatedFile }));
      if (coverInputRef.current) coverInputRef.current.value = "";
      return generatedFile;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not generate an AI thumbnail";
      setThumbnailError(message);
      setGeneratedPreview(undefined);
      return null;
    } finally {
      setGeneratingThumbnail(false);
      setThumbnailPartial(false);
    }
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) { toast.error("Enter a course title"); return; }
    let submitValues = values;
    const needsAutoThumbnail = !course && !values.coverFile && !values.generatedCoverFile && !values.image_url.trim();
    if (needsAutoThumbnail) {
      const generatedFile = await generateAiThumbnail(values);
      if (generatedFile) {
        submitValues = { ...values, generatedCoverFile: generatedFile };
      } else {
        toast.message("AI thumbnail unavailable — assigned a subject-matched fallback thumbnail.");
      }
    }
    await onSave(submitValues, course ?? undefined, youtubeVideos.filter((video) => selectedVideoIds.includes(video.id)));
  }
  async function loadYoutubeVideos() {
    if (!values.youtubeApiKey.trim() || (!values.youtubeChannelId.trim() && !values.youtubePlaylistId.trim())) { toast.error("Enter a YouTube API key and either Channel ID or Playlist ID"); return; }
    setLoadingYoutube(true);
    try {
      const videos = values.youtubePlaylistId.trim()
        ? await fetchYouTubePlaylistVideos(values.youtubeApiKey, values.youtubePlaylistId)
        : await fetchYouTubeChannelVideos(values.youtubeApiKey, values.youtubeChannelId);
      setYoutubeVideos(videos);
      const nextSelected = videos.map((video) => video.id);
      setSelectedVideoIds(nextSelected);
      if (!videos.length) {
        toast.error("No public videos were found for this channel");
      } else {
        const selectedSeconds = videos.reduce((sum, v) => sum + v.durationSeconds, 0);
        const existingMinutes = existingLessons.reduce((sum, l) => sum + l.duration_minutes, 0);
        const totalMinutes = existingMinutes + Math.round(selectedSeconds / 60);
        if (autoDurationHours && totalMinutes > 0) {
          set("duration_hours", String(Math.max(1, Math.round(totalMinutes / 60))));
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load YouTube videos");
    } finally { setLoadingYoutube(false); }
  }
  async function syncExistingLessonDurations() {
    if (!course) return;
    setSyncingDurations(true);
    try {
      const apiKey = values.youtubeApiKey.trim();
      const channelId = values.youtubeChannelId.trim();
      const playlistId = values.youtubePlaylistId.trim();
      let updatedCount = 0;
      let addedCount = 0;

      if (!apiKey) {
        for (const lesson of existingLessons) {
          const nextTitle = replaceChannelBranding(lesson.title);
          const nextDescription = lesson.description ? replaceChannelBranding(lesson.description) : null;
          if (nextTitle !== lesson.title || nextDescription !== lesson.description) {
            const { error: upErr } = await supabase
              .from("lessons")
              .update({ title: nextTitle, description: nextDescription })
              .eq("id", lesson.id);
            if (upErr) throw new Error(upErr.message);
            updatedCount += 1;
          }
        }
        await onSynced(
          updatedCount > 0
            ? `Updated branding to Ezana Academy on ${updatedCount} lesson${updatedCount === 1 ? "" : "s"}. Add a YouTube API key to also sync video lengths and auto-add new channel videos.`
            : "Lesson titles already use Ezana Academy branding. Add a YouTube API key to sync video lengths.",
        );
        return;
      }

      let ytVideos: YouTubeChannelVideo[] = [];
      if (playlistId) {
        ytVideos = await fetchYouTubePlaylistVideos(apiKey, playlistId);
      } else if (channelId) {
        ytVideos = await fetchYouTubeChannelVideos(apiKey, channelId);
      } else {
        const lessonIds = existingLessons.map((l) => l.id);
        const { data: mediaRows } = await supabase
          .from("lesson_media")
          .select("lesson_id,video_url")
          .in("lesson_id", lessonIds);
        const ytIds = (mediaRows ?? []).map((r) => getYouTubeId(r.video_url)).filter((id): id is string => !!id);
        if (ytIds.length > 0) {
          const detailsById = await fetchYouTubeVideoDetails(apiKey, ytIds);
          ytVideos = [...detailsById.values()];
        }
      }

      const lessonIds = existingLessons.map((l) => l.id);
      const { data: mediaRows, error: mediaErr } = await supabase
        .from("lesson_media")
        .select("lesson_id,video_url")
        .in("lesson_id", lessonIds);
      if (mediaErr) throw new Error(mediaErr.message);

      const videoIdByLesson = new Map<string, string>();
      const existingYtIds = new Set<string>();
      for (const row of mediaRows ?? []) {
        const ytId = getYouTubeId(row.video_url);
        if (ytId) {
          videoIdByLesson.set(row.lesson_id, ytId);
          existingYtIds.add(ytId);
        }
      }

      let totalMinutes = 0;

      for (const lesson of existingLessons) {
        const ytId = videoIdByLesson.get(lesson.id);
        const match = ytId ? ytVideos.find((v) => v.id === ytId) : undefined;
        if (match) {
          const nextMinutes = match.durationMinutes > 0 ? match.durationMinutes : lesson.duration_minutes;
          const nextTitle = match.title || replaceChannelBranding(lesson.title);
          const nextDescription = match.description || (lesson.description ? replaceChannelBranding(lesson.description) : null);
          totalMinutes += nextMinutes;
          if (
            lesson.duration_minutes !== nextMinutes ||
            lesson.title !== nextTitle ||
            lesson.description !== nextDescription
          ) {
            const { error: upErr } = await supabase
              .from("lessons")
              .update({
                duration_minutes: nextMinutes,
                title: nextTitle,
                description: nextDescription,
              })
              .eq("id", lesson.id);
            if (upErr) throw new Error(upErr.message);
            updatedCount += 1;
          }
        } else {
          totalMinutes += lesson.duration_minutes;
        }
      }

      const newYtVideos = ytVideos.filter((v) => !existingYtIds.has(v.id));
      if (newYtVideos.length > 0) {
        const startPos = existingLessons.reduce((max, l) => Math.max(max, l.position), 0);
        const { data: createdLessons, error: lErr } = await supabase
          .from("lessons")
          .insert(
            newYtVideos.map((v, i) => ({
              course_id: course.id,
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

      const nextHours = totalMinutes > 0 ? Math.max(1, Math.round(totalMinutes / 60)) : course.duration_hours;
      if (nextHours !== course.duration_hours) {
        const { error: courseErr } = await supabase.from("courses").update({ duration_hours: nextHours }).eq("id", course.id);
        if (courseErr) throw new Error(courseErr.message);
        set("duration_hours", String(nextHours));
      }

      await onSynced(
        `Synced YouTube: updated ${updatedCount} lesson(s), auto-added ${addedCount} new video(s)`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sync YouTube lessons");
    } finally {
      setSyncingDurations(false);
    }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{course ? "Edit course" : "Create a course"}</DialogTitle><DialogDescription>Course data is saved to the academy catalog.</DialogDescription></DialogHeader>
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void handleSubmit(e)}>
      <label className="space-y-1.5 text-sm font-medium">Course title<Input required value={values.title} onChange={(e) => set("title", e.target.value)} /></label>
      <label className="space-y-1.5 text-sm font-medium">URL slug<Input required value={values.slug} onChange={(e) => set("slug", e.target.value)} placeholder={slugify(values.title)} /></label>
      <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Short description<Input value={values.short_description} onChange={(e) => set("short_description", e.target.value)} maxLength={240} /></label>
      <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Course description<Textarea value={values.description} onChange={(e) => set("description", e.target.value)} rows={4} /></label>
      <div className="space-y-2 sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="course-cover" className="text-sm font-medium">Course cover image</label>
          <div className="flex items-center gap-2">
            {(values.coverFile || values.generatedCoverFile) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy || generatingThumbnail}
                onClick={() => {
                  setValues((prev) => ({ ...prev, coverFile: null, generatedCoverFile: null }));
                  setGeneratedPreview(undefined);
                  setThumbnailError(null);
                  if (coverInputRef.current) coverInputRef.current.value = "";
                }}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || generatingThumbnail || !values.title.trim()}
              onClick={() => void generateAiThumbnail(values)}
            >
              {generatingThumbnail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generatingThumbnail ? "Generating…" : values.generatedCoverFile || coverPreview ? "Regenerate AI thumbnail" : "Generate AI thumbnail"}
            </Button>
          </div>
        </div>
        <Input
          ref={coverInputRef}
          id="course-cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="h-auto min-h-11 py-2"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setValues((prev) => ({ ...prev, coverFile: file, generatedCoverFile: file ? null : prev.generatedCoverFile }));
            if (file) {
              setGeneratedPreview(undefined);
              setThumbnailError(null);
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          {values.coverFile
            ? "Custom upload selected (takes priority)."
            : values.generatedCoverFile
              ? "AI-generated thumbnail ready to save."
              : course
                ? "Upload a JPG, PNG, or WebP (up to 10 MB), or generate an AI thumbnail."
                : "Upload a custom image (up to 10 MB), or leave empty to auto-generate an AI thumbnail matching your course title."}
        </p>
        {thumbnailError && <p className="text-xs text-destructive">{thumbnailError}</p>}
        {coverPreview && (
          <div className="relative overflow-hidden rounded-xl border border-border bg-secondary">
            <img
              src={coverPreview}
              alt="Course cover preview"
              className={cn(
                "aspect-[16/7] w-full object-cover transition-[filter] duration-500",
                thumbnailPartial ? "blur-2xl" : "blur-0",
              )}
            />
            {generatingThumbnail && (
              <div className="absolute inset-0 flex items-center justify-center bg-deep/35 text-xs font-semibold text-deep-foreground">
                <span className="inline-flex items-center gap-2 rounded-full bg-deep/80 px-3 py-1.5 backdrop-blur">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Crafting course thumbnail…
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      <label className="space-y-1.5 text-sm font-medium">Level<select value={values.level} onChange={(e) => set("level", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
      <label className="space-y-1.5 text-sm font-medium">Duration (hours)<Input type="number" min="0" value={values.duration_hours} onChange={(e) => { setAutoDurationHours(false); set("duration_hours", e.target.value); }} /></label>
      <label className="space-y-1.5 text-sm font-medium">Publication status<select value={values.status} onChange={(e) => set("status", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
      {(role === "owner" || role === "admin") && <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Assign instructor<select value={values.instructor_id} onChange={(e) => set("instructor_id", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"><option value="">Unassigned</option>{instructors.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}</select></label>}
      {role === "instructor" && <p className="text-xs text-muted-foreground sm:col-span-2">This course will be assigned to your instructor account ({userId.slice(0, 8)}…).</p>}
      <section className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4 sm:col-span-2">
        <div><h3 className="font-semibold">Import lessons from a YouTube channel</h3><p className="text-xs text-muted-foreground">The API key is used only for this request and is not saved. Exact video lengths are fetched dynamically from YouTube.</p></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 text-sm font-medium">YouTube API key<Input type="password" autoComplete="off" value={values.youtubeApiKey} onChange={(e) => set("youtubeApiKey", e.target.value)} /></label>
          <label className="space-y-1.5 text-sm font-medium">YouTube Channel ID<Input value={values.youtubeChannelId} onChange={(e) => set("youtubeChannelId", e.target.value)} placeholder="UC…" /></label>
          <label className="space-y-1.5 text-sm font-medium">YouTube Playlist ID<Input value={values.youtubePlaylistId} onChange={(e) => set("youtubePlaylistId", e.target.value)} placeholder="PL…" /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={loadingYoutube || syncingDurations} onClick={() => void loadYoutubeVideos()}>{loadingYoutube ? <Loader2 className="animate-spin" /> : <PlayCircle />} Load channel videos</Button>
          {course && existingLessons.length > 0 && (
            <Button type="button" variant="outline" disabled={loadingYoutube || syncingDurations} onClick={() => void syncExistingLessonDurations()}>
              {syncingDurations ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync titles &amp; durations
            </Button>
          )}
        </div>
        {youtubeVideos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {selectedVideoIds.length} of {youtubeVideos.length} selected · Total length:{" "}
              {formatVideoDuration(
                youtubeVideos
                  .filter((v) => selectedVideoIds.includes(v.id))
                  .reduce((sum, v) => sum + v.durationSeconds, 0),
              )}
            </p>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
              {youtubeVideos.map((video) => (
                <label key={video.id} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedVideoIds.includes(video.id)}
                    onChange={(e) => {
                      const nextSelected = e.target.checked
                        ? [...selectedVideoIds, video.id]
                        : selectedVideoIds.filter((id) => id !== video.id);
                      setSelectedVideoIds(nextSelected);
                      if (autoDurationHours) {
                        const selectedSeconds = youtubeVideos
                          .filter((v) => nextSelected.includes(v.id))
                          .reduce((sum, v) => sum + v.durationSeconds, 0);
                        const existingMinutes = existingLessons.reduce((sum, l) => sum + l.duration_minutes, 0);
                        const totalMinutes = existingMinutes + Math.round(selectedSeconds / 60);
                        set("duration_hours", totalMinutes > 0 ? String(Math.max(1, Math.round(totalMinutes / 60))) : "0");
                      }
                    }}
                  />
                  <span className="line-clamp-2 flex-1">{video.title}</span>
                  <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {video.durationSeconds > 0 ? formatVideoDuration(video.durationSeconds) : `${video.durationMinutes} min`}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>
      <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" disabled={busy || generatingThumbnail} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="emerald" disabled={busy || generatingThumbnail}>{generatingThumbnail ? "Generating thumbnail…" : busy ? "Saving…" : "Save course"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}

const blankCourse: CourseFormValues = { title: "", slug: "", short_description: "", description: "", image_url: "", coverFile: null, generatedCoverFile: null, level: "Beginner", duration_hours: "0", status: "draft", instructor_id: "", youtubeApiKey: "", youtubeChannelId: "", youtubePlaylistId: "" };

function LearnersSection({ data, coursesById, search, setSearch }: { data: DashboardData; coursesById: Map<string, Course>; search: string; setSearch: (s: string) => void }) {
  const learnerIds = [...new Set(data.enrollments.map((e) => e.user_id))];
  const rows = learnerIds.map((id) => ({
    id,
    profile: data.profiles.find((p) => p.id === id),
    courses: data.enrollments.filter((e) => e.user_id === id).map((e) => coursesById.get(e.course_id)).filter((c): c is Course => !!c),
    completed: data.progress.filter((p) => p.user_id === id).length,
  })).filter((r) => `${r.profile?.first_name ?? ""} ${r.profile?.last_name ?? ""} ${r.profile?.email ?? ""} ${r.courses.map((c) => c.title).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeader title="Learners" description="Students enrolled in your courses and their saved lesson activity." actions={<Badge variant="secondary">{rows.length} learners</Badge>} /><div className="mb-4 flex justify-end"><SearchBox value={search} onChange={setSearch} placeholder="Search learners or courses" /></div><Panel>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Learner</th><th className="pb-3">Enrolled courses</th><th className="pb-3">Lessons completed</th><th className="pb-3">Joined</th></tr></thead><tbody className="divide-y divide-border">{rows.map((r) => <tr key={r.id}><td className="py-4"><p className="font-semibold">{r.profile ? displayName(r.profile) : "Learner"}</p><p className="text-xs text-muted-foreground">{r.profile?.email}</p></td><td className="py-4">{r.courses.map((c) => <Badge className="mr-1 mb-1" key={c.id} variant="outline">{c.title}</Badge>)}</td><td className="py-4 font-semibold">{r.completed}</td><td className="py-4 text-muted-foreground">{dateLabel(data.enrollments.find((e) => e.user_id === r.id)?.created_at ?? new Date().toISOString())}</td></tr>)}</tbody></table></div> : <EmptyState title="No learners yet" text="When a learner enrolls in one of your courses, they’ll appear here." icon={Users} />}</Panel></>;
}

function ChildrenSection({ data, selectedChildId, selectedChildProfile, setSelectedChild, coursesById, lessonsByCourse }: {
  data: DashboardData; selectedChildId: string; selectedChildProfile: Profile | undefined; setSelectedChild: (id: string) => void;
  coursesById: Map<string, Course>; lessonsByCourse: Map<string, Lesson[]>;
}) {
  return <><PageHeader title="My children" description="Choose a linked child to review course progress and payment activity." actions={data.parentLinks.length > 0 ? <select aria-label="Select linked child" value={selectedChildId} onChange={(e) => setSelectedChild(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm">{data.parentLinks.map((l) => <option key={l.student_id} value={l.student_id}>{data.profiles.find((p) => p.id === l.student_id)?.first_name || "Student"}</option>)}</select> : undefined} />
    {selectedChildProfile ? <div className="grid gap-5 md:grid-cols-2"><Panel title={displayName(selectedChildProfile)}><p className="text-sm text-muted-foreground">{selectedChildProfile.email}</p><p className="mt-4 text-sm">Relationship: <span className="font-semibold">{data.parentLinks.find((l) => l.student_id === selectedChildProfile.id)?.relationship || "Parent"}</span></p><p className="mt-1 text-sm">Linked {dateLabel(data.parentLinks.find((l) => l.student_id === selectedChildProfile.id)?.created_at ?? selectedChildProfile.created_at)}</p></Panel><Panel title="Course progress">{data.enrollments.filter((e) => e.user_id === selectedChildId).length ? <div className="space-y-4">{data.enrollments.filter((e) => e.user_id === selectedChildId).map((e) => <ProgressRow key={e.id} course={coursesById.get(e.course_id)} completed={data.progress.filter((p) => p.user_id === selectedChildId && p.course_id === e.course_id).length} total={(lessonsByCourse.get(e.course_id) ?? []).length} />)}</div> : <p className="text-sm text-muted-foreground">No courses enrolled yet.</p>}</Panel></div> : <EmptyState title="No linked children" text="Only children verified and linked by academy staff are shown here." icon={Users} />}
    <Panel title="Linked children" className="mt-5">{data.parentLinks.length ? <div className="grid gap-3 sm:grid-cols-2">{data.parentLinks.map((l) => { const p = data.profiles.find((x) => x.id === l.student_id); const count = data.enrollments.filter((e) => e.user_id === l.student_id).length; return <button key={l.id} onClick={() => setSelectedChild(l.student_id)} className={`flex items-center gap-3 rounded-xl border p-4 text-left ${selectedChildId === l.student_id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/60"}`}><span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-soft text-gold-foreground"><GraduationCap className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{p ? displayName(p) : "Linked student"}</p><p className="text-xs text-muted-foreground">{l.relationship} · {count} courses</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></button>; })}</div> : <p className="text-sm text-muted-foreground">A verified link from the academy will appear here.</p>}</Panel>
  </>;
}

function LearningSection({ role, data, userId, childId, selectedChildProfile, coursesById, lessonsByCourse, enrolled, onEnroll, busy }: {
  role: AppRole; data: DashboardData; userId: string; childId: string | undefined; selectedChildProfile: Profile | undefined;
  coursesById: Map<string, Course>; lessonsByCourse: Map<string, Lesson[]>; enrolled: (userId: string, courseId: string) => boolean;
  onEnroll: (course: Course) => Promise<void>; busy: boolean;
}) {
  const learnerId = childId ?? userId;
  const enrollmentRows = data.enrollments.filter((e) => e.user_id === learnerId);
  const enrolledIds = new Set(enrollmentRows.map((e) => e.course_id));
  const available = data.courses.filter((c) => role === "student" && !enrolledIds.has(c.id));
  return <>
    <PageHeader title={role === "parent" ? `${selectedChildProfile ? displayName(selectedChildProfile) + "’s" : "Child"} course progress` : "My learning"} description={role === "parent" ? "Read-only progress for the selected linked child." : "Pick up a course, track lesson completion, and discover what’s next."} />
    {enrollmentRows.length ? <div className="grid gap-4 md:grid-cols-2">{enrollmentRows.map((e) => { const course = coursesById.get(e.course_id); const complete = data.progress.filter((p) => p.user_id === learnerId && p.course_id === e.course_id).length; const total = lessonsByCourse.get(e.course_id)?.length ?? 0; if (!course) return null; return <article key={e.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft"><div className="mb-3 flex items-center gap-3"><CourseThumbnail imageUrl={course.image_url} course={course} alt={course.title} className="h-14 w-24 shrink-0 rounded-xl" /><div className="min-w-0"><h2 className="truncate font-semibold">{course.title}</h2><p className="text-xs text-muted-foreground">Enrolled {dateLabel(e.created_at)}</p></div></div><ProgressRow course={course} completed={complete} total={total} /><div className="mt-4">{role === "student" ? <Button asChild variant="emerald" size="sm"><Link to="/dashboard/learn/$slug" params={{ slug: course.slug }}>Continue learning <ArrowRight /></Link></Button> : <Badge variant="secondary">Read only parent view</Badge>}</div></article>; })}</div> : <EmptyState title="No enrolled courses" text={role === "parent" ? "This child has not enrolled in a course yet." : "Enroll in a course to keep your learning progress in one place."} icon={BookOpen} action={role === "student" ? <Button asChild variant="emerald"><Link to="/courses">Browse catalog</Link></Button> : undefined} />}
    {role === "student" && available.length > 0 && <Panel title="Recommended courses" className="mt-6"><div className="grid gap-3 sm:grid-cols-2">{available.slice(0, 4).map((course) => <div key={course.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"><div className="flex min-w-0 items-center gap-3"><CourseThumbnail imageUrl={course.image_url} course={course} alt={course.title} className="h-12 w-20 shrink-0 rounded-xl" /><div className="min-w-0"><p className="truncate font-semibold">{course.title}</p><p className="text-xs text-muted-foreground">{course.level} · {course.duration_hours} hours</p></div></div><Button size="sm" variant="outline" disabled={busy || enrolled(userId, course.id)} onClick={() => void onEnroll(course)}><Plus className="h-4 w-4" /> Enroll</Button></div>)}</div></Panel>}
  </>;
}

function PaymentsSection({ role, data, profilesById, coursesById, childId, busy, onReview, onDelete }: {
  role: AppRole; data: DashboardData; profilesById: Map<string, Profile>; coursesById: Map<string, Course>; childId: string | undefined;
  busy: boolean; onReview: (payment: Payment, status: "approved" | "rejected") => Promise<void>; onDelete: (payment: Payment) => Promise<void>;
}) {
  const staff = role === "owner" || role === "admin";
  const owner = role === "owner";
  const rows = childId ? data.payments.filter((p) => p.user_id === childId) : data.payments;
  const pendingTotal = rows.filter((p) => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0);
  const approvedTotal = rows.filter((p) => p.status === "approved").reduce((sum, p) => sum + Number(p.amount), 0);
  return (
    <>
      <PageHeader title={staff ? "Fees & payments" : "Payment history"} description={staff ? "Review receipts and resolve course upgrade requests." : role === "parent" ? "Payments for the selected linked child. Only confirmed payment states are displayed." : "Track submitted payments for your course upgrades."} actions={staff ? <Badge variant="gold">{currency(pendingTotal)} pending</Badge> : undefined} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <StatCard label="Approved" value={currency(approvedTotal)} icon={BadgeCheck} tone="emerald" index={0} />
        <StatCard label="Pending" value={currency(pendingTotal)} icon={Wallet} tone="gold" index={1} />
      </div>
      <Panel>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{staff && <th className="pb-3 pr-4">Learner</th>}<th className="pb-3 pr-4">Course</th><th className="pb-3 pr-4">Amount</th><th className="pb-3 pr-4">Method & reference</th><th className="pb-3 pr-4">Receipt</th><th className="pb-3 pr-4">Submitted</th><th className="pb-3 pr-4">Status</th>{staff && <th className="pb-3">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => {
                  const receiptPath = paymentReceiptPath(p);
                  return (
                    <tr key={p.id}>
                      {staff && <td className="py-4 pr-4"><p className="font-semibold">{profilesById.get(p.user_id) ? displayName(profilesById.get(p.user_id)!) : "Learner"}</p><p className="text-xs text-muted-foreground">{profilesById.get(p.user_id)?.email}</p></td>}
                      <td className="py-4 pr-4 font-medium">{coursesById.get(p.course_id)?.title ?? "Course"}</td>
                      <td className="py-4 pr-4 font-semibold">{currency(Number(p.amount))}</td>
                      <td className="py-4 pr-4"><p>{p.method}</p><p className="text-xs text-muted-foreground">{p.reference}</p></td>
                      <td className="py-4 pr-4">{receiptPath ? <button className="text-primary underline" onClick={() => void openPaymentReceipt(receiptPath)}>View receipt</button> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-4 pr-4 text-muted-foreground">{dateLabel(p.created_at)}</td>
                      <td className="py-4 pr-4"><Badge variant={p.status === "approved" ? "success" : p.status === "rejected" ? "destructive" : "warning"}>{p.status}</Badge></td>
                      {staff && <td className="py-4"><div className="flex flex-wrap gap-2">{p.status === "pending" ? <><ConfirmButton trigger={<Button size="sm" variant="emerald" disabled={busy}>Approve</Button>} title="Approve this payment?" description={`${currency(Number(p.amount))} for ${coursesById.get(p.course_id)?.title ?? "this course"}. Approval unlocks course access.`} confirmLabel="Approve payment" destructive={false} onConfirm={() => void onReview(p, "approved")} /><ConfirmButton trigger={<Button size="sm" variant="outline" className="text-destructive" disabled={busy}>Reject</Button>} title="Reject this payment?" description="The learner will need to submit a new payment request." confirmLabel="Reject payment" onConfirm={() => void onReview(p, "rejected")} /></> : <span className="text-xs text-muted-foreground">Reviewed</span>}{owner && <ConfirmButton trigger={<Button size="sm" variant="outline" className="text-destructive" disabled={busy}>Delete</Button>} title="Delete this payment record?" description="This permanently removes the payment request and its status history." confirmLabel="Delete record" onConfirm={() => void onDelete(p)} />}</div></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No payment records" text={staff ? "Submitted upgrade requests will appear here for review." : "Your submitted payment requests will appear here."} icon={Wallet} />}
      </Panel>
    </>
  );
}

function paymentReceiptPath(payment: Payment) {
  if (payment.receipt_path) return payment.receipt_path;
  const note = payment.note;
  if (!note?.startsWith("[receipt-path]")) return null;
  return note.slice("[receipt-path]".length).split("\n", 1)[0] || null;
}

async function openPaymentReceipt(path: string) {
  const { data, error } = await supabase.storage.from("payment-receipts").createSignedUrl(path, 60);
  if (error || !data?.signedUrl) { toast.error(error?.message ?? "Could not open this receipt"); return; }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function AnnouncementsSection({ role, data, busy, onCreate, onUpdate, onDelete }: {
  role: AppRole; data: DashboardData; busy: boolean;
  onCreate: (v: { title: string; body: string; audience: AppRole | "all" }) => Promise<void>;
  onUpdate: (id: string, v: { title: string; body: string; audience: AppRole | "all" }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const staff = role === "owner" || role === "admin";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AppRole | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const visible = staff ? data.announcements : data.announcements.filter((a) => a.published && (!a.audience || a.audience === role));
  const resetEditor = () => { setEditingId(null); setTitle(""); setBody(""); setAudience("all"); };
  return <><PageHeader title={staff ? "Announcements" : "Academy announcements"} description={staff ? "Publish updates for the whole academy or a specific role." : "Updates shared with your role by Ezana Academy."} actions={staff ? <Badge variant="secondary">{visible.length} records</Badge> : undefined} />
    {staff && <Panel title={editingId ? "Edit announcement" : "Publish an announcement"} className="mb-5"><form className="grid gap-3 md:grid-cols-[1fr_180px]" onSubmit={(e) => { e.preventDefault(); if (!title.trim() || !body.trim()) { toast.error("Add a title and announcement"); return; } const values = { title, body, audience }; const save = editingId ? onUpdate(editingId, values) : onCreate(values); void save.then(resetEditor); }}><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" /><select value={audience} onChange={(e) => setAudience(e.target.value as AppRole | "all")} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">All users</option>{Object.entries(ROLE_NAME).map(([key, name]) => <option key={key} value={key}>{name}s</option>)}</select><Textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the academy update…" rows={3} className="md:col-span-2" /><div className="flex gap-2 md:col-span-2"><Button type="submit" variant="emerald" disabled={busy}><Megaphone className="h-4 w-4" /> {editingId ? "Save changes" : "Publish now"}</Button>{editingId && <Button type="button" variant="outline" onClick={resetEditor}>Cancel edit</Button>}</div></form></Panel>}
    {visible.length ? <div className="grid gap-3">{visible.map((announcement) => <Panel key={announcement.id}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{announcement.title}</h2>{announcement.audience && <Badge variant="outline">{ROLE_NAME[announcement.audience]}</Badge>}{!announcement.published && <Badge variant="muted">Draft</Badge>}</div><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{announcement.body}</p><p className="mt-3 text-xs text-muted-foreground">Published {dateLabel(announcement.publish_at)}</p></div>{staff && <div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => { setEditingId(announcement.id); setTitle(announcement.title); setBody(announcement.body); setAudience(announcement.audience ?? "all"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button><ConfirmButton trigger={<Button size="sm" variant="outline" className="text-destructive">Delete</Button>} title="Delete this announcement?" description="This removes it from all role dashboards." confirmLabel="Delete announcement" onConfirm={() => void onDelete(announcement.id)} /></div>}</div></Panel>)}</div> : <EmptyState title="No announcements" text="New academy updates will appear here." icon={Megaphone} />}
  </>;
}

function InboxSection({ data, busy, onResolve }: { data: DashboardData; busy: boolean; onResolve: (message: ContactMessage, reply: string) => Promise<void> }) {
  const [filter, setFilter] = useState("open");
  const messages = data.messages.filter((m) => filter === "all" || (filter === "resolved" ? m.status === "resolved" : m.status !== "resolved"));
  return <><PageHeader title="Contact inbox" description="Respond to messages sent through the public academy contact form." actions={<Badge variant="warning">{data.messages.filter((m) => m.status !== "resolved").length} open</Badge>} /><div className="mb-4 flex justify-end"><select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm"><option value="open">Open inquiries</option><option value="resolved">Resolved</option><option value="all">All messages</option></select></div>
    {messages.length ? <div className="space-y-4">{messages.map((message) => <MessageCard key={message.id} message={message} busy={busy} onResolve={onResolve} />)}</div> : <EmptyState title="Inbox is clear" text="There are no messages in this view." icon={Mail} />}
  </>;
}

function MessageCard({ message, busy, onResolve }: { message: ContactMessage; busy: boolean; onResolve: (message: ContactMessage, reply: string) => Promise<void> }) {
  const [reply, setReply] = useState(message.reply ?? "");
  return <Panel><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{message.subject || "General inquiry"}</h2><p className="text-sm text-muted-foreground">{message.name} · {message.email}</p></div><Badge variant={message.status === "resolved" ? "success" : "warning"}>{message.status.replaceAll("_", " ")}</Badge></div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p><p className="mt-2 text-xs text-muted-foreground">Received {dateLabel(message.created_at)}</p><div className="mt-4 border-t border-border pt-4"><label className="mb-2 block text-sm font-semibold">{message.status === "resolved" ? "Saved reply" : "Reply and resolve"}</label><Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Write a response to this inquiry…" disabled={message.status === "resolved"} />{message.status !== "resolved" && <Button className="mt-3" variant="emerald" disabled={busy || !reply.trim()} onClick={() => void onResolve(message, reply)}><Mail className="h-4 w-4" /> Save reply</Button>}</div></Panel>;
}

function ReportsSection({ data, rolesByUser }: { data: DashboardData; rolesByUser: Map<string, UserRole[]> }) {
  const [report, setReport] = useState("enrollments");
  function exportReport() {
    if (report === "people") downloadCsv("ezana-people.csv", data.profiles.map((p) => ({ name: displayName(p), email: p.email, roles: (rolesByUser.get(p.id) ?? []).map((r) => ROLE_NAME[r.role]).join("; "), status: p.status, joined: p.created_at })));
    if (report === "courses") downloadCsv("ezana-courses.csv", data.courses.map((c) => ({ title: c.title, slug: c.slug, level: c.level, status: c.status, duration_hours: c.duration_hours, created_at: c.created_at })));
    if (report === "enrollments") downloadCsv("ezana-enrollments.csv", data.enrollments.map((e) => ({ learner: profilesByLabel(data.profiles, e.user_id), course: data.courses.find((c) => c.id === e.course_id)?.title ?? "", enrolled_at: e.created_at })));
    if (report === "payments") downloadCsv("ezana-payments.csv", data.payments.map((p) => ({ learner: profilesByLabel(data.profiles, p.user_id), course: data.courses.find((c) => c.id === p.course_id)?.title ?? "", amount: p.amount, currency: p.currency, method: p.method, reference: p.reference, status: p.status, created_at: p.created_at })));
    toast.success("CSV report downloaded");
  }
  return <><PageHeader title="Reports & analytics" description="Export current records from the academy database. CSV reports open in Excel." /><Panel title="Export a report"><div className="grid gap-4 sm:grid-cols-[1fr_auto]"><select value={report} onChange={(e) => setReport(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm"><option value="enrollments">Enrollment report ({data.enrollments.length})</option><option value="people">People and roles ({data.profiles.length})</option><option value="courses">Course catalog ({data.courses.length})</option><option value="payments">Payment history ({data.payments.length})</option></select><Button variant="emerald" onClick={exportReport}><ArrowDownToLine className="h-4 w-4" /> Download CSV</Button></div><p className="mt-3 text-xs text-muted-foreground">Exports contain records available to your staff role through the current database access policies.</p></Panel><div className="mt-5 grid gap-4 sm:grid-cols-3"><StatCard label="Accounts" value={data.profiles.length} icon={Users} /><StatCard label="Active courses" value={data.courses.filter((c) => c.status === "published").length} icon={BookOpen} tone="gold" index={1} /><StatCard label="Enrollments" value={data.enrollments.length} icon={ClipboardList} tone="deep" index={2} /></div></>;
}

function ActivitySection({ data, profilesById }: { data: DashboardData; profilesById: Map<string, Profile> }) {
  const [search, setSearch] = useState("");
  const items = data.audit.filter((a) => `${a.action} ${a.entity} ${a.details ? JSON.stringify(a.details) : ""} ${profilesById.get(a.actor_id ?? "")?.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeader title="Audit activity" description="Security-relevant role, account, and payment changes recorded by the backend." actions={<Badge variant="secondary">Latest {data.audit.length}</Badge>} /><div className="mb-4 flex justify-end"><SearchBox value={search} onChange={setSearch} placeholder="Search activity" /></div><Panel>{items.length ? <div className="divide-y divide-border">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"><Activity className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate font-semibold">{item.action.replaceAll("_", " ")}</p><p className="truncate text-sm text-muted-foreground">{profilesById.get(item.actor_id ?? "") ? displayName(profilesById.get(item.actor_id ?? "")!) : "System"} · {item.entity}{item.entity_id ? ` #${item.entity_id.slice(0, 8)}` : ""}</p></div></div><time className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</time></div>)}</div> : <EmptyState title="No audit events found" text="Role and payment reviews are automatically recorded here." icon={Activity} />}</Panel></>;
}

function AcademySection({ role, settings, busy, onSave }: { role: AppRole; settings: AcademySettings | null; busy: boolean; onSave: (v: Partial<AcademySettings>) => Promise<void> }) {
  const [values, setValues] = useState<Partial<AcademySettings>>({});
  const current = { name: settings?.name ?? "", tagline: settings?.tagline ?? "", description: settings?.description ?? "", email: settings?.email ?? "", phone: settings?.phone ?? "", address: settings?.address ?? "", website: settings?.website ?? "", payment_instructions: settings?.payment_instructions ?? "", ...values };
  const set = (key: keyof AcademySettings, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const owner = role === "owner";
  return <><PageHeader title="Academy profile" description={owner ? "Edit the public academy identity and contact details." : "View the academy profile. Only Owners can change these settings."} actions={!owner ? <Badge variant="muted">Read only</Badge> : undefined} /><Panel title="Public identity"><form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void onSave(current); }}><label className="space-y-1.5 text-sm font-medium">Academy name<Input value={current.name} onChange={(e) => set("name", e.target.value)} disabled={!owner} /></label><label className="space-y-1.5 text-sm font-medium">Tagline<Input value={current.tagline} onChange={(e) => set("tagline", e.target.value)} disabled={!owner} /></label><label className="space-y-1.5 text-sm font-medium">Contact email<Input type="email" value={current.email} onChange={(e) => set("email", e.target.value)} disabled={!owner} /></label><label className="space-y-1.5 text-sm font-medium">Phone<Input value={current.phone} onChange={(e) => set("phone", e.target.value)} disabled={!owner} /></label><label className="space-y-1.5 text-sm font-medium sm:col-span-2">Address<Input value={current.address} onChange={(e) => set("address", e.target.value)} disabled={!owner} /></label><label className="space-y-1.5 text-sm font-medium sm:col-span-2">Website<Input type="url" value={current.website ?? ""} onChange={(e) => set("website", e.target.value)} disabled={!owner} /></label><label className="space-y-1.5 text-sm font-medium sm:col-span-2">Description<Textarea value={current.description} onChange={(e) => set("description", e.target.value)} rows={4} disabled={!owner} /></label><label className="space-y-1.5 text-sm font-medium sm:col-span-2">Payment instructions<Textarea value={current.payment_instructions} onChange={(e) => set("payment_instructions", e.target.value)} rows={3} disabled={!owner} /></label>{owner && <div className="sm:col-span-2"><Button type="submit" variant="emerald" disabled={busy || !settings}>Save academy profile</Button></div>}{!settings && <p className="text-sm text-muted-foreground sm:col-span-2">Academy settings are not available in the connected database.</p>}</form></Panel></>;
}

function AccountSection({ profile }: { profile: Profile | null }) {
  const { refresh } = useAuth();
  const [form, setForm] = useState({ first_name: profile?.first_name ?? "", last_name: profile?.last_name ?? "", phone: profile?.phone ?? "", bio: profile?.bio ?? "" });
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); if (!profile) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), phone: form.phone.trim() || null, bio: form.bio.trim() || null }).eq("id", profile.id);
    setBusy(false);
    if (error) toast.error(error.message); else { await refresh(); toast.success("Profile updated"); }
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password.current) { toast.error("Enter your current password"); return; }
    if (password.next.length < 8 || !/[A-Za-z]/.test(password.next) || !/\d/.test(password.next)) { toast.error("Use at least 8 characters with a letter and a number"); return; }
    if (password.next !== password.confirm) { toast.error("New passwords do not match"); return; }
    setBusy(true);
    const { error: verificationError } = await supabase.auth.signInWithPassword({ email: profile?.email ?? "", password: password.current });
    if (verificationError) { setBusy(false); toast.error("Current password is incorrect"); return; }
    const { error } = await supabase.auth.updateUser({ password: password.next });
    setBusy(false);
    if (error) toast.error(error.message); else { setPassword({ current: "", next: "", confirm: "" }); toast.success("Password updated"); }
  }
  if (!profile) return <EmptyState title="Profile unavailable" text="Refresh your account session and try again." icon={UserRound} />;
  return <><PageHeader title="My account" description="Update your profile and secure your sign-in." /><div className="grid gap-5 xl:grid-cols-2"><Panel title="Profile information"><form className="space-y-4" onSubmit={saveProfile}><div className="grid grid-cols-2 gap-3"><label className="space-y-1.5 text-sm font-medium">First name<Input required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></label><label className="space-y-1.5 text-sm font-medium">Last name<Input required value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></label></div><label className="block space-y-1.5 text-sm font-medium">Email address<Input value={profile.email} disabled /></label><label className="block space-y-1.5 text-sm font-medium">Phone<Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label><label className="block space-y-1.5 text-sm font-medium">About me<Textarea rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} /></label><Button type="submit" variant="emerald" disabled={busy}>Save profile</Button></form></Panel><Panel title="Change password"><form className="space-y-4" onSubmit={changePassword}><p className="text-sm text-muted-foreground">Choose a new password with at least 8 characters, including a letter and a number.</p><label className="block space-y-1.5 text-sm font-medium">Current password<Input type="password" autoComplete="current-password" required value={password.current} onChange={(e) => setPassword((p) => ({ ...p, current: e.target.value }))} /></label><label className="block space-y-1.5 text-sm font-medium">New password<Input type="password" autoComplete="new-password" required value={password.next} onChange={(e) => setPassword((p) => ({ ...p, next: e.target.value }))} /></label><label className="block space-y-1.5 text-sm font-medium">Confirm new password<Input type="password" autoComplete="new-password" required value={password.confirm} onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))} /></label><Button type="submit" variant="emerald" disabled={busy}>Update password</Button></form></Panel></div></>;
}
