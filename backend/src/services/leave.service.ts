import { PrismaClient, LeaveStatus, UserRole, Prisma } from "@prisma/client";
const prisma = new PrismaClient();
import type { AuthUser } from "../types/auth";
import * as notificationService from "./notification.service";

export async function createLeaveRequest(
  userId: string,
  companyId: string,
  data: { startDate: Date; endDate: Date; reason: string; status?: LeaveStatus; approvedById?: string }
) {
  const reqStart = new Date(data.startDate);
  const reqEnd = new Date(data.endDate);
  const monthStart = new Date(reqStart.getFullYear(), reqStart.getMonth(), 1);
  const monthEnd = new Date(reqStart.getFullYear(), reqStart.getMonth() + 1, 0, 23, 59, 59, 999);

  // Check existing leaves in the month
  const existingLeavesInMonth = await prisma.leaveRequest.findMany({
    where: {
      userId,
      companyId,
      status: { in: ["APPROVED", "PENDING"] },
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart }
    }
  });

  const countDaysInMonth = (s: Date, e: Date) => {
    const from = Math.max(new Date(s).getTime(), monthStart.getTime());
    const to = Math.min(new Date(e).getTime(), monthEnd.getTime());
    if (from > to) return 0;
    return Math.round((to - from) / (24 * 60 * 60 * 1000)) + 1;
  };

  let priorDaysThisMonth = 0;
  for (const el of existingLeavesInMonth) {
    priorDaysThisMonth += countDaysInMonth(el.startDate, el.endDate);
  }

  const currentReqDaysThisMonth = countDaysInMonth(reqStart, reqEnd);
  const totalDaysThisMonth = priorDaysThisMonth + currentReqDaysThisMonth;

  let warning: string | null = null;
  if (totalDaysThisMonth > 2) {
    const lwpDays = totalDaysThisMonth - 2;
    warning = `Warning: 2 days of leave per month are payable. You have ${priorDaysThisMonth} prior leave day(s) this month. With this request of ${currentReqDaysThisMonth} day(s), ${Math.min(currentReqDaysThisMonth, lwpDays)} day(s) will be Leave Without Pay (LWP) and pay will be deducted from your salary.`;

    try {
      await notificationService.createNotification(
        userId,
        "Leave Warning: LWP Notice",
        `Your leave request from ${reqStart.toLocaleDateString()} to ${reqEnd.toLocaleDateString()} exceeds the 2-day paid leave limit for this month. Additional days will be marked as Leave Without Pay (LWP).`,
        "LEAVE_WARNING"
      );
    } catch (err) {
      console.error("[Leave Service] Failed to send leave warning notification:", err);
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, managerId: true }
  });

  const leave = await prisma.leaveRequest.create({
    data: {
      userId,
      companyId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reason: data.reason,
      status: data.status || "PENDING",
      approvedById: data.status === "APPROVED" ? data.approvedById : null
    }
  });

  if (user?.managerId && leave.status === "PENDING") {
    try {
      await notificationService.createNotification(
        user.managerId,
        "New Leave Request",
        `${user.name} has requested leave from ${new Date(data.startDate).toLocaleDateString()} to ${new Date(data.endDate).toLocaleDateString()}.${warning ? ` [LWP WARNING: Exceeds 2 monthly paid leaves]` : ""}`,
        "LEAVE_REQUESTED"
      );
    } catch (err) {
      console.error("[Leave Service] Failed to send leave request notification:", err);
    }
  }

  // If approved, mark attendance as ON_LEAVE for those dates
  if (leave.status === "APPROVED") {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    
    const dates: Date[] = [];
    let current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    for (const date of dates) {
      const dateStr = date.toISOString().split('T')[0];
      const startOfDay = new Date(dateStr);

      const existing = await prisma.attendance.findFirst({
        where: {
          userId: leave.userId,
          date: startOfDay
        },
        select: { id: true }
      });

      if (existing) {
        await prisma.attendance.updateMany({
          where: {
            userId: leave.userId,
            date: startOfDay
          },
          data: {
            status: "ON_LEAVE"
          }
        });
        continue;
      }

      await prisma.attendance.create({
        data: {
          userId: leave.userId,
          date: startOfDay,
          status: "ON_LEAVE"
        }
      });
    }
  }

  return { ...leave, warning, totalDaysThisMonth };
}

