import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  CheckCheck,
  CreditCard,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  KeyRound,
  Lock,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquareHeart,
  Paperclip,
  Plus,
  Printer,
  Receipt,
  Search,
  Send,
  Settings,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, useAuth } from "@/lib/auth";
import { formatETB, PRO_PRICE_ETB } from "@/lib/access";
import { paginateRows } from "@/lib/owner/logic";
import type { ProfileCorrectionRequest } from "@/lib/owner/types";
import {
  ACCOUNT_HOLDER,
  MAX_RECEIPT_MB,
  ONLINE_METHOD,
  PAYMENT_ACCOUNTS,
  PAYMENT_METHODS,
  RECEIPT_ACCEPT,
  RECEIPT_BUCKET,
  YEBUNA_PAY_URL,
  receiptPath,
  validateReceiptFile,
} from "@/lib/payment-info";
import type { StudentSubmenuId } from "@/lib/student/types";
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
  EmptyState,
  PageHeader,
  Pager,
  Panel,
  STATUS_BADGE,
  StatCard,
} from "@/components/dashboard/ui";
import type { StudentDataHandle } from "./useStudentData";

/* ========================================================================== */
/* 4.1 MESSAGES                                                               */
/* ========================================================================== */

export function StudentMessagesModule({ data }: { data: StudentDataHandle }) {
  const { user } = useAuth();
  const { workspace, maps, mutateWorkspace, can, mutating } = data;
  const [box, setBox] = useState<"inbox" | "sent">("inbox");
  const [search, setSearch] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const recipients = maps.recipients;
  const activeRecipientId = recipientId || recipients[0]?.id || "";

  const messages = useMemo(() => {
    if (!user) return [];
    const q = search.trim().toLowerCase();
    return (workspace?.internalMessages ?? []).filter((m) => {
      if (m.deleted) return false;
      const inBox = box === "inbox" ? m.recipientId === user.id : m.senderId === user.id;
      if (!inBox) return false;
      if (!q) return true;
      const otherId = box === "inbox" ? m.senderId : m.recipientId;
      const other = maps.profilesById.get(otherId);
      return `${m.subject} ${m.body} ${other ? displayName(other) : ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [box, maps.profilesById, search, user, workspace?.internalMessages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeRecipientId || !subject.trim() || !body.trim()) return;
    await mutateWorkspace(
      {
        type: "send_internal_message",
        payload: {
          senderId: user.id,
          recipientId: activeRecipientId,
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
        description="Private communication with your course instructors and academy support staff."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <Panel title="Compose Message">
          {!can("communication", "create") ? (
            <p className="text-sm text-muted-foreground">
              Messaging permissions are currently read-only for your account.
            </p>
          ) : recipients.length === 0 ? (
            <EmptyState
              title="No authorized recipients available"
              text="Instructors of your enrolled courses and academy staff appear here."
              icon={Mail}
            />
          ) : (
            <form onSubmit={(e) => void sendMessage(e)} className="space-y-3">
              <div>
                <Label htmlFor="msg-recipient">Recipient</Label>
                <select
                  id="msg-recipient"
                  value={activeRecipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {displayName(r)} ({r.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="msg-subject">Subject</Label>
                <Input
                  id="msg-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Question about lesson or assignment"
                  required
                />
              </div>
              <div>
                <Label htmlFor="msg-body">Message</Label>
                <Textarea
                  id="msg-body"
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message…"
                  required
                />
              </div>
              <Button type="submit" variant="emerald" disabled={mutating}>
                <Send className="h-4 w-4" /> Send Message
              </Button>
            </form>
          )}
        </Panel>

        <Panel title={box === "inbox" ? "Inbox" : "Sent Messages"}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5 rounded-lg bg-secondary/70 p-1">
              <button
                type="button"
                onClick={() => setBox("inbox")}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  box === "inbox" ? "bg-card shadow-sm" : "text-muted-foreground"
                }`}
              >
                Inbox
              </button>
              <button
                type="button"
                onClick={() => setBox("sent")}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  box === "sent" ? "bg-card shadow-sm" : "text-muted-foreground"
                }`}
              >
                Sent
              </button>
            </div>
            <div className="relative w-52">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages…"
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>

          {messages.length === 0 ? (
            <EmptyState
              title={`No messages in ${box}`}
              text="Messages with your instructors and academy staff appear here."
              icon={Mail}
            />
          ) : (
            <div className="space-y-2.5">
              {messages.map((m) => {
                const otherId = box === "inbox" ? m.senderId : m.recipientId;
                const other = maps.profilesById.get(otherId);
                return (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-3.5 ${
                      !m.read && box === "inbox"
                        ? "border-primary/40 bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{m.subject}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {box === "inbox" ? "From" : "To"}:{" "}
                          {other ? displayName(other) : "Academy Team"} ·{" "}
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {box === "inbox" && !m.read && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void mutateWorkspace({
                              type: "update_internal_message",
                              id: m.id,
                              patch: { read: true },
                            })
                          }
                        >
                          <CheckCheck className="h-3.5 w-3.5" /> Mark Read
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-foreground/90 whitespace-pre-wrap">{m.body}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 4.2 PARENT COMMUNICATION                                                   */
/* ========================================================================== */

export function StudentParentCommModule({ data }: { data: StudentDataHandle }) {
  const { user } = useAuth();
  const { workspace, maps, mutateWorkspace, can, mutating } = data;
  const [parentId, setParentId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const parents = maps.parents;
  const activeParentId = parentId || parents[0]?.id || "";
  const thread = workspace?.parentMessages ?? [];

  async function sendToParent(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeParentId || !subject.trim() || !body.trim()) return;
    await mutateWorkspace(
      {
        type: "send_parent_message",
        payload: {
          parentId: activeParentId,
          studentId: user.id,
          senderId: user.id,
          senderRole: "student",
          subject: subject.trim(),
          body: body.trim(),
          includeSnapshot: false,
          snapshotSummary: null,
        },
      },
      "Message sent to linked parent",
    );
    setSubject("");
    setBody("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent Communication"
        description="View linked parent updates shared by instructors or administration and message your linked parent or guardian."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <Panel title="Linked Parent / Guardian">
          {parents.length === 0 ? (
            <EmptyState
              title="No parent account linked yet"
              text="Once a parent or guardian account is linked to your student profile, updates and messaging appear here."
              icon={MessageSquareHeart}
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {parents.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-secondary/35 p-3">
                    <p className="text-sm font-semibold">{displayName(p)}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </div>
                ))}
              </div>
              {can("communication", "create") && (
                <form onSubmit={(e) => void sendToParent(e)} className="space-y-3 border-t border-border pt-3">
                  <div>
                    <Label htmlFor="par-target">Message Linked Parent</Label>
                    <select
                      id="par-target"
                      value={activeParentId}
                      onChange={(e) => setParentId(e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    >
                      {parents.map((p) => (
                        <option key={p.id} value={p.id}>
                          {displayName(p)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                    required
                  />
                  <Textarea
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Share a quick progress note…"
                    required
                  />
                  <Button type="submit" variant="emerald" disabled={mutating}>
                    <Send className="h-4 w-4" /> Send Note
                  </Button>
                </form>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Shared Parent Communication Log">
          {thread.length === 0 ? (
            <EmptyState
              title="No parent communication entries yet"
              text="Progress updates and messages associated with your linked parent account appear here."
              icon={MessageSquareHeart}
            />
          ) : (
            <div className="space-y-3">
              {thread.map((pm) => {
                const sender = maps.profilesById.get(pm.senderId);
                return (
                  <div key={pm.id} className="rounded-xl border border-border p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{pm.subject}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          From {sender ? displayName(sender) : pm.senderRole} ·{" "}
                          {new Date(pm.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!pm.read && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void mutateWorkspace({ type: "mark_parent_message_read", id: pm.id })
                          }
                        >
                          Mark Read
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-foreground/90 whitespace-pre-wrap">{pm.body}</p>
                    {pm.snapshotSummary && (
                      <p className="mt-2 rounded-lg bg-secondary/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                        {pm.snapshotSummary}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 4.3 DISCUSSION FORUMS                                                      */
/* ========================================================================== */

export function StudentDiscussionForumsModule({ data }: { data: StudentDataHandle }) {
  const { user } = useAuth();
  const { workspace, maps, mutateWorkspace, can, mutating } = data;
  const [courseFilter, setCourseFilter] = useState("all");
  const [newCourseId, setNewCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [replyTextByThread, setReplyTextByThread] = useState<Record<string, string>>({});

  const targetCourseId = newCourseId || maps.myCourses[0]?.id || "";

  const threads = useMemo(() => {
    return (workspace?.discussionThreads ?? []).filter(
      (t) => courseFilter === "all" || t.courseId === courseFilter,
    );
  }, [courseFilter, workspace?.discussionThreads]);

  async function createThread(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !targetCourseId || !title.trim() || !body.trim()) return;
    await mutateWorkspace(
      {
        type: "upsert_discussion_thread",
        payload: {
          id: crypto.randomUUID(),
          courseId: targetCourseId,
          authorId: user.id,
          authorRole: "student",
          title: title.trim(),
          body: body.trim(),
          pinned: false,
          locked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      "Discussion topic posted",
    );
    setTitle("");
    setBody("");
  }

  async function postReply(threadId: string, courseId: string) {
    const text = (replyTextByThread[threadId] ?? "").trim();
    if (!user || !text) return;
    await mutateWorkspace(
      {
        type: "add_discussion_post",
        payload: {
          threadId,
          courseId,
          authorId: user.id,
          authorRole: "student",
          body: text,
        },
      },
      "Reply posted",
    );
    setReplyTextByThread((prev) => ({ ...prev, [threadId]: "" }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discussion Forums"
        description="Ask course questions, share takeaways, and participate in instructor-moderated course discussions."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Panel title="Start New Topic">
          {!can("communication", "create") || maps.myCourses.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Enroll in a course with active discussions to start a topic.
            </p>
          ) : (
            <form onSubmit={(e) => void createThread(e)} className="space-y-3">
              <div>
                <Label htmlFor="disc-course">Course</Label>
                <select
                  id="disc-course"
                  value={targetCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {maps.myCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Topic title"
                required
              />
              <Textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe your question or study insight…"
                required
              />
              <Button type="submit" variant="emerald" disabled={mutating}>
                <Plus className="h-4 w-4" /> Post Discussion
              </Button>
            </form>
          )}
        </Panel>

        <Panel title="Course Threads">
          <div className="mb-4">
            <select
              aria-label="Filter discussions by course"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
            >
              <option value="all">All My Courses</option>
              {maps.myCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {threads.length === 0 ? (
            <EmptyState
              title="No discussion threads yet"
              text="Course discussions from your instructors and classmates appear here."
              icon={MessageSquare}
            />
          ) : (
            <div className="space-y-4">
              {threads.map((t) => {
                const author = maps.profilesById.get(t.authorId);
                const posts = (workspace?.discussionPosts ?? []).filter(
                  (p) => p.threadId === t.id,
                );
                return (
                  <div key={t.id} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {maps.coursesById.get(t.courseId)?.title ?? "Course"} ·{" "}
                          {author ? displayName(author) : t.authorRole} ·{" "}
                          {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                        <h3 className="mt-0.5 text-sm font-semibold">{t.title}</h3>
                      </div>
                      {t.locked && (
                        <Badge variant="muted">
                          <Lock className="mr-1 h-3 w-3" /> Locked
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap">{t.body}</p>

                    {posts.length > 0 && (
                      <div className="space-y-2 border-t border-border pt-3">
                        {posts.map((p) => {
                          const pAuthor = maps.profilesById.get(p.authorId);
                          return (
                            <div key={p.id} className="rounded-lg bg-secondary/45 px-3 py-2 text-xs">
                              <p className="font-semibold">
                                {pAuthor ? displayName(pAuthor) : p.authorRole}{" "}
                                <span className="font-normal text-muted-foreground">
                                  · {new Date(p.createdAt).toLocaleString()}
                                </span>
                              </p>
                              <p className="mt-0.5">{p.body}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!t.locked && can("communication", "create") && (
                      <div className="flex gap-2 pt-1">
                        <Input
                          value={replyTextByThread[t.id] ?? ""}
                          onChange={(e) =>
                            setReplyTextByThread((prev) => ({
                              ...prev,
                              [t.id]: e.target.value,
                            }))
                          }
                          placeholder="Write a reply…"
                          className="h-9 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={mutating || !(replyTextByThread[t.id] ?? "").trim()}
                          onClick={() => void postReply(t.id, t.courseId)}
                        >
                          Reply
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 4.4 ANNOUNCEMENTS                                                          */
/* ========================================================================== */

export function StudentAnnouncementsModule({ data }: { data: StudentDataHandle }) {
  const { db, workspace, maps } = data;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.announcements.filter((a) => {
      const meta = workspace?.announcementMeta[a.id];
      if (meta?.targetCourseId && !maps.enrolledCourseIdSet.has(meta.targetCourseId)) {
        return false;
      }
      if (!q) return true;
      return `${a.title} ${a.body}`.toLowerCase().includes(q);
    });
  }, [db.announcements, maps.enrolledCourseIdSet, search, workspace?.announcementMeta]);

  const { items: rows, pageCount, page: safePage } = paginateRows(filtered, page, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Important course updates, class notices, and academy announcements."
      />

      <Panel>
        <div className="mb-4 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search announcements…"
            className="pl-9"
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No announcements found"
            text="Published notices for your courses and cohort will appear here."
            icon={Megaphone}
          />
        ) : (
          <div className="divide-y divide-border">
            {rows.map((a) => {
              const meta = workspace?.announcementMeta[a.id];
              const courseTitle = meta?.targetCourseId
                ? maps.coursesById.get(meta.targetCourseId)?.title
                : null;
              return (
                <article key={a.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{a.title}</h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {courseTitle ? `${courseTitle} · ` : "Academy Notice · "}
                      {new Date(a.publish_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground whitespace-pre-wrap">
                    {a.body}
                  </p>
                </article>
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
/* 4.5 NOTIFICATIONS                                                          */
/* ========================================================================== */

export function StudentNotificationsModule({
  data,
  onNavigate,
}: {
  data: StudentDataHandle;
  onNavigate: (menu: StudentSubmenuId) => void;
}) {
  const { user } = useAuth();
  const { workspace, mutateWorkspace } = data;
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const list = useMemo(() => {
    const raw = workspace?.notifications ?? [];
    if (filter === "unread" && user) {
      return raw.filter((n) => !n.readBy.includes(user.id));
    }
    return raw;
  }, [filter, user, workspace?.notifications]);

  function destinationForCategory(cat: string): StudentSubmenuId {
    if (cat === "finance") return "my-fees";
    if (cat === "academic") return "my-courses";
    if (cat === "communication") return "messages";
    return "account-settings";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Real-time alerts for deadlines, grades, enrollment approvals, and payment updates."
      />

      <Panel>
        <div className="mb-4 flex gap-1.5 rounded-lg bg-secondary/70 p-1 w-fit">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              filter === "all" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            All Alerts
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              filter === "unread" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            Unread
          </button>
        </div>

        {list.length === 0 ? (
          <EmptyState
            title="No notifications in this view"
            text="Updates regarding assignments, grades, enrollments, and payments appear here."
            icon={Bell}
          />
        ) : (
          <div className="space-y-2.5">
            {list.map((n) => {
              const isRead = user ? n.readBy.includes(user.id) : true;
              return (
                <div
                  key={n.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${
                    !isRead ? "border-primary/40 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      {n.category} · {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigate(destinationForCategory(n.category))}
                    >
                      Open
                    </Button>
                    {!isRead && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void mutateWorkspace({ type: "mark_notification_read", id: n.id })
                        }
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Read
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 5.1 MY FEES                                                                */
/* ========================================================================== */

export function StudentFeesModule({
  data,
  onNavigate,
}: {
  data: StudentDataHandle;
  onNavigate: (menu: StudentSubmenuId) => void;
}) {
  const { workspace, maps } = data;
  const feePlans = useMemo(() => workspace?.feePlans ?? [], [workspace?.feePlans]);

  const totals = useMemo(() => {
    let net = 0;
    let paid = 0;
    let outstanding = 0;
    for (const f of feePlans) {
      const fNet = Math.max(0, f.amount - f.discount);
      net += fNet;
      paid += f.paidAmount;
      outstanding += Math.max(0, fNet - f.paidAmount);
    }
    return { net, paid, outstanding };
  }, [feePlans]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Fees"
        description="Assigned tuition plans, applicable discounts, verified payments, and remaining balances."
        actions={
          <Button
            type="button"
            variant="emerald"
            size="sm"
            onClick={() => onNavigate("make-payment")}
          >
            <CreditCard className="h-4 w-4" /> Make a Payment
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Assigned Fees"
          value={<span className="tabular-nums">{formatETB(totals.net)}</span>}
          icon={Wallet}
          index={0}
        />
        <StatCard
          label="Verified Paid"
          value={<span className="tabular-nums">{formatETB(totals.paid)}</span>}
          icon={FileCheck2}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Outstanding Balance"
          value={<span className="tabular-nums">{formatETB(totals.outstanding)}</span>}
          icon={CreditCard}
          tone="deep"
          index={2}
        />
      </div>

      <Panel title="Fee Breakdown">
        {feePlans.length === 0 ? (
          <EmptyState
            title="No assigned tuition fee plans"
            text="Any course upgrade fees or cohort tuition plans assigned to your account appear here."
            icon={Wallet}
            action={
              <Button type="button" variant="outline" onClick={() => onNavigate("make-payment")}>
                Unlock a Course
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Plan</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Net Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feePlans.map((fp) => {
                const net = Math.max(0, fp.amount - fp.discount);
                const balance = Math.max(0, net - fp.paidAmount);
                return (
                  <TableRow key={fp.id}>
                    <TableCell className="font-semibold">{fp.title}</TableCell>
                    <TableCell className="text-xs">
                      {fp.courseId ? maps.coursesById.get(fp.courseId)?.title ?? "Course" : "General"}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatETB(net)}</TableCell>
                    <TableCell className="tabular-nums">{formatETB(fp.paidAmount)}</TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {formatETB(balance)}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{fp.dueDate}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          fp.status === "paid"
                            ? "success"
                            : fp.status === "overdue"
                              ? "destructive"
                              : "warning"
                        }
                        className="capitalize"
                      >
                        {fp.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 5.2 MAKE A PAYMENT                                                         */
/* ========================================================================== */

export function StudentMakePaymentModule({
  data,
  onNavigate,
}: {
  data: StudentDataHandle;
  onNavigate: (menu: StudentSubmenuId) => void;
}) {
  const { user } = useAuth();
  const { db, workspace, refreshAll } = data;
  const [courseId, setCourseId] = useState(() => db.courses[0]?.id ?? "");
  const [method, setMethod] = useState(ONLINE_METHOD);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const activeCourseId = courseId || db.courses[0]?.id || "";
  const feeMatch = (workspace?.feePlans ?? []).find((f) => f.courseId === activeCourseId);
  const metaPrice = workspace?.courseMeta[activeCourseId]?.priceEtb;
  const payableAmount = feeMatch
    ? Math.max(1, feeMatch.amount - feeMatch.discount - feeMatch.paidAmount)
    : metaPrice && metaPrice > 0
      ? metaPrice
      : PRO_PRICE_ETB;

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!activeCourseId) {
      toast.error("Choose a course or fee item first.");
      return;
    }
    const cleanRef = reference.trim();
    if (cleanRef.length < 4) {
      toast.error("Enter a valid transaction reference (at least 4 characters).");
      return;
    }
    if (
      db.payments.some(
        (p) => p.reference.trim().toLowerCase() === cleanRef.toLowerCase(),
      )
    ) {
      toast.error("This transaction reference has already been submitted.");
      return;
    }

    setSubmitting(true);
    let uploadedPath: string | null = null;
    try {
      if (file) {
        const problem = validateReceiptFile(file);
        if (problem) throw new Error(problem);
        uploadedPath = receiptPath(user.id, file.name);
        const { error: upErr } = await supabase.storage
          .from(RECEIPT_BUCKET)
          .upload(uploadedPath, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(`Receipt upload failed: ${upErr.message}`);
      }

      const { error } = await supabase.from("payments").insert({
        user_id: user.id,
        course_id: activeCourseId,
        method,
        reference: cleanRef,
        note: note.trim() || null,
        amount: payableAmount,
        receipt_path: uploadedPath,
      });

      if (error) {
        if (uploadedPath) await supabase.storage.from(RECEIPT_BUCKET).remove([uploadedPath]);
        if (error.code === "23505") {
          throw new Error("You already have an active or pending payment for this course.");
        }
        throw new Error(error.message);
      }

      setReference("");
      setNote("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await refreshAll("Payment submitted — pending verification by academy staff.");
      onNavigate("payment-history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Make a Payment"
        description="Pay online or via bank/mobile transfer and submit your transaction reference and receipt. Payments remain pending until verified by staff."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Academy Payment Accounts">
          <div className="space-y-4">
            <div className="rounded-xl border border-gold/40 bg-gold/10 p-4">
              <p className="text-xs font-semibold text-muted-foreground">Account Holder</p>
              <p className="text-base font-semibold">{ACCOUNT_HOLDER}</p>
              <Button asChild variant="emerald" size="sm" className="mt-3">
                <a href={YEBUNA_PAY_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Pay Online via Ye-Buna
                </a>
              </Button>
            </div>

            <div className="divide-y divide-border rounded-xl border border-border">
              {PAYMENT_ACCOUNTS.map((acc) => (
                <div key={acc.method} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                  <span className="font-semibold">{acc.label}</span>
                  <span className="font-mono font-bold text-primary select-all">{acc.number}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Submit Payment Receipt">
          <form onSubmit={(e) => void submitPayment(e)} className="space-y-4">
            <div>
              <Label htmlFor="pay-course">Course / Fee Item</Label>
              <select
                id="pay-course"
                value={activeCourseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                {db.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="pay-method">Payment Method</Label>
                <select
                  id="pay-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pay-amount">Amount</Label>
                <Input
                  id="pay-amount"
                  value={formatETB(payableAmount)}
                  readOnly
                  className="mt-1 bg-secondary/40 font-semibold tabular-nums"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="pay-ref">Transaction Reference</Label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. FT24321ABCD"
                required
              />
            </div>

            <div>
              <Label htmlFor="pay-receipt">
                Payment Receipt (Photo, Screenshot or PDF · Max {MAX_RECEIPT_MB}MB)
              </Label>
              <input
                ref={fileRef}
                id="pay-receipt"
                type="file"
                accept={RECEIPT_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const chosen = e.target.files?.[0] ?? null;
                  if (!chosen) return;
                  const err = validateReceiptFile(chosen);
                  if (err) {
                    toast.error(err);
                    e.target.value = "";
                    return;
                  }
                  setFile(chosen);
                }}
              />
              {file ? (
                <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-secondary/40 px-3 py-2.5 text-xs">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{file.name}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="pay-receipt"
                  className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-secondary/25 px-4 py-5 text-center text-xs hover:border-primary"
                >
                  <Paperclip className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Attach payment receipt</span>
                  <span className="text-muted-foreground">JPG, PNG, or PDF up to {MAX_RECEIPT_MB}MB</span>
                </label>
              )}
            </div>

            <div>
              <Label htmlFor="pay-note">Note (optional)</Label>
              <Input
                id="pay-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any reference details for the finance team"
              />
            </div>

            <Button type="submit" variant="emerald" className="w-full" disabled={submitting}>
              <Send className="h-4 w-4" /> Submit Payment ({formatETB(payableAmount)})
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 5.3 PAYMENT HISTORY                                                        */
/* ========================================================================== */

export function StudentPaymentHistoryModule({ data }: { data: StudentDataHandle }) {
  const { db, maps, getSignedReceiptUrl } = data;
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [receiptDialog, setReceiptDialog] = useState<{
    reference: string;
    url: string;
    isPdf: boolean;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return `${p.reference} ${p.method} ${maps.coursesById.get(p.course_id)?.title ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [db.payments, maps.coursesById, search, statusFilter]);

  const { items: rows, pageCount, page: safePage } = paginateRows(filtered, page, 8);

  async function inspectReceipt(ref: string, path: string | null) {
    if (!path) {
      toast.info("No receipt file was uploaded with this payment.");
      return;
    }
    const url = await getSignedReceiptUrl(path);
    if (!url) return;
    setReceiptDialog({
      reference: ref,
      url,
      isPdf: path.toLowerCase().endsWith(".pdf"),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment History"
        description="Chronological record of all submitted tuition and course upgrade payments."
      />

      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5 rounded-lg bg-secondary/70 p-1">
            {(["all", "pending", "approved", "rejected"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                  statusFilter === st ? "bg-card shadow-sm" : "text-muted-foreground"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search reference or course…"
              className="pl-9"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No payment transactions found"
            text="Submitted payments and verification statuses will appear here."
            icon={Receipt}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Method &amp; Reference</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {new Date(p.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {maps.coursesById.get(p.course_id)?.title ?? "Course"}
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-xs font-semibold">{p.reference}</p>
                    <p className="text-xs text-muted-foreground">{p.method}</p>
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {formatETB(Number(p.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[p.status] ?? "muted"} className="capitalize">
                      {p.status}
                    </Badge>
                    {p.review_note && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{p.review_note}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.receipt_path ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void inspectReceipt(p.reference, p.receipt_path)}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager page={safePage} pageCount={pageCount} onPage={setPage} />
      </Panel>

      <Dialog open={!!receiptDialog} onOpenChange={(open) => !open && setReceiptDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Uploaded Receipt · {receiptDialog?.reference}</DialogTitle>
            <DialogDescription>Private signed receipt link valid for 10 minutes.</DialogDescription>
          </DialogHeader>
          {receiptDialog && (
            <div className="space-y-3">
              {!receiptDialog.isPdf && (
                <img
                  src={receiptDialog.url}
                  alt="Uploaded payment receipt"
                  className="max-h-80 w-full rounded-xl border border-border object-contain"
                />
              )}
              <Button asChild variant="emerald" className="w-full">
                <a href={receiptDialog.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open / Download Receipt File
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 5.4 INVOICES & RECEIPTS                                                    */
/* ========================================================================== */

export function StudentInvoicesReceiptsModule({ data }: { data: StudentDataHandle }) {
  const { profile } = useAuth();
  const { db, workspace, maps, setPrintable } = data;
  const invoices = workspace?.invoices ?? [];
  const approvedPayments = db.payments.filter((p) => p.status === "approved");

  function printInvoice(invId: string) {
    const inv = invoices.find((i) => i.id === invId);
    if (!inv) return;
    setPrintable({
      title: `Invoice ${inv.invoiceNumber}`,
      subtitle: `${profile ? displayName(profile) : "Student"} · ${maps.coursesById.get(inv.courseId ?? "")?.title ?? "Tuition"}`,
      meta: [
        { label: "Status", value: inv.status.toUpperCase() },
        { label: "Issued Date", value: new Date(inv.issuedAt).toLocaleDateString() },
        { label: "Due Date", value: inv.dueDate },
      ],
      columns: ["Item", "Amount"],
      rows: [
        ["Subtotal", formatETB(inv.subtotal)],
        ["Discount", formatETB(inv.discount)],
        ["Total Due", formatETB(inv.total)],
        ["Paid Amount", formatETB(inv.paidAmount)],
        ["Remaining Balance", formatETB(Math.max(0, inv.total - inv.paidAmount))],
      ],
      footerNote: inv.notes || "Official Ezana Academy invoice copy.",
    });
  }

  function printReceipt(paymentId: string) {
    const p = approvedPayments.find((x) => x.id === paymentId);
    if (!p) return;
    setPrintable({
      title: `Official Payment Receipt · ${p.reference}`,
      subtitle: `${profile ? displayName(profile) : "Student"} · ${maps.coursesById.get(p.course_id)?.title ?? "Course"}`,
      meta: [
        { label: "Status", value: "APPROVED / VERIFIED" },
        { label: "Method", value: p.method },
        { label: "Date", value: new Date(p.created_at).toLocaleDateString() },
      ],
      columns: ["Detail", "Value"],
      rows: [
        ["Transaction Reference", p.reference],
        ["Course", maps.coursesById.get(p.course_id)?.title ?? p.course_id],
        ["Amount Paid", formatETB(Number(p.amount))],
        ["Verification Note", p.review_note ?? "Verified by Ezana Finance"],
      ],
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Receipts"
        description="Inspect and print itemized student tuition invoices and verified payment receipts."
      />

      <Panel title="Itemized Tuition Invoices">
        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices issued yet"
            text="Official invoices issued for your tuition or course plans appear here."
            icon={FileCheck2}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs font-bold">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-xs">
                    {inv.courseId ? maps.coursesById.get(inv.courseId)?.title ?? "Course" : "Tuition"}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatETB(inv.total)}</TableCell>
                  <TableCell className="tabular-nums">{formatETB(inv.paidAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[inv.status] ?? "secondary"} className="capitalize">
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => printInvoice(inv.id)}
                    >
                      <Printer className="h-3.5 w-3.5" /> Print Invoice
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel title="Verified Payment Receipts">
        {approvedPayments.length === 0 ? (
          <EmptyState
            title="No verified payment receipts yet"
            text="Approved receipts ready to print appear here once verified by Ezana staff."
            icon={Receipt}
          />
        ) : (
          <div className="divide-y divide-border">
            {approvedPayments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {maps.coursesById.get(p.course_id)?.title ?? "Course"} ·{" "}
                    <span className="font-mono text-xs">{p.reference}</span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {p.method} · {formatETB(Number(p.amount))} ·{" "}
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => printReceipt(p.id)}
                >
                  <Printer className="h-3.5 w-3.5" /> Print Receipt
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 6.1 MY PROFILE                                                             */
/* ========================================================================== */

export function StudentProfileModule({ data }: { data: StudentDataHandle }) {
  const { user, profile, refresh } = useAuth();
  const { workspace, maps, mutateWorkspace, mutating } = data;
  const meta = workspace?.myStudentMeta;

  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [address, setAddress] = useState(meta?.address ?? "");
  const [guardianName, setGuardianName] = useState(meta?.guardianName ?? "");
  const [guardianPhone, setGuardianPhone] = useState(meta?.guardianPhone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [corrField, setCorrField] =
    useState<ProfileCorrectionRequest["field"]>("studentCode");
  const [corrValue, setCorrValue] = useState("");
  const [corrReason, setCorrReason] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
          bio: bio.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw new Error(error.message);

      await mutateWorkspace({
        type: "upsert_student_meta",
        payload: {
          userId: user.id,
          studentCode: meta?.studentCode ?? "",
          classSectionId: meta?.classSectionId ?? null,
          academicYearId: meta?.academicYearId ?? null,
          dateOfBirth: meta?.dateOfBirth ?? "",
          notes: meta?.notes ?? "",
          address: address.trim(),
          guardianName: guardianName.trim(),
          guardianPhone: guardianPhone.trim(),
        },
      });
      await refresh();
      toast.success("Student profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !corrValue.trim() || !corrReason.trim()) return;
    await mutateWorkspace(
      {
        type: "request_profile_correction",
        payload: {
          studentId: user.id,
          field: corrField,
          requestedValue: corrValue.trim(),
          reason: corrReason.trim(),
        },
      },
      "Correction request submitted to academy administration",
    );
    setCorrValue("");
    setCorrReason("");
  }

  const assignedClass = meta?.classSectionId ? maps.classesById.get(meta.classSectionId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Manage your contact details and inspect your official academy student identification and cohort records."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Editable Contact & Personal Details">
          <form onSubmit={(e) => void saveProfile(e)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="prof-first">First Name</Label>
                <Input
                  id="prof-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="prof-last">Last Name</Label>
                <Input
                  id="prof-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="prof-phone">Phone Number</Label>
                <Input
                  id="prof-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+251 9…"
                />
              </div>
              <div>
                <Label htmlFor="prof-address">Address / City</Label>
                <Input
                  id="prof-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Addis Ababa, Ethiopia"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="prof-gname">Emergency / Guardian Name</Label>
                <Input
                  id="prof-gname"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="prof-gphone">Guardian Phone</Label>
                <Input
                  id="prof-gphone"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="prof-bio">Learning Bio</Label>
              <Textarea
                id="prof-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share what skills or goals you are studying for…"
              />
            </div>
            <Button type="submit" variant="emerald" disabled={savingProfile || mutating}>
              Save Contact Details
            </Button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title="Official Academy Identity (Read-Only)">
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-muted-foreground">Student ID</p>
                <p className="mt-0.5 font-mono text-sm font-bold">
                  {meta?.studentCode || "Assigned"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-muted-foreground">Email Address</p>
                <p className="mt-0.5 font-semibold">{profile?.email ?? user?.email}</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-muted-foreground">Assigned Class / Section</p>
                <p className="mt-0.5 font-semibold">
                  {assignedClass
                    ? `${assignedClass.name} (${assignedClass.sectionCode})`
                    : "General Enrollment"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-muted-foreground">Enrolled Courses</p>
                <p className="mt-0.5 font-semibold tabular-nums">{maps.myCourses.length}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Request Record Correction">
            <form onSubmit={(e) => void submitCorrection(e)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="corr-field">Field</Label>
                  <select
                    id="corr-field"
                    value={corrField}
                    onChange={(e) =>
                      setCorrField(e.target.value as ProfileCorrectionRequest["field"])
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="studentCode">Student ID Code</option>
                    <option value="dateOfBirth">Date of Birth</option>
                    <option value="classSection">Class / Section</option>
                    <option value="guardianName">Guardian Link</option>
                    <option value="other">Other Official Field</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="corr-val">Correct Value</Label>
                  <Input
                    id="corr-val"
                    value={corrValue}
                    onChange={(e) => setCorrValue(e.target.value)}
                    placeholder="Requested value"
                    required
                  />
                </div>
              </div>
              <Input
                value={corrReason}
                onChange={(e) => setCorrReason(e.target.value)}
                placeholder="Reason for correction request"
                required
              />
              <Button type="submit" variant="outline" size="sm" disabled={mutating}>
                Submit Correction Request
              </Button>
            </form>

            {(workspace?.profileCorrectionRequests ?? []).length > 0 && (
              <div className="mt-4 divide-y divide-border border-t border-border pt-3">
                {(workspace?.profileCorrectionRequests ?? []).map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-2 py-2 text-xs"
                  >
                    <span>
                      <strong>{req.field}</strong> → {req.requestedValue}
                    </span>
                    <Badge variant={STATUS_BADGE[req.status] ?? "warning"} className="capitalize">
                      {req.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 6.2 ACCOUNT SETTINGS                                                       */
/* ========================================================================== */

export function StudentAccountSettingsModule({ data }: { data: StudentDataHandle }) {
  const { workspace, mutateWorkspace, mutating } = data;
  const prefs = workspace?.myAccountPrefs;
  const [language, setLanguage] = useState<"en" | "am">(prefs?.language ?? "en");
  const [timezone, setTimezone] = useState(prefs?.timezone ?? "Africa/Addis_Ababa");
  const [emailNotifications, setEmailNotifications] = useState(prefs?.emailNotifications ?? true);
  const [inAppNotifications, setInAppNotifications] = useState(prefs?.inAppNotifications ?? true);

  async function savePrefs(e: React.FormEvent) {
    e.preventDefault();
    await mutateWorkspace(
      {
        type: "update_account_prefs",
        prefs: {
          language,
          timezone,
          emailNotifications,
          inAppNotifications,
          paymentReviewDigest: false,
          weeklyExecutiveSummary: false,
        },
      },
      "Account preferences saved",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Settings"
        description="Configure your preferred language, timezone, and academic notification preferences."
      />

      <Panel className="max-w-xl">
        <form onSubmit={(e) => void savePrefs(e)} className="space-y-4">
          <div>
            <Label htmlFor="set-lang">Display Language</Label>
            <select
              id="set-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "am")}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="en">English</option>
              <option value="am">Amharic (አማርኛ)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="set-tz">Timezone</Label>
            <Input
              id="set-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
            />
            <span>Receive email alerts for assignments, exams, and fee updates</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={inAppNotifications}
              onChange={(e) => setInAppNotifications(e.target.checked)}
            />
            <span>Show real-time in-app notifications in my dashboard</span>
          </label>
          <Button type="submit" variant="emerald" disabled={mutating}>
            <Settings className="h-4 w-4" /> Save Settings
          </Button>
        </form>
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 6.3 CHANGE PASSWORD                                                        */
/* ========================================================================== */

export function StudentChangePasswordModule({ minLength = 8 }: { minLength?: number }) {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Enter your current password to confirm your identity.");
      return;
    }
    if (newPassword.length < minLength) {
      toast.error(`New password must be at least ${minLength} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setBusy(true);
    try {
      if (user?.email) {
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (verifyErr) {
          throw new Error("Current password is incorrect.");
        }
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully");
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
        description={`Verify your current password and choose a strong password (minimum ${minLength} characters).`}
      />

      <Panel className="max-w-lg">
        <form onSubmit={(e) => void submitPassword(e)} className="space-y-4">
          <div>
            <Label htmlFor="cur-pw">Current Password</Label>
            <PasswordInput
              id="cur-pw"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="new-pw">New Password</Label>
            <PasswordInput
              id="new-pw"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="conf-pw">Confirm New Password</Label>
            <PasswordInput
              id="conf-pw"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="emerald" disabled={busy}>
            <KeyRound className="h-4 w-4" /> Update Password
          </Button>
        </form>
      </Panel>
    </div>
  );
}
