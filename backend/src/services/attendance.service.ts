import { AttendanceStatus, Prisma, PunchType, UserRole, WorkMode } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { badRequest, conflict, notFound } from "../lib/errors";
import { monthRange, startOfDay } from "../lib/date";
import { prisma } from "../lib/prisma";
import { ensureCanAccessUser, ensureManagerCanUseEmployee, getManagerGroupId } from "./access.service";
import { createDayEndReport } from "./report.service";
import * as notificationService from "./notification.service";
import { getIO, SOCKET_EVENTS } from "../lib/socket";
import { analyzeFacePhoto } from "./aiVision.service";

interface CheckInInput {
  lat: number;
  lng: number;
  punchType: PunchType;
  photoUrl?: string;
  startOdometerPhotoUrl?: string;
  startOdometer?: number;
  checkInAiAnalysis?: any;
}

interface CheckOutInput {
  lat: number;
  lng: number;
  photoUrl?: string;
  endOdometerPhotoUrl?: string;
  endOdometer?: number;
  checkOutAiAnalysis?: any;
}

interface ManualAttendanceInput {
  userId: string;
  date: string;
  status: AttendanceStatus;
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function checkIn(actor: AuthUser, input: CheckInInput) {
  const now = new Date();
  const date = startOfDay(now);

  const active = await prisma.attendance.findFirst({
    where: {
      userId: actor.id,
      checkOutTime: null,
      status: { not: AttendanceStatus.ON_LEAVE }
    }
  });

  if (active) {
    // If the stale open session is from a PREVIOUS day, auto-close it with an end-of-day timestamp
    // so it doesn't block today's fresh check-in
    const activeDate = startOfDay(active.date);
    if (activeDate.getTime() < date.getTime()) {
      console.warn(`[Auto-Close] User ${actor.id} has a stale open session from ${active.date.toISOString().slice(0, 10)}, auto-closing it to allow today's check-in.`);
      const autoCloseTime = new Date(activeDate);
      autoCloseTime.setHours(18, 30, 0, 0); // auto-close at 6:30 PM of that day
      await prisma.attendance.update({
        where: { id: active.id },
        data: {
          checkOutTime: autoCloseTime,
          checkOutLat: active.checkInLat,
          checkOutLng: active.checkInLng,
        }
      });
    } else {
      conflict("Already checked in. Please check out first.");
    }
  }

  // Load user shiftStart + workMode to check for lateness and punchType restriction
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { shiftStart: true, managerId: true, name: true, workMode: true }
  });

  // Validate punchType against user's workMode
  if (user.workMode === WorkMode.OFFICE && input.punchType === PunchType.FIELD) {
    conflict("You are assigned to OFFICE work mode and cannot check in as FIELD.");
  }
  if (user.workMode === WorkMode.FIELD && input.punchType === PunchType.OFFICE) {
    conflict("You are assigned to FIELD work mode and cannot check in as OFFICE.");
  }

  let isCheckInPending = false;
  let checkInApproved = true;

  const localHour = parseInt(now.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour12: false, hour: "numeric" }));
  const localMinute = parseInt(now.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour12: false, minute: "numeric" }));

  // Strict 9:30 AM late check-in threshold for ALL users
  if (localHour > 9 || (localHour === 9 && localMinute > 30)) {
    isCheckInPending = true;
    checkInApproved = false;
  }

  // Check if there is an existing ON_LEAVE record for today
  const existingLeaveRecord = await prisma.attendance.findFirst({
    where: {
      userId: actor.id,
      date,
      status: AttendanceStatus.ON_LEAVE
    }
  });

  // Strict Server-Side AI Face Verification: reject invalid/spoofed/non-human selfie
  if (input.photoUrl) {
    try {
      const faceAi = await analyzeFacePhoto(input.photoUrl);
      if (!faceAi.isHumanFace) {
        badRequest(faceAi.warningMessage || "AI Face Verification Failed: No human face detected in selfie photo. Please take a clear selfie of your face.");
      }
      if (faceAi.isScreenOrPrintout) {
        badRequest("AI Face Verification Failed: Photo of another screen or printout detected. Live camera selfie is required.");
      }
      input.checkInAiAnalysis = {
        faceAi,
        ...(input.checkInAiAnalysis || {})
      };
    } catch (err: any) {
      if (err?.statusCode === 400) throw err;
      console.warn("[Attendance Service] AI Face verification error during check-in:", err?.message || err);
    }
  }

  const result = await (async () => {
    if (existingLeaveRecord) {
      return prisma.attendance.update({
        where: { id: existingLeaveRecord.id },
        data: {
          checkInTime: now,
          checkInLat: input.lat,
          checkInLng: input.lng,
          punchType: input.punchType,
          checkInPhotoUrl: input.photoUrl,
          startOdometerPhotoUrl: input.punchType === PunchType.FIELD ? input.startOdometerPhotoUrl : undefined,
          startOdometer: input.punchType === PunchType.FIELD ? input.startOdometer : undefined,
          checkOutTime: null,
          checkOutLat: null,
          checkOutLng: null,
          checkOutPhotoUrl: null,
          endOdometerPhotoUrl: null,
          endOdometer: null,
          status: AttendanceStatus.PRESENT,
          isCheckInPending,
          checkInApproved,
          checkInApprovedBy: null,
          checkInApprovedAt: null,
          checkInAiAnalysis: input.checkInAiAnalysis ?? undefined
        }
      });
    } else {
      return prisma.attendance.create({
        data: {
          userId: actor.id,
          date,
          checkInTime: now,
          checkInLat: input.lat,
          checkInLng: input.lng,
          punchType: input.punchType,
          checkInPhotoUrl: input.photoUrl,
          startOdometerPhotoUrl: input.punchType === PunchType.FIELD ? input.startOdometerPhotoUrl : undefined,
          startOdometer: input.punchType === PunchType.FIELD ? input.startOdometer : undefined,
          status: AttendanceStatus.PRESENT,
          isCheckInPending,
          checkInApproved,
          checkInAiAnalysis: input.checkInAiAnalysis ?? undefined
        }
      });
    }
  })();

  // Auto-cancel/adjust any PENDING or APPROVED leave covering today
  try {
    const todayStart = startOfDay(now);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const overlappingLeaves = await prisma.leaveRequest.findMany({
      where: {
        userId: actor.id,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart }
      }
    });

    for (const leave of overlappingLeaves) {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      // If it's a single day leave (today), delete it
      if (startOfDay(start).getTime() === startOfDay(todayStart).getTime() && startOfDay(end).getTime() === startOfDay(todayStart).getTime()) {
        await prisma.leaveRequest.delete({
          where: { id: leave.id }
        });
      }
      // If it starts today, shift start to tomorrow
      else if (startOfDay(start).getTime() === startOfDay(todayStart).getTime()) {
        const tomorrow = new Date(todayStart);
        tomorrow.setDate(tomorrow.getDate() + 1);
        await prisma.leaveRequest.update({
          where: { id: leave.id },
          data: { startDate: tomorrow }
        });
      }
      // If it ends today, shift end to yesterday
      else if (startOfDay(end).getTime() === startOfDay(todayStart).getTime()) {
        const yesterday = new Date(todayStart);
        yesterday.setDate(yesterday.getDate() - 1);
        await prisma.leaveRequest.update({
          where: { id: leave.id },
          data: { endDate: yesterday }
        });
      }
      // If today is in the middle, split it into two leaves
      else {
        const yesterday = new Date(todayStart);
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date(todayStart);
        tomorrow.setDate(tomorrow.getDate() + 1);

        await prisma.leaveRequest.update({
          where: { id: leave.id },
          data: { endDate: yesterday }
        });

        await prisma.leaveRequest.create({
          data: {
            userId: leave.userId,
            companyId: leave.companyId,
            startDate: tomorrow,
            endDate: end,
            reason: leave.reason + " (Split due to check-in)",
            status: leave.status,
            approvedById: leave.approvedById
          }
        });
      }
    }
  } catch (err) {
    console.error("[Attendance Service] Failed to auto-cancel/adjust leave on check-in:", err);
  }

  // Send Push Notification to Manager
  try {
    if (user?.managerId) {
      if (isCheckInPending) {
        await notificationService.createNotification(
          user.managerId,
          "Check-In Pending Approval",
          `${user.name} checked in late (at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) and requires approval.`,
          "LATE_CHECK_IN_PENDING"
        );
      } else {
        await notificationService.createNotification(
          user.managerId,
          "Check In Alert",
          `${user.name} has checked in.`,
          "ATTENDANCE_CHECK_IN"
        );
      }
    }
  } catch (err) {
    console.error("[Attendance Service] Failed to send check-in notification:", err);
  }

  // Send Push Notification to employee for their assigned tasks
  try {
    const todayStart = startOfDay(now);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const activeTasks = await prisma.task.findMany({
      where: {
        assignedToId: actor.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lte: todayEnd },
        AND: [
          {
            OR: [
              { startDate: null },
              { startDate: { lte: now } }
            ]
          },
          {
            OR: [
              { parentTaskId: null },
              {
                parentTask: {
                  OR: [
                    { startDate: null },
                    { startDate: { lte: now } }
                  ]
                }
              }
            ]
          }
        ]
      },
      select: { title: true }
    });

    if (activeTasks.length > 0) {
      const taskTitle = "Your Assigned Tasks Today";
      const taskList = activeTasks.map((t, idx) => `${idx + 1}. ${t.title}`).join(", ");
      const taskMessage = `You have ${activeTasks.length} task${activeTasks.length > 1 ? 's' : ''} pending: ${taskList}`;
      
      await notificationService.createNotification(
        actor.id,
        taskTitle,
        taskMessage,
        "TASK_CHECKIN_SUMMARY"
      );
    }
  } catch (err) {
    console.error("[Attendance Service] Failed to send tasks check-in notification to employee:", err);
  }

  return result;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function checkOut(actor: AuthUser, input: CheckOutInput) {
  const attendance = await prisma.attendance.findFirst({
    where: {
      userId: actor.id,
      checkOutTime: null
    },
    orderBy: { checkInTime: "desc" }
  });

  if (!attendance?.checkInTime) {
    notFound("No active check-in record found");
  }

  const activeBreak = await prisma.break.findFirst({
    where: {
      attendanceId: attendance.id,
      endTime: null
    }
  });

  if (activeBreak) {
    await prisma.break.update({
      where: { id: activeBreak.id },
      data: { endTime: new Date() }
    });
  }

  // Strict Server-Side AI Face Verification on checkout photo
  if (input.photoUrl) {
    try {
      const faceAi = await analyzeFacePhoto(input.photoUrl);
      if (!faceAi.isHumanFace) {
        badRequest(faceAi.warningMessage || "AI Face Verification Failed: No human face detected in selfie photo. Please take a clear selfie of your face.");
      }
      if (faceAi.isScreenOrPrintout) {
        badRequest("AI Face Verification Failed: Photo of another screen or printout detected. Live camera selfie is required.");
      }
      input.checkOutAiAnalysis = {
        faceAi,
        ...(input.checkOutAiAnalysis || {})
      };
    } catch (err: any) {
      if (err?.statusCode === 400) throw err;
      console.warn("[Attendance Service] AI Face verification error during checkout:", err?.message || err);
    }
  }

  const updatedAttendance = await prisma.attendance.update({
    where: {
      id: attendance.id
    },
    data: {
      checkOutTime: new Date(),
      checkOutLat: input.lat,
      checkOutLng: input.lng,
      checkOutPhotoUrl: input.photoUrl,
      endOdometerPhotoUrl: input.endOdometerPhotoUrl,
      endOdometer: input.endOdometer,
      checkOutAiAnalysis: input.checkOutAiAnalysis ?? undefined
    }
  });

  if (attendance.punchType === PunchType.FIELD) {
    try {
      const checkInTime = attendance.checkInTime;
      const checkOutTime = updatedAttendance.checkOutTime || new Date();
      
      // 1. Fetch location logs
      const locationLogs = await prisma.locationLog.findMany({
        where: {
          userId: actor.id,
          timestamp: {
            gte: checkInTime!,
            lte: checkOutTime
          }
        },
        orderBy: {
          timestamp: "asc"
        }
      });

      // 2. Build tracking points starting with checkIn location, then location logs, ending with checkOut location
      const points: Array<{ lat: number; lng: number }> = [];
      if (attendance.checkInLat !== null && attendance.checkInLng !== null) {
        points.push({ lat: attendance.checkInLat, lng: attendance.checkInLng });
      }
      for (const log of locationLogs) {
        points.push({ lat: log.lat, lng: log.lng });
      }
      points.push({ lat: input.lat, lng: input.lng });

      // 3. Compute total distance (use odometer if available, otherwise 0 per user request)
      let kmTravelled = 0;
      if (
        attendance.startOdometer !== null &&
        attendance.startOdometer !== undefined &&
        input.endOdometer !== null &&
        input.endOdometer !== undefined &&
        input.endOdometer >= attendance.startOdometer
      ) {
        kmTravelled = input.endOdometer - attendance.startOdometer;
        console.log(`[Odometer Calculation] kmTravelled calculated via Odometer: ${kmTravelled} (Start: ${attendance.startOdometer}, End: ${input.endOdometer})`);
      } else {
        kmTravelled = 0;
        console.log(`[GPS Calculation Ignored] Odometer data missing, setting kmTravelled to 0`);
      }

      // 4. Count completed tasks for today
      const dayStart = startOfDay(new Date());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const completedTasksCount = await prisma.task.count({
        where: {
          assignedToId: actor.id,
          status: "COMPLETED",
          updatedAt: {
            gte: dayStart,
            lt: dayEnd
          }
        }
      });

      // 5. Automatically create/upsert Day End Report
      await createDayEndReport(actor, {
        date: dayStart,
        visitsSummary: "Auto-generated upon field checkout",
        ordersTaken: completedTasksCount,
        ordersCancelled: 0,
        kmTravelled: Number(kmTravelled.toFixed(2)),
        kmPhotoUrl: input.endOdometerPhotoUrl,
        startOdometerPhotoUrl: attendance.startOdometerPhotoUrl ?? undefined,
        startOdometer: attendance.startOdometer ?? undefined,
        endOdometer: input.endOdometer ?? undefined,
        remarks: "Auto-generated report upon checkout"
      });
    } catch (err) {
      console.error("[AUTO-DER-ERROR] Failed to auto-generate Day End Report:", err);
    }
  }

  // Send Push Notification to Manager
  try {
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { name: true, managerId: true }
    });
    if (user?.managerId) {
      await notificationService.createNotification(
        user.managerId,
        "Check Out Alert",
        `${user.name} has checked out.`,
        "ATTENDANCE_CHECK_OUT"
      );
    }
  } catch (err) {
    console.error("[Attendance Service] Failed to send check-out notification:", err);
  }

  return updatedAttendance;
}

