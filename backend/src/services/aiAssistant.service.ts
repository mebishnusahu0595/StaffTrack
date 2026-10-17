import { Prisma, TaskStatus, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendBroadcastNotification } from "./notification.service";
import { streamGeminiWithFallback } from "../lib/gemini";
import { startOfDay } from "../lib/date";
import { getStartOfDayIST } from "./task.service";

export interface SmartNotification {
  id: string;
  userId: string;
  userName: string;
  type: "ABSENCE_WARNING" | "TASK_REMINDER" | "CHECKIN_REMINDER" | "SALARY_WARNING" | "DER_REMINDER" | "LATE_WARNING";
  title: string;
  message: string;
  severity: "high" | "medium" | "low";
  data: Record<string, any>;
}

// ─── AI chat: Gemini function calling over live DB queries ─────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 20;
const MAX_TOOL_ROUNDS = 6;
// Strongest model first; the global list starts with flash-lite for low-latency nudges.
const CHAT_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest"];
const OPEN: TaskStatus[] = ["PENDING", "IN_PROGRESS"];
const STAFF_ROLES: UserRole[] = ["EMPLOYEE", "MANAGER"];
const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "OPEN", "OVERDUE"];

type Args = Record<string, any>;
type Ctx = { adminId: string; companyId: string; action?: Record<string, any> };
type Staff = { id: string; name: string; role: UserRole; designation: string | null };

const fmtTime = (d?: Date | null) =>
  d ? d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : null;
const fmtDate = (d?: Date | null) => (d ? d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : null); // YYYY-MM-DD

function istDay(s?: string): Date {
  if (!s || s === "today") return getStartOfDayIST();
  const d = new Date(`${s}T00:00:00+05:30`);
  if (isNaN(d.getTime())) throw new Error(`Invalid date "${s}", use YYYY-MM-DD`);
  return d;
}

/** IST day range from {date} or {from,to}; defaults to today. `end` is exclusive. */
function dayRange(a: Args) {
  const start = istDay(a.date ?? a.from);
  const end = new Date(istDay(a.date ?? a.to ?? a.from).getTime() + DAY_MS);
  return { start, end };
}
const hasRange = (a: Args) => Boolean(a.date || a.from || a.to);

// Same "task belongs to a day" rule as the mobile app's task list
const taskInRange = (start: Date, end: Date): Prisma.TaskWhereInput => ({
  OR: [
    { dueDate: { gte: start, lt: end } },
    { startDate: { gte: start, lt: end } },
    { completedAt: { gte: start, lt: end } }
  ]
});

