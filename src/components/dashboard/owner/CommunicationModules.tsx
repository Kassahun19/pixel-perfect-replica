import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Bell,
  CheckCheck,
  LifeBuoy,
  Mail,
  MailOpen,
  Megaphone,
  MessageSquareHeart,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, ROLE_LABEL, ROLE_ORDER, useAuth, type AppRole } from "@/lib/auth";
import { logAudit } from "@/lib/csv";
import { computeAttendanceStats, computeGradeOutcome } from "@/lib/owner/logic";
import type { ContactMessageRow, SupportTicketMeta, SystemNotification } from "@/lib/owner/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ConfirmButton,
  EmptyState,
  PageHeader,
  Panel,
  STATUS_BADGE,
} from "@/components/dashboard/ui";
import type { OwnerDataHandle } from "./useOwnerData";

/* ========================================================================== */
/* 5.1 PARENT COMMUNICATION                                                   */
/* ========================================================================== */

export function ParentCommunicationModule({ data }: { data: OwnerDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can, mutating } = data;
  const [parentId, setParentId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [includeSnapshot, setIncludeSnapshot] = useState(true);

  const parents = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("parent")),
    [db.profiles, maps.rolesByUser],
  );
  const activeParentId = parentId || parents[0]?.id || "";
  const linkedStudents = useMemo(
    () =>
      db.parentLinks
        .filter((l) => l.parent_id === activeParentId)
        .map((l) => maps.profilesById.get(l.student_id))
        .filter((p): p is NonNullable<typeof p> => !!p),
    [db.parentLinks, activeParentId, maps.profilesById],
  );
  const activeStudentId = studentId || linkedStudents[0]?.id || "";

  const snapshotPreview = useMemo(() => {
    if (!activeStudentId) return null;
    const enrolled = db.enrollments.filter((e) => e.user_id === activeStudentId).length;
    const done = db.progress.filter((p) => p.user_id === activeStudentId).length;
    const att = computeAttendanceStats(
      (workspace?.attendance ?? []).filter((a) => a.personId === activeStudentId),
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
    return `Courses enrolled: ${enrolled} | Lessons completed: ${done} | Attendance rate: ${att.total ? `${att.attendanceRate}%` : "No logs"} | Avg grade: ${avg !== null ? `${avg}%` : "N/A"}`;
  }, [activeStudentId, db, workspace]);

  async function sendParentUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeParentId || !subject.trim() || !body.trim()) {
      toast.error("Select a parent and enter subject and message.");
      return;
    }
    await mutateWorkspace(
      {
        type: "send_parent_message",
        payload: {
          parentId: activeParentId,
          studentId: activeStudentId || null,
          senderId: user.id,
          senderRole: "owner",
          subject: subject.trim(),
          body: body.trim(),
          includeSnapshot,
          snapshotSummary: includeSnapshot ? snapshotPreview : null,
        },
      },
      "Message sent to parent",
    );
    setSubject("");
    setBody("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent Communication"
        description="Send direct performance and attendance updates to parents and respond to guardian inquiries."
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <Panel title="Send Parent Update">
          {parents.length > 0 ? (
            <form className="space-y-3" onSubmit={(e) => void sendParentUpdate(e)}>
              <label className="block space-y-1 text-sm font-medium">
                Parent Recipient
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
                  placeholder="Monthly Progress & Attendance Update"
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Message
                <Textarea
                  required
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Share course milestones, attendance feedback, or upcoming exam dates…"
                />
              </label>

              {snapshotPreview && (
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={includeSnapshot}
                    onChange={(e) => setIncludeSnapshot(e.target.checked)}
                  />
                  <div>
                    <p className="font-semibold">Attach live student performance snapshot</p>
                    <p className="mt-0.5 text-muted-foreground">{snapshotPreview}</p>
                  </div>
                </label>
              )}

              <Button
                type="submit"
                variant="emerald"
                disabled={mutating || !can("communication", "create")}
              >
                <Send className="h-4 w-4" /> Send to Parent
              </Button>
            </form>
          ) : (
            <EmptyState
              title="No parent accounts found"
              text="Create a parent account in Parent Management to start messaging."
              icon={MessageSquareHeart}
            />
          )}
        </Panel>

        <Panel title={`Parent Message History (${(workspace?.parentMessages ?? []).length})`}>
          {(workspace?.parentMessages ?? []).length > 0 ? (
            <div className="space-y-3">
              {(workspace?.parentMessages ?? []).map((msg) => {
                const parent = maps.profilesById.get(msg.parentId);
                const student = msg.studentId ? maps.profilesById.get(msg.studentId) : undefined;
                return (
                  <div key={msg.id} className="rounded-xl border border-border p-3.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{msg.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          To: {parent ? displayName(parent) : "Parent"}
                          {student ? ` · Student: ${displayName(student)}` : ""}
                        </p>
                      </div>
                      <Badge variant={msg.read ? "muted" : "gold"}>
                        {msg.read ? "Read" : "Sent"}
                      </Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                      {msg.body}
                    </p>
                    {msg.includeSnapshot && msg.snapshotSummary && (
                      <p className="mt-2 rounded-lg bg-secondary/60 px-2.5 py-1.5 font-mono text-[11px] text-foreground">
                        {msg.snapshotSummary}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{new Date(msg.createdAt).toLocaleString()}</span>
                      {!msg.read && (
                        <button
                          type="button"
                          className="font-semibold text-primary hover:underline"
                          onClick={() =>
                            void mutateWorkspace({ type: "mark_parent_message_read", id: msg.id })
                          }
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No parent conversations yet" icon={MessageSquareHeart} />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 5.2 MESSAGES (INTERNAL CONVERSATIONS)                                      */
/* ========================================================================== */

export function MessagesModule({ data }: { data: OwnerDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can, mutating } = data;
  const [folder, setFolder] = useState<"inbox" | "sent" | "archived">("inbox");
  const [search, setSearch] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const others = useMemo(
    () => db.profiles.filter((p) => p.id !== user?.id),
    [db.profiles, user?.id],
  );
  const activeRecipient = recipientId || others[0]?.id || db.profiles[0]?.id || "";

  const messages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (workspace?.internalMessages ?? [])
      .filter((m) => !m.deleted)
      .filter((m) => {
        if (folder === "archived") return m.archived;
        if (m.archived) return false;
        if (folder === "sent") return m.senderId === user?.id;
        return m.recipientId === user?.id || m.senderId !== user?.id;
      })
      .filter((m) => {
        if (!q) return true;
        const sender = maps.profilesById.get(m.senderId);
        const recip = maps.profilesById.get(m.recipientId);
        return `${m.subject} ${m.body} ${sender ? displayName(sender) : ""} ${recip ? displayName(recip) : ""}`
          .toLowerCase()
          .includes(q);
      });
  }, [workspace?.internalMessages, folder, search, user?.id, maps.profilesById]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeRecipient || !subject.trim() || !body.trim()) return;
    await mutateWorkspace(
      {
        type: "send_internal_message",
        payload: {
          senderId: user.id,
          recipientId: activeRecipient,
          subject: subject.trim(),
          body: body.trim(),
        },
      },
      "Message sent",
    );
    setSubject("");
    setBody("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Send private academy messages, search conversation history, and organize read or archived threads."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Panel title="Compose Message">
          <form className="space-y-3" onSubmit={(e) => void sendMessage(e)}>
            <label className="block space-y-1 text-sm font-medium">
              Recipient
              <select
                value={activeRecipient}
                onChange={(e) => setRecipientId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {db.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayName(p)} ({p.email})
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
                placeholder="Subject line"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Message
              <Textarea
                required
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a private message…"
              />
            </label>
            <Button
              type="submit"
              variant="emerald"
              disabled={mutating || !can("communication", "create")}
            >
              <Send className="h-4 w-4" /> Send Message
            </Button>
          </form>
        </Panel>

        <Panel
          title="Conversations"
          actions={
            <div className="flex flex-wrap gap-1.5">
              {(["inbox", "sent", "archived"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={folder === f ? "emerald" : "outline"}
                  onClick={() => setFolder(f)}
                  className="capitalize"
                >
                  {f}
                </Button>
              ))}
            </div>
          }
        >
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
              className="pl-9"
            />
          </div>

          {messages.length > 0 ? (
            <div className="space-y-3">
              {messages.map((m) => {
                const sender = maps.profilesById.get(m.senderId);
                const recip = maps.profilesById.get(m.recipientId);
                return (
                  <div key={m.id} className="rounded-xl border border-border p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{m.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          From {sender ? displayName(sender) : "User"} → To{" "}
                          {recip ? displayName(recip) : "User"} ·{" "}
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={m.read ? "muted" : "gold"}>
                        {m.read ? "Read" : "Unread"}
                      </Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {m.body}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void mutateWorkspace({
                            type: "update_internal_message",
                            id: m.id,
                            patch: { read: !m.read },
                          })
                        }
                      >
                        {m.read ? (
                          <Mail className="h-3.5 w-3.5" />
                        ) : (
                          <MailOpen className="h-3.5 w-3.5" />
                        )}
                        {m.read ? "Mark unread" : "Mark read"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void mutateWorkspace({
                            type: "update_internal_message",
                            id: m.id,
                            patch: { archived: !m.archived },
                          })
                        }
                      >
                        <Archive className="h-3.5 w-3.5" />
                        {m.archived ? "Unarchive" : "Archive"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          void mutateWorkspace(
                            {
                              type: "update_internal_message",
                              id: m.id,
                              patch: { deleted: true },
                            },
                            "Message deleted",
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No messages in this folder" icon={Mail} />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 5.3 ANNOUNCEMENTS                                                          */
/* ========================================================================== */

export function AnnouncementsModule({ data }: { data: OwnerDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, refreshAll, can } = data;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AppRole | "all">("all");
  const [published, setPublished] = useState(true);
  const [publishAt, setPublishAt] = useState(new Date().toISOString().slice(0, 16));
  const [targetClassId, setTargetClassId] = useState("");
  const [targetCourseId, setTargetCourseId] = useState("");
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setAudience("all");
    setPublished(true);
    setPublishAt(new Date().toISOString().slice(0, 16));
    setTargetClassId("");
    setTargetCourseId("");
  }

  async function saveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const isoDate = publishAt ? new Date(publishAt).toISOString() : new Date().toISOString();
      const payload = {
        title: title.trim(),
        body: body.trim(),
        audience: audience === "all" ? null : audience,
        published,
        publish_at: isoDate,
        created_by: user.id,
      };
      const res = editingId
        ? await supabase
            .from("announcements")
            .update(payload)
            .eq("id", editingId)
            .select("id")
            .single()
        : await supabase.from("announcements").insert(payload).select("id").single();
      if (res.error) throw new Error(res.error.message);
      const id = editingId ?? res.data?.id;
      if (id) {
        await mutateWorkspace({
          type: "upsert_announcement_meta",
          payload: {
            announcementId: id,
            targetClassId: targetClassId || null,
            targetCourseId: targetCourseId || null,
          },
        });
      }
      await logAudit(
        editingId ? "announcement_updated" : "announcement_created",
        "announcement",
        id,
        {
          title: payload.title,
        },
      );
      resetForm();
      await refreshAll(editingId ? "Announcement updated" : "Announcement saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save announcement");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnnouncement(id: string) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("announcement_deleted", "announcement", id, {});
    await refreshAll("Announcement deleted");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Publish or schedule academy announcements targeted to specific roles, classes, or courses."
      />

      {can("communication", "create") && (
        <Panel title={editingId ? "Edit Announcement" : "Create or Schedule Announcement"}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void saveAnnouncement(e)}>
            <label className="space-y-1 text-sm font-medium">
              Title
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Target Role
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as AppRole | "all")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All Users</option>
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}s
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Target Class (optional)
              <select
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Classes</option>
                {(workspace?.classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Target Course (optional)
              <select
                value={targetCourseId}
                onChange={(e) => setTargetCourseId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Courses</option>
                {db.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Publish Date & Time (supports future scheduling)
              <Input
                type="datetime-local"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 pt-6 text-sm font-medium">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Published (uncheck to save as draft)
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Announcement Body
              <Textarea required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="emerald" disabled={busy}>
                <Megaphone className="h-4 w-4" />
                {editingId ? "Save Changes" : "Publish / Schedule"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel Edit
                </Button>
              )}
            </div>
          </form>
        </Panel>
      )}

      <div className="space-y-3">
        {db.announcements.map((a) => {
          const meta = workspace?.announcementMeta[a.id];
          const isFuture = new Date(a.publish_at).getTime() > Date.now();
          return (
            <Panel key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{a.title}</h3>
                    <Badge variant={!a.published ? "muted" : isFuture ? "gold" : "success"}>
                      {!a.published ? "Draft" : isFuture ? "Scheduled" : "Published"}
                    </Badge>
                    {a.audience && <Badge variant="outline">{ROLE_LABEL[a.audience]}</Badge>}
                    {meta?.targetClassId && (
                      <Badge variant="secondary">
                        {maps.classesById.get(meta.targetClassId)?.name ?? "Class"}
                      </Badge>
                    )}
                    {meta?.targetCourseId && (
                      <Badge variant="secondary">
                        {maps.coursesById.get(meta.targetCourseId)?.title ?? "Course"}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Publish time: {new Date(a.publish_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {can("communication", "edit") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(a.id);
                        setTitle(a.title);
                        setBody(a.body);
                        setAudience(a.audience ?? "all");
                        setPublished(a.published);
                        setPublishAt(new Date(a.publish_at).toISOString().slice(0, 16));
                        setTargetClassId(meta?.targetClassId ?? "");
                        setTargetCourseId(meta?.targetCourseId ?? "");
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {can("communication", "delete") && (
                    <ConfirmButton
                      title="Delete announcement?"
                      confirmLabel="Delete"
                      onConfirm={() => void deleteAnnouncement(a.id)}
                      trigger={
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
        {db.announcements.length === 0 && (
          <EmptyState title="No announcements yet" icon={Megaphone} />
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 5.4 NOTIFICATIONS                                                          */
/* ========================================================================== */

export function NotificationsModule({ data }: { data: OwnerDataHandle }) {
  const { user } = useAuth();
  const { workspace, mutateWorkspace, can, mutating } = data;
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<SystemNotification["category"]>("system");
  const [targetRole, setTargetRole] = useState<AppRole | "all">("all");

  const list = workspace?.notifications ?? [];

  async function sendNotification(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    await mutateWorkspace(
      {
        type: "create_notification",
        payload: {
          title: title.trim(),
          message: message.trim(),
          category,
          targetRole,
          targetClassId: null,
        },
      },
      "Notification sent",
    );
    setTitle("");
    setMessage("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Send targeted system notifications to academy groups and manage read states."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Panel title="Broadcast Notification">
          <form className="space-y-3" onSubmit={(e) => void sendNotification(e)}>
            <label className="block space-y-1 text-sm font-medium">
              Title
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SystemNotification["category"])}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="system">System</option>
                <option value="academic">Academic</option>
                <option value="finance">Finance</option>
                <option value="communication">Communication</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Target Group
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as AppRole | "all")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All Academy Users</option>
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}s
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Message
              <Textarea
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <Button
              type="submit"
              variant="emerald"
              disabled={mutating || !can("communication", "create")}
            >
              <Plus className="h-4 w-4" /> Send Notification
            </Button>
          </form>
        </Panel>

        <Panel title={`Notification Feed (${list.length})`}>
          {list.length > 0 ? (
            <div className="space-y-3">
              {list.map((n) => {
                const isRead = user ? n.readBy.includes(user.id) : false;
                return (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-4 text-sm ${
                      isRead ? "border-border bg-card" : "border-primary/40 bg-primary/5"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{n.title}</span>
                          <Badge variant="outline" className="capitalize">
                            {n.category}
                          </Badge>
                          <Badge variant="secondary">
                            {n.targetRole === "all" ? "All users" : ROLE_LABEL[n.targetRole]}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">{n.message}</p>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {!isRead && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void mutateWorkspace({ type: "mark_notification_read", id: n.id })
                            }
                          >
                            <CheckCheck className="h-3.5 w-3.5" /> Read
                          </Button>
                        )}
                        {can("communication", "delete") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() =>
                              void mutateWorkspace(
                                { type: "delete_notification", id: n.id },
                                "Notification removed",
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No notifications yet" icon={Bell} />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 5.5 SUPPORT & FEEDBACK                                                     */
/* ========================================================================== */

export function SupportFeedbackModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, refreshAll, can } = data;
  const [statusFilter, setStatusFilter] = useState("all");

  const staffMembers = useMemo(
    () =>
      db.profiles.filter((p) => {
        const rs = maps.rolesByUser.get(p.id) ?? [];
        return rs.includes("owner") || rs.includes("admin");
      }),
    [db.profiles, maps.rolesByUser],
  );

  const tickets = useMemo(
    () =>
      db.messages.filter((m) => {
        const meta = workspace?.supportMeta[m.id];
        const status = meta?.workflowStatus ?? (m.status === "resolved" ? "resolved" : "open");
        if (statusFilter !== "all" && status !== statusFilter) return false;
        return true;
      }),
    [db.messages, workspace?.supportMeta, statusFilter],
  );

  async function saveTicket(
    msg: ContactMessageRow,
    workflowStatus: SupportTicketMeta["workflowStatus"],
    assignedTo: string | null,
    priority: SupportTicketMeta["priority"],
    reply: string,
    internalNote: string,
  ) {
    const dbStatus = workflowStatus === "resolved" ? "resolved" : "open";
    const { error } = await supabase
      .from("contact_messages")
      .update({ reply: reply.trim() || null, status: dbStatus })
      .eq("id", msg.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    await mutateWorkspace({
      type: "upsert_support_meta",
      payload: {
        messageId: msg.id,
        assignedTo,
        priority,
        workflowStatus,
        internalNote,
        updatedAt: new Date().toISOString(),
      },
    });
    await logAudit("support_ticket_updated", "contact_message", msg.id, {
      workflowStatus,
      assignedTo,
    });
    await refreshAll("Support ticket updated");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support & Feedback"
        description="Manage student & visitor inquiries, assign tickets to administrators, and track Open, In Progress, and Resolved states."
        actions={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Inquiries ({db.messages.length})</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        }
      />

      {tickets.length > 0 ? (
        <div className="space-y-4">
          {tickets.map((msg) => (
            <TicketCard
              key={msg.id}
              message={msg}
              meta={workspace?.supportMeta[msg.id]}
              staffMembers={staffMembers}
              canEdit={can("communication", "edit")}
              onSave={saveTicket}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No support tickets in this view"
          text="Inquiries submitted from the Contact page appear here."
          icon={LifeBuoy}
        />
      )}
    </div>
  );
}

function TicketCard({
  message,
  meta,
  staffMembers,
  canEdit,
  onSave,
}: {
  message: ContactMessageRow;
  meta: SupportTicketMeta | undefined;
  staffMembers: Array<{ id: string; first_name: string; last_name: string; email: string }>;
  canEdit: boolean;
  onSave: (
    msg: ContactMessageRow,
    workflowStatus: SupportTicketMeta["workflowStatus"],
    assignedTo: string | null,
    priority: SupportTicketMeta["priority"],
    reply: string,
    internalNote: string,
  ) => Promise<void>;
}) {
  const [status, setStatus] = useState<SupportTicketMeta["workflowStatus"]>(
    meta?.workflowStatus ?? (message.status === "resolved" ? "resolved" : "open"),
  );
  const [assignedTo, setAssignedTo] = useState(meta?.assignedTo ?? "");
  const [priority, setPriority] = useState<SupportTicketMeta["priority"]>(
    meta?.priority ?? "normal",
  );
  const [reply, setReply] = useState(message.reply ?? "");
  const [internalNote, setInternalNote] = useState(meta?.internalNote ?? "");

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{message.subject || "General Inquiry"}</h3>
          <p className="text-xs text-muted-foreground">
            {message.name} · {message.email} · {new Date(message.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {priority} priority
          </Badge>
          <Badge variant={STATUS_BADGE[status] ?? "warning"} className="capitalize">
            {status.replace("_", " ")}
          </Badge>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-secondary/40 p-3.5 text-sm">
        {message.message}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-medium">
          Ticket Status
          <select
            disabled={!canEdit}
            value={status}
            onChange={(e) => setStatus(e.target.value as SupportTicketMeta["workflowStatus"])}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          Assign to Staff
          <select
            disabled={!canEdit}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Unassigned</option>
            {staffMembers.map((s) => (
              <option key={s.id} value={s.id}>
                {displayName(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          Priority
          <select
            disabled={!canEdit}
            value={priority}
            onChange={(e) => setPriority(e.target.value as SupportTicketMeta["priority"])}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium">
          Official Reply
          <Textarea
            rows={2}
            disabled={!canEdit}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write response to inquirer…"
          />
        </label>
        <label className="space-y-1 text-xs font-medium">
          Internal Staff Notes
          <Textarea
            rows={2}
            disabled={!canEdit}
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            placeholder="Internal follow-up note…"
          />
        </label>
      </div>

      {canEdit && (
        <div className="mt-3">
          <Button
            size="sm"
            variant="emerald"
            onClick={() =>
              void onSave(message, status, assignedTo || null, priority, reply, internalNote)
            }
          >
            Save Ticket Update
          </Button>
        </div>
      )}
    </Panel>
  );
}
