import { AttendanceStatus, Prisma, PunchType, UserRole, WorkMode } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { conflict, notFound } from "../lib/errors";
import { monthRange, startOfDay } from "../lib/date";
import { prisma } from "../lib/prisma";
import { ensureCanAccessUser, getManagerGroupId } from "./access.service";
import { createDayEndReport } from "./report.service";

interface CheckInInput {
  lat: number;
  lng: number;
  punchType: PunchType;
  photoUrl?: string;
  startOdometerPhotoUrl?: string;
  startOdometer?: number;
}

interface CheckOutInput {
  lat: number;
  lng: number;
  photoUrl?: string;
  endOdometerPhotoUrl?: string;
  endOdometer?: number;
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
      checkOutTime: null
    }
  });

  if (active) {
    conflict("Already checked in. Please check out first.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      return tx.attendance.create({
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
          status: AttendanceStatus.PRESENT
        }
      });
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await prisma.attendance.findFirst({
      where: {
        userId: actor.id,
        date
      },
      orderBy: { checkInTime: "desc" }
    });

    if (!existing) {
      throw error;
    }

    if (existing.checkInTime && !existing.checkOutTime) {
      conflict("Already checked in. Please check out first.");
    }

    return prisma.attendance.update({
      where: { id: existing.id },
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
        status: AttendanceStatus.PRESENT
      }
    });
  }
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
      endOdometer: input.endOdometer
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

      // 3. Compute total distance
      let kmTravelled = 0;
      for (let i = 0; i < points.length - 1; i++) {
        kmTravelled += calculateHaversineDistance(
          points[i].lat,
          points[i].lng,
          points[i + 1].lat,
          points[i + 1].lng
        );
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

export async function getAttendanceByDate(actor: AuthUser, date: string) {
  const targetDate = startOfDay(new Date(date));

  const managerGroupId = actor.role === UserRole.MANAGER ? await getManagerGroupId(actor.id) : null;

  const userWhere = {
    companyId: actor.companyId,
    role: UserRole.EMPLOYEE,
    ...(actor.role === UserRole.MANAGER 
      ? {
          OR: [
            { managerId: actor.id },
            ...(managerGroupId ? [{ groupId: managerGroupId }] : [])
          ]
        }
      : {})
  };

  console.log(`[DEBUG] getAttendanceByDate: actor=${actor.email}, date=${date}, targetDate=${targetDate.toISOString()}`);

  const [records, users] = await prisma.$transaction([
    prisma.attendance.findMany({
      where: {
        user: userWhere,
        date: targetDate
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
            workMode: true
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
        createdAt: true
      },
      orderBy: { name: "asc" }
    })
  ]);

  const byUserId = new Map(records.map((record) => [record.userId, record]));
  const includeAbsences = shouldAutoAbsent(targetDate);
  const rows = [...records];

  if (includeAbsences) {
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
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          shiftStart: user.shiftStart,
          shiftEnd: user.shiftEnd,
          workMode: user.workMode
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

  return { success: true };
}