async function findStaff(companyId: string, staff?: string): Promise<Staff[]> {
  const select = { id: true, name: true, role: true, designation: true };
  const base: Prisma.UserWhereInput = { companyId, role: { in: STAFF_ROLES } };
  const q = staff?.trim();
  if (!q) return prisma.user.findMany({ where: base, select, orderBy: { name: "asc" } });

  let users = await prisma.user.findMany({
    where: {
      ...base,
      OR: [
        { id: q },
        { employeeCode: { equals: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { name: { contains: q, mode: "insensitive" } }
      ]
    },
    select
  });
  if (users.length === 0) {
    // "Nand Kishor" vs "Nandkishor": retry on individual name parts
    const parts = q.split(/\s+/).filter(p => p.length >= 3);
    if (parts.length > 1) {
      users = await prisma.user.findMany({
        where: { ...base, OR: parts.map(p => ({ name: { contains: p, mode: "insensitive" as const } })) },
        select
      });
    }
  }
  if (users.length === 0) throw new Error(`No staff found matching "${q}"`);
  return users;
}

/** Resolve to exactly one staff member, or throw so the model asks the admin which one. */
async function findOne(companyId: string, staff: string): Promise<Staff> {
  const users = await findStaff(companyId, staff);
  const exact = users.filter(u => u.name.toLowerCase() === staff.trim().toLowerCase());
  if (exact.length === 1) return exact[0];
  if (users.length === 1) return users[0];
  throw new Error(`"${staff}" matches multiple staff: ${users.map(u => u.name).join(", ")}. Ask the admin which one.`);
}

export const TOOLS: Record<string, (a: Args, ctx: Ctx) => Promise<unknown>> = {
  async get_day_overview(a, { companyId }) {
    const { start, end } = dayRange({ date: a.date });
    const users = await findStaff(companyId);
    const ids = users.map(u => u.id);
    const name = new Map(users.map(u => [u.id, u.name]));
    const [att, tasks, overdueTotal, leaves, holidays, ders, pendingLeaveRequests] = await Promise.all([
      prisma.attendance.findMany({
        where: { userId: { in: ids }, date: { gte: start, lt: end } },
        select: { userId: true, checkInTime: true, checkOutTime: true }
      }),
      prisma.task.groupBy({ by: ["status"], where: { assignedToId: { in: ids }, ...taskInRange(start, end) }, _count: true }),
      prisma.task.count({ where: { assignedToId: { in: ids }, status: { in: OPEN }, dueDate: { lt: new Date() } } }),
      prisma.leaveRequest.findMany({
        where: { userId: { in: ids }, status: "APPROVED", startDate: { lt: end }, endDate: { gte: start } },
        select: { userId: true }
      }),
      prisma.holiday.findMany({ where: { companyId, date: { gte: start, lt: end } }, select: { name: true }, distinct: ["name"] }),
      prisma.dayEndReport.findMany({ where: { userId: { in: ids }, date: { gte: start, lt: end } }, select: { userId: true } }),
      prisma.leaveRequest.count({ where: { companyId, status: "PENDING" } })
    ]);
    const checkedIn = att.filter(r => r.checkInTime);
    const inIds = new Set(checkedIn.map(r => r.userId));
    const leaveIds = new Set(leaves.map(l => l.userId));
    const derIds = new Set(ders.map(d => d.userId));
    return {
      date: fmtDate(start),
      totalStaff: users.length,
      holidays: holidays.map(h => h.name),
      checkedInCount: checkedIn.length,
      checkedIn: checkedIn.map(r => ({
        name: name.get(r.userId),
        checkIn: fmtTime(r.checkInTime),
        checkOut: fmtTime(r.checkOutTime) ?? "still working"
      })),
      notCheckedIn: users.filter(u => !inIds.has(u.id) && !leaveIds.has(u.id)).map(u => u.name),
      onLeave: [...leaveIds].map(id => name.get(id)),
      tasksForThisDay: {
        total: tasks.reduce((n, t) => n + t._count, 0),
        ...Object.fromEntries(tasks.map(t => [t.status, t._count]))
      },
      overdueOpenTasksAllDays: overdueTotal,
      pendingLeaveRequests,
      dayEndReports: {
        submitted: derIds.size,
        missingFromCheckedIn: checkedIn.filter(r => !derIds.has(r.userId)).map(r => name.get(r.userId))
      }
    };
  },

  async get_tasks(a, { companyId }) {
    const users = await findStaff(companyId, a.staff);
    const name = new Map(users.map(u => [u.id, u.name]));
    const now = new Date();
    const where: Prisma.TaskWhereInput = { assignedToId: { in: users.map(u => u.id) } };
    if (hasRange(a)) {
      const { start, end } = dayRange(a);
      Object.assign(where, taskInRange(start, end));
    }
    const status = String(a.status || "").toUpperCase();
    if (status && !TASK_STATUSES.includes(status)) throw new Error(`Unknown status ${status}`);
    if (status === "OVERDUE") Object.assign(where, { status: { in: OPEN }, dueDate: { lt: now } });
    else if (status === "OPEN") where.status = { in: OPEN };
    else if (status) where.status = status as TaskStatus;

    const [byStatus, overdue, list] = await Promise.all([
      prisma.task.groupBy({ by: ["status"], where, _count: true }),
      prisma.task.count({ where: { AND: [where, { status: { in: OPEN }, dueDate: { lt: now } }] } }),
      prisma.task.findMany({
        where,
        select: { title: true, status: true, priority: true, dueDate: true, completedAt: true, completionRemarks: true, assignedToId: true },
        orderBy: { dueDate: "asc" },
        take: 60
      })
    ]);
    return {
      total: byStatus.reduce((n, s) => n + s._count, 0),
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      overdue,
      showing: list.length,
      tasks: list.map(t => ({
        title: t.title,
        staff: name.get(t.assignedToId),
        status: OPEN.includes(t.status) && t.dueDate < now ? `${t.status} (OVERDUE)` : t.status,
        priority: t.priority,
        due: `${fmtDate(t.dueDate)} ${fmtTime(t.dueDate)}`,
        completedAt: t.completedAt ? `${fmtDate(t.completedAt)} ${fmtTime(t.completedAt)}` : undefined,
        remarks: t.completionRemarks || undefined
      }))
    };
  },

  async get_attendance(a, { companyId }) {
    const users = await findStaff(companyId, a.staff);
    const name = new Map(users.map(u => [u.id, u.name]));
    const { start, end } = dayRange(a);
    const records = await prisma.attendance.findMany({
      where: { userId: { in: users.map(u => u.id) }, date: { gte: start, lt: end } },
      select: { userId: true, date: true, status: true, checkInTime: true, checkOutTime: true, punchType: true, isCheckInPending: true },
      orderBy: { date: "asc" }
    });
    const row = (r: (typeof records)[number]) => ({
      date: fmtDate(r.date),
      name: name.get(r.userId),
      status: r.status,
      checkIn: fmtTime(r.checkInTime),
      checkOut: fmtTime(r.checkOutTime) ?? (r.checkInTime ? "still working" : null),
      punchType: r.punchType,
      checkInPendingApproval: r.isCheckInPending || undefined
    });
    const elapsedEnd = Math.min(end.getTime(), getStartOfDayIST().getTime() + DAY_MS);
    const days = Math.max(1, Math.round((elapsedEnd - start.getTime()) / DAY_MS));

    if (days === 1) {
      const byUser = new Map(records.map(r => [r.userId, r]));
      return {
        date: fmtDate(start),
        checkedIn: records.filter(r => r.checkInTime).length,
        totalStaff: users.length,
        staff: users.map(u => (byUser.has(u.id) ? row(byUser.get(u.id)!) : { name: u.name, status: "NOT CHECKED IN" }))
      };
    }
    return {
      from: fmtDate(start),
      to: fmtDate(new Date(elapsedEnd - DAY_MS)),
      daysElapsed: days,
      note: "daysWithoutRecord = no check-in that day (absent, weekly off or holiday)",
      summary: users.map(u => {
        const rs = records.filter(r => r.userId === u.id);
        const count = (s: string) => rs.filter(r => r.status === s).length;
        return {
          name: u.name,
          daysCheckedIn: rs.filter(r => r.checkInTime).length,
          present: count("PRESENT"),
          halfDay: count("HALF_DAY"),
          onLeave: count("ON_LEAVE"),
          markedAbsent: count("ABSENT"),
          daysWithoutRecord: days - rs.length
        };
      }),
      daily: users.length === 1 ? records.map(row) : undefined
    };
  },

  async get_staff_profile(a, { companyId }) {
    const matches = await findStaff(companyId, a.staff);
    const exact = matches.filter(m => m.name.toLowerCase() === String(a.staff).trim().toLowerCase());
    const target = exact.length === 1 ? exact[0] : matches.length === 1 ? matches[0] : null;
    if (!target) return { multipleMatches: matches.map(m => `${m.name} (${m.designation || m.role})`) };

    const id = target.id;
    const now = new Date();
    const today = getStartOfDayIST();
    const tomorrow = new Date(today.getTime() + DAY_MS);
    const monthStart = istDay(`${fmtDate(today)!.slice(0, 8)}01`);
    const [u, todayAtt, monthAtt, todayTasks, overdueTasks, overdueCount, openCount, doneThisMonth, leaves, slip, lastPing, derToday] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id },
          select: {
            name: true, email: true, phone: true, role: true, designation: true, employeeCode: true, workMode: true,
            shiftStart: true, shiftEnd: true, joiningDate: true, batteryLevel: true, isLocationOn: true, locationOffAt: true,
            manager: { select: { name: true } }, group: { select: { name: true } }
          }
        }),
        prisma.attendance.findFirst({
          where: { userId: id, date: { gte: today, lt: tomorrow } },
          select: { status: true, checkInTime: true, checkOutTime: true, punchType: true }
        }),
        prisma.attendance.findMany({ where: { userId: id, date: { gte: monthStart, lt: tomorrow } }, select: { status: true, checkInTime: true } }),
        prisma.task.findMany({ where: { assignedToId: id, ...taskInRange(today, tomorrow) }, select: { title: true, status: true }, take: 30 }),
        prisma.task.findMany({
          where: { assignedToId: id, status: { in: OPEN }, dueDate: { lt: now } },
          select: { title: true, dueDate: true },
          orderBy: { dueDate: "asc" },
          take: 10
        }),
        prisma.task.count({ where: { assignedToId: id, status: { in: OPEN }, dueDate: { lt: now } } }),
        prisma.task.count({ where: { assignedToId: id, status: { in: OPEN } } }),
        prisma.task.count({ where: { assignedToId: id, status: "COMPLETED", completedAt: { gte: monthStart } } }),
        prisma.leaveRequest.findMany({
          where: { userId: id, OR: [{ status: "PENDING" }, { endDate: { gte: today } }] },
          select: { startDate: true, endDate: true, status: true, reason: true },
          take: 10
        }),
        prisma.salarySlip.findFirst({
          where: { userId: id },
          orderBy: [{ year: "desc" }, { month: "desc" }],
          select: { month: true, year: true, netPay: true, deductions: true, payableDays: true, status: true }
        }),
        prisma.locationLog.findFirst({ where: { userId: id }, orderBy: { timestamp: "desc" }, select: { timestamp: true } }),
        prisma.dayEndReport.findFirst({ where: { userId: id, date: { gte: today, lt: tomorrow } }, select: { submittedAt: true } })
      ]);
    if (!u) throw new Error("Staff not found");
    return {
      name: u.name, role: u.role, designation: u.designation, phone: u.phone, email: u.email, employeeCode: u.employeeCode,
      workMode: u.workMode, shift: `${u.shiftStart}-${u.shiftEnd}`, joiningDate: fmtDate(u.joiningDate),
      manager: u.manager?.name ?? null, group: u.group?.name ?? null,
      device: {
        batteryLevel: u.batteryLevel, locationOn: u.isLocationOn,
        locationOffSince: u.isLocationOn ? undefined : fmtTime(u.locationOffAt),
        lastLocationPing: lastPing ? `${fmtDate(lastPing.timestamp)} ${fmtTime(lastPing.timestamp)}` : null
      },
      today: {
        attendance: todayAtt
          ? { status: todayAtt.status, checkIn: fmtTime(todayAtt.checkInTime), checkOut: fmtTime(todayAtt.checkOutTime) ?? "still working", punchType: todayAtt.punchType }
          : "NOT CHECKED IN",
        tasks: todayTasks,
        dayEndReportSubmitted: derToday ? fmtTime(derToday.submittedAt) : false
      },
      thisMonthAttendance: {
        daysCheckedIn: monthAtt.filter(r => r.checkInTime).length,
        halfDay: monthAtt.filter(r => r.status === "HALF_DAY").length,
        onLeave: monthAtt.filter(r => r.status === "ON_LEAVE").length,
        markedAbsent: monthAtt.filter(r => r.status === "ABSENT").length
      },
      tasks: {
        openTotal: openCount,
        overdueCount,
        overdue: overdueTasks.map(t => ({ title: t.title, due: fmtDate(t.dueDate) })),
        completedThisMonth: doneThisMonth
      },
      leaves: leaves.map(l => ({ from: fmtDate(l.startDate), to: fmtDate(l.endDate), status: l.status, reason: l.reason })),
      latestSalarySlip: slip
    };
  },

  async get_leaves(a, { companyId }) {
    const users = await findStaff(companyId, a.staff);
    const name = new Map(users.map(u => [u.id, u.name]));
    const where: Prisma.LeaveRequestWhereInput = { userId: { in: users.map(u => u.id) } };
    if (a.status) where.status = String(a.status).toUpperCase() as Prisma.LeaveRequestWhereInput["status"];
    if (hasRange(a)) {
      const { start, end } = dayRange(a);
      Object.assign(where, { startDate: { lt: end }, endDate: { gte: start } });
    }
    const list = await prisma.leaveRequest.findMany({
      where,
      select: { userId: true, startDate: true, endDate: true, status: true, reason: true },
      orderBy: { startDate: "desc" },
      take: 50
    });
    return {
      count: list.length,
      leaves: list.map(l => ({ name: name.get(l.userId), from: fmtDate(l.startDate), to: fmtDate(l.endDate), status: l.status, reason: l.reason }))
    };
  },

  async get_day_end_reports(a, { companyId }) {
    const users = await findStaff(companyId, a.staff);
    const name = new Map(users.map(u => [u.id, u.name]));
    const { start, end } = dayRange(a);
    const list = await prisma.dayEndReport.findMany({
      where: { userId: { in: users.map(u => u.id) }, date: { gte: start, lt: end } },
      select: { userId: true, date: true, visitsSummary: true, ordersTaken: true, ordersCancelled: true, kmTravelled: true, remarks: true, submittedAt: true },
      orderBy: { date: "desc" },
      take: 60
    });
    const submitted = new Set(list.map(r => r.userId));
    return {
      submittedCount: list.length,
      notSubmitted: end.getTime() - start.getTime() === DAY_MS ? users.filter(u => !submitted.has(u.id)).map(u => u.name) : undefined,
      reports: list.map(r => ({
        name: name.get(r.userId), date: fmtDate(r.date), visits: r.visitsSummary, ordersTaken: r.ordersTaken,
        ordersCancelled: r.ordersCancelled, km: r.kmTravelled, remarks: r.remarks, submittedAt: fmtTime(r.submittedAt)
      }))
    };
  },

  async get_expenses(a, { companyId }) {
    const users = await findStaff(companyId, a.staff);
    const name = new Map(users.map(u => [u.id, u.name]));
    const monthStart = `${fmtDate(new Date())!.slice(0, 8)}01`;
    const { start, end } = dayRange(hasRange(a) ? a : { from: monthStart, to: fmtDate(new Date()) });
    const where: Prisma.ExpenseWhereInput = { userId: { in: users.map(u => u.id) }, date: { gte: start, lt: end } };
    if (typeof a.approved === "boolean") where.approved = a.approved;
    const [agg, list] = await Promise.all([
      prisma.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
      prisma.expense.findMany({
        where,
        select: { userId: true, category: true, amount: true, description: true, date: true, approved: true },
        orderBy: { date: "desc" },
        take: 40
      })
    ]);
    return {
      from: fmtDate(start), to: fmtDate(new Date(end.getTime() - DAY_MS)),
      count: agg._count, totalAmount: agg._sum.amount ?? 0,
      expenses: list.map(e => ({ name: name.get(e.userId), date: fmtDate(e.date), category: e.category, amount: e.amount, description: e.description, approved: e.approved }))
    };
  },

  async send_notification(a, ctx) {
    const names: string[] = Array.isArray(a.staff) ? a.staff : [a.staff];
    const targets = await Promise.all(names.map(s => findOne(ctx.companyId, String(s))));
    const res: any = await sendBroadcastNotification(ctx.adminId, { userIds: targets.map(t => t.id), title: a.title, message: a.message });
    ctx.action = { type: "notification", sent: res?.count ?? 0, actions: targets.map(t => ({ userId: t.id, title: a.title, message: a.message })) };
    return { sentTo: targets.map(t => t.name), delivered: res?.count ?? 0, skippedAsDuplicateIn30Min: res?.skipped ?? 0 };
  },

  async notify_all_staff(a, ctx) {
    const users = await findStaff(ctx.companyId);
    const res: any = await sendBroadcastNotification(ctx.adminId, { userIds: users.map(u => u.id), title: a.title, message: a.message });
    ctx.action = { type: "bulk_notify", notified: res?.count ?? 0 };
    return { notified: res?.count ?? 0, skippedAsDuplicateIn30Min: res?.skipped ?? 0 };
  },

  async mark_holiday(a, ctx) {
    const date = startOfDay(new Date(a.date));
    if (isNaN(date.getTime())) throw new Error(`Invalid date "${a.date}", use YYYY-MM-DD`);
    const targets = a.staff ? [await findOne(ctx.companyId, a.staff)] : await findStaff(ctx.companyId);
    const existing = await prisma.holiday.findMany({
      where: { companyId: ctx.companyId, date, name: a.name, userId: { in: targets.map(t => t.id) } },
      select: { userId: true }
    });
    const done = new Set(existing.map(h => h.userId));
    const data = targets
      .filter(t => !done.has(t.id))
      .map(t => ({ date, name: a.name, type: "HOLIDAY", companyId: ctx.companyId, userId: t.id }));
    if (data.length) await prisma.holiday.createMany({ data });
    ctx.action = { type: "holiday", holidaysCreated: data.length, holidays: [{ date: a.date, name: a.name }] };
    return { holidaysCreated: data.length, alreadyExisted: done.size };
  }
};

