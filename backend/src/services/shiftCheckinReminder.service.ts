/**
 * Shift Check-In Reminder Service
 *
 * Runs every minute via scheduler. Finds all users whose shiftStart is
 * 10 minutes from now (IST), then sends them a fun Hinglish FCM push reminder.
 *
 * Uses Gemini AI to generate a SMALL POOL of 3–4 unique fun messages once per run,
 * then distributes them randomly among staff — so not everyone gets the exact same message.
 */

import { prisma } from "../lib/prisma";
import { createNotification } from "./notification.service";
import { callGeminiWithFallback } from "../lib/gemini";

// ---------- Gemini AI message pool generation ----------

async function generateReminderMessages(count: number = 4): Promise<string[]> {
  const prompt = `You are a fun notification writer for a field-staff attendance app (like Zomato/Swiggy delivery vibe).
Generate exactly ${count} SHORT, fun, Hinglish (mix of Hindi + English) shift check-in reminder messages.
Each message should:
- Be 1-2 lines max
- Have relevant emojis at start/end
- Be playful, witty, motivational like delivery app notifications  
- Different tone each (one funny, one motivational, one teasing, one energetic)
- NOT start with "Hey" every time — vary the openers
- Remind the staff to check in for their shift starting soon
- Examples of good style: "Bhai uth ja! ⏰ Teri shift 10 min mein start hogi, check-in karo warna boss ka call aayega 📞", "🚀 Time to shine! Shift ka countdown shuru ho gaya, jaldi check-in thoko!"

IMPORTANT: Reply with ONLY a JSON array of strings, no extra text or markdown. Like:
["message1", "message2", "message3", "message4"]`;

  try {
    const data = await callGeminiWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 1.0, 
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "STRING"
          }
        }
      }
    });

    if (!data) {
      return getDefaultMessages();
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[Shift Reminder] Gemini generated ${parsed.length} messages.`);
        return parsed.slice(0, count);
      }
    }
    console.warn("[Shift Reminder] Gemini response couldn't be parsed, using defaults.");
    return getDefaultMessages();
  } catch (err) {
    console.error("[Shift Reminder] Error calling Gemini:", err);
    return getDefaultMessages();
  }
}

function getDefaultMessages(): string[] {
  return [
    "⏰ Arre bhai! Teri shift 10 min mein shuru hogi. Jaldi check-in karo! 🏃",
    "🚀 Shift ka time aa gaya! Check-in karo aur apna din shuru karo 💪",
    "📍 10 minute baaki hain shift mein! Boss ke aane se pehle check-in thoko 😅",
    "🔔 Yaar shift yaad hai na? 10 min mein start ho rahi hai, check-in karo! ✅"
  ];
}

// ---------- Main runner ----------

// Track which users got notified (reset every minute) to avoid spam
const notifiedToday = new Map<string, number>(); // userId -> last notification date (yyyymmdd)

function getTodayKey(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return `${ist.getFullYear()}${String(ist.getMonth() + 1).padStart(2, "0")}${String(ist.getDate()).padStart(2, "0")}`;
}

export async function runShiftCheckinReminder() {
  const now = new Date();

  // Get current IST hour and minute
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const currentHour = istNow.getUTCHours();
  const currentMinute = istNow.getUTCMinutes();

  const todayKey = getTodayKey();

  // Find all active users (null checks done in JS after fetch)
  const users = await prisma.user.findMany({
    where: {
      role: { in: ["EMPLOYEE", "MANAGER"] }
    },
    select: {
      id: true,
      name: true,
      shiftStart: true,
      expoPushToken: true
    }
  });

  // Filter to users whose shift starts in 8–12 minutes from now (IST)
  // This gives a window so the check doesn't miss by a few seconds
  const dueUsers = users.filter(u => {
    if (!u.shiftStart || !u.expoPushToken) return false;
    const lastKey = notifiedToday.get(u.id);
    if (lastKey === parseInt(todayKey)) return false;

    const [shiftH, shiftM] = u.shiftStart.split(":").map(Number);
    if (isNaN(shiftH) || isNaN(shiftM)) return false;

    // Calculate minutes until shift start
    const nowTotalMinutes = currentHour * 60 + currentMinute;
    const shiftTotalMinutes = shiftH * 60 + shiftM;
    const diff = shiftTotalMinutes - nowTotalMinutes;

    // Window: 8 to 12 minutes before shift start
    return diff >= 8 && diff <= 12;
  });

  if (dueUsers.length === 0) return;

  console.log(`[Shift Reminder] ${dueUsers.length} user(s) need a shift check-in reminder.`);

  // Generate a small pool of AI messages (3–4)
  const messagePool = await generateReminderMessages(4);

  // Send notifications
  for (let i = 0; i < dueUsers.length; i++) {
    const user = dueUsers[i];
    // Pick message from pool in round-robin (not all same)
    const message = messagePool[i % messagePool.length];

    try {
      await createNotification(
        user.id,
        "⏰ Shift Reminder",
        message,
        "SHIFT_CHECKIN_REMINDER"
      );

      // Mark as notified for today
      notifiedToday.set(user.id, parseInt(todayKey));

      console.log(`[Shift Reminder] Sent to ${user.name} (shift: ${user.shiftStart})`);
    } catch (err) {
      console.error(`[Shift Reminder] Failed to notify ${user.name}:`, err);
    }
  }

  // Cleanup old entries in notifiedToday map
  for (const [uid, day] of notifiedToday.entries()) {
    if (day !== parseInt(todayKey)) {
      notifiedToday.delete(uid);
    }
  }
}
