import { prisma } from "../lib/prisma";
import { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, format, isSameDay } from "date-fns";

export async function calculateMonthlyPayroll(companyId: string, month: number, year: number) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const daysInMonth = eachDayOfInterval({ start, end });

  // 1. Fetch all users in the company
  const users = await prisma.user.findMany({
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
  });

  // 2. Fetch all holidays/leaves for the period
  const holidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: {
        gte: start,
        lte: end
      }
    }
  });

  const payrollReports = users.map((user: any) => {
    const userJoiningDate = new Date(user.joiningDate);
    const effectiveBaseSalary = user.group?.baseSalary || user.baseSalary || 0;
    const dailySalary = effectiveBaseSalary / daysInMonth.length;

    let totalWorkingDays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let paidLeaveDays = 0;
    let holidayDays = 0;
    let totalPayableDays = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyBreakdown = daysInMonth.map((day: any) => {
      const dayDate = new Date(day);
      dayDate.setHours(0, 0, 0, 0);

      // Skip days before joining
      if (dayDate < startOfMonth(userJoiningDate) && !isSameDay(dayDate, userJoiningDate)) {
        if (dayDate < userJoiningDate) return { date: format(day, "yyyy-MM-dd"), status: "PRE_JOINING", payable: false };
      }

      // Check if it's a holiday for this specific user
      const isHoliday = holidays.find((h: any) => 
        isSameDay(new Date(h.date), day) && 
        (!h.groupId || h.groupId === user.groupId) && 
        (!h.userId || h.userId === user.id)
      );

      if (isHoliday) {
        if (isHoliday.type === "HOLIDAY") holidayDays++;
        else paidLeaveDays++;
        totalPayableDays++;
        return { date: format(day, "yyyy-MM-dd"), status: isHoliday.type, payable: true, name: isHoliday.name };
      }

      // Check attendance
      const attendance = user.attendances.find((a: any) => isSameDay(new Date(a.date), day));
      
      if (attendance) {
        if (attendance.status === "PRESENT") {
          presentDays++;
          totalPayableDays++;
          return { date: format(day, "yyyy-MM-dd"), status: "PRESENT", payable: true };
        } else if (attendance.status === "HALF_DAY") {
          presentDays += 0.5;
          totalPayableDays += 0.5;
          return { date: format(day, "yyyy-MM-dd"), status: "HALF_DAY", payable: true };
        } else if (attendance.status === "ON_LEAVE") {
          paidLeaveDays++;
          totalPayableDays++;
          return { date: format(day, "yyyy-MM-dd"), status: "ON_LEAVE", payable: true };
        }
      }

      // Handle weekends - usually paid in monthly salary
      if (isWeekend(day)) {
        holidayDays++;
        totalPayableDays++;
        return { date: format(day, "yyyy-MM-dd"), status: "WEEKEND", payable: true };
      }

      // Handle future days
      if (dayDate > today) {
        return { date: format(day, "yyyy-MM-dd"), status: "UPCOMING", payable: false };
      }

      // If no attendance and not a holiday/weekend and it's past/today, it's an absence
      absentDays++;
      return { date: format(day, "yyyy-MM-dd"), status: "ABSENT", payable: false };
    });

    const netSalary = Math.round(totalPayableDays * dailySalary);

    return {
      userId: user.id,
      userName: user.name,
      designation: user.designation,
      baseSalary: effectiveBaseSalary,
      totalDays: daysInMonth.length,
      presentDays,
      absentDays,
      paidLeaveDays,
      holidayDays,
      totalPayableDays,
      netSalary,
      dailyBreakdown
    };
  });

  return payrollReports;
}

