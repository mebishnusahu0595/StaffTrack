import { TaskStatus, UserRole } from "@prisma/client";
import { eachDayOfInterval, endOfMonth, format, isSameDay, isWeekend, startOfMonth } from "date-fns";
import { prisma } from "../lib/prisma";

export async function calculateMonthlyPayroll(companyId: string, month: number, year: number) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const daysInMonth = eachDayOfInterval({ start, end });

  const [users, holidays, approvedExpenses, reports, completedTasks, company, savedSlips] = await Promise.all([
    prisma.user.findMany({
      where: { companyId, role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } },
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
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true }
    }),
    prisma.salarySlip.findMany({
      where: { companyId, month, year }
    })
  ]);

  const expensesByUser = sumAmountsByUser(approvedExpenses);
  const reportsByUserDate = groupReportsByUserDate(reports);
  const taskPointsByUserDate = groupTaskPointsByUserDate(completedTasks);
  const savedSlipsMap = new Map(savedSlips.map((s) => [s.userId, s]));

  return users.map((user: any) => {
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
        if (attendance.status === "PRESENT" && attendance.checkInApproved === false) {
          // Late check-in awaiting approval — does not count as present/payable yet.
          status = "PENDING";
        } else if (attendance.status === "PRESENT") {
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
        status = "WEEKEND";
        payable = false;
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

    const totalKm = user.attendances.reduce((sum: number, att: any) => {
      if (att.startOdometer !== null && att.endOdometer !== null && att.endOdometer >= att.startOdometer) {
        return sum + (att.endOdometer - att.startOdometer);
      }
      return sum;
    }, 0);
    const travelRate = user.travelRate ?? 5.0;
    const travelAllowance = Math.round(totalKm * travelRate);

    const approvedExpensesTotal = expensesByUser.get(user.id) ?? 0;
    const netSalary = Math.round(totalPayableDays * dailySalary);
    const deductionAmount = Math.max(0, effectiveBaseSalary - netSalary);
    const totalPayout = netSalary + approvedExpensesTotal + travelAllowance;

    const result: any = {
      userId: user.id,
      userName: user.name,
      designation: user.designation,
      avatarUrl: user.avatarUrl || null,
      joiningDate: user.joiningDate || null,
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
      dailyBreakdown,
      companyName: company?.name || "STAFFTRACK"
    };

    const savedSlip = savedSlipsMap.get(user.id);
    if (savedSlip) {
      result.orgName = savedSlip.orgName;
      result.orgSubtitle = savedSlip.orgSubtitle;
      result.orgCode = savedSlip.orgCode;
      result.companyCode = savedSlip.companyCode;
      result.bankName = savedSlip.bankName;
      result.bankAccountNo = savedSlip.bankAccountNo;
      result.ifscCode = savedSlip.ifscCode;
      result.departmentName = savedSlip.departmentName || result.departmentName;
      result.divisionName = savedSlip.divisionName;
      result.designation = savedSlip.designation || result.designation;
      result.traineeType = savedSlip.traineeType;
      result.aadhaarNumber = savedSlip.aadhaarNumber;
      result.totalDays = savedSlip.monthDays !== null ? Number(savedSlip.monthDays) : result.totalDays;
      result.totalPayableDays = savedSlip.payableDays !== null ? Number(savedSlip.payableDays) : result.totalPayableDays;
      result.earnings = savedSlip.earnings;
      result.deductions = savedSlip.deductions;
      result.netSalary = savedSlip.netPay;
      result.totalPayout = savedSlip.netPay;
      const deductionsArray = savedSlip.deductions as any;
      result.deductionAmount = Number(deductionsArray && Array.isArray(deductionsArray) 
        ? (deductionsArray.find((d: any) => d.label === "Absence Deduction" || d.label === "Absence Deductions")?.calculated ?? 0) 
        : 0);
    }

    return result;
  });
}

export async function calculateSalaryMatrix(companyId: string, month: number, year: number) {
  const reports = await calculateMonthlyPayroll(companyId, month, year);

  return reports.map((report: any) => {
    const totalDays = report.totalDays;
    const workingDays = Math.max(1, totalDays - report.holidayDays);
    const dailyWage = report.baseSalary / workingDays;

    return {
      userId: report.userId,
      userName: report.userName,
      designation: report.designation,
      avatarUrl: report.avatarUrl || null,
      joiningDate: report.joiningDate || null,
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
      dailyBreakdown: report.dailyBreakdown,
      orgName: report.orgName || null,
      orgSubtitle: report.orgSubtitle || null,
      orgCode: report.orgCode || null,
      companyCode: report.companyCode || null,
      bankName: report.bankName || null,
      bankAccountNo: report.bankAccountNo || null,
      ifscCode: report.ifscCode || null,
      divisionName: report.divisionName || null,
      traineeType: report.traineeType || null,
      aadhaarNumber: report.aadhaarNumber || null,
      earnings: report.earnings || null,
      deductions: report.deductions || null,
      netPayWords: report.netPayWords || null,
      remarks: report.remarks || null,
      companyName: report.companyName || null
    };
  });
}

export async function calculateMusterReport(companyId: string, month: number, year: number) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const daysInMonth = eachDayOfInterval({ start, end });

  const [users, holidays, reports, completedTasks] = await Promise.all([
    prisma.user.findMany({
      where: { companyId, role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } },
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
        if (attendance.status === "PRESENT" && attendance.checkInApproved === false) status = "PEN";
        else if (attendance.status === "PRESENT") status = "P";
        else if (attendance.status === "HALF_DAY") status = "HD";
        else if (attendance.status === "ON_LEAVE") status = "L";
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
    map.set(key, (map.get(key) ?? 0) + points);
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
