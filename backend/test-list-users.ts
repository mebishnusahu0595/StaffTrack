import { PrismaClient, UserRole } from "@prisma/client";
import { listUsers } from "./src/services/user.service";
const prisma = new PrismaClient();
async function main() {
  const superadmin = await prisma.user.findUnique({ where: { email: "0595" } });
  if (!superadmin) throw new Error("Superadmin not found");
  const result = await listUsers(superadmin as any, 1, 100);
  console.log("Users found for SuperAdmin:", result.items.length);
  console.log("User roles:", result.items.map(u => u.role));
}
main();
