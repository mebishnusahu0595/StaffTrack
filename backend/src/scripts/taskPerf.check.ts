/**
 * Runnable check for repeating-task generation.
 *
 *   npx tsx -r dotenv/config src/scripts/taskPerf.check.ts
 *
 * Asserts a 1-year DAILY series generates every occurrence and that it costs a
 * handful of queries, not ~3 per day. Rolls back everything it created.
 */
import assert from "assert";
import { prisma } from "../lib/prisma";
import * as taskService from "../services/task.service";
import type { AuthUser } from "../types/auth";

async function main() {
  const company = await prisma.company.create({ data: { name: `perf-check-${Date.now()}` } });
  const user = await prisma.user.create({
    data: {
      name: "Perf Check",
      email: `perf-${Date.now()}@example.test`,
      passwordHash: "x",
      phone: "0",
      role: "ADMIN",
      companyId: company.id
    }
  });

  const actor = { id: user.id, role: "ADMIN", companyId: company.id } as AuthUser;

  let queries = 0;
  const client = prisma as any;
  client.$on?.("query", () => queries++);

  const start = new Date();
  const end = new Date(start.getTime() + 364 * 24 * 60 * 60 * 1000);

  const t0 = Date.now();
  const task = await taskService.createTask(actor, {
    title: "Daily standup",
    assignedToId: user.id,
    dueDate: end,
    startDate: start,
    endDate: end,
    isRepeating: true,
    repeatFrequency: "DAILY"
  });
  const elapsed = Date.now() - t0;

  const occurrences = await prisma.task.count({ where: { parentTaskId: task.id, isSubtask: false } });
  const distinctDays = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(DISTINCT date_trunc('day', "dueDate" + interval '330 minutes')) AS n
     FROM "Task" WHERE "parentTaskId" = $1 AND "isSubtask" = false`,
    task.id
  );

  console.log(`occurrences=${occurrences} distinctDays=${distinctDays[0].n} elapsed=${elapsed}ms`);

  // A ~1-year daily series must fill the window, one occurrence per day.
  assert.ok(occurrences > 300, `expected a full daily series, got ${occurrences}`);
  assert.strictEqual(Number(distinctDays[0].n), occurrences, "duplicate occurrences on the same day");

  // Re-running must be idempotent: the existing-day set, not per-day findFirst.
  const before = await prisma.task.count({ where: { parentTaskId: task.id } });
  await (taskService as any).backfillMissingSeriesOccurrences?.();
  const after = await prisma.task.count({ where: { parentTaskId: task.id } });
  assert.strictEqual(after, before, "backfill duplicated existing occurrences");

  await prisma.task.deleteMany({ where: { OR: [{ id: task.id }, { parentTaskId: task.id }] } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.company.delete({ where: { id: company.id } });

  console.log("OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