const str = (description: string) => ({ type: "STRING", description });
const DATE = str("Single day YYYY-MM-DD (IST). Omit for today.");
const FROM = str("Range start YYYY-MM-DD (IST)");
const TO = str("Range end YYYY-MM-DD, inclusive");
const STAFF = str("Staff name (partial ok), employee code or phone. Omit for all staff.");
const decl = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  name,
  description,
  parameters: { type: "OBJECT", properties, ...(required.length ? { required } : {}) }
});

const FUNCTIONS = [
  decl("get_day_overview",
    "Company snapshot for ONE day: who checked in/out with times, who has not checked in, on leave, holidays, task counts by status for that day, total overdue tasks, pending leave requests, day-end reports. Best first call for general questions about a day.",
    { date: DATE }),
  decl("get_tasks",
    "Tasks with exact counts by status plus a list (max 60). A task belongs to a day if its due, start or completion time falls on that day. Without date/from/to it searches all dates.",
    { date: DATE, from: FROM, to: TO, staff: STAFF, status: { type: "STRING", enum: TASK_STATUSES, description: "OPEN = PENDING + IN_PROGRESS. OVERDUE = open and past due." } }),
  decl("get_attendance",
    "Attendance. For one day: every staff member's status and check-in/out time. For a range: per-staff summary (days checked in, half days, leave, absent), plus daily rows if one staff is given.",
    { date: DATE, from: FROM, to: TO, staff: STAFF }),
  decl("get_staff_profile",
    "Everything about ONE staff member: contact, manager, group, shift, device battery/location, today's attendance, tasks and day-end report, overdue tasks, this month's attendance, leaves, latest salary slip.",
    { staff: str("Staff name (partial ok), employee code or phone") }, ["staff"]),
  decl("get_leaves", "Leave requests, optionally overlapping a date range.",
    { status: { type: "STRING", enum: ["PENDING", "APPROVED", "REJECTED"] }, date: DATE, from: FROM, to: TO, staff: STAFF }),
  decl("get_day_end_reports", "Day-end reports (visits, orders, km, remarks). For a single day also lists who has not submitted. Defaults to today.",
    { date: DATE, from: FROM, to: TO, staff: STAFF }),
  decl("get_expenses", "Expense claims with total amount. Defaults to the current month.",
    { from: FROM, to: TO, staff: STAFF, approved: { type: "BOOLEAN", description: "true = approved only, false = unapproved only" } }),
  decl("send_notification", "Send a push notification to specific staff. Only when the admin asks to send/remind.",
    { staff: { type: "ARRAY", items: { type: "STRING" }, description: "Staff names" }, title: str("Short title"), message: str("Message text") },
    ["staff", "title", "message"]),
  decl("notify_all_staff", "Send a push notification to every staff member. Only when the admin explicitly asks.",
    { title: str("Short title"), message: str("Message text") }, ["title", "message"]),
  decl("mark_holiday", "Create a holiday for all staff, or for one staff member. Only when the admin explicitly asks.",
    { date: str("YYYY-MM-DD"), name: str("Holiday name"), staff: str("Optional single staff member; omit for everyone") }, ["date", "name"])
];

