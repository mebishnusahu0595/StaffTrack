/**
 * AI assistant check: tool numbers must match direct DB counts, then one live Gemini question.
 * Run: ./node_modules/.bin/tsx -r dotenv/config src/scripts/aiChat.check.ts ["question"]
 */
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { TOOLS, chatWithAssistantStream } from "../services/aiAssistant.service";
import { getStartOfDayIST } from "../services/task.service";

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true, companyId: true } });
  assert(admin, "no ADMIN user in DB");
  const ctx = { adminId: admin.id, companyId: admin.companyId };

  const start = getStartOfDayIST();
  const end = new Date(start.getTime() + 86_400_000);
  const ids = (await prisma.user.findMany({ where: { companyId: admin.companyId, role: { in: ["EMPLOYEE", "MANAGER"] } }, select: { id: true } })).map(u => u.id);
  const expected = await prisma.task.count({
    where: {
      assignedToId: { in: ids }, status: "PENDING",
      OR: [{ dueDate: { gte: start, lt: end } }, { startDate: { gte: start, lt: end } }, { completedAt: { gte: start, lt: end } }]
    }
  });
  const res: any = await TOOLS.get_tasks({ date: "today", status: "PENDING" }, ctx);
  assert.equal(res.total, expected, "get_tasks PENDING today count mismatch");
  const overview: any = await TOOLS.get_day_overview({}, ctx);
  assert.equal(overview.tasksForThisDay.PENDING ?? 0, expected, "overview PENDING mismatch");
  console.log(`✓ tools match DB: ${expected} pending tasks today, ${overview.checkedInCount}/${overview.totalStaff} checked in`);

  const since = new Date();
  const question = process.argv[2] || "aaj kitne tasks pending hain?";
  process.stdout.write(`\nQ: ${question}\nA: `);
  for await (const chunk of chatWithAssistantStream(admin.id, admin.companyId, question)) process.stdout.write(chunk);
  console.log();
  await prisma.aiChatMessage.deleteMany({ where: { userId: admin.id, createdAt: { gte: since } } });
}

main().finally(() => prisma.$disconnect());