export async function markAttendance(actor: AuthUser, input: ManualAttendanceInput) {
  await ensureCanAccessUser(actor, input.userId);

  const date = startOfDay(new Date(input.date));
  const existing = await prisma.attendance.findFirst({
    where: {
      userId: input.userId,
      date
    }
  });

  // Allow admin overrides even if checkInTime exists


  if (existing) {
    return prisma.attendance.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        punchType: null,
        checkInTime: null,
        checkInLat: null,
        checkInLng: null,
        checkInPhotoUrl: null,
        checkOutTime: null,
        checkOutLat: null,
        checkOutLng: null,
        checkOutPhotoUrl: null
      }
    });
  }

  return prisma.attendance.create({
    data: {
      userId: input.userId,
      date,
      status: input.status
    }
  });
}

export async function clearAttendance(actor: AuthUser, userId: string, dateStr: string) {
  await ensureCanAccessUser(actor, userId);

  const date = startOfDay(new Date(dateStr));
  await prisma.attendance.deleteMany({
    where: {
      userId,
      date
    }
  });

  return { success: true };
}

export async function getMonthlyAttendance(
  actor: AuthUser,
  userId: string,
  month?: number,
  year?: number
) {
  await ensureCanAccessUser(actor, userId);

  const now = new Date();
  const { start, end } = monthRange(year ?? now.getFullYear(), month ?? now.getMonth() + 1);

  const [user, records] = await prisma.$transaction([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { createdAt: true }
    }),
    prisma.attendance.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lt: end
        }
      },
      include: { breaks: true },
      orderBy: { date: "asc" }
    })
  ]);

  return withAutoAbsences(records, userId, start, end, user.createdAt);
}

