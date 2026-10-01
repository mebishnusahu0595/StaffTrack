/**
 * Holiday Notification Scheduler Service
 *
 * Runs once daily at 7:30 AM IST. Checks for holidays marked for today
 * across all companies and sends push notifications to affected staff.
 */

import { prisma } from "../lib/prisma";
import { sendBroadcastNotification } from "./notification.service";
import { startOfDay } from "../lib/date";

// Track which holidays we've already notified about (to avoid duplicates on restart)
const notifiedHolidayKeys = new Set<string>();

export async function sendTodayHolidayNotifications() {
  const today = startOfDay(new Date());
  const todayStr = today.toISOString().slice(0, 10);

  console.log(`[Holiday Notifier] Checking for holidays on ${todayStr}...`);

  // Find all holidays for today
  const todayHolidays = await prisma.holiday.findMany({
    where: {
      date: today,
      type: "HOLIDAY"
    },
    select: {
      id: true,
      name: true,
      companyId: true,
      userId: true
    }
  });

  if (todayHolidays.length === 0) {
    console.log("[Holiday Notifier] No holidays today.");
    return;
  }

  // Group holidays by company + name (so we send one bulk notification per holiday per company)
  const holidayGroups = new Map<string, { name: string; companyId: string; userIds: string[] }>();

  for (const h of todayHolidays) {
    const key = `${h.companyId}::${h.name}`;
    
    // Skip if we already notified this holiday today
    if (notifiedHolidayKeys.has(key)) continue;

    if (!holidayGroups.has(key)) {
      holidayGroups.set(key, { name: h.name, companyId: h.companyId, userIds: [] });
    }
    if (h.userId) {
      holidayGroups.get(key)!.userIds.push(h.userId);
    }
  }

  for (const [key, group] of holidayGroups) {
    try {
      const dateFormatted = today.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });

      // Find an admin from this company to use as sender
      const admin = await prisma.user.findFirst({
        where: { companyId: group.companyId, role: { in: ["ADMIN", "SUPERADMIN"] } },
        select: { id: true }
      });
      const senderId = admin?.id || "system";

      if (group.userIds.length > 0) {
        // Send to specific users who have this holiday
        await sendBroadcastNotification(senderId, {
          userIds: group.userIds,
          title: `🎉 Holiday Today: ${group.name}`,
          message: `Aaj ${group.name} ki chutti hai (${dateFormatted})! Enjoy your day off! 🎊`
        });
      }

      notifiedHolidayKeys.add(key);
      console.log(`[Holiday Notifier] Sent notifications for "${group.name}" to ${group.userIds.length} staff in company ${group.companyId}`);
    } catch (err) {
      console.error(`[Holiday Notifier] Error sending notifications for "${group.name}":`, err);
    }
  }
}
