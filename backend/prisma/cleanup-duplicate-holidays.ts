import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fetching all holidays...");
  const holidays = await prisma.holiday.findMany();
  console.log(`Found ${holidays.length} total holiday records.`);

  const groups = new Map<string, typeof holidays>();

  for (const h of holidays) {
    const dateStr = h.date instanceof Date ? h.date.toISOString() : new Date(h.date).toISOString();
    const key = `${dateStr}_${h.name}_${h.companyId}_${h.userId || "null"}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(h);
  }

  const idsToDelete: string[] = [];
  let uniqueCount = 0;

  for (const [key, list] of groups.entries()) {
    uniqueCount++;
    if (list.length > 1) {
      // Keep the first one, delete the rest
      const [keep, ...rest] = list;
      for (const h of rest) {
        idsToDelete.push(h.id);
      }
    }
  }

  console.log(`Unique holiday configurations: ${uniqueCount}`);
  console.log(`Duplicates to delete: ${idsToDelete.length}`);

  if (idsToDelete.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < idsToDelete.length; i += chunkSize) {
      const chunk = idsToDelete.slice(i, i + chunkSize);
      await prisma.holiday.deleteMany({
        where: {
          id: {
            in: chunk
          }
        }
      });
    }
    console.log(`Successfully deleted ${idsToDelete.length} duplicate holiday records.`);
  } else {
    console.log("No duplicate holiday records found.");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Error running cleanup script:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