export async function getCompanyAttendance(
  actor: AuthUser,
  month?: number,
  year?: number
) {
  const now = new Date();
  const { start, end } = monthRange(year ?? now.getFullYear(), month ?? now.getMonth() + 1);

  return prisma.attendance.findMany({
    where: {
      user: {
        companyId: actor.companyId
      },
      date: {
        gte: start,
        lt: end
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          shiftStart: true,
          shiftEnd: true,
          workMode: true
        }
      },
      breaks: true
    },
    orderBy: { date: "desc" }
  });
}

export async function getAttendanceByDate(
  actor: AuthUser, 
  date?: string, 
  startDate?: string, 
  endDate?: string
) {
  const targetDate = date ? startOfDay(new Date(date)) : null;
  const startRange = startDate ? startOfDay(new Date(startDate)) : null;
  const endRange = endDate ? new Date(startOfDay(new Date(endDate)).getTime() + 24 * 60 * 60 * 1000 - 1) : null;

  const dateFilter = startRange && endRange
    ? { gte: startRange, lte: endRange }
    : targetDate
    ? targetDate
    : undefined;

  if (!dateFilter) {
    throw new Error("Either date or both startDate and endDate must be provided");
  }

  const managerGroupId = actor.role === UserRole.MANAGER ? await getManagerGroupId(actor.id) : null;

  const userWhere = actor.role === UserRole.MANAGER
    ? {
        companyId: actor.companyId,
        role: UserRole.EMPLOYEE,
        OR: [
          { managerId: actor.id },
          ...(managerGroupId ? [{ groupId: managerGroupId }] : [])
        ]
      }
    : {
        companyId: actor.companyId,
        role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] }
      };

  console.log(`[DEBUG] getAttendanceByDate: actor=${actor.email}, dateFilter=${JSON.stringify(dateFilter)}`);

  const [records, users] = await prisma.$transaction([
    prisma.attendance.findMany({
      where: {
        user: userWhere,
        date: dateFilter
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            shiftStart: true,
            shiftEnd: true,
            workMode: true,
            groupId: true
          }
        },
        breaks: true
      },
      orderBy: { checkInTime: "desc" }
    }),
    prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        shiftStart: true,
        shiftEnd: true,
        workMode: true,
        createdAt: true,
        groupId: true
      },
      orderBy: { name: "asc" }
    })
  ]);

  const byUserId = new Map(records.map((record) => [record.userId, record]));
  const includeAbsences = targetDate ? shouldAutoAbsent(targetDate) : false;
  const rows = [...records];

  if (includeAbsences && targetDate) {
    for (const user of users) {
      if (byUserId.has(user.id) || startOfDay(user.createdAt) > targetDate) {
        continue;
      }

      rows.push({
        id: `absent-${user.id}-${targetDate.toISOString().slice(0, 10)}`,
        userId: user.id,
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
        checkInApproved: true,
        checkInApprovedBy: null,
        checkInApprovedAt: null,
        checkInAiAnalysis: null,
        checkOutAiAnalysis: null,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          shiftStart: user.shiftStart,
          shiftEnd: user.shiftEnd,
          workMode: user.workMode,
          groupId: user.groupId
        },
        breaks: []
      });
    }
  }

  return rows.sort((a, b) => {
    const aTime = a.checkInTime?.getTime() ?? 0;
    const bTime = b.checkInTime?.getTime() ?? 0;
    return bTime - aTime || a.user.name.localeCompare(b.user.name);
  });
}

