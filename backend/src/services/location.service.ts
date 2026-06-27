import type { AuthUser } from "../types/auth";
import { nextDay, startOfDay } from "../lib/date";
import { prisma } from "../lib/prisma";
import { ensureCanAccessUser } from "./access.service";
import { UserRole } from "@prisma/client";
import { getIO, SOCKET_EVENTS } from "../lib/socket";
import * as notificationService from "./notification.service";

interface LocationLogInput {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: Date;
  batteryLevel?: number;
}

export async function createLocationLogs(
  actor: AuthUser,
  input: LocationLogInput[] | { logs: LocationLogInput[] }
) {
  const logs = Array.isArray(input) ? input : input.logs;

  const result = await prisma.locationLog.createMany({
    data: logs.map((log) => ({
      userId: actor.id,
      lat: log.lat,
      lng: log.lng,
      accuracy: log.accuracy,
      timestamp: log.timestamp,
      batteryLevel: log.batteryLevel
    }))
  });

  if (logs.length > 0) {
    const latestLog = logs.reduce((latest, current) => {
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
    });

    await updateLocationStatus(actor, {
      isLocationOn: true,
      batteryLevel: latestLog.batteryLevel
    });

    // Notify listeners that location has updated
    getIO().to(`company:${actor.companyId}`).emit(SOCKET_EVENTS.LOCATION_UPDATE, {
      userId: actor.id,
      lat: latestLog.lat,
      lng: latestLog.lng,
      timestamp: latestLog.timestamp,
      batteryLevel: latestLog.batteryLevel
    });
  }

  return {
    count: result.count
  };
}

export async function updateLocationStatus(
  actor: AuthUser,
  input: { isLocationOn: boolean; batteryLevel?: number; isStale?: boolean }
) {
  const user = await prisma.user.update({
    where: { id: actor.id },
    data: {
      isLocationOn: input.isLocationOn,
      locationOffAt: input.isLocationOn ? null : new Date(),
      ...(input.batteryLevel !== undefined && { batteryLevel: input.batteryLevel })
    }
  });

  // If location is turned off:
  if (!input.isLocationOn) {
    // 1. Pause working hours by auto-starting break if punched in on FIELD
    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        userId: actor.id,
        checkOutTime: null,
        punchType: "FIELD"
      }
    });

    if (activeAttendance) {
      const activeBreak = await prisma.break.findFirst({
        where: {
          attendanceId: activeAttendance.id,
          endTime: null
        }
      });

      if (!activeBreak) {
        // Use user.locationOffAt or new Date() as break startTime to be precise
        const breakStartTime = user.locationOffAt || new Date();
        await prisma.break.create({
          data: {
            attendanceId: activeAttendance.id,
            startTime: breakStartTime
          }
        });

        // Emit WS update so the app and admin panels refresh
        getIO().to(`company:${actor.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
          userId: actor.id,
          type: "break-start-auto",
          data: activeAttendance
        });
      }
    }

    // 2. Alert manager and admins (only if it was manually turned off, i.e., NOT stale)
    if (!input.isStale) {
      const batteryInfo = input.batteryLevel !== undefined ? `${input.batteryLevel}%` : "N/A";
      const alertMessage = `${actor.name} has turned off their location. Battery level: ${batteryInfo}.`;

      if (user.managerId) {
        await notificationService.createNotification(
          user.managerId,
          "Location Alert",
          alertMessage,
          "LOCATION_OFF"
        );
      }

      const admins = await prisma.user.findMany({
        where: {
          companyId: actor.companyId,
          role: { in: ["ADMIN", "SUPERADMIN"] }
        },
        select: { id: true }
      });

      for (const admin of admins) {
        if (admin.id !== user.managerId) {
          await notificationService.createNotification(
            admin.id,
            "Location Alert",
            alertMessage,
            "LOCATION_OFF"
          );
        }
      }

      // Emit live popup WS event for current logged-in admins
      getIO().to(`company:${actor.companyId}`).emit("LOCATION_OFF_EVENT", {
        userId: actor.id,
        name: actor.name,
        batteryLevel: input.batteryLevel ?? null,
        timestamp: new Date().toISOString()
      });
    }
  } else {
    // If location is turned back on, resume working hours by auto-ending break if active
    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        userId: actor.id,
        checkOutTime: null,
        punchType: "FIELD"
      }
    });

    if (activeAttendance) {
      const activeBreak = await prisma.break.findFirst({
        where: {
          attendanceId: activeAttendance.id,
          endTime: null
        }
      });

      if (activeBreak) {
        await prisma.break.update({
          where: { id: activeBreak.id },
          data: { endTime: new Date() }
        });

        // Emit WS update so the app and admin panels refresh
        getIO().to(`company:${actor.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
          userId: actor.id,
          type: "break-end-auto",
          data: activeAttendance
        });
      }
    }
  }

  return { success: true };
}

export async function getTodayLocationLogs(actor: AuthUser, userId: string, dateStr?: string) {
  await ensureCanAccessUser(actor, userId);

  const baseDate = dateStr ? new Date(dateStr) : new Date();
  const dayStart = startOfDay(baseDate);

  return prisma.locationLog.findMany({
    where: {
      userId,
      timestamp: {
        gte: dayStart,
        lt: nextDay(dayStart)
      }
    },
    orderBy: { timestamp: "desc" }
  });
}

export async function checkStaleLocations() {
  const now = new Date();
  const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

  try {
    const activeUsers = await prisma.user.findMany({
      where: {
        isLocationOn: true,
        role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] },
        attendances: {
          some: {
            checkOutTime: null,
            punchType: "FIELD",
            breaks: {
              none: {
                endTime: null
              }
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        companyId: true,
        managerId: true,
        role: true,
        email: true
      }
    });

    for (const user of activeUsers) {
      // Find the active attendance record
      const activeAttendance = await prisma.attendance.findFirst({
        where: {
          userId: user.id,
          checkOutTime: null,
          punchType: "FIELD"
        },
        orderBy: { checkInTime: "desc" }
      });

      if (!activeAttendance) continue;

      // Find the latest location log for this user today
      const latestLog = await prisma.locationLog.findFirst({
        where: { userId: user.id },
        orderBy: { timestamp: "desc" }
      });

      let lastPingTime = activeAttendance.checkInTime ? new Date(activeAttendance.checkInTime) : null;
      if (latestLog) {
        lastPingTime = new Date(latestLog.timestamp);
      }

      if (!lastPingTime) continue;

      const diffMs = now.getTime() - lastPingTime.getTime();

      if (diffMs > STALE_THRESHOLD_MS) {
        console.log(`[Scheduler] User ${user.name} (${user.id}) location ping is stale by ${(diffMs / 1000 / 60).toFixed(1)} mins. Marking location OFF.`);
        
        const actor: AuthUser = {
          id: user.id,
          name: user.name,
          companyId: user.companyId,
          managerId: user.managerId,
          role: user.role,
          email: user.email
        };

        await updateLocationStatus(actor, { isLocationOn: false, isStale: true });
      }
    }
  } catch (error) {
    console.error("[Scheduler] Error in checkStaleLocations:", error);
  }
}
