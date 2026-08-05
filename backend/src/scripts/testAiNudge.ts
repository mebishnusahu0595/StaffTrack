/**
 * Test script: Run AI Nudge Monitor
 * Run: npx tsx src/scripts/testAiNudge.ts
 */

import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../lib/prisma";
import { runAiNudgeMonitor } from "../services/aiNudgeMonitor.service";

async function main() {
  console.log("🔍 Running AI Nudge Monitor on test database...\n");

  // Check currently checked-in users first
  const active = await prisma.attendance.findMany({
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

  console.log(`📊 Found ${active.length} checked-in users:`);
  for (const att of active) {
    const user = att.user;
    console.log(`  - Name: ${user.name} | LocationOn: ${user.isLocationOn} | Token: ${user.expoPushToken ? "✅" : "❌"}`);
  }

  console.log("\n🚀 Triggering AI Nudge Monitor...");
  await runAiNudgeMonitor();
  console.log("\n🎉 Done!");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