function withAutoAbsences<T extends { date: Date; userId: string }>(
  records: T[],
  userId: string,
  start: Date,
  end: Date,
  userCreatedAt: Date
) {
  const byDate = new Map(records.map((record) => [record.date.toISOString().slice(0, 10), record]));
  const rows: Array<T | ReturnType<typeof buildAbsentRecord>> = [...records];
  const cursor = startOfDay(start > userCreatedAt ? start : userCreatedAt);
  const today = startOfDay(new Date());
  const lastDate = end < today ? end : today;

  while (cursor < lastDate) {
    const key = cursor.toISOString().slice(0, 10);
    if (!byDate.has(key) && shouldAutoAbsent(cursor)) {
      rows.push(buildAbsentRecord(userId, cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function buildAbsentRecord(userId: string, date: Date) {
  return {
    id: `absent-${userId}-${date.toISOString().slice(0, 10)}`,
    userId,
    date: new Date(date),
    punchType: null,
    checkInTime: null,
    checkInLat: null,
    checkInLng: null,
    checkInPhotoUrl: null,
    checkOutTime: null,
    checkOutLat: null,
    checkOutLng: null,
    checkOutPhotoUrl: null,
    status: AttendanceStatus.ABSENT,
    isCheckInPending: false,
    checkInApproved: true,
    checkInApprovedBy: null,
    checkInApprovedAt: null,
    checkInAiAnalysis: null,
    checkOutAiAnalysis: null,
    breaks: []
  };
}

function shouldAutoAbsent(date: Date) {
  const value = startOfDay(date);
  const today = startOfDay(new Date());
  const day = value.getDay();

  return value < today && day !== 0 && day !== 6;
}

export async function startBreak(actor: AuthUser) {
  const activeAttendance = await prisma.attendance.findFirst({
    where: {
      userId: actor.id,
      checkOutTime: null
    }
  });

  if (!activeAttendance) {
    notFound("No active attendance record found");
  }

  const activeBreak = await prisma.break.findFirst({
    where: {
      attendanceId: activeAttendance.id,
      endTime: null
    }
  });

  if (activeBreak) {
    conflict("You are already on a break");
  }

  return prisma.break.create({
    data: {
      attendanceId: activeAttendance.id,
      startTime: new Date()
    }
  });
}

export async function endBreak(actor: AuthUser) {
  const activeAttendance = await prisma.attendance.findFirst({
    where: {
      userId: actor.id,
      checkOutTime: null
    }
  });

  if (!activeAttendance) {
    notFound("No active attendance record found");
  }

  const activeBreak = await prisma.break.findFirst({
    where: {
      attendanceId: activeAttendance.id,
      endTime: null
    }
  });

  if (!activeBreak) {
    notFound("No active break found");
  }

  return prisma.break.update({
    where: {
      id: activeBreak.id
    },
    data: {
      endTime: new Date()
    }
  });
}

export async function getAttendanceDashboardSummary(actor: AuthUser, dateStr: string) {
  const targetDate = startOfDay(new Date(dateStr));
  const companyId = actor.companyId;

  // 1. Total Employees
  const totalEmployees = await prisma.user.count({
    where: { companyId, role: UserRole.EMPLOYEE }
  });

  // 2. Currently Working (checked in today, checkOutTime is null)
  const currentlyWorking = await prisma.attendance.count({
    where: {
      user: { companyId },
      date: targetDate,
      checkInTime: { not: null },
      checkOutTime: null
    }
  });

  // 3. On Break (checked in today, has active break with endTime null)
  const onBreak = await prisma.break.count({
    where: {
      attendance: {
        user: { companyId },
        date: targetDate,
        checkOutTime: null
      },
      endTime: null
    }
  });

  // 4. Time Off (ON_LEAVE status today)
  const timeOff = await prisma.attendance.count({
    where: {
      user: { companyId },
      date: targetDate,
      status: AttendanceStatus.ON_LEAVE
    }
  });

  // 5. Pending Biometrics (employees with null avatarUrl as standard biometric verification proxy)
  const pendingBiometrics = await prisma.user.count({
    where: { companyId, role: UserRole.EMPLOYEE, avatarUrl: null }
  });

  // 6. Detailed Employees List for "Quick Attendance Summary"
  const records = await prisma.attendance.findMany({
    where: {
      user: { companyId },
      date: targetDate
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          designation: true,
          shiftStart: true,
          shiftEnd: true,
          group: { select: { name: true } }
        }
      },
      breaks: true
    }
  });

  // Get users who haven't checked in yet today and are not on approved leaves
  const checkedInUserIds = records.map(r => r.userId);
  const absentUsers = await prisma.user.findMany({
    where: {
      companyId,
      role: UserRole.EMPLOYEE,
      id: { notIn: checkedInUserIds }
    },
    select: {
      id: true,
      name: true,
      email: true,
      designation: true,
      shiftStart: true,
      shiftEnd: true,
      group: { select: { name: true } }
    }
  });

  // Combine checked in & absent/not-in-yet
  const allRows = [
    ...records.map(r => {
      // Calculate active durations
      const firstPunch = r.checkInTime ? r.checkInTime.toISOString() : "-";
      const lastPunch = r.checkOutTime ? r.checkOutTime.toISOString() : "-";
      
      let totalWorkMs = 0;
      if (r.checkInTime) {
        const end = r.checkOutTime ? new Date(r.checkOutTime) : new Date();
        totalWorkMs = end.getTime() - new Date(r.checkInTime).getTime();
      }

      const totalBreakMs = r.breaks.reduce((sum, b) => {
        const end = b.endTime ? new Date(b.endTime) : new Date();
        return sum + (end.getTime() - new Date(b.startTime).getTime());
      }, 0);

      const workHours = Math.max(0, (totalWorkMs - totalBreakMs) / (1000 * 60 * 60));
      const breakHours = totalBreakMs / (1000 * 60 * 60);

      // Overtime: work hours greater than 8 hours
      const overtime = Math.max(0, workHours - 8);

      return {
        id: r.id,
        employeeId: r.user.id.slice(-4).toUpperCase(),
        name: r.user.name,
        department: r.user.group?.name || "General",
        designation: r.user.designation || "Employee",
        firstPunch,
        lastPunch,
        workingHours: workHours.toFixed(2) + "h",
        breakHours: breakHours > 0 ? breakHours.toFixed(2) + "h" : "-",
        overtime: overtime > 0 ? overtime.toFixed(2) + "h" : "-",
        status: r.status,
        shift: r.user.shiftStart === "20:00" ? "NIGHT" : (r.user.shiftStart === "00:00" ? "Open Shift" : "Default Shift"),
        isCheckedIn: true
      };
    }),
    ...absentUsers.map(u => ({
      id: "absent-" + u.id,
      employeeId: u.id.slice(-4).toUpperCase(),
      name: u.name,
      department: u.group?.name || "General",
      designation: u.designation || "Employee",
      firstPunch: "-",
      lastPunch: "-",
      workingHours: "-",
      breakHours: "-",
      overtime: "-",
      status: "ABSENT",
      shift: u.shiftStart === "20:00" ? "NIGHT" : (u.shiftStart === "00:00" ? "Open Shift" : "Default Shift"),
      isCheckedIn: false
    }))
  ];

  // 7. Today's Shift Wise Attendance Summary
  const shiftWise = [
    {
      shift: "Open Shift",
      onTime: allRows.filter(r => r.shift === "Open Shift" && r.isCheckedIn).length,
      late: 0,
      notInYet: allRows.filter(r => r.shift === "Open Shift" && !r.isCheckedIn).length,
      timeOff: 0
    },
    {
      shift: "Default Shift",
      onTime: allRows.filter(r => r.shift === "Default Shift" && r.isCheckedIn && r.status === "PRESENT").length,
      late: allRows.filter(r => r.shift === "Default Shift" && r.isCheckedIn && r.status === "HALF_DAY").length,
      notInYet: allRows.filter(r => r.shift === "Default Shift" && !r.isCheckedIn).length,
      timeOff: 0
    },
    {
      shift: "NIGHT",
      onTime: allRows.filter(r => r.shift === "NIGHT" && r.isCheckedIn).length,
      late: 0,
      notInYet: allRows.filter(r => r.shift === "NIGHT" && !r.isCheckedIn).length,
      timeOff: 0
    }
  ];

  // 8. Today's Department Wise Attendance Summary
  const departments = Array.from(new Set(allRows.map(r => r.department)));
  const departmentWise = departments.map(dept => ({
    department: dept,
    checkedIn: allRows.filter(r => r.department === dept && r.isCheckedIn).length,
    notInYet: allRows.filter(r => r.department === dept && !r.isCheckedIn).length,
    timeOff: 0
  }));

  // 9. Devices Sync Status
  const devices = await prisma.syncDevice.findMany({
    where: { companyId }
  });

  // 10. Pending Approvals list
  const pendingApprovals = await prisma.attendanceRequest.findMany({
    where: {
      status: "PENDING",
      user: { companyId }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          designation: true,
          group: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return {
    stats: {
      totalEmployees,
      currentlyWorking,
      onBreak,
      timeOff,
      pendingBiometrics
    },
    quickSummary: allRows,
    shiftWise,
    departmentWise,
    devices: devices.length > 0 ? devices : [
      {
        id: "mock-device",
        name: "INDRAPRASTHA PETROLEUM(202)",
        macAddress: "70:b8:f6:69:34:2a",
        lastSync: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
        status: "Offline"
      }
    ],
    pendingApprovals: pendingApprovals.map(pa => ({
      id: pa.id,
      employeeId: pa.userId.slice(-4).toUpperCase(),
      name: pa.user.name,
      designation: pa.user.designation || "Employee",
      department: pa.user.group?.name || "General",
      date: pa.date.toISOString(),
      type: pa.type,
      newPunch: pa.checkInTime ? new Date(pa.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
      reason: pa.reason,
      createdAt: pa.createdAt.toISOString()
    }))
  };
}

export async function getAttendanceRequests(actor: AuthUser, status?: string) {
  const companyId = actor.companyId;
  const whereClause: any = {
    user: { companyId }
  };
  
  if (status && status !== "ALL") {
    whereClause.status = status;
  }

  const requests = await prisma.attendanceRequest.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          designation: true,
          group: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return requests.map(pa => ({
    id: pa.id,
    type: pa.type,
    userId: pa.userId,
    employeeId: pa.userId.slice(-4).toUpperCase(),
    name: pa.user.name,
    designation: pa.user.designation || "Employee",
    department: pa.user.group?.name || "General",
    date: pa.date.toISOString(),
    newPunch: pa.checkInTime ? new Date(pa.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
    reason: pa.reason,
    status: pa.status,
    createdAt: pa.createdAt.toISOString()
  }));
}

export async function approveAttendanceRequest(actor: AuthUser, requestId: string) {
  const request = await prisma.attendanceRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { user: true }
  });

  if (request.user.companyId !== actor.companyId) {
    throw new Error("Unauthorized access to request.");
  }

  await prisma.attendanceRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED" }
  });

  const targetDate = startOfDay(new Date(request.date));
  const existing = await prisma.attendance.findFirst({
    where: { userId: request.userId, date: targetDate }
  });

  if (existing) {
    await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkInTime: request.checkInTime || existing.checkInTime,
        checkOutTime: request.checkOutTime || existing.checkOutTime,
        status: AttendanceStatus.PRESENT
      }
    });
  } else {
    await prisma.attendance.create({
      data: {
        userId: request.userId,
        date: targetDate,
        checkInTime: request.checkInTime,
        checkOutTime: request.checkOutTime,
        status: AttendanceStatus.PRESENT
      }
    });
  }

  // Notify employee of attendance request approval
  try {
    await notificationService.createNotification(
      request.userId,
      "Attendance Request Approved",
      `Your attendance request for ${new Date(request.date).toLocaleDateString()} has been approved by ${actor.name}.`,
      "ATTENDANCE_APPROVAL"
    );
  } catch (err) {
    console.error("[Attendance Service] Failed to send attendance approval notification:", err);
  }

  return { success: true };
}

export async function rejectAttendanceRequest(actor: AuthUser, requestId: string) {
  const request = await prisma.attendanceRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { user: true }
  });

  if (request.user.companyId !== actor.companyId) {
    throw new Error("Unauthorized access to request.");
  }

  await prisma.attendanceRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED" }
  });

  // Notify employee of attendance request rejection
  try {
    await notificationService.createNotification(
      request.userId,
      "Attendance Request Rejected",
      `Your attendance request for ${new Date(request.date).toLocaleDateString()} has been rejected by ${actor.name}.`,
      "ATTENDANCE_REJECTION"
    );
  } catch (err) {
    console.error("[Attendance Service] Failed to send attendance rejection notification:", err);
  }

  return { success: true };
}

