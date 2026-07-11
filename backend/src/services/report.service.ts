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
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

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
