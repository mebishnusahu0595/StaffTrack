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
  const { id } = req.params; // Note: id might be a dummy or real id
  const { userId, date, status, checkInTime, checkOutTime } = req.body;

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const existing = await prisma.attendance.findFirst({
    where: { 
      userId: userId as string, 
      date: targetDate 
    } 
  });

  let updated;
  if (existing) {
    updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        status: status as AttendanceStatus,
        checkInTime: checkInTime ? new Date(checkInTime) : undefined,
        checkOutTime: checkOutTime ? new Date(checkOutTime) : undefined
      }
    });
  } else {
    updated = await prisma.attendance.create({
      data: {
        userId: userId as string,
        date: targetDate,
        status: status as AttendanceStatus,
        checkInTime: checkInTime ? new Date(checkInTime) : undefined,
        checkOutTime: checkOutTime ? new Date(checkOutTime) : undefined
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