export async function getPendingLateCheckIns(actor: AuthUser, status: string = "PENDING") {
  if (actor.role === UserRole.EMPLOYEE) {
    throw new Error("Unauthorized");
  }

  const companyId = actor.companyId;

  // A manager may only review their own team's EMPLOYEE late check-ins.
  // A manager's own (or another manager's) late check-in is only approvable by an admin.
  const managerGroupId =
    actor.role === UserRole.MANAGER ? await getManagerGroupId(actor.id) : null;

  const userWhere =
    actor.role === UserRole.MANAGER
      ? {
          companyId,
          role: UserRole.EMPLOYEE,
          OR: [
            { managerId: actor.id },
            ...(managerGroupId ? [{ groupId: managerGroupId }] : [])
          ]
        }
      : { companyId };

  const whereClause: any = {
    user: userWhere
  };

  if (status === "APPROVED") {
    whereClause.isCheckInPending = false;
    whereClause.checkInApproved = true;
    whereClause.checkInApprovedBy = { not: null };
  } else if (status === "REJECTED") {
    whereClause.isCheckInPending = false;
    whereClause.checkInApproved = false;
    whereClause.checkInApprovedBy = { not: null };
  } else {
    // Default to PENDING
    whereClause.isCheckInPending = true;
  }

  const pendingList = await prisma.attendance.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          designation: true,
          shiftStart: true,
          shiftEnd: true,
          group: { select: { name: true } }
        }
      }
    },
    orderBy: { checkInTime: "desc" }
  });

  const userIds = pendingList.map(item => item.userId);
  const now = new Date();
  const { start, end } = monthRange(now.getFullYear(), now.getMonth() + 1);

  const monthlyRecords = await prisma.attendance.findMany({
    where: {
      userId: { in: userIds },
      date: { gte: start, lt: end },
      checkInTime: { not: null }
    },
    select: { userId: true, checkInTime: true }
  });

  const countsMap: Record<string, number> = {};
  for (const r of monthlyRecords) {
    if (r.checkInTime) {
      const localHour = parseInt(r.checkInTime.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour12: false, hour: "numeric" }));
      const localMinute = parseInt(r.checkInTime.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour12: false, minute: "numeric" }));
      if (localHour > 9 || (localHour === 9 && localMinute > 45)) {
        countsMap[r.userId] = (countsMap[r.userId] || 0) + 1;
      }
    }
  }

  return pendingList.map(item => ({
    id: item.id,
    userId: item.userId,
    employeeId: item.userId.slice(-4).toUpperCase(),
    name: item.user.name,
    email: item.user.email,
    designation: item.user.designation || "Employee",
    department: item.user.group?.name || "General",
    date: item.date.toISOString(),
    checkInTime: item.checkInTime ? item.checkInTime.toISOString() : null,
    shiftStart: item.user.shiftStart,
    createdAt: item.checkInTime ? item.checkInTime.toISOString() : new Date().toISOString(),
    lateCheckInsCount: countsMap[item.userId] || 0,
    punchType: item.punchType,
    checkInPhotoUrl: item.checkInPhotoUrl,
    startOdometer: item.startOdometer,
    startOdometerPhotoUrl: item.startOdometerPhotoUrl,
    checkInLat: item.checkInLat,
    checkInLng: item.checkInLng,
    checkInAiAnalysis: item.checkInAiAnalysis,
    checkInApproved: item.checkInApproved,
    checkInApprovedBy: item.checkInApprovedBy,
    checkInApprovedAt: item.checkInApprovedAt ? item.checkInApprovedAt.toISOString() : null,
    status: item.status
  }));
}

