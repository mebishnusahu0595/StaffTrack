import { TaskStatus } from "@prisma/client";
import { eachDayOfInterval, endOfMonth, format, isSameDay, isWeekend, startOfMonth } from "date-fns";
import { prisma } from "../lib/prisma";

export async function calculateMonthlyPayroll(companyId: string, month: number, year: number) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const daysInMonth = eachDayOfInterval({ start, end });

  const [users, holidays, approvedExpenses, reports, completedTasks] = await Promise.all([
    prisma.user.findMany({
      where: { companyId },
      include: {
        group: true,
        attendances: {
          where: {
            date: {
              gte: start,
              lte: end
            }
          }
        }
      }
    }),
    prisma.holiday.findMany({
      where: {
        companyId,
        date: {
          gte: start,
          lte: end
        }
      }
    }),
    prisma.expense.findMany({
      where: {
        user: { companyId },
        approved: true,
        date: {
          gte: start,
          lte: end
        }
      },
      select: {
        userId: true,
        amount: true
      }
    }),
    prisma.dayEndReport.findMany({
      where: {
        user: { companyId },
        date: {
          gte: start,
          lte: end
        }
      },
      select: {
        userId: true,
        date: true,
        ordersTaken: true,
        ordersCancelled: true,
        kmTravelled: true
      }
    }),
    prisma.task.findMany({
      where: {
        assignedTo: { companyId },
        status: TaskStatus.COMPLETED,
        updatedAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true,
        assignedToId: true,
        updatedAt: true,
        dueDate: true,
        points: true
      }
    })
  ]);

  const expensesByUser = sumAmountsByUser(approvedExpenses);
  const reportsByUserDate = groupReportsByUserDate(reports);
  const taskPointsByUserDate = groupTaskPointsByUserDate(completedTasks);

  return users.map((user: any) => {
    const userJoiningDate = new Date(user.joiningDate);
    userJoiningDate.setHours(0, 0, 0, 0);
    const effectiveBaseSalary = user.group?.baseSalary || user.baseSalary || 0;
    const dailySalary = effectiveBaseSalary / daysInMonth.length;

    let totalPayableDays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let unpaidLeaveDays = 0;
    let paidLeaveDays = 0;
    let holidayDays = 0;
    let halfDays = 0;
    let monthlyPoints = 0;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const dailyBreakdown = daysInMonth.map((day: Date) => {
      const dayDate = startOfDate(day);
      const dayKey = format(day, "yyyy-MM-dd");

      if (dayDate < userJoiningDate) {
        return { date: dayKey, status: "PRE_JOINING", payable: false, points: 0 };
      }

      const applicableHoliday = findHolidayForUser(holidays, user, day);
      const attendance = user.attendances.find((row: any) => isSameDay(new Date(row.date), day));

      let status = "ABSENT";
      let payable = false;

      if (applicableHoliday) {
        if (applicableHoliday.type === "HOLIDAY") {
          holidayDays++;
          totalPayableDays++;
          payable = true;
          status = "HOLIDAY";
        } else {
          paidLeaveDays++;
          totalPayableDays++;
          payable = true;
          status = "PAID_LEAVE";
        }
      } else if (attendance) {
        if (attendance.status === "PRESENT") {
          presentDays++;
          totalPayableDays++;
          payable = true;
          status = "PRESENT";
        } else if (attendance.status === "HALF_DAY") {
          halfDays++;
          totalPayableDays += 0.5;
          payable = true;
          status = "HALF_DAY";
        } else if (attendance.status === "ON_LEAVE") {
          unpaidLeaveDays++;
          status = "ON_LEAVE";
        }
      } else if (isWeekend(day)) {
        holidayDays++;
        totalPayableDays++;
        payable = true;
        status = "WEEKEND";
      } else if (dayDate > today) {
        status = "UPCOMING";
      } else {
        absentDays++;
      }

      const points = calculateDailyPoints(
        reportsByUserDate.get(getUserDateKey(user.id, dayKey)),
        taskPointsByUserDate.get(getUserDateKey(user.id, dayKey)) ?? 0
      );
      monthlyPoints += points;

      return {
        date: dayKey,
        status,
        payable,
        points
      };
    });

    const userReports = reports.filter((r: any) => r.userId === user.id);
    const totalKm = userReports.reduce((sum: number, r: any) => sum + (r.kmTravelled || 0), 0);
    const travelRate = user.travelRate ?? 5.0;
    const travelAllowance = Math.round(totalKm * travelRate);

    const approvedExpensesTotal = expensesByUser.get(user.id) ?? 0;
    const netSalary = Math.round(totalPayableDays * dailySalary);
    const deductionAmount = Math.max(0, effectiveBaseSalary - netSalary);
    const totalPayout = netSalary + approvedExpensesTotal + travelAllowance;

    return {
      userId: user.id,
      userName: user.name,
      designation: user.designation,
      departmentName: user.group?.name || null,
      baseSalary: effectiveBaseSalary,
      totalDays: daysInMonth.length,
      presentDays,
      halfDays,
      absentDays,
      unpaidLeaveDays,
      paidLeaveDays,
      holidayDays,
      totalPayableDays,
      approvedExpensesTotal,
      monthlyPoints,
      netSalary,
      deductionAmount,
      totalKm,
      travelAllowance,
      totalPayout,
      dailyBreakdown
    };
  });
}

