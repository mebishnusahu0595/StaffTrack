import { UserRole } from "@prisma/client";
import { startOfDay } from "../lib/date";
import { prisma } from "../lib/prisma";
import type { AuthUser } from "../types/auth";
import { ensureCanAccessUser, getManagerGroupId } from "./access.service";
import * as notificationService from "./notification.service";
import { getIO, SOCKET_EVENTS } from "../lib/socket";

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function calculateTodayGpsKm(userId: string, date: Date = new Date()): Promise<number> {
  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Fetch all location logs for this user today ordered chronologically
  const logs = await prisma.locationLog.findMany({
    where: {
      userId,
      timestamp: {
        gte: dayStart,
        lt: dayEnd
      }
    },
    orderBy: { timestamp: "asc" }
  });

  if (logs.length < 2) {
    return 0;
  }

  let totalKm = 0;
  let prevLog = logs[0];

  for (let i = 1; i < logs.length; i++) {
    const current = logs[i];

    // Filter out low accuracy pings (> 150m accuracy)
    if (current.accuracy > 150) {
      continue;
    }

    const distance = calculateHaversineDistance(prevLog.lat, prevLog.lng, current.lat, current.lng);

    // Ignore tiny jitter (< 10 meters)
    if (distance < 0.01) {
      continue;
    }

    // Filter out unrealistic speed jumps (> 160 km/h)
    const timeDiffHours = (new Date(current.timestamp).getTime() - new Date(prevLog.timestamp).getTime()) / (1000 * 60 * 60);
    if (timeDiffHours > 0) {
      const speedKmh = distance / timeDiffHours;
      if (speedKmh > 160) {
        // Skip teleport ping
        continue;
      }
    }

    totalKm += distance;
    prevLog = current;
  }

  return Number(totalKm.toFixed(1));
}

export async function getTodayAllowanceStatus(actor: AuthUser) {
  const today = startOfDay(new Date());
  const gpsKm = await calculateTodayGpsKm(actor.id, today);

  const allowance = await prisma.dailyAllowance.findUnique({
    where: {
      userId_date: {
        userId: actor.id,
        date: today
      }
    }
  });

  const thresholdExceeded = gpsKm >= 50.0;

  // Send push notification if >= 50km and allowance not yet submitted and notification not sent today
  if (thresholdExceeded && !allowance) {
    try {
      const notificationKey = `DA_50KM_ALERT_${actor.id}_${today.toISOString().slice(0, 10)}`;
      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: actor.id,
          type: "DA_50KM_ALERT",
          createdAt: { gte: today }
        }
      });

      if (!existingNotif) {
        await notificationService.createNotification(
          actor.id,
          "Daily Allowance Eligible!",
          `You have traveled ${gpsKm} km today (>50 km). Please submit your Daily Allowance in the app.`,
          "DA_50KM_ALERT"
        );
      }
    } catch (err) {
      console.warn("[DailyAllowance] Failed to send 50km alert notification:", err);
    }
  }

  return {
    gpsKm,
    thresholdExceeded,
    allowance
  };
}

export async function submitDailyAllowance(actor: AuthUser, input: { amount: number; remark?: string }) {
  const today = startOfDay(new Date());
  const gpsKm = await calculateTodayGpsKm(actor.id, today);

  if (input.amount <= 0) {
    throw new Error("Daily allowance amount must be greater than 0");
  }

  const allowance = await prisma.dailyAllowance.upsert({
    where: {
      userId_date: {
        userId: actor.id,
        date: today
      }
    },
    create: {
      userId: actor.id,
      companyId: actor.companyId,
      date: today,
      amount: Number(input.amount),
      remark: input.remark ? input.remark.trim() : null,
      gpsKm
    },
    update: {
      amount: Number(input.amount),
      remark: input.remark ? input.remark.trim() : null,
      gpsKm
    }
  });

  // Notify socket listeners
  getIO().to(`company:${actor.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
    userId: actor.id,
    type: "daily-allowance-submitted",
    data: allowance
  });

  return allowance;
}

export async function getDailyAllowanceSubmissions(
  actor: AuthUser,
  params: { date?: string; startDate?: string; endDate?: string; userId?: string }
) {
  const targetDate = params.date ? startOfDay(new Date(params.date)) : null;
  const startRange = params.startDate ? startOfDay(new Date(params.startDate)) : null;
  const endRange = params.endDate
    ? new Date(startOfDay(new Date(params.endDate)).getTime() + 24 * 60 * 60 * 1000 - 1)
    : null;

  const dateFilter =
    startRange && endRange
      ? { gte: startRange, lte: endRange }
      : targetDate
      ? targetDate
      : undefined;

  const managerGroupId = actor.role === UserRole.MANAGER ? await getManagerGroupId(actor.id) : null;

  const userWhere: any = { companyId: actor.companyId };
  if (actor.role === UserRole.MANAGER) {
    userWhere.OR = [
      { id: actor.id },
      { managerId: actor.id },
      ...(managerGroupId ? [{ groupId: managerGroupId }] : [])
    ];
  }

  if (params.userId) {
    await ensureCanAccessUser(actor, params.userId);
    userWhere.id = params.userId;
  }

  const submissions = await prisma.dailyAllowance.findMany({
    where: {
      companyId: actor.companyId,
      ...(dateFilter && { date: dateFilter }),
      user: userWhere
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          designation: true,
          avatarUrl: true
        }
      }
    },
    orderBy: { date: "desc" }
  });

  return submissions;
}
