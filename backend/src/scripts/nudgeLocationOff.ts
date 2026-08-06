import { PrismaClient } from "@prisma/client";
import { createNotification } from "../services/notification.service";

const prisma = new PrismaClient();
const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY || "";
const GEMINI_URL = () =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY()}`;

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

async function main() {
  console.log("Querying active checked-in users whose location is off...");
  
  const activeLocOff = await prisma.attendance.findMany({
    where: {
      checkOutTime: null,
      status: "PRESENT",
      user: {
        isLocationOn: false,
        expoPushToken: { not: null }
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          expoPushToken: true
        }
      }
    }
  });

  console.log(`Found ${activeLocOff.length} users with location off.`);

  for (const record of activeLocOff) {
    const user = record.user;
    if (!user) continue;

    console.log(`Nudging user: ${user.name} (${user.id})...`);

    const fallback = `📍 location off warning! ${user.name}, aapne location band kyu rakha hai? Please immediate location ON karein!`;
    const prompt = `You are a witty assistant for an attendance app (delivery-app style). 
Generate a short 1-2 line Hinglish (Hindi + English) reminder for employee ${user.name} asking why they turned off their location and warning them to turn it back ON immediately so their attendance stays active. Use emojis.
Reply with ONLY the final message text, no quotes or markdown.`;

    const message = await askGeminiForNudge(prompt, fallback);
    console.log(`Generated message: "${message}"`);

    try {
      await createNotification(user.id, "📍 Location Off Alert", message, "LOCATION_WARNING");
      console.log(`Notification sent successfully to ${user.name}.`);
    } catch (err) {
      console.error(`Failed to send notification to ${user.name}:`, err);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