export async function approveLateCheckIn(actor: AuthUser, id: string) {
  if (actor.role === UserRole.EMPLOYEE) {
    throw new Error("Unauthorized");
  }

  const attendance = await prisma.attendance.findUnique({
    where: { id },
    include: { user: true }
  });

  if (!attendance) {
    throw new Error("Attendance record not found");
  }

  if (attendance.user.companyId !== actor.companyId) {
    throw new Error("Unauthorized");
  }

  // Managers can only approve their own team's EMPLOYEE check-ins.
  // This forbids a manager approving another manager's (or their own) late check-in — admin only.
  if (actor.role === UserRole.MANAGER) {
    await ensureManagerCanUseEmployee(actor, attendance.userId);
  }

  const result = await prisma.attendance.update({
    where: { id },
    data: {
      isCheckInPending: false,
      checkInApproved: true,
      checkInApprovedBy: actor.id,
      checkInApprovedAt: new Date()
    }
  });

  // Push a real-time update so the employee's app starts the work timer immediately
  // (and any open manager/admin dashboards drop the pending row) without a manual refresh.
  try {
    getIO().to(`company:${attendance.user.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
      type: "LATE_CHECK_IN_APPROVED",
      userId: attendance.userId,
      attendanceId: id
    });
  } catch (err) {
    console.error("[Attendance Service] Failed to emit approval socket event:", err);
  }

  try {
    await notificationService.createNotification(
      attendance.userId,
      "Check-In Approved",
      "Your late check-in has been approved by your manager/admin.",
      "LATE_CHECK_IN_APPROVED"
    );
  } catch (err) {
    console.error("[Attendance Service] Failed to send approval notification:", err);
  }

  return result;
}

export async function rejectLateCheckIn(actor: AuthUser, id: string) {
  if (actor.role === UserRole.EMPLOYEE) {
    throw new Error("Unauthorized");
  }

  const attendance = await prisma.attendance.findUnique({
    where: { id },
    include: { user: true }
  });

  if (!attendance) {
    throw new Error("Attendance record not found");
  }

  if (attendance.user.companyId !== actor.companyId) {
    throw new Error("Unauthorized");
  }

  if (actor.role === UserRole.MANAGER) {
    await ensureManagerCanUseEmployee(actor, attendance.userId);
  }

  const result = await prisma.attendance.update({
    where: { id },
    data: {
      isCheckInPending: false,
      checkInApproved: false,
      checkInApprovedBy: actor.id,
      checkInApprovedAt: new Date(),
      status: AttendanceStatus.ABSENT
    }
  });

  try {
    getIO().to(`company:${attendance.user.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
      type: "LATE_CHECK_IN_REJECTED",
      userId: attendance.userId,
      attendanceId: id
    });
  } catch (err) {
    console.error("[Attendance Service] Failed to emit rejection socket event:", err);
  }

  try {
    await notificationService.createNotification(
      attendance.userId,
      "Check-In Rejected",
      "Your late check-in request was rejected.",
      "LATE_CHECK_IN_REJECTED"
    );
  } catch (err) {
    console.error("[Attendance Service] Failed to send rejection notification:", err);
  }

  return { success: true };
}

