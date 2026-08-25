import { TaskStatus, UserRole } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { monthRange, startOfDay } from "../lib/date";
import { prisma } from "../lib/prisma";
import { ensureCanAccessUser, getManagerGroupId } from "./access.service";
import * as notificationService from "./notification.service";

interface DayEndReportInput {
  date: Date;
  visitsSummary: string;
  ordersTaken: number;
  ordersCancelled: number;
  kmTravelled: number;
  kmPhotoUrl?: string;
  startOdometer?: number;
  endOdometer?: number;
  startOdometerPhotoUrl?: string;
  remarks: string;
}

type PerformanceMetrics = {
  completedTasksCount: number;
  pendingTasksCount: number;
  taskPoints: number;
  orderPoints: number;
  kmPoints: number;
  cancellationPenalty: number;
  totalPoints: number;
};

export async function createDayEndReport(actor: AuthUser, input: DayEndReportInput) {
  const reportDate = startOfDay(input.date);

  const existing = await prisma.dayEndReport.findUnique({
    where: {
      userId_date: {
        userId: actor.id,
        date: reportDate
      }
    }
  });

  const updateData: any = {
    visitsSummary: input.visitsSummary,
    ordersTaken: input.ordersTaken,
    ordersCancelled: input.ordersCancelled,
    remarks: input.remarks,
    submittedAt: new Date()
  };

  if (input.kmTravelled !== undefined) {
    updateData.kmTravelled = input.kmTravelled;
  }

  // Preserve existing photos if input doesn't provide new ones
  if (input.kmPhotoUrl !== undefined && input.kmPhotoUrl !== null) {
    updateData.kmPhotoUrl = input.kmPhotoUrl;
  } else if (existing?.kmPhotoUrl) {
    updateData.kmPhotoUrl = existing.kmPhotoUrl;
  }

  if (input.startOdometerPhotoUrl !== undefined && input.startOdometerPhotoUrl !== null) {
    updateData.startOdometerPhotoUrl = input.startOdometerPhotoUrl;
  } else if (existing?.startOdometerPhotoUrl) {
    updateData.startOdometerPhotoUrl = existing.startOdometerPhotoUrl;
  }

  if (input.startOdometer !== undefined && input.startOdometer !== null) {
    updateData.startOdometer = input.startOdometer;
  } else if (existing?.startOdometer) {
    updateData.startOdometer = existing.startOdometer;
  }

  if (input.endOdometer !== undefined && input.endOdometer !== null) {
    updateData.endOdometer = input.endOdometer;
  } else if (existing?.endOdometer) {
    updateData.endOdometer = existing.endOdometer;
  }

  const report = await prisma.dayEndReport.upsert({
    where: {
      userId_date: {
        userId: actor.id,
        date: reportDate
      }
    },
    update: updateData,
    create: {
      userId: actor.id,
      date: reportDate,
      visitsSummary: input.visitsSummary,
      ordersTaken: input.ordersTaken,
      ordersCancelled: input.ordersCancelled,
      kmTravelled: input.kmTravelled,
      kmPhotoUrl: input.kmPhotoUrl,
      startOdometer: input.startOdometer,
      endOdometer: input.endOdometer,
      startOdometerPhotoUrl: input.startOdometerPhotoUrl,
      remarks: input.remarks
    }
  });

  const metrics = await calculatePerformanceMetrics(actor.id, reportDate, report);

  await notificationService.createNotification(
    actor.id,
    "Day End Report Submitted",
    `You earned ${metrics.totalPoints} points today. ${metrics.pendingTasksCount} pending task(s) will move to the next day.`,
    "DAY_END_REPORT"
  );

  return {
    ...report,
    ...metrics
  };
}

export async function getDayEndReportHistory(actor: AuthUser, userId: string, limit: number = 15) {
  await ensureCanAccessUser(actor, userId);

  const reports = await prisma.dayEndReport.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: limit
  });

  return Promise.all(
    reports.map(async (report) => ({
      ...report,
      ...(await calculatePerformanceMetrics(userId, report.date, report))
    }))
  );
}

export async function listDayEndReports(actor: AuthUser, userId?: string) {
  const where: any = {
    user: {
      companyId: actor.companyId,
      role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] }
    }
  };

  if (actor.role === UserRole.EMPLOYEE) {
    // Employees can only ever see their own day-end reports.
    where.userId = actor.id;
  } else if (actor.role === UserRole.MANAGER) {
    const managerGroupId = await getManagerGroupId(actor.id);
    where.user = {
      companyId: actor.companyId,
      OR: [
        { id: actor.id },
        { managerId: actor.id },
        ...(managerGroupId ? [{ groupId: managerGroupId }] : [])
      ]
    };
    if (userId) where.userId = userId;
  } else if (userId) {
    where.userId = userId;
  }

  const reports = await prisma.dayEndReport.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          workMode: true
        }
      }
    },
    orderBy: { date: "desc" }
  });

  return Promise.all(
    reports.map(async (report) => ({
      ...report,
      ...(await calculatePerformanceMetrics(report.userId, report.date, report))
    }))
  );
}

