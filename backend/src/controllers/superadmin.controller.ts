import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { sendSuccess, sendMessage } from "../lib/response";
import { AttendanceStatus, UserRole, ExpenseCategory, LeaveStatus, TaskStatus, PunchType } from "@prisma/client";

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
  
  const targetDate = date ? new Date(date as string) : new Date();
  targetDate.setHours(0, 0, 0, 0);

  // 1. Fetch active users (employees & managers)
  const users = await prisma.user.findMany({
    where: {
      id: userId as string || undefined,
      role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] }
    },
    select: {
      id: true,
      name: true,
      email: true
    }
  });

  // 2. Fetch attendance logs for the target date
  const logs = await prisma.attendance.findMany({
    where: {
      userId: userId as string || undefined,
      date: targetDate
    },
    include: {
      user: {
        select: { name: true, email: true }
      },
      breaks: true
    }
  });

  // 3. Map users to attendance logs or generate virtual absent logs
  const mergedLogs = users.map((u) => {
    const existingLog = logs.find((l) => l.userId === u.id);
    if (existingLog) {
      return existingLog;
    }
    return {
      id: `virtual-${u.id}-${targetDate.toISOString()}`,
      userId: u.id,
      date: targetDate,
      punchType: null,
      checkInTime: null,
      checkInLat: null,
      checkInLng: null,
      checkInPhotoUrl: null,
      startOdometerPhotoUrl: null,
      startOdometer: null,
      checkOutTime: null,
      checkOutLat: null,
      checkOutLng: null,
      checkOutPhotoUrl: null,
      endOdometerPhotoUrl: null,
      endOdometer: null,
      status: AttendanceStatus.ABSENT,
      isCheckInPending: false,
      checkInApproved: false,
      checkInApprovedBy: null,
      checkInApprovedAt: null,
      user: {
        name: u.name,
        email: u.email
      },
      breaks: [],
      isVirtual: true
    };
  });

  sendSuccess(res, mergedLogs);
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
  if (id && id !== "new" && id !== "undefined" && !id.startsWith("virtual-")) {
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

// --- EXPENSES ---

export async function getAllExpenses(req: Request, res: Response): Promise<void> {
  const expenses = await prisma.expense.findMany({
    include: {
      user: {
        select: { name: true, email: true }
      },
      approvedBy: {
        select: { name: true }
      }
    },
    orderBy: { date: "desc" }
  });
  sendSuccess(res, expenses);
}

export async function updateExpense(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    category,
    amount,
    description,
    receiptUrl,
    date,
    approved
  } = req.body;

  const data: Record<string, unknown> = {};
  if (category !== undefined) data.category = category as ExpenseCategory;
  if (amount !== undefined && amount !== null && amount !== "") data.amount = Number(amount);
  if (description !== undefined) data.description = description;
  if (receiptUrl !== undefined) data.receiptUrl = receiptUrl || null;
  if (date !== undefined) data.date = date ? new Date(date) : undefined;
  if (approved !== undefined) {
    data.approved = Boolean(approved);
    if (approved) {
      data.approvedById = (req as any).user?.id || null;
    } else {
      data.approvedById = null;
    }
  }

  const updatedExpense = await prisma.expense.update({
    where: { id },
    data
  });

  sendSuccess(res, updatedExpense, "Expense updated successfully");
}

export async function deleteExpense(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await prisma.expense.delete({
    where: { id }
  });
  sendMessage(res, "Expense deleted successfully");
}

// --- LEAVES ---