export async function forceCheckout(actor: AuthUser, userId: string) {
  await ensureCanAccessUser(actor, userId);

  // Turn off location tracking state on the user model so the admin panel UI dot updates
  await prisma.user.update({
    where: { id: userId },
    data: { isLocationOn: false }
  });

  const activeAttendances = await prisma.attendance.findMany({
    where: {
      userId,
      checkOutTime: null
    },
    select: { id: true }
  });

  if (activeAttendances.length === 0) {
    return { success: true, message: "No active check-in found for this user." };
  }

  const activeIds = activeAttendances.map(a => a.id);

  // Close active breaks
  await prisma.break.updateMany({
    where: {
      attendanceId: { in: activeIds },
      endTime: null
    },
    data: { endTime: new Date() }
  });

  // Close all active attendances
  await prisma.attendance.updateMany({
    where: {
      id: { in: activeIds }
    },
    data: {
      checkOutTime: new Date(),
      checkOutLat: 0,
      checkOutLng: 0
    }
  });

  return { success: true, message: "Force checkout completed successfully." };
}

export async function autoCheckoutStuckUsers() {
  const now = new Date();
  console.log(`[Scheduler] Starting auto-checkout for stuck users at ${now.toISOString()}`);

  const activeRecords = await prisma.attendance.findMany({
    where: {
      checkOutTime: null
    },
    select: {
      id: true,
      userId: true,
      date: true,
      checkInTime: true
    }
  });

  console.log(`[Scheduler] Found ${activeRecords.length} active sessions to check out.`);

  for (const record of activeRecords) {
    try {
      const activeBreak = await prisma.break.findFirst({
        where: {
          attendanceId: record.id,
          endTime: null
        }
      });

      if (activeBreak) {
        await prisma.break.update({
          where: { id: activeBreak.id },
          data: { endTime: now }
        });
      }

      await prisma.attendance.update({
        where: { id: record.id },
        data: {
          checkOutTime: now,
          checkOutLat: 0,
          checkOutLng: 0
        }
      });

      await prisma.user.update({
        where: { id: record.userId },
        data: { isLocationOn: false }
      });

      console.log(`[Scheduler] Auto checked out user ${record.userId} for attendance ${record.id}`);
    } catch (error) {
      console.error(`[Scheduler] Failed to auto checkout user ${record.userId}:`, error);
    }
  }
}