export async function getMonthlyPerformanceReport(actor: AuthUser, userId: string, month: number, year: number) {
  await ensureCanAccessUser(actor, userId);

  const { start: startDate, end: endDate } = monthRange(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();

  const [attendances, reports, expenses, user, holidays, completedTasks, pendingTasks, leaveRequests] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId, date: { gte: startDate, lt: endDate } },
      include: { breaks: true },
      orderBy: [{ date: "asc" }, { checkInTime: "asc" }]
    }),
    prisma.dayEndReport.findMany({
      where: { userId, date: { gte: startDate, lt: endDate } }
    }),
    prisma.expense.findMany({
      where: { userId, date: { gte: startDate, lt: endDate }, approved: true }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      include: { group: true }
    }),
    prisma.holiday.findMany({
      where: {
        companyId: actor.companyId,
        date: { gte: startDate, lt: endDate },
        OR: [
          { userId },
          { groupId: { not: null } },
          { groupId: null, userId: null }
        ]
      }
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: TaskStatus.COMPLETED,
        updatedAt: {
          gte: startDate,
          lt: endDate
        }
      },
      select: {
        id: true,
        title: true,
        points: true,
        updatedAt: true
      }
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        dueDate: {
          gte: startDate,
          lt: endDate
        }
      },
      select: {
        id: true,
        title: true,
        points: true,
        dueDate: true
      }
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId,
        // Any leave whose span overlaps the selected month.
        startDate: { lt: endDate },
        endDate: { gte: startDate }
      },
      orderBy: { startDate: "asc" }
    })
  ]);

  if (!user) throw new Error("User not found");

  const applicableHolidays = holidays.filter((holiday) =>
    holiday.userId === userId ||
    (holiday.groupId && holiday.groupId === user.groupId) ||
    (!holiday.groupId && !holiday.userId)
  );

  const holidayDates = new Set(
    applicableHolidays
      .filter((holiday) => holiday.type === "HOLIDAY")
      .map((holiday) => toDateKey(holiday.date))
  );
  const attendanceByDate = new Map<string, typeof attendances>();
  const reportByDate = new Map(reports.map((report) => [toDateKey(report.date), report]));
  const completedTasksByDate = groupTasksByDate(completedTasks, "updatedAt");
  const pendingTasksByDate = groupTasksByDate(pendingTasks, "dueDate");

  for (const attendance of attendances) {
    const key = toDateKey(attendance.date);
    const rows = attendanceByDate.get(key) ?? [];
    rows.push(attendance);
    attendanceByDate.set(key, rows);
  }

  let presentDays = 0;
  let halfDays = 0;
  let onLeave = 0;
  let absentDays = 0;
  const paidHolidays = holidayDates.size;
  const dailyLogs = [];

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  for (let day = 1; day <= daysInMonth; day++) {
    const yyyy = year;
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayDate = new Date(yyyy, month - 1, day, 0, 0, 0, 0);

    const rows = attendanceByDate.get(dateStr) ?? [];
    let status = "ABSENT";

    const dayOfWeek = dayDate.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0; // Only Sunday is a weekend

    if (rows.length > 0) {
      status = resolveDayStatus(rows);
    } else if (holidayDates.has(dateStr)) {
      status = "HOLIDAY";
    } else if (isWeekend) {
      status = "WEEKEND";
    } else if (dayDate > today) {
      status = "UPCOMING";
    }

    if (status === "PRESENT") presentDays++;
    else if (status === "HALF_DAY") halfDays++;
    else if (status === "ON_LEAVE") onLeave++;
    else if (status === "ABSENT") absentDays++;

    const report = reportByDate.get(dateStr);
    const completedTaskRows = completedTasksByDate.get(dateStr) ?? [];
    const pendingCount = pendingTasksByDate.get(dateStr)?.length ?? 0;
    const dailyPoints = calculatePoints(report, completedTaskRows, pendingCount);

    dailyLogs.push({
      date: dateStr,
      status,
      sessionCount: rows.filter((row) => row.checkInTime).length,
      punchTypes: Array.from(new Set(rows.map((row) => row.punchType).filter(Boolean))),
      checkInTime: rows.find((row) => row.checkInTime)?.checkInTime ?? null,
      checkOutTime: rows.slice().reverse().find((row) => row.checkOutTime)?.checkOutTime ?? null,
      completedTasksCount: completedTaskRows.length,
      pendingTasksCount: pendingCount,
      points: dailyPoints.totalPoints
    });
  }

  const totalKm = reports.reduce((sum, report) => {
    if (report.endOdometer !== null && report.startOdometer !== null && report.endOdometer >= report.startOdometer) {
      return sum + (report.endOdometer - report.startOdometer);
    }
    return sum + report.kmTravelled;
  }, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const monthlyPoints = dailyLogs.reduce((sum, log) => sum + log.points, 0);

  const baseSalary = user.group?.baseSalary || user.baseSalary || 0;
  const dailyRate = baseSalary / daysInMonth;
  const deductions = ((absentDays + onLeave) * dailyRate) + (halfDays * 0.5 * dailyRate);
  const finalSalary = Math.max(0, baseSalary - deductions);

  // Task rollup for the month.
  const completedTaskPoints = completedTasks.reduce((sum, t) => sum + Number(t.points ?? 0), 0);
  const pendingTaskPoints = pendingTasks.reduce((sum, t) => sum + Number(t.points ?? 0), 0);
  const tasksSummary = {
    completedCount: completedTasks.length,
    pendingCount: pendingTasks.length,
    completedPoints: completedTaskPoints,
    possiblePoints: completedTaskPoints + pendingTaskPoints,
    completed: completedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      points: t.points ?? 0,
      date: t.updatedAt
    })),
    pending: pendingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      points: t.points ?? 0,
      dueDate: t.dueDate
    }))
  };

  // Leaves overlapping the month.
  const countLeaveDays = (start: Date, end: Date) => {
    const from = new Date(Math.max(startOfDay(start).getTime(), startDate.getTime()));
    const to = new Date(Math.min(startOfDay(end).getTime(), new Date(endDate.getTime() - 1).getTime()));
    return Math.max(0, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  };
  const leaves = leaveRequests.map((leave) => ({
    id: leave.id,
    startDate: leave.startDate,
    endDate: leave.endDate,
    reason: leave.reason,
    status: leave.status,
    days: countLeaveDays(leave.startDate, leave.endDate)
  }));

  // Holiday list for the month.
  const holidaysList = applicableHolidays
    .filter((holiday) => holiday.type === "HOLIDAY")
    .map((holiday) => ({
      id: holiday.id,
      date: holiday.date,
      name: holiday.name
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    month,
    year,
    user: {
      name: user.name,
      designation: user.designation,
      joiningDate: user.joiningDate,
      groupName: user.group?.name
    },
    stats: {
      presentDays,
      halfDays,
      onLeave,
      absentDays,
      paidHolidays,
      totalKm,
      totalExpenses,
      monthlyPoints,
      tasksCompleted: tasksSummary.completedCount,
      tasksPending: tasksSummary.pendingCount,
      taskPoints: completedTaskPoints
    },
    payroll: {
      baseSalary,
      deductions,
      finalSalary,
      dailyRate
    },
    tasks: tasksSummary,
    leaves,
    holidays: holidaysList,
    dailyLogs: dailyLogs.sort((a, b) => a.date.localeCompare(b.date))
  };
}

/**
 * Comprehensive single-day summary used by the enriched Day End Report on both
 * the staff app and the admin web. Combines attendance (auto check-in/out times,
 * odometer km), completed/pending task counts with their completion details
 * (remarks, checklist Q&A, points), points earned vs possible, and any forms the
 * user submitted that day.
 */
export async function getDaySummary(actor: AuthUser, userId: string, date: Date) {
  await ensureCanAccessUser(actor, userId);

  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [user, attendances, report, completedTasks, pendingTasks, formResponses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, designation: true, workMode: true }
    }),
    prisma.attendance.findMany({
      where: { userId, date: { gte: dayStart, lt: dayEnd } },
      orderBy: { checkInTime: "asc" }
    }),
    prisma.dayEndReport.findUnique({
      where: { userId_date: { userId, date: dayStart } }
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: TaskStatus.COMPLETED,
        updatedAt: { gte: dayStart, lt: dayEnd }
      },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        points: true,
        completionRemarks: true,
        completionPhotoUrl: true,
        checklist: true,
        checklistResponses: true,
        updatedAt: true
      },
      orderBy: { updatedAt: "asc" }
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        dueDate: { lt: dayEnd }
      },
      select: { id: true, title: true, priority: true, points: true, dueDate: true }
    }),
    prisma.formResponse.findMany({
      where: { userId, submittedAt: { gte: dayStart, lt: dayEnd } },
      include: { form: { include: { fields: true } } },
      orderBy: { submittedAt: "asc" }
    })
  ]);

  // Attendance: earliest check-in, latest check-out, odometer readings.
  const checkInTime = attendances.find((a) => a.checkInTime)?.checkInTime ?? null;
  const checkOutTime =
    attendances.slice().reverse().find((a) => a.checkOutTime)?.checkOutTime ?? null;
  const startOdometer = attendances.find((a) => a.startOdometer != null)?.startOdometer ?? report?.startOdometer ?? null;
  const endOdometer =
    attendances.slice().reverse().find((a) => a.endOdometer != null)?.endOdometer ?? report?.endOdometer ?? null;

  let kmTravelled = report?.kmTravelled ?? 0;
  if (startOdometer != null && endOdometer != null && endOdometer >= startOdometer) {
    kmTravelled = endOdometer - startOdometer;
  }

  const metrics = await calculatePerformanceMetrics(userId, dayStart, report ?? {
    ordersTaken: 0,
    ordersCancelled: 0,
    kmTravelled,
    startOdometer,
    endOdometer
  });

  const completedPoints = completedTasks.reduce((sum, t) => sum + Number(t.points ?? 0), 0);
  const pendingPoints = pendingTasks.reduce((sum, t) => sum + Number(t.points ?? 0), 0);
  const possibleTaskPoints = completedPoints + pendingPoints;

  // Map each form response's stored JSON onto its field labels for readable Q&A.
  const forms = formResponses.map((fr) => {
    let parsed: Record<string, any> = {};
    try {
      parsed = JSON.parse(fr.data || "{}");
    } catch {
      parsed = {};
    }
    const fields = fr.form?.fields ?? [];
    const answers = fields.length
      ? fields.map((f) => ({
          question: f.label,
          answer: formatFormAnswer(parsed[f.id] ?? parsed[f.label])
        }))
      : Object.entries(parsed).map(([question, answer]) => ({
          question,
          answer: formatFormAnswer(answer)
        }));
    return {
      id: fr.id,
      formName: fr.form?.name ?? "Form",
      submittedAt: fr.submittedAt,
      answers
    };
  });

  return {
    date: dayStart,
    user,
    attendance: {
      checkInTime,
      checkOutTime,
      startOdometer,
      endOdometer,
      kmTravelled
    },
    report: report
      ? { ...report, ...metrics }
      : { ...metrics, kmTravelled, startOdometer, endOdometer, remarks: null, visitsSummary: null, ordersTaken: 0, ordersCancelled: 0 },
    tasks: {
      completed: completedTasks,
      pending: pendingTasks,
      completedCount: completedTasks.length,
      pendingCount: pendingTasks.length,
      pointsEarned: completedPoints,
      pointsPossible: possibleTaskPoints
    },
    points: {
      taskPoints: metrics.taskPoints,
      orderPoints: metrics.orderPoints,
      kmPoints: metrics.kmPoints,
      cancellationPenalty: metrics.cancellationPenalty,
      totalPoints: metrics.totalPoints,
      taskPointsEarned: completedPoints,
      taskPointsPossible: possibleTaskPoints
    },
    forms
  };
}

