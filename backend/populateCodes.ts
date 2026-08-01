import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Populating employee codes...");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" }
  });

  let counter = 101;
  for (const user of users) {
    if (!user.employeeCode) {
      const code = String(counter++);
      await prisma.user.update({
        where: { id: user.id },
        data: { employeeCode: code }
      });
      console.log(`Updated User ${user.name} with employeeCode: ${code}`);
    } else {
      console.log(`User ${user.name} already has employeeCode: ${user.employeeCode}`);
      // Ensure we increment to avoid conflict if we set one manually
      const numericVal = parseInt(user.employeeCode, 10);
      if (!isNaN(numericVal) && numericVal >= counter) {
        counter = numericVal + 1;
      }
    }
  }
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
