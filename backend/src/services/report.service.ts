import type { AuthUser } from "../types/auth";
import { monthRange, startOfDay } from "../lib/date";
import { prisma } from "../lib/prisma";
import { ensureCanAccessUser } from "./access.service";

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

export async function createDayEndReport(actor: AuthUser, input: DayEndReportInput) {
  return prisma.dayEndReport.create({
    data: {
      userId: actor.id,
      date: startOfDay(input.date),
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
}

export async function getDayEndReportHistory(actor: AuthUser, userId: string) {
  await ensureCanAccessUser(actor, userId);

  return prisma.dayEndReport.findMany({
    where: { userId },
    orderBy: { date: "desc" }
  });
}

export async function listDayEndReports(actor: AuthUser, userId?: string) {
  const where: any = {
    user: {
      companyId: actor.companyId
    }
  };

  if (userId) {
    where.userId = userId;
  }

  return prisma.dayEndReport.findMany({
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
}

export async function getMonthlyPerformanceReport(actor: AuthUser, userId: string, month: number, year: number) {
  await ensureCanAccessUser(actor, userId);

  const { start: startDate, end: endDate } = monthRange(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();

  const [attendances, reports, expenses, user, holidays] = await Promise.all([
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
          { groupId: { not: null } }, // We'll filter this in code or better refine query
          { groupId: null, userId: null } // Company-wide holiday
        ]
      }
    })
  ]);

  if (!user) throw new Error("User not found");

  // Refine holidays applicable to this specific user
  const applicableHolidays = holidays.filter(h => 
    h.userId === userId || 
    (h.groupId && h.groupId === user.groupId) || 
    (!h.groupId && !h.userId)
  );

  const holidayDates = new Set(
    applicableHolidays
      .filter((holiday) => holiday.type === "HOLIDAY")
      .map((holiday) => toDateKey(holiday.date))
  );
  const attendanceByDate = new Map<string, typeof attendances>();

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

    return {
      date,
      status,
      sessionCount: rows.filter((row) => row.checkInTime).length,
      punchTypes: Array.from(new Set(rows.map((row) => row.punchType).filter(Boolean))),
      checkInTime: rows.find((row) => row.checkInTime)?.checkInTime,
      checkOutTime: rows.slice().reverse().find((row) => row.checkOutTime)?.checkOutTime
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
        checkOutTime: null
      });
    }
  }

  const totalKm = reports.reduce((sum, r) => sum + r.kmTravelled, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Salary calculation: (group.baseSalary || user.baseSalary)
  const baseSalary = user.group?.baseSalary || user.baseSalary || 0;
  const dailyRate = baseSalary / daysInMonth;
  const deductions = (absentDays * dailyRate) + (halfDays * 0.5 * dailyRate);
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
      totalExpenses
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

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolveDayStatus(rows: Array<{ status: string }>) {
  if (rows.some((row) => row.status === "PRESENT")) return "PRESENT";
  if (rows.some((row) => row.status === "HALF_DAY")) return "HALF_DAY";
  if (rows.some((row) => row.status === "ON_LEAVE")) return "ON_LEAVE";
  if (rows.some((row) => row.status === "ABSENT")) return "ABSENT";
  return rows[0]?.status ?? "ABSENT";
}
