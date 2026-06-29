import { PrismaClient, LeaveStatus, UserRole, Prisma } from "@prisma/client";
const prisma = new PrismaClient();
import type { AuthUser } from "../types/auth";
import * as notificationService from "./notification.service";

export async function createLeaveRequest(
  userId: string,
  companyId: string,
  data: { startDate: Date; endDate: Date; reason: string; status?: LeaveStatus; approvedById?: string }
) {
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
        `${user.name} has requested leave from ${new Date(data.startDate).toLocaleDateString()} to ${new Date(data.endDate).toLocaleDateString()}.`,
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

  return leave;
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
