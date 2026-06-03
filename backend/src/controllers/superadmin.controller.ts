import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendMessage } from "../lib/response";
import { AttendanceStatus, UserRole } from "@prisma/client";

export async function getAllUsers(req: Request, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      shiftStart: true,
      shiftEnd: true,
      managerId: true,
      companyId: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });
  sendSuccess(res, users);
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { shiftStart, shiftEnd, managerId, role } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      shiftStart,
      shiftEnd,
      managerId,
      role: role as UserRole
    }
  });

  sendSuccess(res, updatedUser, "User updated successfully");
}

export async function getAttendanceLogs(req: Request, res: Response): Promise<void> {
  const { userId, date } = req.query;
  
  const logs = await prisma.attendance.findMany({
    where: {
      userId: userId as string || undefined,
      date: date ? new Date(date as string) : undefined
    },
    include: {
      user: {
        select: { name: true, email: true }
      }
    },
    orderBy: { date: "desc" }
  });

  sendSuccess(res, logs);
}

export async function updateAttendance(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { userId, date, status, checkInTime, checkOutTime, startOdometer, endOdometer } = req.body;

  let existing = null;
  if (id && id !== "new" && id !== "undefined") {
    existing = await prisma.attendance.findUnique({
      where: { id }
    });
  }

  if (!existing && userId && date) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    existing = await prisma.attendance.findFirst({
      where: { 
        userId: userId as string, 
        date: targetDate 
      } 
    });
  }

  let updated;
  const startOdo = startOdometer !== undefined ? (startOdometer !== null ? Number(startOdometer) : null) : undefined;
  const endOdo = endOdometer !== undefined ? (endOdometer !== null ? Number(endOdometer) : null) : undefined;

  if (existing) {
    updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        status: status as AttendanceStatus,
        checkInTime: checkInTime ? new Date(checkInTime) : undefined,
        checkOutTime: checkOutTime ? new Date(checkOutTime) : undefined,
        startOdometer: startOdo,
        endOdometer: endOdo
      }
    });
  } else {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    updated = await prisma.attendance.create({
      data: {
        userId: userId as string,
        date: targetDate,
        status: status as AttendanceStatus,
        checkInTime: checkInTime ? new Date(checkInTime) : undefined,
        checkOutTime: checkOutTime ? new Date(checkOutTime) : undefined,
        startOdometer: startOdo,
        endOdometer: endOdo
      }
    });
  }

  // Recalculate kmTravelled for DayEndReport if needed
  if (updated.startOdometer !== null || updated.endOdometer !== null) {
    let kmTravelled = 0;
    if (updated.startOdometer !== null && updated.endOdometer !== null && updated.endOdometer >= updated.startOdometer) {
      kmTravelled = updated.endOdometer - updated.startOdometer;
    }

    const targetDate = new Date(updated.date);
    targetDate.setHours(0, 0, 0, 0);

    await prisma.dayEndReport.upsert({
      where: {
        userId_date: {
          userId: updated.userId,
          date: targetDate
        }
      },
      update: {
        startOdometer: updated.startOdometer,
        endOdometer: updated.endOdometer,
        kmTravelled: Number(kmTravelled.toFixed(2))
      },
      create: {
        userId: updated.userId,
        date: targetDate,
        visitsSummary: "Auto-updated via admin console",
        ordersTaken: 0,
        ordersCancelled: 0,
        kmTravelled: Number(kmTravelled.toFixed(2)),
        startOdometer: updated.startOdometer,
        endOdometer: updated.endOdometer,
        remarks: "Auto-updated via admin console"
      }
    });
  }

  sendSuccess(res, updated, "Attendance record updated");
}

export async function getManagers(req: Request, res: Response): Promise<void> {
  const managers = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.ADMIN, UserRole.MANAGER] }
    },
    select: {
      id: true,
      name: true,
      role: true
    }
  });
  sendSuccess(res, managers);
}
