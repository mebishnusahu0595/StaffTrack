import { PrismaClient, AttendanceStatus, PunchType } from "@prisma/client";

const prisma = new PrismaClient();

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate random IST time converted to UTC Date
// Check-in: 09:30 - 09:45 AM IST (04:00 - 04:15 UTC)
function getCheckInTime(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const minute = getRandomInt(30, 45);
  const second = getRandomInt(0, 59);
  const millisecond = getRandomInt(100, 999);
  
  // 9:minute:second IST is (9 - 5):minute - 30 UTC -> 3:minute+30 if minute < 30, but here minute >= 30, so:
  // 09:30 IST = 04:00 UTC
  // 09:45 IST = 04:15 UTC
  const utcHour = 4;
  const utcMinute = minute - 30;

  return new Date(Date.UTC(year, month - 1, day, utcHour, utcMinute, second, millisecond));
}

// Check-out: 05:03 - 05:16 PM IST (17:03 - 17:16 IST) -> 11:33 - 11:46 UTC
function getCheckOutTime(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const minute = getRandomInt(3, 16);
  const second = getRandomInt(0, 59);
  const millisecond = getRandomInt(100, 999);

  // 17:minute IST:
  // 17:03 IST - 5:30 = 11:33 UTC
  // 17:16 IST - 5:30 = 11:46 UTC
  const utcHour = 11;
  const utcMinute = 30 + minute;

  return new Date(Date.UTC(year, month - 1, day, utcHour, utcMinute, second, millisecond));
}

async function main() {
  console.log("Starting attendance seeding for Oct 6 to Oct 9, 2026...");

  // 1. Find users
  const bishnu = await prisma.user.findFirst({
    where: { phone: "1234567890" }
  });
  const deepika = await prisma.user.findFirst({
    where: {
      OR: [
        { name: { contains: "Deepika", mode: "insensitive" } },
        { email: { contains: "deepikatandulkar", mode: "insensitive" } }
      ]
    }
  });

  if (!bishnu) {
    throw new Error("User Bishnu Sahu (1234567890) not found!");
  }
  if (!deepika) {
    throw new Error("User Deepika Tandulkar not found!");
  }

  console.log(`Found Bishnu: ${bishnu.id} (${bishnu.name}, phone: ${bishnu.phone})`);
  console.log(`Found Deepika: ${deepika.id} (${deepika.name}, phone: ${deepika.phone})`);

  const users = [bishnu, deepika];
  const dates = ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];

  for (const user of users) {
    for (const dateStr of dates) {
      const [year, month, day] = dateStr.split("-").map(Number);
      const recordDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

      const isToday = dateStr === "2026-10-09";
      const checkInTime = getCheckInTime(dateStr);
      const checkOutTime = isToday ? null : getCheckOutTime(dateStr);

      // Check if existing record exists for user on this date
      const existing = await prisma.attendance.findFirst({
        where: {
          userId: user.id,
          date: {
            gte: recordDate,
            lt: nextDay
          }
        }
      });

      if (existing) {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            punchType: PunchType.OFFICE,
            checkInTime,
            checkOutTime,
            status: AttendanceStatus.PRESENT,
            checkInApproved: true,
            isCheckInPending: false
          }
        });
        console.log(`Updated attendance for ${user.name} on ${dateStr}: CheckIn=${checkInTime.toISOString()}, CheckOut=${checkOutTime?.toISOString() || "NONE (today)"}`);
      } else {
        await prisma.attendance.create({
          data: {
            userId: user.id,
            date: recordDate,
            punchType: PunchType.OFFICE,
            checkInTime,
            checkOutTime,
            status: AttendanceStatus.PRESENT,
            checkInApproved: true,
            isCheckInPending: false
          }
        });
        console.log(`Created attendance for ${user.name} on ${dateStr}: CheckIn=${checkInTime.toISOString()}, CheckOut=${checkOutTime?.toISOString() || "NONE (today)"}`);
      }
    }
  }

  console.log("Attendance seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
