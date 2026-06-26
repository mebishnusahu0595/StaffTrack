import { autoCheckoutStuckUsers, autoCheckoutOldStuckSessions } from "../services/attendance.service";
import { checkStaleLocations } from "../services/location.service";
import { rolloverOverdueTasks, sendDailyTaskNotifications } from "../services/task.service";

export function startScheduler() {
  // 1. Immediately clean up any old stuck sessions from previous days on startup
  autoCheckoutOldStuckSessions()
    .then(() => console.log("[Scheduler] Initial old sessions cleanup completed."))
    .catch((err) => console.error("[Scheduler] Initial old sessions cleanup failed:", err));

  // 1b. Automatically rollover overdue tasks on startup
  rolloverOverdueTasks()
    .then(() => console.log("[Scheduler] Initial task rollover completed."))
    .catch((err) => console.error("[Scheduler] Initial task rollover failed:", err));

  // 1c. Automatically send daily task notifications on startup
  sendDailyTaskNotifications()
    .then(() => console.log("[Scheduler] Initial daily task notifications sent."))
    .catch((err) => console.error("[Scheduler] Initial daily task notifications failed:", err));

  // 2. Schedule the daily auto-checkout to run at midnight in Indian Standard Time (IST)
  function scheduleNextRun() {
    const now = new Date();
    
    // India is UTC + 5:30
    const indiaOffset = 5.5 * 60 * 60 * 1000;
    
    // Convert current time to India local time
    const indiaTime = new Date(now.getTime() + indiaOffset);
    
    // Find next midnight (00:00:00) in India
    const nextMidnightIndia = new Date(
      indiaTime.getFullYear(),
      indiaTime.getMonth(),
      indiaTime.getDate() + 1, // Tomorrow in India
      0, 0, 0, 0              // 00:00:00
    );
    
    // Convert next midnight India time back to UTC/server time
    const nextMidnight = new Date(nextMidnightIndia.getTime() - indiaOffset);
    
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();
    console.log(`[Scheduler] Next daily auto-checkout scheduled in ${(msUntilMidnight / 1000 / 60).toFixed(2)} minutes (at ${nextMidnight.toString()})`);

    setTimeout(async () => {
      try {
        await autoCheckoutStuckUsers();
      } catch (error) {
        console.error("[Scheduler] Error in scheduled auto-checkout job:", error);
      }
      try {
        await rolloverOverdueTasks();
        console.log("[Scheduler] Scheduled daily task rollover completed.");
      } catch (error) {
        console.error("[Scheduler] Error in scheduled daily task rollover:", error);
      }
      try {
        await sendDailyTaskNotifications();
        console.log("[Scheduler] Scheduled daily task notifications sent.");
      } catch (error) {
        console.error("[Scheduler] Error in scheduled daily task notifications:", error);
      }
      // Recursively schedule the next day's run
      scheduleNextRun();
    }, msUntilMidnight);
  }

  scheduleNextRun();

  // 3. Schedule periodic stale location checks every 2 minutes
  setInterval(async () => {
    try {
      await checkStaleLocations();
    } catch (error) {
      console.error("[Scheduler] Error in periodic stale location check:", error);
    }
  }, 2 * 60 * 1000);
}