function formatFormAnswer(value: any): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map((v) => formatFormAnswer(v)).join(", ");
  if (typeof value === "object") {
    if (value.url || value.name) return value.name || value.url;
    return JSON.stringify(value);
  }
  return String(value);
}

async function calculatePerformanceMetrics(
  userId: string,
  date: Date,
  report: {
    ordersTaken: number;
    ordersCancelled: number;
    kmTravelled: number;
    startOdometer?: number | null;
    endOdometer?: number | null;
  }
) {
  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [completedTasks, pendingTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: TaskStatus.COMPLETED,
        updatedAt: {
          gte: dayStart,
          lt: dayEnd
        }
      },
      select: {
        id: true,
        points: true,
        updatedAt: true
      }
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        dueDate: {
          lt: dayEnd
        }
      },
      select: {
        id: true,
        dueDate: true
      }
    })
  ]);

  return calculatePoints(report, completedTasks, pendingTasks.length);
}

function calculatePoints(
  report:
    | {
        ordersTaken: number;
        ordersCancelled: number;
        kmTravelled: number;
        startOdometer?: number | null;
        endOdometer?: number | null;
      }
    | undefined,
  completedTasks: Array<{ points: number | null }>,
  pendingTasksCount: number
): PerformanceMetrics {
  const taskPoints = completedTasks.reduce((sum, task) => sum + Number(task.points ?? 0), 0);
  const orderPoints = Number(report?.ordersTaken ?? 0) * 2;
  const cancellationPenalty = Number(report?.ordersCancelled ?? 0);
  
  let kmVal = Number(report?.kmTravelled ?? 0);
  if (
    report?.endOdometer !== null &&
    report?.endOdometer !== undefined &&
    report?.startOdometer !== null &&
    report?.startOdometer !== undefined &&
    report.endOdometer >= report.startOdometer
  ) {
    kmVal = report.endOdometer - report.startOdometer;
  }
  const kmPoints = Math.floor(kmVal / 10);
  const totalPoints = Math.max(0, taskPoints + orderPoints + kmPoints - cancellationPenalty);

  return {
    completedTasksCount: completedTasks.length,
    pendingTasksCount,
    taskPoints,
    orderPoints,
    kmPoints,
    cancellationPenalty,
    totalPoints
  };
}