export async function calculateSalaryMatrix(companyId: string, month: number, year: number) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const daysInMonth = eachDayOfInterval({ start, end });

  const users = await prisma.user.findMany({
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
  });

  const holidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: {
        gte: start,
        lte: end
      }
    }
  });

  const salaryReports = users.map((user: any) => {
    const userJoiningDate = new Date(user.joiningDate);
    const effectiveBaseSalary = user.group?.baseSalary || user.baseSalary || 0;

    let presentDays = 0;
    let absentDays = 0;
    let paidLeaveDays = 0;
    let holidayDays = 0;
    let weekendDays = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyBreakdown = daysInMonth.map((day: any) => {
      const dayDate = new Date(day);
      dayDate.setHours(0, 0, 0, 0);

      // Skip days before joining
      if (dayDate < startOfMonth(userJoiningDate) && !isSameDay(dayDate, userJoiningDate)) {
        if (dayDate < userJoiningDate) return { date: format(day, "yyyy-MM-dd"), status: "PRE_JOINING", payable: false };
      }

      // Check if it's a holiday for this specific user
      const isHoliday = holidays.find((h: any) => 
        isSameDay(new Date(h.date), day) && 
        (!h.groupId || h.groupId === user.groupId) && 
        (!h.userId || h.userId === user.id)
      );

      if (isHoliday) {
        if (isHoliday.type === "HOLIDAY") holidayDays++;
        else paidLeaveDays++;
        return { date: format(day, "yyyy-MM-dd"), status: isHoliday.type, payable: isHoliday.type === "PAID_LEAVE", name: isHoliday.name };
      }

      // Check attendance
      const attendance = user.attendances.find((a: any) => isSameDay(new Date(a.date), day));
      
      if (attendance) {
        if (attendance.status === "PRESENT") {
          presentDays++;
          return { date: format(day, "yyyy-MM-dd"), status: "PRESENT", payable: true };
        } else if (attendance.status === "HALF_DAY") {
          presentDays += 0.5;
          return { date: format(day, "yyyy-MM-dd"), status: "HALF_DAY", payable: true };
        } else if (attendance.status === "ON_LEAVE") {
          paidLeaveDays++;
          return { date: format(day, "yyyy-MM-dd"), status: "ON_LEAVE", payable: true };
        }
      }

      if (isWeekend(day)) {
        weekendDays++;
        return { date: format(day, "yyyy-MM-dd"), status: "WEEKEND", payable: false };
      }

      if (dayDate > today) {
        return { date: format(day, "yyyy-MM-dd"), status: "UPCOMING", payable: false };
      }

      absentDays++;
      return { date: format(day, "yyyy-MM-dd"), status: "ABSENT", payable: false };
    });

    // New rule: divide by working days (excluding holidays and weekends)
    const totalDays = daysInMonth.length;
    // We only exclude "HOLIDAY" type holidays, not "PAID_LEAVE" holidays? Usually company-wide holidays are type "HOLIDAY"
    const workingDays = Math.max(1, totalDays - (holidayDays + weekendDays)); 
    const dailyWage = effectiveBaseSalary / workingDays;

    const payableDays = presentDays + paidLeaveDays;
    const netSalary = Math.round(payableDays * dailyWage);

    return {
      userId: user.id,
      userName: user.name,
      designation: user.designation,
      avatarUrl: user.avatarUrl,
      baseSalary: effectiveBaseSalary,
      totalDays,
      workingDays,
      presentDays,
      absentDays,
      paidLeaveDays,
      holidayDays,
      weekendDays,
      payableDays,
      dailyWage,
      netSalary,
      dailyBreakdown
    };
  });

  return salaryReports;
}

export async function calculateMusterReport(companyId: string, month: number, year: number) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const daysInMonth = eachDayOfInterval({ start, end });

  const users = await prisma.user.findMany({
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
  });

  const holidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: {
        gte: start,
        lte: end
      }
    }
  });

  const report = users.map((user: any) => {
    const attendanceMap: Record<string, string> = {};
    
    daysInMonth.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      
      // Default
      let status = "A"; // Absent

      // Check Weekend
      if (isWeekend(day)) status = "W";

      // Check Holiday
      const isHoliday = holidays.find(h => isSameDay(new Date(h.date), day) && (!h.groupId || h.groupId === user.groupId));
      if (isHoliday) status = "H";

      // Check Attendance
      const attendance = user.attendances.find((a: any) => isSameDay(new Date(a.date), day));
      if (attendance) {
        if (attendance.status === "PRESENT") status = "P";
        else if (attendance.status === "HALF_DAY") status = "HD";
        else if (attendance.status === "ON_LEAVE") status = "L";
      }

      attendanceMap[dateStr] = status;
    });

    return {
      userId: user.id,
      userName: user.name,
      group: user.group?.name || "General",
      attendance: attendanceMap
    };
  });

  return {
    days: daysInMonth.map(d => format(d, "yyyy-MM-dd")),
    data: report
  };
}