export async function calculateSalaryMatrix(companyId: string, month: number, year: number) {
  const reports = await calculateMonthlyPayroll(companyId, month, year);

  return reports.map((report) => {
    const totalDays = report.totalDays;
    const workingDays = Math.max(1, totalDays - report.holidayDays);
    const dailyWage = report.baseSalary / workingDays;

    return {
      userId: report.userId,
      userName: report.userName,
      designation: report.designation,
      departmentName: report.departmentName || null,
      baseSalary: report.baseSalary,
      totalDays,
      workingDays,
      presentDays: report.presentDays + report.halfDays * 0.5,
      absentDays: report.absentDays,
      paidLeaveDays: report.paidLeaveDays,
      unpaidLeaveDays: report.unpaidLeaveDays,
      holidayDays: report.holidayDays,
      payableDays: report.totalPayableDays,
      dailyWage,
      monthlyPoints: report.monthlyPoints,
      approvedExpensesTotal: report.approvedExpensesTotal,
      totalKm: report.totalKm,
      travelAllowance: report.travelAllowance,
      deductionAmount: report.deductionAmount,
      netSalary: report.netSalary,
      totalPayout: report.totalPayout,
      dailyBreakdown: report.dailyBreakdown
    };
  });
}

export async function calculateMusterReport(companyId: string, month: number, year: number) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const daysInMonth = eachDayOfInterval({ start, end });

  const [users, holidays, reports, completedTasks] = await Promise.all([
    prisma.user.findMany({
      where: { companyId },
      include: {
        group: true,
        attendances: {
          where: {
            date: {
              gte: start,
              lte: end
            }
          }
        }
      }
    }),
    prisma.holiday.findMany({
      where: {
        companyId,
        date: {
          gte: start,
          lte: end
        }
      }
    }),
    prisma.dayEndReport.findMany({
      where: {
        user: { companyId },
        date: {
          gte: start,
          lte: end
        }
      },
      select: {
        userId: true,
        date: true,
        ordersTaken: true,
        ordersCancelled: true,
        kmTravelled: true
      }
    }),
    prisma.task.findMany({
      where: {
        assignedTo: { companyId },
        status: TaskStatus.COMPLETED,
        updatedAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true,
        assignedToId: true,
        updatedAt: true,
        dueDate: true,
        points: true
      }
    })
  ]);

  const reportsByUserDate = groupReportsByUserDate(reports);
  const taskPointsByUserDate = groupTaskPointsByUserDate(completedTasks);

  const report = users.map((user: any) => {
    const attendanceMap: Record<string, string> = {};
    const dailyPoints: Record<string, number> = {};
    const joiningDate = user.joiningDate ? startOfDate(user.joiningDate) : null;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let monthlyPoints = 0;

    daysInMonth.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayDate = startOfDate(day);
      let status = "A";

      if (isWeekend(day)) status = "W";

      const applicableHoliday = findHolidayForUser(holidays, user, day);
      if (applicableHoliday) {
        status = applicableHoliday.type === "HOLIDAY" ? "H" : "L";
      }

      const attendance = user.attendances.find((row: any) => isSameDay(new Date(row.date), day));
      if (attendance) {
        if (attendance.status === "PRESENT") status = "P";
        else if (attendance.status === "HALF_DAY") status = "HD";
        else if (attendance.status === "ON_LEAVE") status = "L";
      }

      if (joiningDate && dayDate < joiningDate) {
        status = "-";
      }

      if (dayDate > today) {
        status = "-";
      }

      const points = calculateDailyPoints(
        reportsByUserDate.get(getUserDateKey(user.id, dateStr)),
        taskPointsByUserDate.get(getUserDateKey(user.id, dateStr)) ?? 0
      );
      monthlyPoints += points;
      attendanceMap[dateStr] = status;
      dailyPoints[dateStr] = points;
    });

    return {
      userId: user.id,
      userName: user.name,
      group: user.group?.name || "General",
      attendance: attendanceMap,
      dailyPoints,
      monthlyPoints
    };
  });

  return {
    days: daysInMonth.map((day) => format(day, "yyyy-MM-dd")),
    data: report
  };
}