function groupTasksByDate<T extends Record<string, any>>(tasks: T[], field: keyof T) {
  const map = new Map<string, T[]>();

  for (const task of tasks) {
    const key = toDateKey(task[field]);
    const rows = map.get(key) ?? [];
    rows.push(task);
    map.set(key, rows);
  }

  return map;
}

function toDateKey(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function resolveDayStatus(
  rows: Array<{ status: string; checkInApproved?: boolean; isCheckInPending?: boolean }>
) {
  // A late check-in awaiting manager/admin approval must NOT count as present yet.
  const isApprovedPresent = (row: { status: string; checkInApproved?: boolean }) =>
    row.status === "PRESENT" && row.checkInApproved !== false;

  if (rows.some(isApprovedPresent)) return "PRESENT";
  if (rows.some((row) => row.status === "HALF_DAY")) return "HALF_DAY";
  if (rows.some((row) => row.status === "ON_LEAVE")) return "ON_LEAVE";
  // Only an unapproved (pending) check-in remains for this day → show as PENDING, count neither present nor absent.
  if (rows.some((row) => row.status === "PRESENT")) return "PENDING";
  if (rows.some((row) => row.status === "ABSENT")) return "ABSENT";
  return rows[0]?.status ?? "ABSENT";
}

export async function renderDayEndReportHtml(actor: AuthUser, targetUserId: string, targetDate: Date): Promise<string> {
  const userId = targetUserId || actor.id;
  const reportDate = startOfDay(targetDate);
  const nextDate = new Date(reportDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const startOfMonth = new Date(reportDate.getFullYear(), reportDate.getMonth(), 1);

  const [user, report, attendance, mtdReports, completedTasks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { company: true, group: true }
    }),
    prisma.dayEndReport.findUnique({
      where: { userId_date: { userId, date: reportDate } }
    }),
    prisma.attendance.findFirst({
      where: { userId, date: reportDate },
      include: { breaks: true }
    }),
    prisma.dayEndReport.findMany({
      where: {
        userId,
        date: { gte: startOfMonth, lte: reportDate }
      }
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: TaskStatus.COMPLETED,
        updatedAt: { gte: reportDate, lt: nextDate }
      }
    })
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  const monthToDateKm = mtdReports.reduce((sum, r) => sum + (r.kmTravelled || 0), 0);

  // Format work time
  let workTimeLabel = "0h 0m";
  let breakTimeLabel = "0h 0m";
  if (attendance?.checkInTime && attendance?.checkOutTime) {
    const totalMs = new Date(attendance.checkOutTime).getTime() - new Date(attendance.checkInTime).getTime();
    const breakMs = (attendance.breaks || []).reduce((acc, b) => {
      if (b.startTime && b.endTime) {
        return acc + (new Date(b.endTime).getTime() - new Date(b.startTime).getTime());
      }
      return acc;
    }, 0);
    const netMs = Math.max(0, totalMs - breakMs);
    const mins = Math.floor(netMs / (1000 * 60));
    workTimeLabel = `${Math.floor(mins / 60)}h ${mins % 60}m`;
    const bMins = Math.floor(breakMs / (1000 * 60));
    breakTimeLabel = `${Math.floor(bMins / 60)}h ${bMins % 60}m`;
  }

  const calculatedKm = attendance?.endOdometer !== null && attendance?.endOdometer !== undefined && attendance?.startOdometer !== null && attendance?.startOdometer !== undefined
    ? Math.max(0, attendance.endOdometer - attendance.startOdometer)
    : 0;

  const currentReport: any = report || {
    date: reportDate,
    kmTravelled: calculatedKm,
    ordersTaken: 0,
    ordersCancelled: 0,
    startOdometer: attendance?.startOdometer,
    endOdometer: attendance?.endOdometer,
    startOdometerPhotoUrl: attendance?.startOdometerPhotoUrl,
    kmPhotoUrl: attendance?.endOdometerPhotoUrl,
    visitsSummary: "Field Work Mode",
    remarks: "",
    submittedAt: attendance?.checkOutTime || new Date()
  };

  const formattedDate = reportDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const formattedSubmittedAt = new Date(currentReport.submittedAt || new Date()).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });

  const completedCount = completedTasks.length;
  const countBannerText = `${completedCount} Completed`;

  const parseTaskDetails = (t: any) => {
    let locationCoords = "";
    if (t.completionLat != null && t.completionLng != null) {
      locationCoords = `${Number(t.completionLat).toFixed(4)}, ${Number(t.completionLng).toFixed(4)}`;
    } else if (t.lat != null && t.lng != null) {
      locationCoords = `${Number(t.lat).toFixed(4)}, ${Number(t.lng).toFixed(4)}`;
    }

    let personName = "";
    let contact = "";
    let village = "";
    let crop = "";
    let land = "";
    let product = "";
    const extraParts: string[] = [];

    if (t.checklistResponses && Array.isArray(t.checklistResponses) && t.checklistResponses.length > 0) {
      for (const item of t.checklistResponses) {
        const val = item.value !== undefined ? String(item.value).trim() : (item.response !== undefined ? String(item.response).trim() : (item.text !== undefined ? String(item.text).trim() : ""));
        if (!val || item.type === "IMAGE" || item.type === "VIDEO" || item.type === "AUDIO") continue;

        const title = (item.title || item.label || item.id || "").toLowerCase();
        if (item.type === "GEOTAG" || title.includes("location") || title.includes("geotag")) {
          if (!locationCoords) locationCoords = val;
        } else if (title.includes("farmer name") || title.includes("dealer name") || title === "name" || title.includes("person") || title.includes("customer")) {
          personName = val;
        } else if (title.includes("contact") || title.includes("phone") || title.includes("mobile") || title.includes("number")) {
          contact = val;
        } else if (title.includes("village") || title.includes("place") || title.includes("area") || title.includes("city")) {
          village = val;
        } else if (title.includes("crop")) {
          crop = val;
        } else if (title.includes("farmland") || title.includes("land") || title.includes("acre")) {
          land = val;
        } else if (title.includes("product") || title.includes("item")) {
          product = val;
        } else if (!title.includes("remark")) {
          extraParts.push(val);
        }
      }
    }

    // Fallback if person name in description
    if (!personName && t.description && t.description.includes("—")) {
      const parts = t.description.split("—");
      if (parts.length > 1) personName = parts[1].trim();
    }

    const detailsParts: string[] = [];
    if (crop) detailsParts.push(`${crop}${land ? ` (${land} Acr)` : ''}`);
    else if (land) detailsParts.push(`${land} Acr`);
    if (product) detailsParts.push(product);
    if (extraParts.length > 0) detailsParts.push(...extraParts.slice(0, 2));
    const detailsText = detailsParts.length > 0 ? detailsParts.join(" • ") : (t.description || "");

    let photo: string | null = t.completionPhotoUrl || null;
    if (!photo && t.checklistResponses && Array.isArray(t.checklistResponses)) {
      const img = t.checklistResponses.find((item: any) => 
        item.type === "IMAGE" && (item.fileUrl || item.photoUrl || item.image || item.url)
      );
      if (img) photo = img.fileUrl || img.photoUrl || img.image || img.url;
    }

    return {
      title: t.title || "Task",
      personName,
      village,
      detailsText,
      contact,
      coords: locationCoords,
      points: t.points ?? 10,
      photoUrl: photo,
      remarks: t.completionRemarks || ""
    };
  };

  let tasksGridHtml = "";
  if (completedTasks.length === 0) {
    tasksGridHtml = `<p style="font-size: 10px; color: #94a3b8; font-style: italic; margin: 0; padding: 4px 0;">No completed tasks recorded on this date.</p>`;
  } else {
    const tableRows = completedTasks.map((t, idx) => {
      const row = parseTaskDetails(t);
      const isEven = idx % 2 === 0;
      return `
        <tr style="background: ${isEven ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 4px 6px; border: 1px solid #e2e8f0; vertical-align: middle;">
            <div style="font-weight: 800; color: #16a34a; font-size: 8.5px; white-space: nowrap;">
              ✅ ${row.title}
            </div>
            ${row.personName ? `<div style="font-weight: 700; color: #0f172a; font-size: 8px; margin-top: 1px;">— ${row.personName}</div>` : ""}
          </td>
          <td style="padding: 4px 6px; border: 1px solid #e2e8f0; vertical-align: middle; color: #334155; font-size: 8px; font-weight: 600;">
            ${row.village ? `📍 ${row.village}` : '<span style="color: #cbd5e1;">--</span>'}
          </td>
          <td style="padding: 4px 6px; border: 1px solid #e2e8f0; vertical-align: middle; color: #334155; font-size: 8px;">
            ${row.detailsText ? row.detailsText : '<span style="color: #cbd5e1;">--</span>'}
          </td>
          <td style="padding: 4px 6px; border: 1px solid #e2e8f0; vertical-align: middle; color: #0f172a; font-size: 8px; font-weight: 700; white-space: nowrap;">
            ${row.contact ? `📞 ${row.contact}` : '<span style="color: #cbd5e1;">--</span>'}
          </td>
          <td style="padding: 4px 6px; border: 1px solid #e2e8f0; vertical-align: middle; color: #0284c7; font-size: 7.5px; font-weight: 700; white-space: nowrap;">
            ${row.coords ? `🌐 ${row.coords}` : '<span style="color: #cbd5e1;">--</span>'}
          </td>
          <td style="padding: 4px 6px; border: 1px solid #e2e8f0; vertical-align: middle; text-align: center; white-space: nowrap;">
            <span style="font-size: 7.5px; font-weight: 800; color: #16a34a; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1px 4px; border-radius: 3px;">+${row.points} pts</span>
          </td>
          <td style="padding: 4px 6px; border: 1px solid #e2e8f0; vertical-align: middle; text-align: center;">
            ${row.photoUrl ? `<img src="${row.photoUrl}" style="width: 28px; height: 28px; border-radius: 3px; object-fit: cover; border: 1px solid #cbd5e1;" alt="Pic" />` : '<span style="color: #cbd5e1; font-size: 7px;">No pic</span>'}
          </td>
        </tr>
      `;
    }).join("");

    tasksGridHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 3px; font-size: 8px; table-layout: auto;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 7.5px; font-weight: 800; letter-spacing: 0.3px;">
            <th style="padding: 4px 6px; text-align: left; border: 1px solid #e2e8f0;">Task / Name</th>
            <th style="padding: 4px 6px; text-align: left; border: 1px solid #e2e8f0;">Place / Location</th>
            <th style="padding: 4px 6px; text-align: left; border: 1px solid #e2e8f0;">Details / Crop</th>
            <th style="padding: 4px 6px; text-align: left; border: 1px solid #e2e8f0;">Contact</th>
            <th style="padding: 4px 6px; text-align: left; border: 1px solid #e2e8f0;">Coordinates</th>
            <th style="padding: 4px 6px; text-align: center; border: 1px solid #e2e8f0;">Points</th>
            <th style="padding: 4px 6px; text-align: center; border: 1px solid #e2e8f0;">Photo</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;
  }

  const startPhoto = currentReport.startOdometerPhotoUrl;
  const endPhoto = currentReport.kmPhotoUrl;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day End Report - ${formattedDate}</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; padding: 12px 16px; background: #ffffff; margin: 0; }
    @media print {
      body { padding: 8px 12px; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div style="max-width: 820px; margin: 0 auto;">
    <!-- Header Bar -->
    <div style="height: 4px; background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%); border-radius: 2px; margin-bottom: 10px;"></div>

    <!-- Main Header Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
      <tr>
        <td style="vertical-align: top;">
          <h1 style="font-size: 18px; font-weight: 800; color: #1e293b; margin: 0; letter-spacing: -0.5px;">DAY END REPORT</h1>
          <p style="font-size: 9px; font-weight: 700; color: #2563eb; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.8px;">${user.company?.name || "Vaniki Crop Science Pvt Ltd"}</p>
        </td>
        <td style="vertical-align: top; text-align: right;">
          <h2 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0;">${user.name}</h2>
          <p style="font-size: 9.5px; font-weight: 600; color: #64748b; margin: 2px 0 0 0;">${user.designation || 'Field Representative'} &bull; ${user.email}</p>
        </td>
      </tr>
    </table>

    <!-- Meta Stats Row (4 Columns Compact) -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
      <tr>
        <td style="width: 25%; padding-right: 3px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 6px; text-align: center; box-sizing: border-box;">
            <p style="font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0 0 2px 0;">Report Date</p>
            <p style="font-size: 11px; font-weight: 800; color: #1e293b; margin: 0;">${formattedDate}</p>
          </div>
        </td>
        <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 6px; text-align: center; box-sizing: border-box;">
            <p style="font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0 0 2px 0;">Today Distance</p>
            <p style="font-size: 11px; font-weight: 800; color: #2563eb; margin: 0;">${currentReport.kmTravelled ?? 0} KM</p>
          </div>
        </td>
        <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 5px 6px; text-align: center; box-sizing: border-box;">
            <p style="font-size: 7.5px; font-weight: 700; color: #1e40af; text-transform: uppercase; margin: 0 0 2px 0;">MTD Distance</p>
            <p style="font-size: 11px; font-weight: 800; color: #1d4ed8; margin: 0;">${monthToDateKm} KM</p>
          </div>
        </td>
        <td style="width: 25%; padding-left: 3px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 6px; text-align: center; box-sizing: border-box;">
            <p style="font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0 0 2px 0;">Submitted At</p>
            <p style="font-size: 10px; font-weight: 800; color: #1e293b; margin: 0;">${formattedSubmittedAt}</p>
          </div>
        </td>
      </tr>
    </table>

    <!-- Orders & Working Metrics (Grid) -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
      <tr>
        <td style="width: 25%; padding-right: 3px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 5px 8px; box-sizing: border-box;">
            <span style="font-size: 7.5px; font-weight: 700; color: #166534; text-transform: uppercase;">Orders Booked:</span>
            <span style="font-size: 12px; font-weight: 800; color: #14532d; margin-left: 4px;">${currentReport.ordersTaken ?? 0}</span>
          </div>
        </td>
        <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 5px 8px; box-sizing: border-box;">
            <span style="font-size: 7.5px; font-weight: 700; color: #991b1b; text-transform: uppercase;">Cancelled:</span>
            <span style="font-size: 12px; font-weight: 800; color: #7f1d1d; margin-left: 4px;">${currentReport.ordersCancelled ?? 0}</span>
          </div>
        </td>
        <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; box-sizing: border-box;">
            <span style="font-size: 7.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Work Time:</span>
            <span style="font-size: 11px; font-weight: 800; color: #166534; margin-left: 4px;">${workTimeLabel}</span>
          </div>
        </td>
        <td style="width: 25%; padding-left: 3px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; box-sizing: border-box;">
            <span style="font-size: 7.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Break Time:</span>
            <span style="font-size: 11px; font-weight: 800; color: #b45309; margin-left: 4px;">${breakTimeLabel}</span>
          </div>
        </td>
      </tr>
    </table>

    <!-- Odometer Readings -->
    ${(currentReport.startOdometer !== null && currentReport.startOdometer !== undefined) || (currentReport.endOdometer !== null && currentReport.endOdometer !== undefined) ? `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; margin-bottom: 8px; box-sizing: border-box;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 50%;">
            <span style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">Start Odometer: </span>
            <span style="font-size: 11px; font-weight: 800; color: #1e293b;">${currentReport.startOdometer !== null && currentReport.startOdometer !== undefined ? currentReport.startOdometer + ' km' : '--'}</span>
          </td>
          <td style="width: 50%;">
            <span style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">End Odometer: </span>
            <span style="font-size: 11px; font-weight: 800; color: #1e293b;">${currentReport.endOdometer !== null && currentReport.endOdometer !== undefined ? currentReport.endOdometer + ' km' : '--'}</span>
          </td>
        </tr>
      </table>
    </div>
    ` : ''}

    <!-- Tasks Completed -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; box-sizing: border-box;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; margin-bottom: 5px;">
        <h3 style="font-size: 10px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">Tasks Completed Today</h3>
        <span style="font-size: 9px; font-weight: 700; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1px 5px; border-radius: 3px;">
          ✅ ${countBannerText}
        </span>
      </div>
      <div>
        ${tasksGridHtml}
      </div>
    </div>

    <!-- Work Summary & Remarks -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
      <tr>
        <td style="width: ${currentReport.remarks ? '50%' : '100%'}; padding-right: ${currentReport.remarks ? '4px' : '0'}; vertical-align: top;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; box-sizing: border-box; min-height: 40px;">
            <h4 style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0 0 2px 0;">Work Summary</h4>
            <p style="font-size: 9.5px; line-height: 1.3; color: #334155; margin: 0;">${currentReport.visitsSummary || "Field Work Mode"}</p>
          </div>
        </td>
        ${currentReport.remarks ? `
        <td style="width: 50%; padding-left: 4px; vertical-align: top;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; box-sizing: border-box; min-height: 40px;">
            <h4 style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0 0 2px 0;">Remarks</h4>
            <p style="font-size: 9.5px; font-style: italic; line-height: 1.3; color: #64748b; margin: 0;">${currentReport.remarks}</p>
          </div>
        </td>
        ` : ''}
      </tr>
    </table>

    <!-- Verification Media -->
    ${startPhoto || endPhoto ? `
    <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 4px; box-sizing: border-box;">
      <h3 style="font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0 0 4px 0; letter-spacing: 0.5px;">Verification Photos</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          ${startPhoto ? `
          <td style="width: 50%; padding-right: 4px; text-align: center; vertical-align: top;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; box-sizing: border-box;">
              <p style="font-size: 7.5px; font-weight: 700; color: #64748b; margin: 0 0 2px 0; text-transform: uppercase;">Start Odometer</p>
              <img src="${startPhoto}" style="max-width: 100%; max-height: 70px; border-radius: 3px; object-fit: contain;" />
            </div>
          </td>
          ` : ''}
          ${endPhoto ? `
          <td style="width: 50%; padding-left: 4px; text-align: center; vertical-align: top;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; box-sizing: border-box;">
              <p style="font-size: 7.5px; font-weight: 700; color: #64748b; margin: 0 0 2px 0; text-transform: uppercase;">End Odometer</p>
              <img src="${endPhoto}" style="max-width: 100%; max-height: 70px; border-radius: 3px; object-fit: contain;" />
            </div>
          </td>
          ` : ''}
        </tr>
      </table>
    </div>
    ` : ''}

    <div style="text-align: center; margin-top: 12px; font-size: 8.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px;">
      System-generated Document &bull; StaffTrack &copy; ${new Date().getFullYear()} &bull; ${user.company?.name || "Vaniki Crop Science"}
    </div>
  </div>
</body>
</html>
  `;

  return html;
}
