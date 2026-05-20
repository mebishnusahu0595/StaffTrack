import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("0595", 12);

  // Ensure company exists
  const company = await prisma.company.upsert({
    where: { id: "demo-corp-company" },
    update: { name: "Demo Corp" },
    create: {
      id: "demo-corp-company",
      name: "Demo Corp"
    }
  });

  const superadmin = await prisma.user.upsert({
    where: { email: "0595" },
    update: {
      name: "Super Admin",
      phone: "0595",
      role: UserRole.SUPERADMIN,
      companyId: company.id,
      passwordHash,
      managerId: null
    },
    create: {
      name: "Super Admin",
      email: "0595",
      phone: "0595",
      role: UserRole.SUPERADMIN,
      companyId: company.id,
      passwordHash
    }
  });

  console.log("Super Admin created/updated successfully:", superadmin.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
