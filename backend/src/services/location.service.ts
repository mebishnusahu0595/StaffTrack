import type { AuthUser } from "../types/auth";
import { nextDay, startOfDay } from "../lib/date";
import { prisma } from "../lib/prisma";
import { ensureCanAccessUser } from "./access.service";

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

  return {
    count: result.count
  };
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
    orderBy: { timestamp: "asc" }
  });
}
