/**
 * Test script: Send shift check-in reminder to specific users
 * Run: npx ts-node --project tsconfig.json src/scripts/testShiftReminder.ts
 */

import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../lib/prisma";
import { createNotification } from "../services/notification.service";

const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY || "";
const GEMINI_URL = () =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY()}`;

async function generateReminderMessages(count: number = 4): Promise<string[]> {
  const prompt = `You are a fun notification writer for a field-staff attendance app (like Zomato/Swiggy delivery vibe).
Generate exactly ${count} SHORT, fun, Hinglish (mix of Hindi + English) shift check-in reminder messages.
Each message should:
- Be 1-2 lines max
- Have relevant emojis at start/end
- Be playful, witty, motivational like delivery app notifications  
- Different tone each (one funny, one motivational, one teasing, one energetic)
- NOT start with "Hey" every time — vary the openers
- Remind the staff to check in for their shift starting in 10 minutes

IMPORTANT: Reply with ONLY a JSON array of strings, no extra text or markdown. Like:
["message1", "message2", "message3", "message4"]`;

  try {
    const response = await fetch(GEMINI_URL(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 1.2, 
          maxOutputTokens: 512,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      console.error("Gemini error:", response.status, await response.text());
      return fallback();
    }

    const data = await response.json() as any;
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("\n🤖 Gemini raw response:\n", raw);

    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, count);
    }
    return fallback();
  } catch (err) {
    console.error("Gemini error:", err);
    return fallback();
  }
}

function fallback(): string[] {
  return [
    "⏰ Arre bhai! Teri shift 10 min mein shuru hogi. Jaldi check-in karo! 🏃",
    "🚀 Shift ka time aa gaya! Check-in karo aur apna din shuru karo 💪",
    "📍 10 minute baaki hain shift mein! Boss ke aane se pehle check-in thoko 😅",
    "🔔 Yaar shift yaad hai na? 10 min mein start ho rahi hai, check-in karo! ✅"
  ];
}

async function main() {
  const targetNames = ["Deepika Tandulkar", "Bishnu Prasad Sahu", "Sajal Tamrakar"];

  console.log("🔍 Looking up users...\n");
  const users = await prisma.user.findMany({
    where: {
      name: { in: targetNames, mode: "insensitive" }
    },
    select: { id: true, name: true, expoPushToken: true, shiftStart: true }
  });

  if (users.length === 0) {
    // Try partial match
    const all = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: "Deepika", mode: "insensitive" } },
          { name: { contains: "Bishnu", mode: "insensitive" } },
          { name: { contains: "Sajal", mode: "insensitive" } },
          { name: { contains: "Tamrakar", mode: "insensitive" } },
        ]
      },
      select: { id: true, name: true, expoPushToken: true, shiftStart: true }
    });
    users.push(...all);
  }

  console.log(`✅ Found ${users.length} user(s):`);
  for (const u of users) {
    console.log(`  - ${u.name} | shift: ${u.shiftStart || "N/A"} | token: ${u.expoPushToken ? "✅ present" : "❌ missing"}`);
  }

  if (users.length === 0) {
    console.log("❌ No users found. Exiting.");
    await prisma.$disconnect();
    return;
  }

  console.log("\n🤖 Generating AI messages via Gemini...\n");
  const messagePool = await generateReminderMessages(4);
  console.log("\n📨 Message Pool:");
  messagePool.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));

  console.log("\n📤 Sending notifications...\n");
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const message = messagePool[i % messagePool.length];
    try {
      await createNotification(user.id, "⏰ Shift Reminder (TEST)", message, "SHIFT_CHECKIN_REMINDER");
      console.log(`  ✅ Sent to ${user.name}: "${message}"`);
    } catch (err) {
      console.error(`  ❌ Failed for ${user.name}:`, err);
    }
  }

  console.log("\n🎉 Done!");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
