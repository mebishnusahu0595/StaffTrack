import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing all tasks in DB...");
  const totalCount = await prisma.task.count();
  console.log(`Total tasks in DB: ${totalCount}`);

  // Let's get the earliest and latest due dates
  const earliest = await prisma.task.findFirst({
    orderBy: { dueDate: "asc" }
  });
  const latest = await prisma.task.findFirst({
    orderBy: { dueDate: "desc" }
  });

  if (earliest && latest) {
    console.log(`Earliest due date: ${earliest.dueDate.toISOString()} (ID: ${earliest.id}, title: ${earliest.title})`);
    console.log(`Latest due date: ${latest.dueDate.toISOString()} (ID: ${latest.id}, title: ${latest.title})`);
  }

  // Let's query all tasks and see how many we have per day
  const tasks = await prisma.task.findMany({
    select: { dueDate: true }
  });

  const dateCounts: Record<string, number> = {};
  for (const t of tasks) {
    const dStr = t.dueDate.toISOString().split('T')[0];
    dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;
  }

  console.log("\nTask counts by Date (UTC):");
  Object.keys(dateCounts).sort().forEach(d => {
    console.log(`  ${d}: ${dateCounts[d]}`);
  });

  // Let's see some sample repeating tasks
  const sampleRepeating = await prisma.task.findFirst({
    where: { isRepeating: true }
  });
  console.log("\nSample repeating task:", sampleRepeating);
}

main().catch(console.error).finally(() => prisma.$disconnect());