export async function getAllLeaves(req: Request, res: Response): Promise<void> {
  const leaves = await prisma.leaveRequest.findMany({
    include: {
      user: {
        select: { name: true, email: true }
      },
      approvedBy: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  sendSuccess(res, leaves);
}

export async function updateLeave(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    startDate,
    endDate,
    reason,
    status
  } = req.body;

  const data: Record<string, unknown> = {};
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : undefined;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : undefined;
  if (reason !== undefined) data.reason = reason;
  if (status !== undefined) {
    data.status = status as LeaveStatus;
    if (status === LeaveStatus.APPROVED) {
      data.approvedById = (req as any).user?.id || null;
    } else {
      data.approvedById = null;
    }
  }

  const updatedLeave = await prisma.leaveRequest.update({
    where: { id },
    data
  });

  sendSuccess(res, updatedLeave, "Leave request updated successfully");
}

export async function deleteLeave(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await prisma.leaveRequest.delete({
    where: { id }
  });
  sendMessage(res, "Leave request deleted successfully");
}

// --- TASKS ---

export async function getAllTasks(req: Request, res: Response): Promise<void> {
  const tasks = await prisma.task.findMany({
    include: {
      assignedTo: {
        select: { name: true, email: true }
      },
      assignedBy: {
        select: { name: true, email: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  sendSuccess(res, tasks);
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    title,
    description,
    status,
    priority,
    points,
    dueDate,
    assignedToId
  } = req.body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description || null;
  if (status !== undefined) data.status = status as TaskStatus;
  if (priority !== undefined) data.priority = priority;
  if (points !== undefined && points !== null && points !== "") data.points = Number(points);
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : undefined;
  if (assignedToId !== undefined) data.assignedToId = assignedToId;

  const updatedTask = await prisma.task.update({
    where: { id },
    data
  });

  sendSuccess(res, updatedTask, "Task updated successfully");
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await prisma.task.delete({
    where: { id }
  });
  sendMessage(res, "Task deleted successfully");
}

export async function bulkMarkAttendance(req: Request, res: Response): Promise<void> {
  const {
    userId,
    startDate,
    endDate,
    status,
    punchType,
    checkInTime,
    checkOutTime,
    timezoneOffset
  } = req.body;

  if (!userId || !startDate || !endDate || !status) {
    res.status(400).json({ success: false, message: "Missing required fields" });
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (end < start) {
    res.status(400).json({ success: false, message: "End date cannot be before start date" });
    return;
  }

  const results = [];
  const currentDate = new Date(start);

  while (currentDate <= end) {
    const targetDate = new Date(currentDate);
    targetDate.setHours(0, 0, 0, 0);

    let checkIn: Date | null = null;
    let checkOut: Date | null = null;

    const tzOffset = timezoneOffset !== undefined ? Number(timezoneOffset) : -330; // default to IST

    if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.HALF_DAY) {
      if (checkInTime) {
        const [h, m] = checkInTime.split(":").map(Number);
        checkIn = new Date(targetDate);
        checkIn.setUTCHours(h, m, 0, 0);
        checkIn.setUTCMinutes(checkIn.getUTCMinutes() + tzOffset);
      }
      if (checkOutTime) {
        const [h, m] = checkOutTime.split(":").map(Number);
        checkOut = new Date(targetDate);
        checkOut.setUTCHours(h, m, 0, 0);
        checkOut.setUTCMinutes(checkOut.getUTCMinutes() + tzOffset);
      }
    }

    // Find existing
    const existing = await prisma.attendance.findFirst({
      where: {
        userId,
        date: targetDate
      }
    });

    const data: any = {
      status: status as AttendanceStatus,
      punchType: punchType ? (punchType as PunchType) : null,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      isCheckInPending: false,
      checkInApproved: true
    };

    let record;
    if (existing) {
      record = await prisma.attendance.update({
        where: { id: existing.id },
        data
      });
    } else {
      record = await prisma.attendance.create({
        data: {
          userId,
          date: targetDate,
          ...data
        }
      });
    }
    results.push(record);

    // Recalculate kmTravelled + sync odometer photos onto the DayEndReport if any odometer data is present.
    if (record.startOdometer !== null || record.endOdometer !== null || record.startOdometerPhotoUrl || record.endOdometerPhotoUrl) {
      let kmTravelled = 0;
      if (record.startOdometer !== null && record.endOdometer !== null && record.endOdometer >= record.startOdometer) {
        kmTravelled = record.endOdometer - record.startOdometer;
      }

      await prisma.dayEndReport.upsert({
        where: {
          userId_date: {
            userId: record.userId,
            date: targetDate
          }
        },
        update: {
          startOdometer: record.startOdometer,
          endOdometer: record.endOdometer,
          kmTravelled: Number(kmTravelled.toFixed(2)),
          startOdometerPhotoUrl: record.startOdometerPhotoUrl,
          kmPhotoUrl: record.endOdometerPhotoUrl
        },
        create: {
          userId: record.userId,
          date: targetDate,
          visitsSummary: "Auto-updated via admin console",
          ordersTaken: 0,
          ordersCancelled: 0,
          kmTravelled: Number(kmTravelled.toFixed(2)),
          startOdometer: record.startOdometer,
          endOdometer: record.endOdometer,
          startOdometerPhotoUrl: record.startOdometerPhotoUrl,
          kmPhotoUrl: record.endOdometerPhotoUrl,
          remarks: "Auto-updated via admin console"
        }
      });
    }

    // Advance to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  sendSuccess(res, results, `Bulk attendance updated for ${results.length} days`);
}