export async function listLeaveRequests(actor: AuthUser, filter?: any) {
  const where: Prisma.LeaveRequestWhereInput = {
    companyId: actor.companyId,
    ...(filter?.status && { status: filter.status as LeaveStatus })
  };

  if (actor.role === UserRole.EMPLOYEE) {
    // Employees can only ever see their own leave requests.
    where.userId = actor.id;
  } else if (actor.role === UserRole.MANAGER) {
    // Managers see their own requests plus those of their direct reports.
    const scope: Prisma.LeaveRequestWhereInput = {
      OR: [{ userId: actor.id }, { user: { managerId: actor.id } }]
    };
    // An explicit user filter must still stay within the manager's scope.
    where.AND = filter?.userId ? [scope, { userId: filter.userId }] : [scope];
  } else if (filter?.userId) {
    // ADMIN / SUPERADMIN: full company visibility, optional explicit user filter.
    where.userId = filter.userId;
  }

  return prisma.leaveRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, designation: true, group: true, managerId: true } },
      approvedBy: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getLeaveRequest(id: string) {
  return prisma.leaveRequest.findUniqueOrThrow({
    where: { id },
    include: { user: true, approvedBy: true }
  });
}

export async function updateLeaveStatus(id: string, adminId: string, status: "APPROVED" | "REJECTED") {
  const leave = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status,
      approvedById: adminId
    }
  });

  // Notify user
  try {
    const adminUser = await prisma.user.findUnique({ where: { id: adminId }, select: { name: true } });
    await notificationService.createNotification(
      leave.userId,
      `Leave Request ${status === "APPROVED" ? "Approved" : "Rejected"}`,
      `Your leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been ${status === "APPROVED" ? "approved" : "rejected"}${adminUser ? ` by ${adminUser.name}` : ""}.`,
      "LEAVE"
    );
  } catch (err) {
    console.error("Failed to send leave notification:", err);
  }

  // If approved, mark attendance as ON_LEAVE for those dates
  if (status === "APPROVED") {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    
    const dates: Date[] = [];
    let current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    for (const date of dates) {
      const dateStr = date.toISOString().split('T')[0];
      const startOfDay = new Date(dateStr);

      const existing = await prisma.attendance.findFirst({
        where: {
          userId: leave.userId,
          date: startOfDay
        },
        select: { id: true }
      });

      if (existing) {
        await prisma.attendance.updateMany({
          where: {
            userId: leave.userId,
            date: startOfDay
          },
          data: {
            status: "ON_LEAVE"
          }
        });
        continue;
      }

      await prisma.attendance.create({
        data: {
          userId: leave.userId,
          date: startOfDay,
          status: "ON_LEAVE"
        }
      });
    }
  }

  return leave;
}

export async function getYearlyLeaveSummary(userId: string, companyId: string, year?: number) {
  const currentYear = year || new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Fetch user info for base salary / designation
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, designation: true, baseSalary: true, group: true }
  });

  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      companyId,
      status: "APPROVED",
      startDate: { lte: endOfYear },
      endDate: { gte: startOfYear }
    }
  });

  const countDaysInInterval = (s: Date, e: Date, ws: Date, we: Date) => {
    const from = Math.max(new Date(s).getTime(), ws.getTime());
    const to = Math.min(new Date(e).getTime(), we.getTime());
    if (from > to) return 0;
    return Math.round((to - from) / (24 * 60 * 60 * 1000)) + 1;
  };

  let usedYearly = 0;
  let usedThisMonth = 0;

  for (const l of approvedLeaves) {
    usedYearly += countDaysInInterval(l.startDate, l.endDate, startOfYear, endOfYear);
    usedThisMonth += countDaysInInterval(l.startDate, l.endDate, startOfMonth, endOfMonth);
  }

  const yearlyQuota = 20; // Company yearly leave quota: 20 days
  const availableYearly = Math.max(0, yearlyQuota - usedYearly);
  const monthlyPaidLimit = 2;
  const monthlyPaidUsed = Math.min(monthlyPaidLimit, usedThisMonth);
  const monthlyLwpUsed = Math.max(0, usedThisMonth - monthlyPaidLimit);
  const exceedsMonthlyLimit = usedThisMonth >= monthlyPaidLimit;

  const effectiveBaseSalary = (user?.baseSalary != null && user.baseSalary > 0)
    ? user.baseSalary
    : (user?.group?.baseSalary || 0);
  const perDaySalary = Math.round(effectiveBaseSalary / 30);

  return {
    userId,
    userName: user?.name || "Staff",
    designation: user?.designation || "Staff",
    year: currentYear,
    yearlyQuota,
    usedYearly,
    availableYearly,
    monthlyPaidLimit,
    monthlyPaidUsed,
    monthlyLwpUsed,
    usedThisMonth,
    exceedsMonthlyLimit,
    perDaySalary,
    warning: exceedsMonthlyLimit
      ? `Warning: 2 days of leave per month are payable. You have used ${usedThisMonth} leave days this month. Additional leaves are Leave Without Pay (LWP) and will deduct ₹${perDaySalary}/day.`
      : null
  };
}

export async function getCompanyYearlyLeaveSummaries(companyId: string, year?: number) {
  const users = await prisma.user.findMany({
    where: { companyId, role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } },
    select: { id: true }
  });

  const summaries = await Promise.all(
    users.map((u) => getYearlyLeaveSummary(u.id, companyId, year))
  );

  return summaries;
}