function sumAmountsByUser(expenses: Array<{ userId: string; amount: number }>) {
  const map = new Map<string, number>();

  for (const expense of expenses) {
    map.set(expense.userId, (map.get(expense.userId) ?? 0) + Number(expense.amount ?? 0));
  }

  return map;
}

function groupReportsByUserDate(
  reports: Array<{ userId: string; date: Date; ordersTaken: number; ordersCancelled: number; kmTravelled: number }>
) {
  const map = new Map<string, { ordersTaken: number; ordersCancelled: number; kmTravelled: number }>();

  for (const report of reports) {
    map.set(getUserDateKey(report.userId, format(new Date(report.date), "yyyy-MM-dd")), {
      ordersTaken: report.ordersTaken,
      ordersCancelled: report.ordersCancelled,
      kmTravelled: report.kmTravelled
    });
  }

  return map;
}

function groupTaskPointsByUserDate(tasks: Array<{ id: string; assignedToId: string; updatedAt: Date; dueDate: Date; points: number | null }>) {
  const map = new Map<string, number>();

  for (const task of tasks) {
    const key = getUserDateKey(task.assignedToId, format(new Date(task.updatedAt), "yyyy-MM-dd"));
    
    const points = Number(task.points ?? 0);
    let finalPoints = points;
    if (points > 0) {
      const due = new Date(task.dueDate).getTime();
      const completed = new Date(task.updatedAt).getTime();
      if (completed > due) {
        // Deterministic reduction between 10% and 30% based on task ID seed
        const seed = task.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const reductionPercent = 0.1 + (seed % 20) / 100; // 10% to 30%
        finalPoints = Math.max(1, Math.round(points * (1 - reductionPercent)));
      }
    }

    map.set(key, (map.get(key) ?? 0) + finalPoints);
  }

  return map;
}

function calculateDailyPoints(
  report: { ordersTaken: number; ordersCancelled: number; kmTravelled: number } | undefined,
  taskPoints: number
) {
  const orderPoints = Number(report?.ordersTaken ?? 0) * 2;
  const kmPoints = Math.floor(Number(report?.kmTravelled ?? 0) / 10);
  const cancellationPenalty = Number(report?.ordersCancelled ?? 0);
  return Math.max(0, taskPoints + orderPoints + kmPoints - cancellationPenalty);
}

function findHolidayForUser(holidays: any[], user: any, day: Date) {
  return holidays.find((holiday) =>
    isSameDay(new Date(holiday.date), day) &&
    (!holiday.groupId || holiday.groupId === user.groupId) &&
    (!holiday.userId || holiday.userId === user.id)
  );
}

function getUserDateKey(userId: string, dateKey: string) {
  return `${userId}:${dateKey}`;
}

function startOfDate(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