async function runTool(name: string, args: Args | undefined, ctx: Ctx) {
  const fn = TOOLS[name];
  if (!fn) return { error: `Unknown tool ${name}` };
  try {
    return { result: await fn(args ?? {}, ctx) };
  } catch (err: any) {
    console.warn(`[AI Tool] ${name} failed:`, err?.message);
    return { error: err?.message || String(err) };
  }
}

async function buildSystemPrompt(companyId: string): Promise<string> {
  const staff = await findStaff(companyId);
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" });
  return `Aap "StaffTrack AI" hain: company admin ke liye smart HR aur operations assistant. Company database ka LIVE access aapke tools ke through hai.

Abhi ka samay (IST): ${now}. Aaj ki date: ${fmtDate(getStartOfDayIST())}.

DATA RULES (sabse zaroori):
1. Har data wale sawaal (tasks, attendance, leaves, reports, expenses, salary, kisi staff ke baare mein) ke liye PEHLE tool call karo. Number kabhi andaze se ya purani chat se mat batao, data har baar fresh lo.
2. Tool jo number deta hai wahi exact batao. Tool mein data nahi hai toh saaf bolo ki data nahi mila. Kuch bhi invent mat karo.
3. "aaj", "kal", "parso", "is hafte", "pichle mahine" jaise shabdon ko upar ki date se YYYY-MM-DD mein badal kar tool ko do. "Kal" ka matlab context se samjho (beeta hua ya aane wala).
4. Zarurat ho toh ek se zyada tools call karo aur data ko analyze karke insight do: kaun peeche hai, kya urgent hai, admin ko kya action lena chahiye.
5. Naam ke multiple matches aayen toh admin se poochho kaun sa.
6. send_notification / notify_all_staff / mark_holiday tabhi chalao jab admin saaf bole. "Usko bhej do" jaise reference chat history se samjho.

JAWAB KA STYLE:
- Natural Hinglish (Roman script), polite aur seedha. Pehli line mein direct jawab (exact number), phir zarurat ho toh short details.
- Plain text only: koi markdown (**, #, tables) nahi. List ke liye har line "• " se shuru karo. Lambi list ho toh top 10 dikhao aur baaki ki ginti batao.
- Database IDs kabhi mat dikhao.

STAFF LIST (${staff.length}): ${staff.map(s => `${s.name} (${s.designation || s.role})`).join(", ")}`;
}

