import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarRange,
  FolderTree,
  Layers,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName } from "@/lib/auth";
import { logAudit } from "@/lib/csv";
import { detectTimetableConflicts } from "@/lib/owner/logic";
import type {
  AcademicCalendarEvent,
  AcademicTerm,
  AcademicYear,
  ClassSection,
  Department,
  SubjectRecord,
  TimetableSessionType,
  TimetableSlot,
} from "@/lib/owner/types";
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
import { ConfirmButton, EmptyState, PageHeader, Panel } from "@/components/dashboard/ui";
import type { OwnerDataHandle } from "./useOwnerData";

/* ========================================================================== */
/* 3.5 ACADEMIC MANAGEMENT                                                    */
/* ========================================================================== */

export function AcademicManagementModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, can, mutating } = data;
  const [tab, setTab] = useState<"years" | "terms" | "departments" | "classes" | "calendar">(
    "years",
  );

  const years = workspace?.academicYears ?? [];
  const terms = workspace?.terms ?? [];
  const departments = workspace?.departments ?? [];
  const classes = workspace?.classes ?? [];
  const events = workspace?.calendarEvents ?? [];

  const instructors = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("instructor")),
    [db.profiles, maps.rolesByUser],
  );
  const students = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("student")),
    [db.profiles, maps.rolesByUser],
  );

  // Forms
  const [yearDialog, setYearDialog] = useState<AcademicYear | null>(null);
  const [termDialog, setTermDialog] = useState<AcademicTerm | null>(null);
  const [deptDialog, setDeptDialog] = useState<Department | null>(null);
  const [classDialog, setClassDialog] = useState<ClassSection | null>(null);
  const [eventDialog, setEventDialog] = useState<AcademicCalendarEvent | null>(null);

  const canEdit = can("academics", "edit");
  const canDelete = can("academics", "delete");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Management"
        description="Configure academic years, semesters, departments, class sections, student/instructor cohorts, and the academy calendar."
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["years", `Academic Years (${years.length})`, CalendarRange],
            ["terms", `Semesters / Terms (${terms.length})`, Layers],
            ["departments", `Departments (${departments.length})`, Building2],
            ["classes", `Classes & Sections (${classes.length})`, FolderTree],
            ["calendar", `Academic Calendar (${events.length})`, CalendarClock],
          ] as const
        ).map(([id, label, Icon]) => (
          <Button
            key={id}
            size="sm"
            variant={tab === id ? "emerald" : "outline"}
            onClick={() => setTab(id)}
          >
            <Icon className="h-4 w-4" /> {label}
          </Button>
        ))}
      </div>

      {/* Academic Years */}
      {tab === "years" && (
        <Panel
          title="Academic Years"
          actions={
            canEdit && (
              <Button
                size="sm"
                variant="emerald"
                onClick={() =>
                  setYearDialog({
                    id: crypto.randomUUID(),
                    name: "",
                    startDate: "2026-09-01",
                    endDate: "2027-06-30",
                    isCurrent: false,
                    status: "planned",
                  })
                }
              >
                <Plus className="h-4 w-4" /> New Academic Year
              </Button>
            )
          }
        >
          {years.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((y) => (
                  <TableRow key={y.id}>
                    <TableCell className="font-semibold">
                      {y.name}{" "}
                      {y.isCurrent && (
                        <Badge variant="gold" className="ml-2">
                          Current
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {y.startDate} → {y.endDate}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={y.status === "active" ? "success" : "muted"}
                        className="capitalize"
                      >
                        {y.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {canEdit && (
                          <Button size="sm" variant="outline" onClick={() => setYearDialog(y)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        )}
                        {canDelete && (
                          <ConfirmButton
                            title="Delete academic year?"
                            confirmLabel="Delete"
                            onConfirm={() =>
                              void mutateWorkspace(
                                { type: "delete_academic_year", id: y.id },
                                "Academic year deleted",
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
              title="No academic years configured"
              text="Add an academic year to structure terms and classes."
            />
          )}
        </Panel>
      )}

      {/* Terms */}
      {tab === "terms" && (
        <Panel
          title="Semesters & Terms"
          actions={
            canEdit && (
              <Button
                size="sm"
                variant="emerald"
                onClick={() =>
                  setTermDialog({
                    id: crypto.randomUUID(),
                    academicYearId: years[0]?.id ?? "",
                    name: "",
                    startDate: "2026-09-01",
                    endDate: "2027-01-31",
                    isCurrent: false,
                    calendarNotes: "",
                  })
                }
              >
                <Plus className="h-4 w-4" /> New Semester / Term
              </Button>
            )
          }
        >
          {terms.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term Name</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-semibold">
                      {t.name}{" "}
                      {t.isCurrent && (
                        <Badge variant="success" className="ml-2">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {years.find((y) => y.id === t.academicYearId)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {t.startDate} → {t.endDate}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.calendarNotes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {canEdit && (
                          <Button size="sm" variant="outline" onClick={() => setTermDialog(t)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        )}
                        {canDelete && (
                          <ConfirmButton
                            title="Delete term?"
                            confirmLabel="Delete"
                            onConfirm={() =>
                              void mutateWorkspace(
                                { type: "delete_term", id: t.id },
                                "Term deleted",
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
              title="No terms defined"
              text="Create semesters or quarters under your academic year."
            />
          )}
        </Panel>
      )}

      {/* Departments */}
      {tab === "departments" && (
        <Panel
          title="Academic Departments"
          actions={
            canEdit && (
              <Button
                size="sm"
                variant="emerald"
                onClick={() =>
                  setDeptDialog({
                    id: crypto.randomUUID(),
                    name: "",
                    code: "",
                    headInstructorId: null,
                    description: "",
                  })
                }
              >
                <Plus className="h-4 w-4" /> New Department
              </Button>
            )
          }
        >
          {departments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code & Department</TableHead>
                  <TableHead>Department Head</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((d) => {
                  const head = d.headInstructorId
                    ? maps.profilesById.get(d.headInstructorId)
                    : undefined;
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <span className="mr-2 font-mono text-xs font-bold text-primary">
                          {d.code}
                        </span>
                        <span className="font-semibold">{d.name}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {head ? displayName(head) : "Unassigned"}
                      </TableCell>
                      <TableCell className="max-w-sm text-xs text-muted-foreground">
                        {d.description || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {canEdit && (
                            <Button size="sm" variant="outline" onClick={() => setDeptDialog(d)}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                          )}
                          {canDelete && (
                            <ConfirmButton
                              title="Delete department?"
                              confirmLabel="Delete"
                              onConfirm={() =>
                                void mutateWorkspace(
                                  { type: "delete_department", id: d.id },
                                  "Department deleted",
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
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No departments"
              text="Create departments to organize instructors and subjects."
            />
          )}
        </Panel>
      )}

      {/* Classes & Sections */}
      {tab === "classes" && (
        <Panel
          title="Classes & Sections"
          actions={
            canEdit && (
              <Button
                size="sm"
                variant="emerald"
                onClick={() =>
                  setClassDialog({
                    id: crypto.randomUUID(),
                    name: "",
                    sectionCode: "",
                    academicYearId: years[0]?.id ?? "",
                    departmentId: departments[0]?.id ?? null,
                    instructorId: null,
                    studentIds: [],
                    capacity: 40,
                    room: "Online Classroom",
                  })
                }
              >
                <Plus className="h-4 w-4" /> New Class / Section
              </Button>
            )
          }
        >
          {classes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class / Section</TableHead>
                  <TableHead>Lead Instructor</TableHead>
                  <TableHead>Students / Capacity</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((c) => {
                  const inst = c.instructorId ? maps.profilesById.get(c.instructorId) : undefined;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <p className="font-semibold">{c.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{c.sectionCode}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        {inst ? displayName(inst) : "Unassigned"}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        <span className="font-semibold">{c.studentIds.length}</span> / {c.capacity}
                      </TableCell>
                      <TableCell className="text-xs">{c.room}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {canEdit && (
                            <Button size="sm" variant="outline" onClick={() => setClassDialog(c)}>
                              <Pencil className="h-3.5 w-3.5" /> Assign / Edit
                            </Button>
                          )}
                          {canDelete && (
                            <ConfirmButton
                              title="Delete class section?"
                              confirmLabel="Delete"
                              onConfirm={() =>
                                void mutateWorkspace(
                                  { type: "delete_class", id: c.id },
                                  "Class deleted",
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
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No classes yet"
              text="Create classes and assign students and instructors."
            />
          )}
        </Panel>
      )}

      {/* Calendar */}
      {tab === "calendar" && (
        <Panel
          title="Academic Calendar"
          actions={
            canEdit && (
              <Button
                size="sm"
                variant="emerald"
                onClick={() =>
                  setEventDialog({
                    id: crypto.randomUUID(),
                    title: "",
                    date: new Date().toISOString().slice(0, 10),
                    category: "event",
                    description: "",
                  })
                }
              >
                <Plus className="h-4 w-4" /> Add Calendar Event
              </Button>
            )
          }
        >
          {events.length > 0 ? (
            <div className="space-y-2.5">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3.5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {ev.category}
                      </Badge>
                      <p className="font-semibold">{ev.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-mono font-semibold text-foreground">{ev.date}</span>
                      {ev.description ? ` — ${ev.description}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => setEventDialog(ev)}>
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          void mutateWorkspace(
                            { type: "delete_calendar_event", id: ev.id },
                            "Calendar event deleted",
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No calendar events"
              text="Add term dates, exam windows, or academy holidays."
            />
          )}
        </Panel>
      )}

      {/* Year Dialog */}
      <Dialog open={!!yearDialog} onOpenChange={(o) => !o && setYearDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Academic Year</DialogTitle>
          </DialogHeader>
          {yearDialog && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_academic_year", payload: yearDialog },
                  "Academic year saved",
                ).then(() => setYearDialog(null));
              }}
            >
              <label className="block space-y-1 text-sm font-medium">
                Name
                <Input
                  required
                  value={yearDialog.name}
                  onChange={(e) => setYearDialog({ ...yearDialog, name: e.target.value })}
                  placeholder="2026–2027 Academic Year"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm font-medium">
                  Start Date
                  <Input
                    type="date"
                    required
                    value={yearDialog.startDate}
                    onChange={(e) => setYearDialog({ ...yearDialog, startDate: e.target.value })}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  End Date
                  <Input
                    type="date"
                    required
                    value={yearDialog.endDate}
                    onChange={(e) => setYearDialog({ ...yearDialog, endDate: e.target.value })}
                  />
                </label>
              </div>
              <label className="block space-y-1 text-sm font-medium">
                Status
                <select
                  value={yearDialog.status}
                  onChange={(e) =>
                    setYearDialog({
                      ...yearDialog,
                      status: e.target.value as AcademicYear["status"],
                    })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={yearDialog.isCurrent}
                  onChange={(e) => setYearDialog({ ...yearDialog, isCurrent: e.target.checked })}
                />
                Set as active current academic year
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setYearDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald" disabled={mutating}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Term Dialog */}
      <Dialog open={!!termDialog} onOpenChange={(o) => !o && setTermDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Semester / Term</DialogTitle>
          </DialogHeader>
          {termDialog && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_term", payload: termDialog },
                  "Term saved",
                ).then(() => setTermDialog(null));
              }}
            >
              <label className="block space-y-1 text-sm font-medium">
                Academic Year
                <select
                  required
                  value={termDialog.academicYearId}
                  onChange={(e) => setTermDialog({ ...termDialog, academicYearId: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select year…</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Term Name
                <Input
                  required
                  value={termDialog.name}
                  onChange={(e) => setTermDialog({ ...termDialog, name: e.target.value })}
                  placeholder="Semester 1"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm font-medium">
                  Start Date
                  <Input
                    type="date"
                    required
                    value={termDialog.startDate}
                    onChange={(e) => setTermDialog({ ...termDialog, startDate: e.target.value })}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  End Date
                  <Input
                    type="date"
                    required
                    value={termDialog.endDate}
                    onChange={(e) => setTermDialog({ ...termDialog, endDate: e.target.value })}
                  />
                </label>
              </div>
              <label className="block space-y-1 text-sm font-medium">
                Notes
                <Input
                  value={termDialog.calendarNotes}
                  onChange={(e) => setTermDialog({ ...termDialog, calendarNotes: e.target.value })}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={termDialog.isCurrent}
                  onChange={(e) => setTermDialog({ ...termDialog, isCurrent: e.target.checked })}
                />
                Set as active term
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTermDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald" disabled={mutating}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Department Dialog */}
      <Dialog open={!!deptDialog} onOpenChange={(o) => !o && setDeptDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Department</DialogTitle>
          </DialogHeader>
          {deptDialog && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_department", payload: deptDialog },
                  "Department saved",
                ).then(() => setDeptDialog(null));
              }}
            >
              <label className="block space-y-1 text-sm font-medium">
                Department Name
                <Input
                  required
                  value={deptDialog.name}
                  onChange={(e) => setDeptDialog({ ...deptDialog, name: e.target.value })}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Code
                <Input
                  required
                  value={deptDialog.code}
                  onChange={(e) =>
                    setDeptDialog({ ...deptDialog, code: e.target.value.toUpperCase() })
                  }
                  placeholder="COMP"
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Department Head
                <select
                  value={deptDialog.headInstructorId ?? ""}
                  onChange={(e) =>
                    setDeptDialog({ ...deptDialog, headInstructorId: e.target.value || null })
                  }
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
              <label className="block space-y-1 text-sm font-medium">
                Description
                <Textarea
                  rows={2}
                  value={deptDialog.description}
                  onChange={(e) => setDeptDialog({ ...deptDialog, description: e.target.value })}
                />
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeptDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald" disabled={mutating}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Class Dialog */}
      <Dialog open={!!classDialog} onOpenChange={(o) => !o && setClassDialog(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Class / Section</DialogTitle>
          </DialogHeader>
          {classDialog && (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_class", payload: classDialog },
                  "Class saved",
                ).then(() => setClassDialog(null));
              }}
            >
              <label className="space-y-1 text-sm font-medium">
                Class Name
                <Input
                  required
                  value={classDialog.name}
                  onChange={(e) => setClassDialog({ ...classDialog, name: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Section Code
                <Input
                  required
                  value={classDialog.sectionCode}
                  onChange={(e) =>
                    setClassDialog({ ...classDialog, sectionCode: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Academic Year
                <select
                  value={classDialog.academicYearId}
                  onChange={(e) =>
                    setClassDialog({ ...classDialog, academicYearId: e.target.value })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Lead Instructor
                <select
                  value={classDialog.instructorId ?? ""}
                  onChange={(e) =>
                    setClassDialog({ ...classDialog, instructorId: e.target.value || null })
                  }
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
              <label className="space-y-1 text-sm font-medium">
                Room / Virtual Space
                <Input
                  value={classDialog.room}
                  onChange={(e) => setClassDialog({ ...classDialog, room: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Capacity
                <Input
                  type="number"
                  min="1"
                  value={classDialog.capacity}
                  onChange={(e) =>
                    setClassDialog({ ...classDialog, capacity: Number(e.target.value) || 30 })
                  }
                />
              </label>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Assign Students to Class ({classDialog.studentIds.length} selected)</Label>
                <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3">
                  {students.length ? (
                    students.map((s) => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={classDialog.studentIds.includes(s.id)}
                          onChange={(e) =>
                            setClassDialog({
                              ...classDialog,
                              studentIds: e.target.checked
                                ? [...classDialog.studentIds, s.id]
                                : classDialog.studentIds.filter((id) => id !== s.id),
                            })
                          }
                        />
                        <span>{displayName(s)}</span>
                        <span className="text-xs text-muted-foreground">({s.email})</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No student profiles found yet.</p>
                  )}
                </div>
              </div>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setClassDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald" disabled={mutating}>
                  Save Class
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Calendar Event Dialog */}
      <Dialog open={!!eventDialog} onOpenChange={(o) => !o && setEventDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Academic Calendar Event</DialogTitle>
          </DialogHeader>
          {eventDialog && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_calendar_event", payload: eventDialog },
                  "Calendar event saved",
                ).then(() => setEventDialog(null));
              }}
            >
              <label className="block space-y-1 text-sm font-medium">
                Event Title
                <Input
                  required
                  value={eventDialog.title}
                  onChange={(e) => setEventDialog({ ...eventDialog, title: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm font-medium">
                  Date
                  <Input
                    type="date"
                    required
                    value={eventDialog.date}
                    onChange={(e) => setEventDialog({ ...eventDialog, date: e.target.value })}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Category
                  <select
                    value={eventDialog.category}
                    onChange={(e) =>
                      setEventDialog({
                        ...eventDialog,
                        category: e.target.value as AcademicCalendarEvent["category"],
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="term">Term Milestone</option>
                    <option value="exam">Exam Window</option>
                    <option value="holiday">Holiday</option>
                    <option value="event">Academy Event</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-sm font-medium">
                Description
                <Textarea
                  rows={2}
                  value={eventDialog.description}
                  onChange={(e) => setEventDialog({ ...eventDialog, description: e.target.value })}
                />
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEventDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald" disabled={mutating}>
                  Save Event
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
/* 3.7 SUBJECTS & CATEGORIES                                                  */
/* ========================================================================== */

function slugify(val: string) {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SubjectsCategoriesModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, refreshAll, can, mutating } = data;
  const [search, setSearch] = useState("");
  const [catDialog, setCatDialog] = useState<{
    id?: string;
    name: string;
    slug: string;
    description: string;
    parent_id: string;
  } | null>(null);
  const [subjectDialog, setSubjectDialog] = useState<SubjectRecord | null>(null);

  const categories = useMemo(
    () =>
      db.categories.filter((c) =>
        `${c.name} ${c.slug} ${c.description ?? ""}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [db.categories, search],
  );
  const subjects = useMemo(
    () =>
      (workspace?.subjects ?? []).filter((s) =>
        `${s.name} ${s.code} ${s.description}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [workspace?.subjects, search],
  );

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catDialog) return;
    const payload = {
      name: catDialog.name.trim(),
      slug: slugify(catDialog.slug || catDialog.name),
      description: catDialog.description.trim() || null,
      parent_id: catDialog.parent_id || null,
    };
    const res = catDialog.id
      ? await supabase.from("categories").update(payload).eq("id", catDialog.id)
      : await supabase.from("categories").insert(payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    await logAudit(
      catDialog.id ? "category_updated" : "category_created",
      "category",
      catDialog.id,
      {
        name: payload.name,
      },
    );
    setCatDialog(null);
    await refreshAll("Category saved");
  }

  async function deleteCategory(id: string) {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("category_deleted", "category", id, {});
    await refreshAll("Category deleted");
  }

  async function assignCategoryToCourse(courseId: string, categoryId: string | null) {
    const { error } = await supabase
      .from("courses")
      .update({ category_id: categoryId })
      .eq("id", courseId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshAll("Course category updated");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subjects & Categories"
        description="Manage curriculum subjects, hierarchical categories/subcategories, and course assignments."
        actions={
          can("subjects", "create") ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCatDialog({ name: "", slug: "", description: "", parent_id: "" })}
              >
                <Plus className="h-4 w-4" /> Add Category
              </Button>
              <Button
                size="sm"
                variant="emerald"
                onClick={() =>
                  setSubjectDialog({
                    id: crypto.randomUUID(),
                    name: "",
                    code: "",
                    categoryId: db.categories[0]?.id ?? null,
                    departmentId: workspace?.departments[0]?.id ?? null,
                    courseIds: [],
                    credits: 3,
                    description: "",
                  })
                }
              >
                <Plus className="h-4 w-4" /> Add Subject
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subjects or categories…"
          className="pl-9"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`Categories & Subcategories (${categories.length})`}>
          {categories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      <p className="font-semibold">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">{cat.description || cat.slug}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {cat.parent_id
                        ? (maps.categoriesById.get(cat.parent_id)?.name ?? "Parent")
                        : "Top-level"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {can("subjects", "edit") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setCatDialog({
                                id: cat.id,
                                name: cat.name,
                                slug: cat.slug,
                                description: cat.description ?? "",
                                parent_id: cat.parent_id ?? "",
                              })
                            }
                          >
                            Edit
                          </Button>
                        )}
                        {can("subjects", "delete") && (
                          <ConfirmButton
                            title={`Delete category "${cat.name}"?`}
                            confirmLabel="Delete"
                            onConfirm={() => void deleteCategory(cat.id)}
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
            <EmptyState title="No categories match" icon={Tags} />
          )}
        </Panel>

        <Panel title={`Subjects (${subjects.length})`}>
          {subjects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category & Courses</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <p className="font-semibold">
                        <span className="mr-1.5 font-mono text-xs text-primary">{sub.code}</span>
                        {sub.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{sub.credits} credits</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p>
                        {sub.categoryId
                          ? (maps.categoriesById.get(sub.categoryId)?.name ?? "—")
                          : "—"}
                      </p>
                      <p className="text-muted-foreground">
                        {sub.courseIds.length
                          ? sub.courseIds
                              .map((id) => maps.coursesById.get(id)?.title)
                              .filter(Boolean)
                              .join(", ")
                          : "No courses linked"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {can("subjects", "edit") && (
                          <Button size="sm" variant="outline" onClick={() => setSubjectDialog(sub)}>
                            Edit
                          </Button>
                        )}
                        {can("subjects", "delete") && (
                          <ConfirmButton
                            title={`Delete subject "${sub.name}"?`}
                            confirmLabel="Delete"
                            onConfirm={() =>
                              void mutateWorkspace(
                                { type: "delete_subject", id: sub.id },
                                "Subject deleted",
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
            <EmptyState title="No subjects defined" icon={Tags} />
          )}
        </Panel>
      </div>

      {/* Quick Course -> Category Assignment */}
      <Panel title="Assign Categories to Courses">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {db.courses.map((course) => (
            <div
              key={course.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <span className="truncate text-sm font-semibold">{course.title}</span>
              <select
                value={course.category_id ?? ""}
                disabled={!can("subjects", "edit")}
                onChange={(e) => void assignCategoryToCourse(course.id, e.target.value || null)}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Uncategorized</option>
                {db.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Panel>

      {/* Category Modal */}
      <Dialog open={!!catDialog} onOpenChange={(o) => !o && setCatDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{catDialog?.id ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          {catDialog && (
            <form className="space-y-3" onSubmit={(e) => void saveCategory(e)}>
              <label className="block space-y-1 text-sm font-medium">
                Name
                <Input
                  required
                  value={catDialog.name}
                  onChange={(e) => setCatDialog({ ...catDialog, name: e.target.value })}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Slug
                <Input
                  value={catDialog.slug}
                  onChange={(e) => setCatDialog({ ...catDialog, slug: e.target.value })}
                  placeholder={slugify(catDialog.name)}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Parent Category (optional subcategory)
                <select
                  value={catDialog.parent_id}
                  onChange={(e) => setCatDialog({ ...catDialog, parent_id: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None (Top-level category)</option>
                  {db.categories
                    .filter((c) => c.id !== catDialog.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Description
                <Textarea
                  rows={2}
                  value={catDialog.description}
                  onChange={(e) => setCatDialog({ ...catDialog, description: e.target.value })}
                />
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCatDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald">
                  Save Category
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Subject Modal */}
      <Dialog open={!!subjectDialog} onOpenChange={(o) => !o && setSubjectDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Subject Details</DialogTitle>
          </DialogHeader>
          {subjectDialog && (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_subject", payload: subjectDialog },
                  "Subject saved",
                ).then(() => setSubjectDialog(null));
              }}
            >
              <label className="space-y-1 text-sm font-medium">
                Subject Name
                <Input
                  required
                  value={subjectDialog.name}
                  onChange={(e) => setSubjectDialog({ ...subjectDialog, name: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Subject Code
                <Input
                  required
                  value={subjectDialog.code}
                  onChange={(e) =>
                    setSubjectDialog({ ...subjectDialog, code: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Category
                <select
                  value={subjectDialog.categoryId ?? ""}
                  onChange={(e) =>
                    setSubjectDialog({ ...subjectDialog, categoryId: e.target.value || null })
                  }
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
              <label className="space-y-1 text-sm font-medium">
                Credits / Hours
                <Input
                  type="number"
                  min="1"
                  value={subjectDialog.credits}
                  onChange={(e) =>
                    setSubjectDialog({ ...subjectDialog, credits: Number(e.target.value) || 1 })
                  }
                />
              </label>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Linked Courses</Label>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border p-2.5">
                  {db.courses.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={subjectDialog.courseIds.includes(c.id)}
                        onChange={(e) =>
                          setSubjectDialog({
                            ...subjectDialog,
                            courseIds: e.target.checked
                              ? [...subjectDialog.courseIds, c.id]
                              : subjectDialog.courseIds.filter((id) => id !== c.id),
                          })
                        }
                      />
                      <span>{c.title}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="space-y-1 text-sm font-medium sm:col-span-2">
                Description
                <Textarea
                  rows={2}
                  value={subjectDialog.description}
                  onChange={(e) =>
                    setSubjectDialog({ ...subjectDialog, description: e.target.value })
                  }
                />
              </label>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setSubjectDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald" disabled={mutating}>
                  Save Subject
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
/* 3.8 TIMETABLES & SCHEDULING                                                */
/* ========================================================================== */

const DAYS: TimetableSlot["dayOfWeek"][] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function TimetablesModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, can, mutating } = data;
  const [dayFilter, setDayFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [slotDialog, setSlotDialog] = useState<TimetableSlot | null>(null);

  const slots = workspace?.timetables ?? [];
  const instructors = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("instructor")),
    [db.profiles, maps.rolesByUser],
  );

  const filtered = useMemo(
    () =>
      slots
        .filter((s) => (dayFilter === "all" ? true : s.dayOfWeek === dayFilter))
        .filter((s) => (classFilter === "all" ? true : s.classSectionId === classFilter)),
    [slots, dayFilter, classFilter],
  );

  const liveConflicts = useMemo(
    () => (slotDialog ? detectTimetableConflicts(slots, slotDialog) : []),
    [slots, slotDialog],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetables & Scheduling"
        description="Schedule lessons, exams, and live classes with automatic conflict detection across rooms, instructors, and sections."
        actions={
          can("timetables", "create") ? (
            <Button
              size="sm"
              variant="emerald"
              onClick={() =>
                setSlotDialog({
                  id: crypto.randomUUID(),
                  title: "",
                  sessionType: "live_class",
                  courseId: db.courses[0]?.id ?? null,
                  classSectionId: workspace?.classes[0]?.id ?? null,
                  instructorId: instructors[0]?.id ?? null,
                  dayOfWeek: "Monday",
                  startTime: "09:00",
                  endTime: "10:30",
                  room: "Lab 1",
                  meetingUrl: "",
                })
              }
            >
              <Plus className="h-4 w-4" /> Schedule Session
            </Button>
          ) : undefined
        }
      />

      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Days</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Classes</option>
            {(workspace?.classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {filtered.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day & Time</TableHead>
                <TableHead>Session & Type</TableHead>
                <TableHead>Course & Class</TableHead>
                <TableHead>Instructor & Room</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((slot) => {
                const inst = slot.instructorId
                  ? maps.profilesById.get(slot.instructorId)
                  : undefined;
                return (
                  <TableRow key={slot.id}>
                    <TableCell className="tabular-nums">
                      <p className="font-semibold">{slot.dayOfWeek}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {slot.startTime} – {slot.endTime}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{slot.title}</p>
                      <Badge variant="outline" className="mt-1 capitalize">
                        {slot.sessionType.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p className="font-medium">
                        {slot.courseId ? (maps.coursesById.get(slot.courseId)?.title ?? "—") : "—"}
                      </p>
                      <p className="text-muted-foreground">
                        {slot.classSectionId
                          ? (maps.classesById.get(slot.classSectionId)?.name ?? "—")
                          : "Open cohort"}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p className="font-medium">{inst ? displayName(inst) : "TBD"}</p>
                      <p className="text-muted-foreground">{slot.room || "Virtual"}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {can("timetables", "edit") && (
                          <Button size="sm" variant="outline" onClick={() => setSlotDialog(slot)}>
                            Edit
                          </Button>
                        )}
                        {can("timetables", "delete") && (
                          <ConfirmButton
                            title="Delete scheduled session?"
                            confirmLabel="Delete"
                            onConfirm={() =>
                              void mutateWorkspace(
                                { type: "delete_timetable", id: slot.id },
                                "Session removed",
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
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No timetable slots match"
            text="Schedule a lesson, live class, or exam session to build the timetable."
            icon={CalendarClock}
          />
        )}
      </Panel>

      {/* Timetable Slot Dialog */}
      <Dialog open={!!slotDialog} onOpenChange={(o) => !o && setSlotDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Timetable Session</DialogTitle>
            <DialogDescription>
              Automatic conflict checks prevent overlapping rooms, instructors, or classes.
            </DialogDescription>
          </DialogHeader>
          {slotDialog && (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (liveConflicts.length > 0) {
                  toast.error(liveConflicts[0]!.reasons.join("; "));
                  return;
                }
                void mutateWorkspace(
                  { type: "upsert_timetable", payload: slotDialog },
                  "Timetable session saved",
                ).then(() => setSlotDialog(null));
              }}
            >
              {liveConflicts.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive sm:col-span-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Schedule Conflict Detected:</p>
                    <p>{liveConflicts[0]!.reasons.join(" · ")}</p>
                  </div>
                </div>
              )}
              <label className="space-y-1 text-sm font-medium sm:col-span-2">
                Session Title
                <Input
                  required
                  value={slotDialog.title}
                  onChange={(e) => setSlotDialog({ ...slotDialog, title: e.target.value })}
                  placeholder="e.g. Excel Formulas Lab"
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Type
                <select
                  value={slotDialog.sessionType}
                  onChange={(e) =>
                    setSlotDialog({
                      ...slotDialog,
                      sessionType: e.target.value as TimetableSessionType,
                    })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="lesson">Lesson</option>
                  <option value="live_class">Live Class</option>
                  <option value="exam">Exam</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Day of Week
                <select
                  value={slotDialog.dayOfWeek}
                  onChange={(e) =>
                    setSlotDialog({
                      ...slotDialog,
                      dayOfWeek: e.target.value as TimetableSlot["dayOfWeek"],
                    })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Start Time
                <Input
                  type="time"
                  required
                  value={slotDialog.startTime}
                  onChange={(e) => setSlotDialog({ ...slotDialog, startTime: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                End Time
                <Input
                  type="time"
                  required
                  value={slotDialog.endTime}
                  onChange={(e) => setSlotDialog({ ...slotDialog, endTime: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Course
                <select
                  value={slotDialog.courseId ?? ""}
                  onChange={(e) =>
                    setSlotDialog({ ...slotDialog, courseId: e.target.value || null })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {db.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Class / Section
                <select
                  value={slotDialog.classSectionId ?? ""}
                  onChange={(e) =>
                    setSlotDialog({ ...slotDialog, classSectionId: e.target.value || null })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {(workspace?.classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Instructor
                <select
                  value={slotDialog.instructorId ?? ""}
                  onChange={(e) =>
                    setSlotDialog({ ...slotDialog, instructorId: e.target.value || null })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">TBD</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {displayName(i)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Room / Location
                <Input
                  value={slotDialog.room}
                  onChange={(e) => setSlotDialog({ ...slotDialog, room: e.target.value })}
                  placeholder="Lab 1"
                />
              </label>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setSlotDialog(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="emerald"
                  disabled={mutating || liveConflicts.length > 0}
                >
                  Save Session
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
