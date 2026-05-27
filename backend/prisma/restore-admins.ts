import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, WorkMode } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Restoring admin accounts...");

  // 1. Ensure company exists
  const company = await prisma.company.upsert({
    where: { id: "demo-corp-company" },
    update: { name: "Demo Corp" },
    create: {
      id: "demo-corp-company",
      name: "Demo Corp"
    }
  });

  // 2. Hash passwords
  const superadminPasswordHash = await bcrypt.hash("superadmin@123", 12);
  const adminPasswordHash = await bcrypt.hash("Admin@123", 12);
  const numericPasswordHash = await bcrypt.hash("0595", 12);

  // 3. Upsert Superadmin (superadmin@gmail.com / superadmin@123)
  const superadmin = await prisma.user.upsert({
    where: { email: "superadmin@gmail.com" },
    update: {
      name: "Global SuperAdmin",
      phone: "0000000000",
      role: UserRole.SUPERADMIN,
      companyId: company.id,
      passwordHash: superadminPasswordHash,
      workMode: WorkMode.OFFICE
    },
    create: {
      name: "Global SuperAdmin",
      email: "superadmin@gmail.com",
      phone: "0000000000",
      role: UserRole.SUPERADMIN,
      companyId: company.id,
      passwordHash: superadminPasswordHash,
      workMode: WorkMode.OFFICE
    }
  });
  console.log("Superadmin restored:", superadmin.email);

  // 4. Upsert Admin (admin@demo.com / Admin@123)
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {
      name: "Deepika Tandulkar",
      phone: "9876543210",
      role: UserRole.ADMIN,
      companyId: company.id,
      passwordHash: adminPasswordHash,
      workMode: WorkMode.BOTH,
      designation: "Managing Director"
    },
    create: {
      name: "Deepika Tandulkar",
      email: "admin@demo.com",
      phone: "9876543210",
      role: UserRole.ADMIN,
      companyId: company.id,
      passwordHash: adminPasswordHash,
      workMode: WorkMode.BOTH,
      designation: "Managing Director"
    }
  });
  console.log("Admin restored:", admin.email);

  // 5. Upsert Numeric Superadmin (0595 / 0595)
  const numericAdmin = await prisma.user.upsert({
    where: { email: "0595" },
    update: {
      name: "Super Admin (0595)",
      phone: "0595",
      role: UserRole.SUPERADMIN,
      companyId: company.id,
      passwordHash: numericPasswordHash,
      workMode: WorkMode.OFFICE
    },
    create: {
      name: "Super Admin (0595)",
      email: "0595",
      phone: "0595",
      role: UserRole.SUPERADMIN,
      companyId: company.id,
      passwordHash: numericPasswordHash,
      workMode: WorkMode.OFFICE
    }
  });
  console.log("Numeric admin restored:", numericAdmin.email);

  console.log("All admin accounts successfully restored/updated without deleting other data!");
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