type Content = { role: "user" | "model"; parts: any[] };

/** Persistent per-admin chat memory (survives restarts). */
async function loadHistory(userId: string): Promise<Content[]> {
  const rows = await prisma.aiChatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { role: true, text: true }
  });
  rows.reverse();
  while (rows[0]?.role === "model") rows.shift(); // Gemini wants the first turn to be the user's
  return rows.map(r => ({ role: r.role as Content["role"], parts: [{ text: r.text }] }));
}

async function saveTurn(userId: string, question: string, answer: string) {
  const now = Date.now();
  await prisma.aiChatMessage.createMany({
    data: [
      { userId, role: "user", text: question, createdAt: new Date(now) },
      { userId, role: "model", text: answer, createdAt: new Date(now + 1) }
    ]
  });
}

/** Yields every content part from a Gemini SSE stream, as received (keeps thought signatures intact). */
async function* geminiParts(response: Response): AsyncGenerator<any> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const parts = JSON.parse(line.slice(6))?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) yield* parts;
      } catch { /* skip malformed chunks */ }
    }
  }
}

/** Streaming chat — the model queries the DB through tools, then streams its answer. */
export async function* chatWithAssistantStream(adminId: string, companyId: string, userMessage: string): AsyncGenerator<string> {
  try {
    const [systemPrompt, history] = await Promise.all([buildSystemPrompt(companyId), loadHistory(adminId)]);
    const contents: Content[] = [...history, { role: "user", parts: [{ text: userMessage }] }];
    const ctx: Ctx = { adminId, companyId };
    let answer = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = await streamGeminiWithFallback(
        {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          tools: [{ functionDeclarations: FUNCTIONS }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
        },
        { models: CHAT_MODELS, timeoutMs: 30_000 }
      );
      if (!stream) {
        yield "Sorry, AI assistant abhi available nahi hai. Thodi der baad try karein.";
        return;
      }

      const modelParts: any[] = [];
      for await (const part of geminiParts(stream.response)) {
        modelParts.push(part);
        if (part.text && !part.thought) {
          answer += part.text;
          yield part.text;
        }
      }

      const calls = modelParts.filter(p => p.functionCall).map(p => p.functionCall);
      if (calls.length === 0) break;

      contents.push({ role: "model", parts: modelParts });
      const responses = await Promise.all(
        calls.map(async c => ({ functionResponse: { id: c.id, name: c.name, response: await runTool(c.name, c.args, ctx) } }))
      );
      contents.push({ role: "user", parts: responses });
    }

    if (!answer.trim()) {
      answer = "Maaf kijiye, is sawaal ka data nikal nahi paya. Thoda specific karke dobara poochiye.";
      yield answer;
    }
    if (ctx.action) yield `__ACTION_RESULT__${JSON.stringify(ctx.action)}`;
    await saveTurn(adminId, userMessage, answer.trim());
  } catch (err: any) {
    console.warn("[AI Stream] Error:", err?.message);
    yield "Sorry, AI assistant is currently unavailable. Please check your connection.";
  }
}

