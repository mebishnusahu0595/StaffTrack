/**
 * AI Nudge Monitor Service
 *
 * Checks checked-in staff periodically (runs every 60 minutes) to:
 * 1. Nudge if their Location is turned OFF while checked in.
 * 2. Nudge if they have pending tasks for today.
 * 3. Appreciate them once they complete all their tasks today.
 *
 * Uses Gemini AI to generate creative Hinglish delivery-app style messages.
 */

import { prisma } from "../lib/prisma";
import { createNotification } from "./notification.service";

const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY || "";
const GEMINI_URL = () =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY()}`;

// In-memory throttling map to prevent spamming notifications
// Keys: userId -> { locationLastNudgedAt: timestamp, taskLastNudgedAt: timestamp, appreciatedToday: boolean }
interface NudgeState {
  locationLastNudgedAt?: number;
  taskLastNudgedAt?: number;
  appreciatedToday?: boolean;
}
const nudgeTracker = new Map<string, NudgeState>();

// Clear appreciatedToday cache every midnight (IST)
let lastCleanupDate = new Date().getUTCDate();

function dailyCleanupCheck() {
  const currentDay = new Date().getUTCDate();
  if (currentDay !== lastCleanupDate) {
    console.log("[AI Nudge Monitor] Performing daily throttle reset...");
    nudgeTracker.clear();
    lastCleanupDate = currentDay;
  }
}

// Helper to call Gemini AI for custom messages
async function askGeminiForNudge(prompt: string, fallbackMessage: string): Promise<string> {
  if (!GEMINI_API_KEY()) {
    return fallbackMessage;
  }

  try {
    const response = await fetch(GEMINI_URL(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 256
        }
      })
    });

    if (!response.ok) {
      console.error("[AI Nudge Monitor] Gemini error status:", response.status);
      return fallbackMessage;
    }

    const data = await response.json() as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || fallbackMessage;
  } catch (err) {
    console.error("[AI Nudge Monitor] Gemini call failed:", err);
    return fallbackMessage;
  }
}

export async function runAiNudgeMonitor() {
  dailyCleanupCheck();
  const nowMs = Date.now();

  console.log("[AI Nudge Monitor] Running periodic checks...");

  // Find all staff who are checked in (active session)
  const activeAttendances = await prisma.attendance.findMany({
    where: {
      checkOutTime: null,
      status: "PRESENT"
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          isLocationOn: true,
          expoPushToken: true
        }
      }
    }
  });

  if (activeAttendances.length === 0) {
    console.log("[AI Nudge Monitor] No active checked-in users found.");
    return;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  for (const attendance of activeAttendances) {
    const user = attendance.user;
    if (!user || !user.expoPushToken) continue;

    let userState = nudgeTracker.get(user.id) || {};

    // 1. LOCATION OFF NUDGE
    if (user.isLocationOn === false) {
      const lastLocNudge = userState.locationLastNudgedAt || 0;
      // Nudge every 2 hours if location remains off
      if (nowMs - lastLocNudge > 2 * 60 * 60 * 1000) {
        const fallback = `📍 location off warning! ${user.name}, aapne location band kyu rakha hai? Please immediate location ON karein!`;
        const prompt = `You are a witty assistant for an attendance app (delivery-app style). 
Write ONE single Hinglish (Hindi + English) sentence (not a list, not multiple options, no asterisks, no markdown) for employee ${user.name} asking why they turned off their location and warning them to turn it back ON immediately so their attendance stays active. Use 1-2 emojis.
Reply with ONLY that one sentence. No options, no bullets, no markdown, just plain text.`;

        const message = await askGeminiForNudge(prompt, fallback);
        try {
          await createNotification(user.id, "📍 Location Off Alert", message, "LOCATION_WARNING");
          userState.locationLastNudgedAt = nowMs;
          nudgeTracker.set(user.id, userState);
          console.log(`[AI Nudge Monitor] Location off alert sent to ${user.name}`);
        } catch (err) {
          console.error(`[AI Nudge Monitor] Failed to send location notification to ${user.name}:`, err);
        }
      }
    }

    // 2. TASK PROGRESS NUDGE
    try {
      const todayTasks = await prisma.task.findMany({
        where: {
          assignedToId: user.id,
          dueDate: { gte: todayStart, lte: todayEnd }
        },
        select: { status: true }
      });

      if (todayTasks.length > 0) {
        const total = todayTasks.length;
        const completed = todayTasks.filter(t => t.status === "COMPLETED").length;
        const pending = total - completed;

        if (pending > 0) {
          // Send task nudge every 3 hours
          const lastTaskNudge = userState.taskLastNudgedAt || 0;
          if (nowMs - lastTaskNudge > 3 * 60 * 60 * 1000) {
            const fallback = `📝 Task Reminder: ${user.name}, you have ${pending} pending tasks today. Complete them soon!`;
            const prompt = `You are a fun Swiggy/Zomato style notification writer. 
Write ONE single Hinglish sentence (not a list, not multiple options, no asterisks, no markdown) for employee ${user.name} who has completed ${completed} out of ${total} tasks today (${pending} still pending). 
Wittily nudge them to finish pending tasks. Use 1-2 motivational emojis.
Reply with ONLY that one sentence. No options, no bullets, no markdown, just plain text.`;

            const message = await askGeminiForNudge(prompt, fallback);
            await createNotification(user.id, "📝 Tasks Pending Reminder", message, "TASK_NUDGE");
            userState.taskLastNudgedAt = nowMs;
            nudgeTracker.set(user.id, userState);
            console.log(`[AI Nudge Monitor] Task nudge sent to ${user.name}`);
          }
        } else if (completed > 0 && !userState.appreciatedToday) {
          // Appreciate once per day if they completed all tasks
          const fallback = `🎉 Great work! ${user.name}, you have completed all tasks today. You are a superstar!`;
          const prompt = `You are a fun Swiggy/Zomato style notification writer.
Write ONE single Hinglish sentence (not a list, not multiple options, no asterisks, no markdown) to appreciate employee ${user.name} who completed all their tasks today. 
Praise their speed and hard work. Use 1-2 happy emojis.
Reply with ONLY that one sentence. No options, no bullets, no markdown, just plain text.`;

          const message = await askGeminiForNudge(prompt, fallback);
          await createNotification(user.id, "🎉 Task Completed Appreciation!", message, "TASK_APPRECIATION");
          userState.appreciatedToday = true;
          nudgeTracker.set(user.id, userState);
          console.log(`[AI Nudge Monitor] Task appreciation sent to ${user.name}`);
        }
      }
    } catch (taskErr) {
      console.error(`[AI Nudge Monitor] Error checking tasks for user ${user.name}:`, taskErr);
    }
  }
}
