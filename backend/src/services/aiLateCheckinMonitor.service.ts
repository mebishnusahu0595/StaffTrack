/**
 * AI Late Check-In Monitor Service
 *
 * Runs every 60 seconds. For each pending late check-in (isCheckInPending=true):
 *  - Waits 10 minutes from checkInTime (grace window for human to act)
 *  - Counts this month's late check-ins for that user (including this one)
 *  - If count <= 3 (1st, 2nd, 3rd): Auto-Approve
 *  - If count > 3 (4th or more):   Auto-Reject + FCM Push Notification
 */

import { prisma } from "../lib/prisma";
import { createNotification } from "./notification.service";
import { getIO, SOCKET_EVENTS } from "../lib/socket";

const GRACE_MS = 10 * 60 * 1000; // 10 minutes
const LATE_THRESHOLD_HOUR = 9;
const LATE_THRESHOLD_MINUTE = 45;
const MAX_FORGIVEN_LATE = 3; // 1st 2nd 3rd → forgiven; 4th+ → reject

function isLateCheckIn(checkInTime: Date): boolean {
  const h = parseInt(
    checkInTime.toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      hour: "numeric",
    })
  );
  const m = parseInt(
    checkInTime.toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      minute: "numeric",
    })
  );
  return h > LATE_THRESHOLD_HOUR || (h === LATE_THRESHOLD_HOUR && m > LATE_THRESHOLD_MINUTE);
}

async function countLateCheckInsThisMonth(userId: string, excludeAttendanceId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const records = await prisma.attendance.findMany({
    where: {
      userId,
      id: { not: excludeAttendanceId },
      date: { gte: monthStart, lt: monthEnd },
      checkInTime: { not: null },
    },
    select: { id: true, checkInTime: true },
  });

  let count = 0;
  for (const r of records) {
    if (r.checkInTime && isLateCheckIn(r.checkInTime)) {
      count++;
    }
  }
  return count;
}

async function autoApprove(attendanceId: string, userId: string, companyId: string, lateCount: number) {
  await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      isCheckInPending: false,
      checkInApproved: true,
      checkInApprovedBy: "AI_MONITOR",
      checkInApprovedAt: new Date(),
    },
  });

  console.log(
    `[AI Late Checkin Monitor] AUTO-APPROVED attendance ${attendanceId} for user ${userId} (late #${lateCount} this month — within 3-forgive limit)`
  );

  // Real-time socket update
  try {
    getIO().to(`company:${companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
      type: "LATE_CHECK_IN_APPROVED",
      userId,
      attendanceId,
      autoApprovedByAI: true,
    });
  } catch (err) {
    console.error("[AI Late Checkin Monitor] Socket emit failed:", err);
  }

  // In-app notification to employee
  try {
    await createNotification(
      userId,
      "Late Check-In Auto-Approved",
      `Your late check-in has been automatically approved (${lateCount} of 3 allowed this month). Please try to check in on time.`,
      "LATE_CHECK_IN_APPROVED"
    );
  } catch (err) {
    console.error("[AI Late Checkin Monitor] Failed to send approve notification:", err);
  }
}

async function autoReject(
  attendanceId: string,
  userId: string,
  companyId: string,
  lateCount: number
) {
  await prisma.attendance.delete({ where: { id: attendanceId } });

  console.log(
    `[AI Late Checkin Monitor] AUTO-REJECTED attendance ${attendanceId} for user ${userId} (late #${lateCount} this month — exceeds 3-forgive limit)`
  );

  // Real-time socket update
  try {
    getIO().to(`company:${companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
      type: "LATE_CHECK_IN_REJECTED",
      userId,
      attendanceId,
      autoRejectedByAI: true,
    });
  } catch (err) {
    console.error("[AI Late Checkin Monitor] Socket emit failed:", err);
  }

  // FCM Push notification to employee
  try {
    await createNotification(
      userId,
      "Late Check-In Rejected",
      "You were late today. Please contact your administrator for check-in assistance.",
      "LATE_CHECK_IN_REJECTED"
    );
  } catch (err) {
    console.error("[AI Late Checkin Monitor] Failed to send reject notification:", err);
  }
}

export async function runAiLateCheckinMonitor() {
  const now = new Date();

  // Find all pending late check-ins across all companies
  const pending = await prisma.attendance.findMany({
    where: { isCheckInPending: true },
    include: {
      user: { select: { id: true, companyId: true, name: true } },
    },
  });

  if (pending.length === 0) return;

  console.log(`[AI Late Checkin Monitor] Checking ${pending.length} pending request(s)...`);

  for (const record of pending) {
    try {
      // Skip if still within 10-minute grace window
      if (!record.checkInTime) continue;
      const elapsed = now.getTime() - record.checkInTime.getTime();
      if (elapsed < GRACE_MS) {
        const remaining = Math.ceil((GRACE_MS - elapsed) / 60000);
        console.log(
          `[AI Late Checkin Monitor] Skipping ${record.id} — ${remaining}m remaining in grace window`
        );
        continue;
      }

      // Count late check-ins this month for this user (excluding this record)
      const priorLateCount = await countLateCheckInsThisMonth(record.userId, record.id);
      // Including this record
      const totalLateCount = priorLateCount + 1;

      if (totalLateCount <= MAX_FORGIVEN_LATE) {
        // Forgive: 1st, 2nd, 3rd late → Auto-Approve
        await autoApprove(record.id, record.userId, record.user.companyId, totalLateCount);
      } else {
        // 4th or more → Auto-Reject
        await autoReject(record.id, record.userId, record.user.companyId, totalLateCount);
      }
    } catch (err) {
      console.error(`[AI Late Checkin Monitor] Error processing record ${record.id}:`, err);
    }
  }
}