/** Non-streaming chat — same pipeline, collected into one reply. */
export async function chatWithAssistant(adminId: string, companyId: string, userMessage: string): Promise<string> {
  let reply = "";
  for await (const chunk of chatWithAssistantStream(adminId, companyId, userMessage)) {
    if (!chunk.startsWith("__ACTION_RESULT__")) reply += chunk;
  }
  return reply;
}

/** Clear chat memory for an admin */
export async function clearChatSession(adminId: string) {
  await prisma.aiChatMessage.deleteMany({ where: { userId: adminId } });
}



/** Smart Notification Algorithm — analyzes staff data and generates suggested notifications */
export async function generateSmartNotifications(companyId: string): Promise<SmartNotification[]> {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const todayStr = today.toISOString().slice(0, 10);
  const currentHour = today.getHours();

  const users = await prisma.user.findMany({
    where: { companyId, role: { in: ["EMPLOYEE", "MANAGER"] } },
    select: { id: true, name: true }
  });

  const attendance = await prisma.attendance.findMany({
    where: { date: { gte: monthStart }, user: { companyId } },
    select: { userId: true, date: true, status: true, checkInTime: true, checkOutTime: true }
  });

  const tasks = await prisma.task.findMany({
    where: {
      assignedToId: { in: users.map(u => u.id) },
      status: { in: ["PENDING", "IN_PROGRESS"] },
      dueDate: { lt: today }
    },
    select: { assignedToId: true, title: true, dueDate: true }
  });

  // DER check
  const dayEndReports = await prisma.dayEndReport.findMany({
    where: {
      userId: { in: users.map(u => u.id) },
      date: { gte: new Date(todayStr) }
    },
    select: { userId: true }
  });
  const derUserIds = new Set(dayEndReports.map(d => d.userId));

  const notifications: SmartNotification[] = [];

  for (const user of users) {
    const userAttendance = attendance.filter(a => a.userId === user.id);
    const absences = userAttendance.filter(a => a.status === "ABSENT").length;
    const presents = userAttendance.filter(a => a.status === "PRESENT").length;
    const workingDays = userAttendance.length;
    const attendancePct = workingDays > 0 ? (presents / workingDays) * 100 : 100;

    const todayPunch = userAttendance.find(a => a.date.toISOString().slice(0, 10) === todayStr);
    const isCheckedIn = Boolean(todayPunch?.checkInTime);
    const isCheckedOut = Boolean(todayPunch?.checkOutTime);

    const userOverdueTasks = tasks.filter(t => t.assignedToId === user.id);

    // Rule 1: 3+ absences this month
    if (absences >= 3) {
      notifications.push({
        id: `absence-${user.id}`,
        userId: user.id,
        userName: user.name,
        type: "ABSENCE_WARNING",
        title: "Attendance Warning",
        message: `${user.name}, you have been absent ${absences} times this month. Please ensure regular attendance to avoid salary deduction.`,
        severity: absences >= 5 ? "high" : "medium",
        data: { absences, attendancePct: Math.round(attendancePct) }
      });
    }

    // Rule 2: 2+ overdue tasks
    if (userOverdueTasks.length >= 2) {
      notifications.push({
        id: `tasks-${user.id}`,
        userId: user.id,
        userName: user.name,
        type: "TASK_REMINDER",
        title: "Overdue Tasks Reminder",
        message: `${user.name}, you have ${userOverdueTasks.length} overdue tasks. Please complete them as soon as possible.`,
        severity: userOverdueTasks.length >= 4 ? "high" : "medium",
        data: { overdueTasks: userOverdueTasks.length }
      });
    }

    // Rule 3: Not checked in after 10:30 AM on a workday
    if (!isCheckedIn && currentHour >= 10 && currentHour < 14) {
      notifications.push({
        id: `checkin-${user.id}`,
        userId: user.id,
        userName: user.name,
        type: "CHECKIN_REMINDER",
        title: "Check-in Reminder",
        message: `${user.name}, you haven't checked in yet today. Please mark your attendance.`,
        severity: "low",
        data: { currentTime: today.toLocaleTimeString() }
      });
    }

    // Rule 4: Low attendance % (< 75%)
    if (attendancePct < 75 && workingDays >= 10) {
      notifications.push({
        id: `salary-warn-${user.id}`,
        userId: user.id,
        userName: user.name,
        type: "SALARY_WARNING",
        title: "Salary Deduction Warning",
        message: `${user.name}, your attendance this month is ${Math.round(attendancePct)}%, which is below 75%. This may affect your salary.`,
        severity: "high",
        data: { attendancePct: Math.round(attendancePct) }
      });
    }

    // Rule 5: No DER submitted after 6 PM for checked-in staff
    if (isCheckedIn && !isCheckedOut && currentHour >= 18 && !derUserIds.has(user.id)) {
      notifications.push({
        id: `der-${user.id}`,
        userId: user.id,
        userName: user.name,
        type: "DER_REMINDER",
        title: "Day End Report Reminder",
        message: `${user.name}, please submit your Day End Report before checking out.`,
        severity: "low",
        data: {}
      });
    }
  }

  // Sort: high severity first
  return notifications.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}

/** Send selected notifications to staff via push + DB */
export async function sendSmartNotifications(
  adminId: string,
  notifications: Array<{ userId: string; title: string; message: string }>
): Promise<{ sent: number }> {
  const results = await Promise.allSettled(
    notifications.map(n =>
      sendBroadcastNotification(adminId, {
        userIds: [n.userId],
        title: n.title,
        message: n.message
      })
    )
  );
  const sent = results.filter(r => r.status === "fulfilled").length;
  return { sent };
}
