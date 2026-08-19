import { PrismaClient } from "@prisma/client";
import { createNotification } from "../services/notification.service";
import { callGeminiWithFallback } from "../lib/gemini";

const prisma = new PrismaClient();

async function askGeminiForNudge(prompt: string, fallbackMessage: string): Promise<string> {
  try {
    const data = await callGeminiWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: 256
      }
    });

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
