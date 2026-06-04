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
      workMode: true,
      designation: true,
      shiftStart: true,
      shiftEnd: true,
      baseSalary: true,
      travelRate: true,
      avatarUrl: true,
      managerId: true,
      groupId: true,
      companyId: true,
      isLocationOn: true,
      createdAt: true,
      company: { select: { name: true } },
      group: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  sendSuccess(res, users);
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    name,
    email,
    phone,
    designation,
    workMode,
    baseSalary,
    travelRate,
    shiftStart,
    shiftEnd,
    managerId,
    role
  } = req.body;

  // Only update fields that were actually provided so partial edits never wipe data.
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (designation !== undefined) data.designation = designation;
  if (workMode !== undefined) data.workMode = workMode;
  if (baseSalary !== undefined && baseSalary !== null && baseSalary !== "") data.baseSalary = Number(baseSalary);
  if (travelRate !== undefined && travelRate !== null && travelRate !== "") data.travelRate = Number(travelRate);
  if (shiftStart !== undefined) data.shiftStart = shiftStart;
  if (shiftEnd !== undefined) data.shiftEnd = shiftEnd;
  if (managerId !== undefined) data.managerId = managerId || null;
  if (role !== undefined) data.role = role as UserRole;

  const updatedUser = await prisma.user.update({
    where: { id },
    data
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
    orderBy: { date: "desc" },
    take: 300
  });

  sendSuccess(res, logs);
}

export async function updateAttendance(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    userId,
    date,
    status,
    punchType,
    checkInTime,
    checkOutTime,
    startOdometer,
    endOdometer,
    checkInPhotoUrl,
    checkOutPhotoUrl,
    startOdometerPhotoUrl,
    endOdometerPhotoUrl
  } = req.body;

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

  const startOdo = startOdometer !== undefined ? (startOdometer !== null && startOdometer !== "" ? Number(startOdometer) : null) : undefined;
  const endOdo = endOdometer !== undefined ? (endOdometer !== null && endOdometer !== "" ? Number(endOdometer) : null) : undefined;

  // Build a data object that only touches fields the superadmin actually sent.
  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status as AttendanceStatus;
  if (punchType !== undefined) data.punchType = punchType || null;
  if (checkInTime !== undefined) data.checkInTime = checkInTime ? new Date(checkInTime) : null;
  if (checkOutTime !== undefined) data.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
  if (startOdo !== undefined) data.startOdometer = startOdo;
  if (endOdo !== undefined) data.endOdometer = endOdo;
  if (checkInPhotoUrl !== undefined) data.checkInPhotoUrl = checkInPhotoUrl || null;
  if (checkOutPhotoUrl !== undefined) data.checkOutPhotoUrl = checkOutPhotoUrl || null;
  if (startOdometerPhotoUrl !== undefined) data.startOdometerPhotoUrl = startOdometerPhotoUrl || null;
  if (endOdometerPhotoUrl !== undefined) data.endOdometerPhotoUrl = endOdometerPhotoUrl || null;

  let updated;
  if (existing) {
    updated = await prisma.attendance.update({
      where: { id: existing.id },
      data
    });
  } else {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    updated = await prisma.attendance.create({
      data: {
        userId: userId as string,
        date: targetDate,
        ...data,
        status: (status as AttendanceStatus) ?? AttendanceStatus.PRESENT
      }
    });
  }

  // Recalculate kmTravelled + sync odometer photos onto the DayEndReport if any odometer data is present.
  if (updated.startOdometer !== null || updated.endOdometer !== null || updated.startOdometerPhotoUrl || updated.endOdometerPhotoUrl) {
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
        kmTravelled: Number(kmTravelled.toFixed(2)),
        startOdometerPhotoUrl: updated.startOdometerPhotoUrl,
        kmPhotoUrl: updated.endOdometerPhotoUrl
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
        startOdometerPhotoUrl: updated.startOdometerPhotoUrl,
        kmPhotoUrl: updated.endOdometerPhotoUrl,
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