export async function autoCheckoutOldStuckSessions() {
  const today = startOfDay(new Date());

  const oldActiveRecords = await prisma.attendance.findMany({
    where: {
      checkOutTime: null,
      date: {
        lt: today
      }
    },
    select: {
      id: true,
      userId: true,
      date: true,
      checkInTime: true
    }
  });

  if (oldActiveRecords.length === 0) {
    return;
  }

  console.log(`[Scheduler] Found ${oldActiveRecords.length} historical stuck sessions to auto-checkout on startup.`);

  for (const record of oldActiveRecords) {
    try {
      let checkoutTime = new Date(record.checkInTime || record.date);

      if (record.checkInTime) {
        checkoutTime.setHours(checkoutTime.getHours() + 9);
      } else {
        checkoutTime.setHours(18, 0, 0, 0);
      }

      const activeBreak = await prisma.break.findFirst({
        where: {
          attendanceId: record.id,
          endTime: null
        }
      });

      if (activeBreak) {
        await prisma.break.update({
          where: { id: activeBreak.id },
          data: { endTime: checkoutTime }
        });
      }

      await prisma.attendance.update({
        where: { id: record.id },
        data: {
          checkOutTime: checkoutTime,
          checkOutLat: 0,
          checkOutLng: 0
        }
      });

      await prisma.user.update({
        where: { id: record.userId },
        data: { isLocationOn: false }
      });

      console.log(`[Scheduler] Startup auto-checkout: Closed old session ${record.id} for user ${record.userId}`);
    } catch (error) {
      console.error(`[Scheduler] Failed to close old session ${record.id}:`, error);
    }
  }
}

export async function analyzeFacePhotoService(image: string) {
  const { analyzeFacePhoto } = await import("./aiVision.service");
  return analyzeFacePhoto(image);
}

export async function analyzeOdometerPhotoService(image: string) {
  const { analyzeOdometerPhoto } = await import("./aiVision.service");
  return analyzeOdometerPhoto(image);
}

