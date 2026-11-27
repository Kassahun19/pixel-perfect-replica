import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  Bell,
  CheckCheck,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MessageSquare,
  MessageSquareHeart,
  Pin,
  Plus,
  Printer,
  Receipt,
  Search,
  Send,
  Settings,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, useAuth } from "@/lib/auth";
import { formatETB } from "@/lib/access";
import { logAudit } from "@/lib/csv";
import { downloadExcelXls } from "@/lib/export";
import {
  computeAttendanceStats,
  computeGradeOutcome,
  computeInstructorEarningsSummary,
} from "@/lib/owner/logic";
import type { CourseDiscussionThread } from "@/lib/owner/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
import type { InstructorDataHandle } from "./useInstructorData";

/* ========================================================================== */
/* PARENT COMMUNICATION                                                       */
/* ========================================================================== */

export function InstructorParentCommModule({ data }: { data: InstructorDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can, mutating } = data;
  const [parentId, setParentId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [includeSnapshot, setIncludeSnapshot] = useState(true);

  const parents = maps.parents;
  const activeParentId = parentId || parents[0]?.id || "";
  const linkedStudents = useMemo(
    () =>
      db.parentLinks
        .filter((l) => l.parent_id === activeParentId && maps.studentIdSet.has(l.student_id))
        .map((l) => maps.profilesById.get(l.student_id))
        .filter((p): p is NonNullable<typeof p> => !!p),
    [db.parentLinks, activeParentId, maps],
  );
  const activeStudentId = studentId || linkedStudents[0]?.id || "";

  const snapshotPreview = useMemo(() => {
    if (!activeStudentId) return null;
    const enrolled = db.enrollments.filter((e) => e.user_id === activeStudentId).length;
    const done = db.progress.filter((p) => p.user_id === activeStudentId).length;
    const att = computeAttendanceStats(
      (workspace?.attendance ?? []).filter(
        (a) => a.personType === "student" && a.personId === activeStudentId,
      ),
    );
    const scale = workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];
    const grades = (workspace?.grades ?? []).filter((g) => g.studentId === activeStudentId);
    const avg =
      grades.length && scale
        ? Math.round(
            grades.reduce(
              (s, g) => s + computeGradeOutcome(g.score, g.maxScore, scale).percent,
              0,
            ) / grades.length,
          )
        : null;
    return `Assigned Courses: ${enrolled} | Lessons done: ${done} | Attendance: ${att.total ? `${att.attendanceRate}%` : "No logs"} | Avg grade: ${avg !== null ? `${avg}%` : "N/A"}`;
  }, [activeStudentId, db, workspace]);

  async function sendParentMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeParentId || !subject.trim() || !body.trim()) return;
    await mutateWorkspace(
      {
        type: "send_parent_message",
        payload: {
          parentId: activeParentId,
          studentId: activeStudentId || null,
          senderId: user.id,
          senderRole: "instructor",
          subject: subject.trim(),
          body: body.trim(),
          includeSnapshot,
          snapshotSummary: includeSnapshot ? snapshotPreview : null,
        },
      },
      "Update sent to parent",
    );
    setSubject("");
    setBody("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent Communication"
        description="Communicate with linked parents of students in your assigned courses and classes."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Send Update to Linked Parent">
          {parents.length > 0 ? (
            <form className="space-y-3" onSubmit={(e) => void sendParentMessage(e)}>
              <label className="block space-y-1 text-sm font-medium">
                Parent
                <select
                  value={activeParentId}
                  onChange={(e) => {
                    setParentId(e.target.value);
                    setStudentId("");
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {displayName(p)} ({p.email})
                    </option>
                  ))}
                </select>
              </label>

              {linkedStudents.length > 0 && (
                <label className="block space-y-1 text-sm font-medium">
                  Student Context
                  <select
                    value={activeStudentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {linkedStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {displayName(s)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block space-y-1 text-sm font-medium">
                Subject
                <Input
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Progress & Attendance Check-in"
                />
              </label>

              <label className="block space-y-1 text-sm font-medium">
                Message
                <Textarea
                  required
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>

              {snapshotPreview && (
                <label className="flex items-start gap-2 rounded-xl border border-border bg-secondary/35 p-3 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={includeSnapshot}
                    onChange={(e) => setIncludeSnapshot(e.target.checked)}
                  />
                  <span>
                    <strong className="block">Include academic & attendance snapshot</strong>
                    <span className="text-muted-foreground">{snapshotPreview}</span>
                  </span>
                </label>
              )}

              {can("communication", "create") && (
                <Button type="submit" variant="emerald" disabled={mutating}>
                  <Send className="h-4 w-4" />
                  Send to Parent
                </Button>
              )}
            </form>
          ) : (
            <EmptyState
              title="No linked parents found"
              text="Parents linked to your enrolled students will appear here automatically."
              icon={MessageSquareHeart}
            />
          )}
        </Panel>

        <Panel title="Parent Communication History">
          {(workspace?.parentMessages ?? []).length > 0 ? (
            <div className="space-y-3">
              {(workspace?.parentMessages ?? []).map((m) => {
                const parent = maps.profilesById.get(m.parentId);
                return (
                  <div key={m.id} className="rounded-xl border border-border p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">{m.subject}</span>
                      <Badge variant={m.read ? "outline" : "secondary"}>
                        {m.read ? "Read" : "Sent"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      Parent: {parent ? displayName(parent) : "Parent"} ·{" "}
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                    <p className="pt-1 text-foreground">{m.body}</p>
                    {m.snapshotSummary && (
                      <p className="rounded bg-secondary/60 px-2 py-1 text-[11px] text-muted-foreground">
                        {m.snapshotSummary}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No parent messages yet"
              text="Your parent progress updates and replies appear here."
              icon={Mail}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* STUDENT MESSAGES                                                           */
/* ========================================================================== */

export function InstructorStudentMessagesModule({ data }: { data: InstructorDataHandle }) {
  const { user } = useAuth();
  const { workspace, maps, mutateWorkspace, can, mutating } = data;
  const [recipientId, setRecipientId] = useState(maps.students[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");

  const messages = useMemo(() => {
    return (workspace?.internalMessages ?? []).filter((m) => {
      if (!search.trim()) return true;
      return `${m.subject} ${m.body}`.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [workspace?.internalMessages, search]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const target = recipientId || maps.students[0]?.id || "";
    if (!user || !target || !subject.trim() || !body.trim()) return;
    await mutateWorkspace(
      {
        type: "send_internal_message",
        payload: {
          senderId: user.id,
          recipientId: target,
          subject: subject.trim(),
          body: body.trim(),
        },
      },
      "Message sent to student",
    );
    setSubject("");
    setBody("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Messages"
        description="Send and receive private messages with students enrolled in your assigned courses and classes."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <Panel title="Compose Student Message">
          {maps.students.length > 0 ? (
            <form className="space-y-3" onSubmit={(e) => void sendMessage(e)}>
              <label className="block space-y-1 text-sm font-medium">
                Student Recipient
                <select
                  value={recipientId || maps.students[0]?.id || ""}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {maps.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {displayName(s)} ({s.email})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Subject
                <Input
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Assignment clarification / Lab feedback"
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Message
                <Textarea
                  required
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              {can("communication", "create") && (
                <Button type="submit" variant="emerald" disabled={mutating}>
                  <Send className="h-4 w-4" />
                  Send Message
                </Button>
              )}
            </form>
          ) : (
            <EmptyState
              title="No enrolled students yet"
              text="Students enrolled in your courses appear here for private messaging."
              icon={Mail}
            />
          )}
        </Panel>

        <Panel
          title="Conversations"
          actions={
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages…"
                className="h-9 w-44 pl-8 text-xs"
              />
            </div>
          }
        >
          {messages.length > 0 ? (
            <div className="space-y-2.5">
              {messages.map((m) => {
                const otherId = m.senderId === user?.id ? m.recipientId : m.senderId;
                const other = maps.profilesById.get(otherId);
                return (
                  <div key={m.id} className="rounded-xl border border-border p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">{m.subject}</span>
                      <button
                        type="button"
                        onClick={() =>
                          void mutateWorkspace({
                            type: "update_internal_message",
                            id: m.id,
                            patch: { read: !m.read },
                          })
                        }
                      >
                        <Badge variant={m.read ? "outline" : "secondary"}>
                          {m.read ? "Read" : "Unread"}
                        </Badge>
                      </button>
                    </div>
                    <p className="text-muted-foreground">
                      {m.senderId === user?.id ? "To" : "From"}:{" "}
                      {other ? displayName(other) : "Student"} ·{" "}
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                    <p className="pt-1 text-foreground">{m.body}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Inbox is empty"
              text="Direct conversations with your enrolled students appear here."
              icon={Mail}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* DISCUSSION FORUMS                                                          */
/* ========================================================================== */

export function InstructorDiscussionForumsModule({ data }: { data: InstructorDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [courseFilter, setCourseFilter] = useState("all");
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [replyBody, setReplyBody] = useState("");
  const [newThread, setNewThread] = useState({
    courseId: db.courses[0]?.id ?? "",
    title: "",
    body: "",
  });

  const threads = useMemo(() => {
    return (workspace?.discussionThreads ?? [])
      .filter((t) => (courseFilter === "all" ? true : t.courseId === courseFilter))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [workspace?.discussionThreads, courseFilter]);

  const activeThread =
    threads.find((t) => t.id === selectedThreadId) ?? threads[0] ?? null;

  const activePosts = useMemo(() => {
    if (!activeThread) return [];
    return (workspace?.discussionPosts ?? []).filter((p) => p.threadId === activeThread.id);
  }, [workspace?.discussionPosts, activeThread]);

  async function createThread(e: React.FormEvent) {
    e.preventDefault();
    const cid = newThread.courseId || db.courses[0]?.id || "";
    if (!user || !cid || !newThread.title.trim() || !newThread.body.trim()) return;
    const now = new Date().toISOString();
    const thread: CourseDiscussionThread = {
      id: crypto.randomUUID(),
      courseId: cid,
      authorId: user.id,
      authorRole: "instructor",
      title: newThread.title.trim(),
      body: newThread.body.trim(),
      pinned: false,
      locked: false,
      createdAt: now,
      updatedAt: now,
    };
    await mutateWorkspace(
      { type: "upsert_discussion_thread", payload: thread },
      "Discussion topic created",
    );
    setSelectedThreadId(thread.id);
    setNewThread((f) => ({ ...f, title: "", body: "" }));
  }

  async function addReply(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeThread || !replyBody.trim()) return;
    await mutateWorkspace(
      {
        type: "add_discussion_post",
        payload: {
          threadId: activeThread.id,
          courseId: activeThread.courseId,
          authorId: user.id,
          authorRole: "instructor",
          body: replyBody.trim(),
        },
      },
      "Reply posted",
    );
    setReplyBody("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discussion Forums"
        description="Start course discussion topics, answer student questions, pin announcements, and moderate replies."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
        <div className="space-y-6">
          <Panel title="Start Discussion Topic">
            <form className="space-y-3" onSubmit={(e) => void createThread(e)}>
              <label className="block space-y-1 text-sm font-medium">
                Course
                <select
                  required
                  value={newThread.courseId || db.courses[0]?.id || ""}
                  onChange={(e) => setNewThread((f) => ({ ...f, courseId: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {db.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                required
                value={newThread.title}
                onChange={(e) => setNewThread((f) => ({ ...f, title: e.target.value }))}
                placeholder="Discussion topic title"
              />
              <Textarea
                required
                rows={3}
                value={newThread.body}
                onChange={(e) => setNewThread((f) => ({ ...f, body: e.target.value }))}
                placeholder="Prompt question or discussion guidelines…"
              />
              <Button
                type="submit"
                variant="emerald"
                size="sm"
                disabled={db.courses.length === 0 || data.mutating}
              >
                <Plus className="h-4 w-4" />
                Post Topic
              </Button>
            </form>
          </Panel>

          <Panel
            title="Course Topics"
            actions={
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="all">All courses</option>
                {db.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            }
          >
            {threads.length > 0 ? (
              <div className="space-y-2">
                {threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedThreadId(t.id)}
                    className={`w-full rounded-xl border p-3 text-left text-xs transition-colors ${
                      activeThread?.id === t.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">{t.title}</span>
                      <div className="flex gap-1">
                        {t.pinned && <Badge variant="gold">Pinned</Badge>}
                        {t.locked && <Badge variant="muted">Locked</Badge>}
                      </div>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {maps.coursesById.get(t.courseId)?.title ?? "Course"}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No forum discussions yet"
                text="Create a discussion topic to encourage student collaboration."
                icon={MessageSquare}
              />
            )}
          </Panel>
        </div>

        <Panel
          title={activeThread ? activeThread.title : "Thread Moderation"}
          actions={
            activeThread &&
            can("communication", "edit") && (
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void mutateWorkspace(
                      {
                        type: "upsert_discussion_thread",
                        payload: { ...activeThread, pinned: !activeThread.pinned },
                      },
                      activeThread.pinned ? "Unpinned topic" : "Pinned topic",
                    )
                  }
                >
                  <Pin className="h-3.5 w-3.5" />
                  {activeThread.pinned ? "Unpin" : "Pin"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void mutateWorkspace(
                      {
                        type: "upsert_discussion_thread",
                        payload: { ...activeThread, locked: !activeThread.locked },
                      },
                      activeThread.locked ? "Thread unlocked" : "Thread locked",
                    )
                  }
                >
                  <Lock className="h-3.5 w-3.5" />
                  {activeThread.locked ? "Unlock" : "Lock"}
                </Button>
                {can("communication", "delete") && (
                  <ConfirmButton
                    title="Delete Thread?"
                    description={`Delete "${activeThread.title}" and all replies?`}
                    onConfirm={() =>
                      void mutateWorkspace(
                        { type: "delete_discussion_thread", id: activeThread.id },
                        "Thread deleted",
                      )
                    }
                    trigger={
                      <Button type="button" variant="ghost" size="sm" aria-label="Delete thread">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    }
                  />
                )}
              </div>
            )
          }
        >
          {activeThread ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-secondary/40 p-3.5 text-sm">
                <p className="text-foreground">{activeThread.body}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Started {new Date(activeThread.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                {activePosts.map((p) => {
                  const author = maps.profilesById.get(p.authorId);
                  return (
                    <div
                      key={p.id}
                      className="flex items-start justify-between gap-2 rounded-xl border border-border p-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold">
                          {author ? displayName(author) : p.authorRole}{" "}
                          <span className="font-normal text-muted-foreground">
                            · {new Date(p.createdAt).toLocaleString()}
                          </span>
                        </p>
                        <p className="mt-1 text-sm">
                          {p.moderatedHidden ? (
                            <span className="italic text-muted-foreground">
                              [Hidden by instructor moderation]
                            </span>
                          ) : (
                            p.body
                          )}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void mutateWorkspace({
                            type: "moderate_discussion_post",
                            id: p.id,
                            hidden: !p.moderatedHidden,
                          })
                        }
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {!activeThread.locked && (
                <form className="flex gap-2" onSubmit={(e) => void addReply(e)}>
                  <Input
                    required
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write an instructor reply…"
                  />
                  <Button type="submit" variant="emerald" disabled={data.mutating}>
                    Reply
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <EmptyState
              title="Select a discussion thread"
              text="Pick a thread on the left or create a new discussion topic."
              icon={MessageSquare}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* NOTIFICATIONS                                                              */
/* ========================================================================== */

export function InstructorNotificationsModule({ data }: { data: InstructorDataHandle }) {
  const { user } = useAuth();
  const { workspace, mutateWorkspace } = data;
  const prefs = workspace?.myAccountPrefs;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="View alerts about new student submissions, upcoming sessions, messages, and notification settings."
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <Panel title="Teaching Alerts & Notices">
          {(workspace?.notifications ?? []).length > 0 ? (
            <div className="space-y-2.5">
              {(workspace?.notifications ?? []).map((n) => {
                const isRead = user ? n.readBy.includes(user.id) : false;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 ${
                      isRead ? "border-border bg-card" : "border-primary/40 bg-primary/5"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{n.title}</p>
                        <Badge variant="outline">{n.category}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!isRead && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void mutateWorkspace({ type: "mark_notification_read", id: n.id })
                        }
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark Read
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="All caught up"
              text="New submission notifications, schedule changes, and academy alerts appear here."
              icon={Bell}
            />
          )}
        </Panel>

        <Panel title="Notification Preferences">
          {prefs && (
            <div className="space-y-3 text-sm">
              <label className="flex items-center justify-between rounded-xl border border-border p-3">
                <span>Email alerts for submissions</span>
                <input
                  type="checkbox"
                  checked={prefs.emailNotifications}
                  onChange={(e) =>
                    void mutateWorkspace(
                      {
                        type: "update_account_prefs",
                        prefs: { ...prefs, emailNotifications: e.target.checked },
                      },
                      "Preferences updated",
                    )
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-border p-3">
                <span>In-app notifications</span>
                <input
                  type="checkbox"
                  checked={prefs.inAppNotifications}
                  onChange={(e) =>
                    void mutateWorkspace(
                      {
                        type: "update_account_prefs",
                        prefs: { ...prefs, inAppNotifications: e.target.checked },
                      },
                      "Preferences updated",
                    )
                  }
                />
              </label>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* MY EARNINGS & PAYMENT HISTORY                                              */
/* ========================================================================== */

export function InstructorEarningsModule({
  data,
  mode = "earnings",
}: {
  data: InstructorDataHandle;
  mode?: "earnings" | "history";
}) {
  const { profile } = useAuth();
  const { db, workspace, maps, setPrintable } = data;
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const payouts = useMemo(() => workspace?.payouts ?? [], [workspace?.payouts]);
  const meta = workspace?.myInstructorMeta;
  const liveHours = (workspace?.liveClasses ?? [])
    .filter((lc) => lc.status === "ended")
    .reduce((sum, lc) => {
      const [sh, sm] = lc.startTime.split(":").map(Number);
      const [eh, em] = lc.endTime.split(":").map(Number);
      const mins = Math.max(0, (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0)));
      return sum + mins / 60;
    }, 0);

  const summary = useMemo(
    () =>
      computeInstructorEarningsSummary(
        payouts,
        meta?.hourlyRate ?? 0,
        Math.round(liveHours * 10) / 10,
      ),
    [payouts, meta?.hourlyRate, liveHours],
  );

  const filteredPayouts = useMemo(() => {
    return payouts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!search.trim()) return true;
      return `${p.periodLabel} ${p.referenceCode} ${p.notes}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    });
  }, [payouts, statusFilter, search]);

  function exportEarningsStatement() {
    downloadExcelXls(
      "ezana-instructor-earnings",
      "Earnings",
      filteredPayouts.map((p) => ({
        Period: p.periodLabel,
        Course: p.courseId ? (maps.coursesById.get(p.courseId)?.title ?? "Course") : "General",
        TeachingHours: p.teachingHours,
        RatePerHour: p.ratePerHour,
        Amount: p.amount,
        Status: p.status,
        Reference: p.referenceCode,
        PaidDate: p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "Pending",
      })),
      `Instructor Earnings Statement — ${profile ? displayName(profile) : "Instructor"}`,
    );
  }

  function printEarningsStatement() {
    setPrintable({
      title: `Instructor Earnings Statement — ${profile ? displayName(profile) : "Instructor"}`,
      subtitle: `Paid: ${formatETB(summary.totalPaid)} · Pending: ${formatETB(summary.totalPending)} · Rate: ${formatETB(meta?.hourlyRate ?? 0)}/hr`,
      columns: ["Period", "Course", "Hours", "Amount", "Status", "Reference"],
      rows: filteredPayouts.map((p) => [
        p.periodLabel,
        p.courseId ? (maps.coursesById.get(p.courseId)?.title ?? "Course") : "General",
        p.teachingHours,
        formatETB(p.amount),
        p.status,
        p.referenceCode || "—",
      ]),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "history" ? "Payment History" : "My Earnings"}
        description={
          mode === "history"
            ? "Track your previous instructor payout dates, amounts, transaction references, and download statements."
            : "Review total, pending, and paid teaching earnings, hourly rate breakdowns, and assigned teaching volume."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {filteredPayouts.length > 0 && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={exportEarningsStatement}>
                  <ArrowDownToLine className="h-4 w-4" />
                  Export Statement
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={printEarningsStatement}>
                  <Printer className="h-4 w-4" />
                  Print PDF
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Paid" value={formatETB(summary.totalPaid)} icon={Wallet} index={0} />
        <StatCard
          label="Pending Payouts"
          value={formatETB(summary.totalPending)}
          icon={Receipt}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Hourly Rate"
          value={meta?.hourlyRate ? `${formatETB(meta.hourlyRate)}/hr` : "Standard"}
          icon={Wallet}
          hint={`${db.courses.length} assigned courses`}
          tone="deep"
          index={2}
        />
        <StatCard
          label="Logged Payout Hours"
          value={`${summary.loggedHours} hrs`}
          icon={Receipt}
          hint={`${Math.round(liveHours * 10) / 10} live class hrs ended`}
          tone="plain"
          index={3}
        />
      </div>

      <Panel
        title="Payout Records & Statements"
        actions={
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search period or reference…"
              className="h-9 w-48 text-xs"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        }
      >
        {filteredPayouts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Hours & Rate</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold text-sm">{p.periodLabel}</TableCell>
                  <TableCell className="text-xs">
                    {p.courseId ? (maps.coursesById.get(p.courseId)?.title ?? "Course") : "General"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.teachingHours} hrs × {formatETB(p.ratePerHour)}
                  </TableCell>
                  <TableCell className="font-semibold text-sm">{formatETB(p.amount)}</TableCell>
                  <TableCell className="font-mono text-xs">{p.referenceCode || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[p.status] ?? "outline"}>{p.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No payout records yet"
            text="Processed and pending instructor payouts recorded by the academy appear here."
            icon={Receipt}
          />
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* MY ACCOUNT (PROFILE, SETTINGS, CHANGE PASSWORD)                            */
/* ========================================================================== */

export function InstructorProfileModule({ data }: { data: InstructorDataHandle }) {
  const { user, profile, refresh } = useAuth();
  const { workspace, mutateWorkspace, mutating } = data;
  const meta = workspace?.myInstructorMeta;

  const [form, setForm] = useState({
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    phone: profile?.phone ?? "",
    avatar_url: profile?.avatar_url ?? "",
    bio: profile?.bio ?? "",
    qualifications: meta?.qualifications ?? "",
    experienceYears: String(meta?.experienceYears ?? 0),
    expertiseText: (meta?.expertise ?? []).join(", "),
  });
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim() || null,
          avatar_url: form.avatar_url.trim() || null,
          bio: form.bio.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw new Error(error.message);

      await mutateWorkspace({
        type: "upsert_instructor_meta",
        payload: {
          userId: user.id,
          qualifications: form.qualifications.trim(),
          experienceYears: Math.max(0, Number(form.experienceYears) || 0),
          expertise: form.expertiseText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          departmentId: meta?.departmentId ?? null,
          weeklyHoursLimit: meta?.weeklyHoursLimit ?? 20,
          scheduleSummary: meta?.scheduleSummary ?? "",
          hourlyRate: meta?.hourlyRate ?? 0,
        },
      });
      await logAudit("instructor_profile_updated", "profile", user.id);
      await refresh();
      toast.success("Instructor profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Update your personal contact details, biography, qualifications, experience, and subject expertise."
      />
      <Panel title="Personal & Professional Details">
        <form className="max-w-2xl space-y-4" onSubmit={(e) => void saveProfile(e)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium">
              First Name
              <Input
                required
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Last Name
              <Input
                required
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium">
              Email Address
              <Input disabled value={profile?.email ?? user?.email ?? ""} />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Phone Number
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium">
              Qualifications / Degrees
              <Input
                value={form.qualifications}
                onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))}
                placeholder="MSc in Computer Science"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Years of Experience
              <Input
                type="number"
                min={0}
                value={form.experienceYears}
                onChange={(e) => setForm((f) => ({ ...f, experienceYears: e.target.value }))}
              />
            </label>
          </div>
          <label className="block space-y-1 text-sm font-medium">
            Areas of Expertise (comma separated)
            <Input
              value={form.expertiseText}
              onChange={(e) => setForm((f) => ({ ...f, expertiseText: e.target.value }))}
              placeholder="Microsoft Excel, Web Development, Data Analysis"
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Photo URL (optional)
            <Input
              value={form.avatar_url}
              onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))}
              placeholder="https://..."
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Instructor Biography
            <Textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </label>
          <Button type="submit" variant="emerald" disabled={busy || mutating}>
            <UserRound className="h-4 w-4" />
            {busy ? "Saving…" : "Save Profile"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}

export function InstructorAccountSettingsModule({ data }: { data: InstructorDataHandle }) {
  const { workspace, mutateWorkspace, mutating } = data;
  const existing = workspace?.myAccountPrefs;
  const [form, setForm] = useState({
    language: existing?.language ?? ("en" as const),
    timezone: existing?.timezone ?? "Africa/Addis_Ababa",
    emailNotifications: existing?.emailNotifications ?? true,
    inAppNotifications: existing?.inAppNotifications ?? true,
  });

  async function savePrefs(e: React.FormEvent) {
    e.preventDefault();
    await mutateWorkspace(
      {
        type: "update_account_prefs",
        prefs: {
          ...form,
          paymentReviewDigest: false,
          weeklyExecutiveSummary: false,
        },
      },
      "Account settings saved",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Settings"
        description="Configure your personal language, timezone, and teaching notification preferences."
      />
      <Panel title="Preferences">
        <form className="max-w-xl space-y-4" onSubmit={(e) => void savePrefs(e)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium">
              Language
              <select
                value={form.language}
                onChange={(e) =>
                  setForm((f) => ({ ...f, language: e.target.value as "en" | "am" }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="en">English</option>
                <option value="am">Amharic</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Timezone
              <Input
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              />
            </label>
          </div>
          <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
            <span>Email alerts for submissions & messages</span>
            <input
              type="checkbox"
              checked={form.emailNotifications}
              onChange={(e) =>
                setForm((f) => ({ ...f, emailNotifications: e.target.checked }))
              }
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
            <span>In-app notifications</span>
            <input
              type="checkbox"
              checked={form.inAppNotifications}
              onChange={(e) =>
                setForm((f) => ({ ...f, inAppNotifications: e.target.checked }))
              }
            />
          </label>
          <Button type="submit" variant="emerald" disabled={mutating}>
            <Settings className="h-4 w-4" />
            Save Settings
          </Button>
        </form>
      </Panel>
    </div>
  );
}

export function InstructorChangePasswordModule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast.error("New password must include both letters and numbers.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Password confirmation does not match.");
      return;
    }
    if (!user?.email) return;

    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        throw new Error("Current password is incorrect.");
      }
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) throw new Error(updateErr.message);

      await logAudit("password_changed", "auth", user.id);
      toast.success("Password updated. Please sign in with your new credentials.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      void navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Change Password"
        description="Verify your current password and choose a strong new password."
      />
      <Panel title="Update Account Password">
        <form className="max-w-md space-y-4" onSubmit={(e) => void submitPassword(e)}>
          <label className="block space-y-1 text-sm font-medium">
            Current Password
            <PasswordInput
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            New Password
            <PasswordInput
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Confirm New Password
            <PasswordInput
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          <Button type="submit" variant="emerald" disabled={busy}>
            <KeyRound className="h-4 w-4" />
            {busy ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
