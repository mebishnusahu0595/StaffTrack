import { PrismaClient, LeaveStatus } from "@prisma/client";
const prisma = new PrismaClient();

export async function createLeaveRequest(userId: string, companyId: string, data: { startDate: Date; endDate: Date; reason: string }) {
  return prisma.leaveRequest.create({
    data: {
      userId,
      companyId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reason: data.reason,
      status: "PENDING"
    }
  });
}

export async function listLeaveRequests(companyId: string, filter?: any) {
  return prisma.leaveRequest.findMany({
    where: { 
      companyId,
      ...(filter?.status && { status: filter.status as LeaveStatus }),
      ...(filter?.userId && { userId: filter.userId })
    },
    include: {
      user: { select: { id: true, name: true, designation: true, group: true } },
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
      // Upsert attendance
      const dateStr = date.toISOString().split('T')[0];
      const startOfDay = new Date(dateStr);
      
      await prisma.attendance.upsert({
        where: {
          userId_date: {
            userId: leave.userId,
            date: startOfDay
          }
        },
        create: {
          userId: leave.userId,
          date: startOfDay,
          status: "ON_LEAVE"
        },
        update: {
          status: "ON_LEAVE"
        }
      });
    }
  }

  return leave;
}
