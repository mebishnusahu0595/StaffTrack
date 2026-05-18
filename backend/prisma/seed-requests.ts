import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Attendance Requests & Devices...");
  
  const company = await prisma.company.findFirst({
    where: { id: "demo-corp-company" }
  });
  
  if (!company) {
    console.error("Demo Corp company not found!");
    return;
  }
  
  const employees = await prisma.user.findMany({
    where: { companyId: company.id, role: "EMPLOYEE" }
  });
  
  if (employees.length === 0) {
    console.error("No employees found!");
    return;
  }

  await prisma.attendanceRequest.deleteMany({});
  await prisma.syncDevice.deleteMany({});

  await prisma.syncDevice.createMany({
    data: [
      {
        name: "INDRAPRASTHA PETROLEUM(202)",
        macAddress: "70:b8:f6:69:34:2a",
        lastSync: new Date(new Date().getTime() - 2.5 * 60 * 60 * 1000),
        status: "Offline",
        companyId: company.id
      },
      {
        name: "OKHLA BRANCH BIOMETRIC(104)",
        macAddress: "12:34:56:78:90:ab",
        lastSync: new Date(new Date().getTime() - 10 * 60 * 1000),
        status: "Online",
        companyId: company.id
      }
    ]
  });

  const emp1 = employees[0];
  const emp2 = employees[1] || emp1;
  const emp3 = employees[2] || emp1;
  
  const today = new Date();
  
  await prisma.attendanceRequest.create({
    data: {
      userId: emp1.id,
      date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      type: "Attendance - New Punch Added",
      checkInTime: new Date(new Date().setHours(9, 15, 0, 0)),
      reason: "Forgot to check in, client meeting early morning at Delhi site",
      status: "PENDING"
    }
  });

  await prisma.attendanceRequest.create({
    data: {
      userId: emp2.id,
      date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      type: "Attendance - New Punch Added",
      checkInTime: new Date(new Date().setHours(9, 45, 0, 0)),
      reason: "Network issue during check-in in Noida field area",
      status: "PENDING"
    }
  });

  await prisma.attendanceRequest.create({
    data: {
      userId: emp3.id,
      date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
      type: "Attendance - New Punch Added",
      checkInTime: new Date(new Date().setHours(9, 0, 0, 0)),
      reason: "System was showing blank screen, checked in via supervisor",
      status: "APPROVED"
    }
  });

  await prisma.attendanceRequest.create({
    data: {
      userId: emp1.id,
      date: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
      type: "Attendance - New Punch Added",
      checkInTime: new Date(new Date().setHours(8, 30, 0, 0)),
      reason: "Wrong time submitted, rejected by self check",
      status: "REJECTED"
    }
  });

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
