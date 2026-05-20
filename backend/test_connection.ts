import { PrismaClient } from "@prisma/client";
async function main() {
  const url = process.argv[2];
  if (!url) {
    console.log("Please provide a connection URL");
    process.exit(1);
  }
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url
      }
    }
  });
  try {
    await prisma.$connect();
    console.log("SUCCESS");
    process.exit(0);
  } catch (err) {
    console.log("FAIL", (err as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
main();
