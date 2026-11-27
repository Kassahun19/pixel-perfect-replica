import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownToLine, FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import { displayName, ROLE_LABEL } from "@/lib/auth";
import { formatETB } from "@/lib/access";
import { downloadCsv, downloadExcelXls } from "@/lib/export";
import {
  computeAttendanceStats,
  computeFeeBalance,
  computeGradeOutcome,
  paginateRows,
} from "@/lib/owner/logic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, PageHeader, Pager, Panel, StatCard } from "@/components/dashboard/ui";
import type { OwnerDataHandle } from "./useOwnerData";

type ReportType =
  | "academic"
  | "student"
  | "financial"
  | "attendance"
  | "enrollment"
  | "operational";

export function OwnerReports({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, setPrintable, can } = data;
  const [reportType, setReportType] = useState<ReportType>("financial");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [page, setPage] = useState(1);

  const canExport = can("reports", "export");
  const defaultScale =
    workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];

  const inDateRange = (isoOrDate: string | null | undefined) => {
    if (!isoOrDate) return true;
    const d = isoOrDate.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const reportPayload = useMemo(() => {
    const classStudentSet =
      classFilter !== "all" ? new Set(maps.classesById.get(classFilter)?.studentIds ?? []) : null;

    if (reportType === "academic") {
      const rows = (workspace?.grades ?? [])
        .filter((g) => {
          if (!inDateRange(g.gradedAt)) return false;
          if (semesterFilter !== "all" && g.termId !== semesterFilter) return false;
          if (courseFilter !== "all" && g.courseId !== courseFilter) return false;
          if (userFilter !== "all" && g.studentId !== userFilter) return false;
          if (classStudentSet && !classStudentSet.has(g.studentId)) return false;
          if (yearFilter !== "all") {
            const term = workspace?.terms.find((t) => t.id === g.termId);
            if (term && term.academicYearId !== yearFilter) return false;
          }
          return true;
        })
        .map((g) => {
          const student = maps.profilesById.get(g.studentId);
          const course = maps.coursesById.get(g.courseId);
          const outcome = defaultScale
            ? computeGradeOutcome(g.score, g.maxScore, defaultScale)
            : { percent: Math.round((g.score / g.maxScore) * 100), letter: "—", gpa: 0 };
          return {
            Student: student ? displayName(student) : "Student",
            Course: course?.title ?? "Course",
            Assessment: g.assessmentTitle,
            Type: g.assessmentType,
            Score: `${g.score}/${g.maxScore}`,
            Percent: `${outcome.percent}%`,
            Grade: outcome.letter,
            Date: g.gradedAt.slice(0, 10),
          };
        });
      const avgPct =
        rows.length > 0
          ? Math.round(
              (rows.reduce((s, r) => s + Number.parseFloat(r.Percent), 0) / rows.length) * 10,
            ) / 10
          : 0;
      return {
        title: "Academic Performance Report",
        subtitle: `${rows.length} grade entries matching filters`,
        columns: ["Student", "Course", "Assessment", "Type", "Score", "Percent", "Grade", "Date"],
        rows,
        summary: [
          { label: "Total Assessments", value: String(rows.length) },
          { label: "Average Percentage", value: `${avgPct}%` },
          { label: "Courses Covered", value: String(new Set(rows.map((r) => r.Course)).size) },
        ],
        chartData: db.courses.map((c) => {
          const matching = (workspace?.grades ?? []).filter((g) => g.courseId === c.id);
          const avg =
            matching.length && defaultScale
              ? Math.round(
                  matching.reduce(
                    (s, g) => s + computeGradeOutcome(g.score, g.maxScore, defaultScale).percent,
                    0,
                  ) / matching.length,
                )
              : 0;
          return { label: c.title.slice(0, 18), value: avg };
        }),
      };
    }

    if (reportType === "financial") {
      const paymentRows = db.payments
        .filter((p) => {
          if (!inDateRange(p.created_at)) return false;
          if (courseFilter !== "all" && p.course_id !== courseFilter) return false;
          if (userFilter !== "all" && p.user_id !== userFilter) return false;
          if (classStudentSet && !classStudentSet.has(p.user_id)) return false;
          return true;
        })
        .map((p) => ({
          Source: "Course Payment",
          Payer: maps.profilesById.get(p.user_id)
            ? displayName(maps.profilesById.get(p.user_id)!)
            : "Learner",
          Course: maps.coursesById.get(p.course_id)?.title ?? "Course",
          Method: p.method,
          Reference: p.reference,
          Amount: Number(p.amount || 0),
          Status: p.status,
          Date: p.created_at.slice(0, 10),
        }));

      const approvedTotal = paymentRows
        .filter((r) => r.Status === "approved")
        .reduce((s, r) => s + r.Amount, 0);
      const pendingTotal = paymentRows
        .filter((r) => r.Status === "pending")
        .reduce((s, r) => s + r.Amount, 0);

      const methodGroups = new Map<string, number>();
      for (const r of paymentRows) {
        methodGroups.set(r.Method, (methodGroups.get(r.Method) ?? 0) + r.Amount);
      }

      return {
        title: "Financial & Revenue Report",
        subtitle: `${paymentRows.length} transactions matching filters`,
        columns: ["Source", "Payer", "Course", "Method", "Reference", "Amount", "Status", "Date"],
        rows: paymentRows.map((r) => ({ ...r, Amount: formatETB(r.Amount) })),
        rawRows: paymentRows,
        summary: [
          { label: "Approved Revenue", value: formatETB(approvedTotal) },
          { label: "Pending Review", value: formatETB(pendingTotal) },
          { label: "Total Records", value: String(paymentRows.length) },
        ],
        chartData: [...methodGroups.entries()].map(([label, value]) => ({ label, value })),
      };
    }

    if (reportType === "attendance") {
      const rows = (workspace?.attendance ?? [])
        .filter((a) => {
          if (!inDateRange(a.date)) return false;
          if (courseFilter !== "all" && a.courseId !== courseFilter) return false;
          if (classFilter !== "all" && a.classSectionId !== classFilter) return false;
          if (userFilter !== "all" && a.personId !== userFilter) return false;
          return true;
        })
        .map((a) => ({
          Person: maps.profilesById.get(a.personId)
            ? displayName(maps.profilesById.get(a.personId)!)
            : "Member",
          Role: a.personType,
          Course: a.courseId ? (maps.coursesById.get(a.courseId)?.title ?? "—") : "—",
          Class: a.classSectionId ? (maps.classesById.get(a.classSectionId)?.name ?? "—") : "—",
          Date: a.date,
          Status: a.status,
          Notes: a.notes || "—",
        }));

      const presentCount = rows.filter((r) => r.Status === "present" || r.Status === "late").length;
      const rate = rows.length ? Math.round((presentCount / rows.length) * 1000) / 10 : 0;

      return {
        title: "Attendance Summary Report",
        subtitle: `${rows.length} attendance entries`,
        columns: ["Person", "Role", "Course", "Class", "Date", "Status", "Notes"],
        rows,
        summary: [
          { label: "Entries Logged", value: String(rows.length) },
          { label: "Attendance Rate", value: `${rate}%` },
          { label: "Absences", value: String(rows.filter((r) => r.Status === "absent").length) },
        ],
        chartData: ["present", "late", "absent", "excused"].map((status) => ({
          label: status,
          value: rows.filter((r) => r.Status === status).length,
        })),
      };
    }

    if (reportType === "enrollment") {
      const rows = db.enrollments
        .filter((e) => {
          if (!inDateRange(e.created_at)) return false;
          if (courseFilter !== "all" && e.course_id !== courseFilter) return false;
          if (userFilter !== "all" && e.user_id !== userFilter) return false;
          if (classStudentSet && !classStudentSet.has(e.user_id)) return false;
          return true;
        })
        .map((e) => {
          const totalLessons = (maps.lessonsByCourse.get(e.course_id) ?? []).length;
          const completed = db.progress.filter(
            (p) => p.user_id === e.user_id && p.course_id === e.course_id,
          ).length;
          const pct = totalLessons
            ? Math.min(100, Math.round((completed / totalLessons) * 100))
            : 0;
          return {
            Student: maps.profilesById.get(e.user_id)
              ? displayName(maps.profilesById.get(e.user_id)!)
              : "Learner",
            Email: maps.profilesById.get(e.user_id)?.email ?? "—",
            Course: maps.coursesById.get(e.course_id)?.title ?? "Course",
            Completed: `${completed}/${totalLessons}`,
            Progress: `${pct}%`,
            Enrolled: e.created_at.slice(0, 10),
          };
        });
      return {
        title: "Enrollment & Completion Report",
        subtitle: `${rows.length} active course enrollments`,
        columns: ["Student", "Email", "Course", "Completed", "Progress", "Enrolled"],
        rows,
        summary: [
          { label: "Total Enrollments", value: String(rows.length) },
          { label: "Unique Learners", value: String(new Set(rows.map((r) => r.Email)).size) },
          { label: "Courses", value: String(new Set(rows.map((r) => r.Course)).size) },
        ],
        chartData: db.courses.map((c) => ({
          label: c.title.slice(0, 18),
          value: rows.filter((r) => r.Course === c.title).length,
        })),
      };
    }

    if (reportType === "student") {
      const students = db.profiles.filter((p) => {
        if (!(maps.rolesByUser.get(p.id) ?? []).includes("student")) return false;
        if (!inDateRange(p.created_at)) return false;
        if (userFilter !== "all" && p.id !== userFilter) return false;
        if (classStudentSet && !classStudentSet.has(p.id)) return false;
        if (
          courseFilter !== "all" &&
          !db.enrollments.some((e) => e.user_id === p.id && e.course_id === courseFilter)
        ) {
          return false;
        }
        return true;
      });

      const rows = students.map((s) => {
        const meta = workspace?.studentMeta[s.id];
        const clsName = meta?.classSectionId
          ? (maps.classesById.get(meta.classSectionId)?.name ?? "Assigned")
          : "Unassigned";
        const enrollments = db.enrollments.filter((e) => e.user_id === s.id).length;
        const att = computeAttendanceStats(
          (workspace?.attendance ?? []).filter((a) => a.personId === s.id),
        );
        const sGrades = (workspace?.grades ?? []).filter((g) => g.studentId === s.id);
        const avgPct =
          sGrades.length && defaultScale
            ? `${Math.round(
                sGrades.reduce(
                  (sum, g) => sum + computeGradeOutcome(g.score, g.maxScore, defaultScale).percent,
                  0,
                ) / sGrades.length,
              )}%`
            : "—";
        const due = (workspace?.feePlans ?? [])
          .filter((f) => f.studentId === s.id)
          .reduce((sum, f) => sum + computeFeeBalance(f.amount, f.discount, f.paidAmount), 0);

        return {
          Code: meta?.studentCode ?? `STU-${s.id.slice(0, 6).toUpperCase()}`,
          Student: displayName(s),
          Email: s.email,
          Class: clsName,
          Courses: enrollments,
          Attendance: att.total ? `${att.attendanceRate}%` : "—",
          AvgGrade: avgPct,
          Balance: formatETB(due),
          Status: s.status,
        };
      });

      return {
        title: "Student Directory & Performance Report",
        subtitle: `${rows.length} student profiles matching filters`,
        columns: ["Code", "Student", "Email", "Class", "Courses", "Attendance", "AvgGrade", "Balance", "Status"],
        rows,
        summary: [
          { label: "Total Students", value: String(rows.length) },
          {
            label: "Active Students",
            value: String(rows.filter((r) => r.Status === "active").length),
          },
          {
            label: "Enrolled in Courses",
            value: String(rows.filter((r) => r.Courses > 0).length),
          },
        ],
        chartData: (workspace?.classes ?? []).map((cls) => ({
          label: cls.sectionCode,
          value: students.filter((s) => workspace?.studentMeta[s.id]?.classSectionId === cls.id).length,
        })),
      };
    }

    // Operational
    const rows = db.profiles
      .filter((p) => {
        if (!inDateRange(p.created_at)) return false;
        if (userFilter !== "all" && p.id !== userFilter) return false;
        if (classStudentSet && !classStudentSet.has(p.id)) return false;
        return true;
      })
      .map((p) => ({
        User: displayName(p),
        Email: p.email,
        Roles: (maps.rolesByUser.get(p.id) ?? []).map((r) => ROLE_LABEL[r]).join(", ") || "None",
        Status: p.status,
        Phone: p.phone ?? "—",
        Joined: p.created_at.slice(0, 10),
      }));

    return {
      title: "Operational Account & Activity Report",
      subtitle: `${rows.length} academy accounts · ${db.audit.length} recent audit logs`,
      columns: ["User", "Email", "Roles", "Status", "Phone", "Joined"],
      rows,
      summary: [
        { label: "Total Accounts", value: String(rows.length) },
        {
          label: "Active Accounts",
          value: String(rows.filter((r) => r.Status === "active").length),
        },
        { label: "Support Tickets", value: String(db.messages.length) },
      ],
      chartData: ["active", "inactive", "suspended"].map((st) => ({
        label: st,
        value: rows.filter((r) => r.Status === st).length,
      })),
    };
  }, [
    reportType,
    dateFrom,
    dateTo,
    yearFilter,
    semesterFilter,
    courseFilter,
    classFilter,
    userFilter,
    workspace,
    db,
    maps,
    defaultScale,
  ]);

  const paged = paginateRows(reportPayload.rows as Array<Record<string, unknown>>, page, 12);

  function handleExportCsv() {
    if (!canExport) {
      toast.error("Export permission is disabled for your role.");
      return;
    }
    if (!reportPayload.rows.length) {
      toast.error("No rows match the current filter.");
      return;
    }
    downloadCsv(`ezana-${reportType}-report.csv`, reportPayload.rows as Record<string, unknown>[]);
    toast.success("CSV report downloaded");
  }

  function handleExportExcel() {
    if (!canExport) {
      toast.error("Export permission is disabled for your role.");
      return;
    }
    if (!reportPayload.rows.length) {
      toast.error("No rows match the current filter.");
      return;
    }
    downloadExcelXls(
      `ezana-${reportType}-report.xls`,
      reportType.toUpperCase(),
      reportPayload.rows as Record<string, unknown>[],
      reportPayload.title,
    );
    toast.success("Excel (.xls) report downloaded");
  }

  function handleExportPdf() {
    if (!canExport) {
      toast.error("Export permission is disabled for your role.");
      return;
    }
    setPrintable({
      title: reportPayload.title,
      subtitle: reportPayload.subtitle,
      meta: reportPayload.summary,
      columns: reportPayload.columns,
      rows: reportPayload.rows.map((r) =>
        reportPayload.columns.map((c) => String((r as Record<string, unknown>)[c] ?? "")),
      ),
      footerNote: "Generated by Ezana Academy Owner Reports & Analytics.",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Generate, filter, visualize, and export academic, financial, attendance, enrollment, and operational reports."
        actions={
          canExport ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <ArrowDownToLine className="h-4 w-4" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4" /> Export Excel
              </Button>
              <Button variant="emerald" size="sm" onClick={handleExportPdf}>
                <Printer className="h-4 w-4" /> Export PDF
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Report Type Selector */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["financial", "Financial Reports"],
            ["academic", "Academic Reports"],
            ["student", "Student Reports"],
            ["attendance", "Attendance Reports"],
            ["enrollment", "Enrollment Reports"],
            ["operational", "Operational Reports"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={reportType === id ? "emerald" : "outline"}
            onClick={() => {
              setReportType(id);
              setPage(1);
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Multi-Filter Bar */}
      <Panel title="Report Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            From Date
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            To Date
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Academic Year
            <select
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="all">All years</option>
              {(workspace?.academicYears ?? []).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Semester / Term
            <select
              value={semesterFilter}
              onChange={(e) => {
                setSemesterFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="all">All terms</option>
              {(workspace?.terms ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Course
            <select
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="all">All courses</option>
              {db.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Class / Section
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="all">All classes</option>
              {(workspace?.classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            User
            <select
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="all">All users</option>
              {db.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {reportPayload.summary.map((s, idx) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={<span className="tabular-nums">{s.value}</span>}
            icon={FileSpreadsheet}
            tone={idx === 0 ? "emerald" : idx === 1 ? "gold" : "deep"}
            index={idx}
          />
        ))}
      </div>

      {/* Chart */}
      <Panel title={`${reportPayload.title} Visualization`}>
        {reportPayload.chartData.length > 0 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportPayload.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#0f5132" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="No chart data" text="Adjust filters or add records to chart." />
        )}
      </Panel>

      {/* Tabular Breakdown */}
      <Panel
        title={reportPayload.title}
        actions={<Badge variant="secondary">{reportPayload.rows.length} rows</Badge>}
      >
        {paged.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {reportPayload.columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((row, idx) => (
                  <TableRow key={idx}>
                    {reportPayload.columns.map((col) => (
                      <TableCell key={col} className="tabular-nums">
                        {String((row as Record<string, unknown>)[col] ?? "—")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title="No records match these filters"
            text="Reset one or more report filters above to inspect academy records."
          />
        )}
      </Panel>
    </div>
  );
}
