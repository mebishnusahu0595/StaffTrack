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

export async function getDayEndReportHistory(actor: AuthUser, userId: string) {
  await ensureCanAccessUser(actor, userId);

  const reports = await prisma.dayEndReport.findMany({
    where: { userId },
    orderBy: { date: "desc" }
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
      companyId: actor.companyId
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

  const [attendances, reports, expenses, user, holidays, completedTasks, pendingTasks] = await Promise.all([
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
        dueDate: true
      }
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
  const dailyLogs = [...attendanceByDate.entries()].map(([date, rows]) => {
    const status = resolveDayStatus(rows);

    if (status === "PRESENT") presentDays++;
    else if (status === "HALF_DAY") halfDays++;
    else if (status === "ON_LEAVE") onLeave++;
    else if (status === "ABSENT" && !holidayDates.has(date)) absentDays++;

    const report = reportByDate.get(date);
    const completedTaskRows = completedTasksByDate.get(date) ?? [];
    const pendingCount = pendingTasksByDate.get(date)?.length ?? 0;
    const dailyPoints = calculatePoints(report, completedTaskRows, pendingCount);

    return {
      date,
      status,
      sessionCount: rows.filter((row) => row.checkInTime).length,
      punchTypes: Array.from(new Set(rows.map((row) => row.punchType).filter(Boolean))),
      checkInTime: rows.find((row) => row.checkInTime)?.checkInTime,
      checkOutTime: rows.slice().reverse().find((row) => row.checkOutTime)?.checkOutTime,
      completedTasksCount: completedTaskRows.length,
      pendingTasksCount: pendingCount,
      points: dailyPoints.totalPoints
    };
  });

  for (const holidayDate of holidayDates) {
    if (!attendanceByDate.has(holidayDate)) {
      dailyLogs.push({
        date: holidayDate,
        status: "HOLIDAY",
        sessionCount: 0,
        punchTypes: [],
        checkInTime: null,
        checkOutTime: null,
        completedTasksCount: completedTasksByDate.get(holidayDate)?.length ?? 0,
        pendingTasksCount: pendingTasksByDate.get(holidayDate)?.length ?? 0,
        points: calculatePoints(
          reportByDate.get(holidayDate),
          completedTasksByDate.get(holidayDate) ?? [],
          pendingTasksByDate.get(holidayDate)?.length ?? 0
        ).totalPoints
      });
    }
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
      monthlyPoints
    },
    payroll: {
      baseSalary,
      deductions,
      finalSalary,
      dailyRate
    },
    dailyLogs: dailyLogs.sort((a, b) => a.date.localeCompare(b.date))
  };
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
