import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking for holidays beyond 2026...");
  
  const cutOffDate = new Date("2026-12-31T23:59:59.999Z");
  
  const extremeHolidays = await prisma.holiday.findMany({
    where: {
      date: {
        gt: cutOffDate
      }
    }
  });

  console.log(`Found ${extremeHolidays.length} holiday records scheduled after 2026.`);

  if (extremeHolidays.length > 0) {
    const ids = extremeHolidays.map(h => h.id);
    const chunkSize = 100;
    
    console.log("Pruning future records beyond 2026...");
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await prisma.holiday.deleteMany({
        where: {
          id: {
            in: chunk
          }
        }
      });
    }
    console.log(`Successfully deleted ${extremeHolidays.length} future holiday records.`);
  } else {
    console.log("No holiday records beyond 2026 found.");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Error running prune script:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
