import type { AuthUser } from "../types/auth";
import { startOfDay } from "../lib/date";
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

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const daysInMonth = endDate.getDate();

  const [attendances, reports, expenses, user, holidays] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } }
    }),
    prisma.dayEndReport.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } }
    }),
    prisma.expense.findMany({
      where: { userId, date: { gte: startDate, lte: endDate }, approved: true }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      include: { group: true }
    }),
    prisma.holiday.findMany({
      where: {
        companyId: actor.companyId,
        date: { gte: startDate, lte: endDate },
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

  const holidayDates = new Set(applicableHolidays.map(h => h.date.toISOString().split('T')[0]));
  const attendanceDates = new Map(attendances.map(a => [a.date.toISOString().split('T')[0], a]));

  let presentDays = 0;
  let halfDays = 0;
  let onLeave = 0;
  let absentDays = 0;
  let paidHolidays = 0;

  const joiningDate = new Date(user.joiningDate);
  const today = new Date();

  // Iterate through every day of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const currentDate = new Date(year, month - 1, d);
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Skip days before joining date
    if (currentDate < startOfDay(joiningDate)) continue;
    // Skip future days
    if (currentDate > startOfDay(today)) continue;

    const attendance = attendanceDates.get(dateStr);
    const isHoliday = holidayDates.has(dateStr);

    if (attendance) {
      if (attendance.status === "PRESENT") presentDays++;
      else if (attendance.status === "HALF_DAY") halfDays++;
      else if (attendance.status === "ON_LEAVE") onLeave++;
      else if (attendance.status === "ABSENT" && !isHoliday) absentDays++;
      else if (isHoliday) paidHolidays++;
    } else {
      // No attendance record
      if (isHoliday) {
        paidHolidays++;
      } else {
        // Not a holiday and no attendance = ABSENT
        absentDays++;
      }
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
    }
  };
}
