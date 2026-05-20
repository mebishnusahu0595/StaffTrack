import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, WorkMode, TaskStatus, ExpenseCategory, AttendanceStatus, PunchType, LeaveStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 12);

  console.log("Cleaning up database...");
  await prisma.break.deleteMany({});
  await prisma.locationLog.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.issueUpdate.deleteMany({});
  await prisma.issue.deleteMany({});
  await prisma.formResponse.deleteMany({});
  await prisma.formField.deleteMany({});
  await prisma.form.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { not: "superadmin@gmail.com" } } });
  await prisma.group.deleteMany({});
  await prisma.holiday.deleteMany({});
  await prisma.company.deleteMany({});

  console.log("Creating Company...");
  const company = await prisma.company.upsert({
    where: { id: "demo-corp-company" },
    update: { name: "Demo Corp" },
    create: {
      id: "demo-corp-company",
      name: "Demo Corp"
    }
  });

  console.log("Creating Groups...");
  const groupSales = await prisma.group.create({
    data: {
      name: "Sales & Client Relations",
      baseSalary: 35000,
      companyId: company.id
    }
  });

  const groupEngineers = await prisma.group.create({
    data: {
      name: "On-Site Engineering",
      baseSalary: 45000,
      companyId: company.id
    }
  });

  const groupOperations = await prisma.group.create({
    data: {
      name: "Corporate Operations",
      baseSalary: 30000,
      companyId: company.id
    }
  });

  console.log("Creating SuperAdmin, Admin and Managers...");
  const superadminPasswordHash = await bcrypt.hash("superadmin@123", 12);
  const superadmin = await prisma.user.upsert({
    where: { email: "superadmin@gmail.com" },
    update: {
      role: UserRole.SUPERADMIN,
      passwordHash: superadminPasswordHash
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

  const admin = await prisma.user.create({
    data: {
      name: "Deepika Tandulkar",
      email: "admin@demo.com",
      phone: "9876543210",
      role: UserRole.ADMIN,
      companyId: company.id,
      passwordHash,
      workMode: WorkMode.BOTH,
      designation: "Managing Director"
    }
  });

  const salesManager = await prisma.user.create({
    data: {
      name: "Rohan Sharma",
      email: "rohan@demo.com",
      phone: "9876543211",
      role: UserRole.MANAGER,
      companyId: company.id,
      passwordHash,
      managerId: admin.id,
      groupId: groupSales.id,
      workMode: WorkMode.BOTH,
      designation: "Sales Director",
      baseSalary: 65000
    }
  });

  const engManager = await prisma.user.create({
    data: {
      name: "Vikram Malhotra",
      email: "vikram@demo.com",
      phone: "9876543212",
      role: UserRole.MANAGER,
      companyId: company.id,
      passwordHash,
      managerId: admin.id,
      groupId: groupEngineers.id,
      workMode: WorkMode.FIELD,
      designation: "Chief Engineer",
      baseSalary: 75000
    }
  });

  console.log("Creating Projects...");
  const projAgrotech = await prisma.project.create({
    data: { name: "Agrotech Phase 1", description: "Smart irrigation and farm-monitoring system deployment", companyId: company.id, status: "Ongoing" }
  });
  const projIndraprastha = await prisma.project.create({
    data: { name: "Indraprastha Retail Setup", description: "New retail store construction and IT configuration", companyId: company.id, status: "Ongoing" }
  });
  const projVaniki = await prisma.project.create({
    data: { name: "Vaniki Plantation", description: "Soil health assessment and drone survey operations", companyId: company.id, status: "Scheduled" }
  });
  const projHQ = await prisma.project.create({
    data: { name: "Corporate HQ Upgrade", description: "Office security surveillance and networking refresh", companyId: company.id, status: "Completed" }
  });

  console.log("Creating Employees...");
  const employeesData = [
    { name: "Aarav Mehta", email: "employee1@demo.com", phone: "9000000001", workMode: WorkMode.FIELD, designation: "Lead Sales Rep", baseSalary: 38000, groupId: groupSales.id, managerId: salesManager.id },
    { name: "Diya Roy", email: "employee2@demo.com", phone: "9000000002", workMode: WorkMode.FIELD, designation: "Junior Sales Executive", baseSalary: 28000, groupId: groupSales.id, managerId: salesManager.id },
    { name: "Amit Verma", email: "employee3@demo.com", phone: "9000000003", workMode: WorkMode.FIELD, designation: "Site Installation Engineer", baseSalary: 48000, groupId: groupEngineers.id, managerId: engManager.id },
    { name: "Priya Nair", email: "employee4@demo.com", phone: "9000000004", workMode: WorkMode.FIELD, designation: "Senior Drone Surveyor", baseSalary: 52000, groupId: groupEngineers.id, managerId: engManager.id },
    { name: "Kabir Gupta", email: "employee5@demo.com", phone: "9000000005", workMode: WorkMode.OFFICE, designation: "Operations Coordinator", baseSalary: 32000, groupId: groupOperations.id, managerId: admin.id },
    { name: "Neha Sen", email: "employee6@demo.com", phone: "9000000006", workMode: WorkMode.OFFICE, designation: "Administrative Assistant", baseSalary: 25000, groupId: groupOperations.id, managerId: admin.id },
    { name: "Suresh Rao", email: "employee7@demo.com", phone: "9000000007", workMode: WorkMode.BOTH, designation: "Support Specialist", baseSalary: 34000, groupId: groupSales.id, managerId: salesManager.id },
    { name: "Ananya Joshi", email: "employee8@demo.com", phone: "9000000008", workMode: WorkMode.BOTH, designation: "Field Support Tech", baseSalary: 36000, groupId: groupEngineers.id, managerId: engManager.id }
  ];

  const employees: any[] = [];
  for (const empData of employeesData) {
    const emp = await prisma.user.create({
      data: {
        ...empData,
        role: UserRole.EMPLOYEE,
        companyId: company.id,
        passwordHash
      }
    });
    employees.push(emp);
  }

  console.log("Creating Holidays...");
  const holidaysData = [
    { name: "Republic Day", date: new Date("2026-01-26"), description: "National Republic Day celebrations" },
    { name: "Makar Sankranti", date: new Date("2026-01-14"), description: "Harvest Festival" },
    { name: "Holi", date: new Date("2026-03-05"), description: "Festival of Colors" },
    { name: "Good Friday", date: new Date("2026-04-03"), description: "Good Friday Holiday" },
    { name: "Dr. Ambedkar Jayanti", date: new Date("2026-04-14"), description: "Babasaheb Ambedkar Birth Anniversary" },
    { name: "May Day", date: new Date("2026-05-01"), description: "International Workers' Day" }
  ];
  for (const hol of holidaysData) {
    await prisma.holiday.create({
      data: {
        name: hol.name,
        date: hol.date,
        description: hol.description,
        companyId: company.id
      }
    });
  }

  console.log("Creating Attendance History (Past 14 Days)...");
  const today = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (let i = 14; i >= 0; i--) {
    const currentDate = new Date(today.getTime() - i * oneDayMs);
    currentDate.setHours(12, 0, 0, 0); // Normalized time
    const dayOfWeek = currentDate.getDay();

    if (dayOfWeek === 0) continue; // Skip Sundays

    for (const emp of employees) {
      let status: AttendanceStatus = AttendanceStatus.PRESENT;
      let punchType: PunchType | null = emp.workMode === WorkMode.OFFICE ? PunchType.OFFICE : PunchType.FIELD;

      // Add variation (e.g. absent once, half day once, leave once)
      const seedVal = (emp.name.charCodeAt(0) + i) % 15;
      if (seedVal === 0) {
        status = AttendanceStatus.ABSENT;
      } else if (seedVal === 1) {
        status = AttendanceStatus.HALF_DAY;
      } else if (seedVal === 2) {
        status = AttendanceStatus.ON_LEAVE;
      }

      if (status === AttendanceStatus.ABSENT || status === AttendanceStatus.ON_LEAVE) {
        await prisma.attendance.create({
          data: {
            userId: emp.id,
            date: currentDate,
            status,
            punchType: null
          }
        });
        continue;
      }

      // Generate realistic check-in / check-out times
      const checkInTime = new Date(currentDate);
      const checkInHour = 8 + (seedVal % 3); // 8:00 to 10:00 AM
      const checkInMin = seedVal * 4 % 60;
      checkInTime.setHours(checkInHour, checkInMin, 0, 0);

      const checkOutTime = new Date(currentDate);
      const checkOutHour = status === AttendanceStatus.HALF_DAY ? 13 + (seedVal % 2) : 17 + (seedVal % 3); // 1:00 PM for half day, 5:00 - 7:00 PM for full day
      const checkOutMin = seedVal * 7 % 60;
      checkOutTime.setHours(checkOutHour, checkOutMin, 0, 0);

      // Latitudes around Delhi-NCR
      const checkInLat = 28.535512 + (seedVal * 0.005);
      const checkInLng = 77.391024 + (seedVal * 0.004);
      const checkOutLat = checkInLat + (seedVal * 0.0003);
      const checkOutLng = checkInLng - (seedVal * 0.0002);

      const attendance = await prisma.attendance.create({
        data: {
          userId: emp.id,
          date: currentDate,
          punchType,
          checkInTime,
          checkInLat,
          checkInLng,
          checkInPhotoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
          checkOutTime,
          checkOutLat,
          checkOutLng,
          checkOutPhotoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
          status
        }
      });

      // Generate some breaks for full day shifts
      if (status === AttendanceStatus.PRESENT && seedVal % 2 === 0) {
        const breakStart = new Date(currentDate);
        breakStart.setHours(13, 0, 0, 0);
        const breakEnd = new Date(currentDate);
        breakEnd.setHours(13, 30 + (seedVal * 2), 0, 0);

        await prisma.break.create({
          data: {
            attendanceId: attendance.id,
            startTime: breakStart,
            endTime: breakEnd
          }
        });
      }

      // Generate DayEndReports for field employees
      if (punchType === PunchType.FIELD && status === AttendanceStatus.PRESENT) {
        const kmTravelled = 15 + (seedVal * 4.5);
        await prisma.dayEndReport.create({
          data: {
            userId: emp.id,
            date: currentDate,
            visitsSummary: `Visited ${3 + (seedVal % 4)} client locations in Noida/Greater Noida. Inspected system health and gathered requirements.`,
            ordersTaken: 2 + (seedVal % 5),
            ordersCancelled: seedVal % 2,
            kmTravelled,
            kmPhotoUrl: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=500",
            startOdometer: 10240 + (i * 50),
            endOdometer: 10240 + (i * 50) + kmTravelled,
            remarks: "All client visits went smoothly. Handed over manuals to onsite team."
          }
        });
      }
    }
  }

  console.log("Creating Active Location Log Routes (GPS Tracks) for Current Day...");
  // Let's create an active walking/driving route for Aarav Mehta (employee1) and Diya Roy (employee2) for today
  const activeFieldEmps = [employees[0], employees[1]];
  const baseLat = 28.535512;
  const baseLng = 77.391024;

  for (const emp of activeFieldEmps) {
    const routePoints = 15;
    for (let j = 0; j < routePoints; j++) {
      const timeOffset = j * 30 * 60 * 1000; // Point every 30 minutes
      const timestamp = new Date(today.getTime() - timeOffset);

      // Create a circular-ish path for realistic mapping
      const angle = (j / routePoints) * 2 * Math.PI;
      const radius = 0.02 + (emp.name.charCodeAt(0) % 5 * 0.005);
      const lat = baseLat + Math.sin(angle) * radius;
      const lng = baseLng + Math.cos(angle) * radius;

      await prisma.locationLog.create({
        data: {
          userId: emp.id,
          lat,
          lng,
          accuracy: 5.0 + (j % 3),
          batteryLevel: 98 - (j * 2),
          timestamp
        }
      });
    }
  }

  console.log("Creating Custom Tasks...");
  const tasksData = [
    { title: "Perform soil moisture calibration", description: "Use the Agrotech calibration kit to test soil water capacity in Block C.", status: TaskStatus.COMPLETED, assignedToId: employees[0].id, assignedById: salesManager.id, priority: "High", completionRemarks: "Calibration complete. Values registered in app.", completionPhotoUrl: "https://images.unsplash.com/photo-1463123081488-729f60c1926d?w=500" },
    { title: "Conduct client briefing on retail dashboard", description: "Explain sales dashboards, report exports, and custom notifications to the branch manager.", status: TaskStatus.COMPLETED, assignedToId: employees[1].id, assignedById: salesManager.id, priority: "Medium", completionRemarks: "Branch manager fully trained. He was able to download reports successfully.", completionPhotoUrl: "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=500" },
    { title: "Install Agrotech base station", description: "Securely mount solar bracket and wireless router at coordinates 28.53, 77.39.", status: TaskStatus.IN_PROGRESS, assignedToId: employees[2].id, assignedById: engManager.id, priority: "High" },
    { title: "Drone soil-gradient capture", description: "Fly drone at altitude 120m across Vaniki field to generate multi-spectral mapping.", status: TaskStatus.PENDING, assignedToId: employees[3].id, assignedById: engManager.id, priority: "High" },
    { title: "Schedule regional operations review meeting", description: "Send out invites, prepare Google Meet links, and draft outline agenda.", status: TaskStatus.PENDING, assignedToId: employees[4].id, assignedById: admin.id, priority: "Low" },
    { title: "Reconcile corporate asset registry", description: "Audit all office desktop systems, network routers, and storage arrays.", status: TaskStatus.COMPLETED, assignedToId: employees[5].id, assignedById: admin.id, priority: "Medium", completionRemarks: "Audited all 14 workstations. Missing tags replaced.", completionPhotoUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500" }
  ];

  for (const t of tasksData) {
    const dueDate = new Date(today.getTime() + (Math.random() > 0.5 ? 2 : -2) * oneDayMs);
    await prisma.task.create({
      data: {
        ...t,
        dueDate
      }
    });
  }

  // Create explicit OVERDUE tasks (due 3-5 days ago, status PENDING/IN_PROGRESS)
  const overdueTasksData = [
    { title: "Submit physical expense vouchers for Q1", description: "Bring all original food and fuel bills to Deepika for verification.", status: TaskStatus.PENDING, assignedToId: employees[0].id, assignedById: admin.id, priority: "High", dueDate: new Date(today.getTime() - 4 * oneDayMs) },
    { title: "Install networking cable in IT storage room", description: "Deploy 50m Cat6 cable from server rack to operational backup terminal.", status: TaskStatus.IN_PROGRESS, assignedToId: employees[7].id, assignedById: engManager.id, priority: "Medium", dueDate: new Date(today.getTime() - 3 * oneDayMs) }
  ];
  for (const ot of overdueTasksData) {
    await prisma.task.create({
      data: ot
    });
  }

  console.log("Creating Expenses...");
  const expensesData = [
    { userId: employees[0].id, category: ExpenseCategory.TRAVEL, amount: 1250, description: "Fuel for weekly field clients meet in Noida.", approved: true, approvedById: salesManager.id, receiptUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500" },
    { userId: employees[0].id, category: ExpenseCategory.FOOD, amount: 480, description: "Client dinner at Noida sector 62.", approved: true, approvedById: salesManager.id, receiptUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500" },
    { userId: employees[2].id, category: ExpenseCategory.ACCOMMODATION, amount: 4500, description: "3 days stay in Greater Noida near Agrotech site.", approved: false, receiptUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500" },
    { userId: employees[3].id, category: ExpenseCategory.TRAVEL, amount: 3200, description: "Drone transport logistics service fees.", approved: false, receiptUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500" }
  ];
  for (const exp of expensesData) {
    await prisma.expense.create({
      data: {
        ...exp,
        date: new Date(today.getTime() - 2 * oneDayMs)
      }
    });
  }

  console.log("Creating Leave Requests...");
  const leavesData = [
    { userId: employees[4].id, reason: "Severe back pain, doctor recommended 2 days absolute bed rest.", status: LeaveStatus.APPROVED, approvedById: admin.id, startDate: new Date(today.getTime() - 4 * oneDayMs), endDate: new Date(today.getTime() - 3 * oneDayMs) },
    { userId: employees[1].id, reason: "Attending sister's wedding in Jaipur. Requesting leave.", status: LeaveStatus.PENDING, startDate: new Date(today.getTime() + 5 * oneDayMs), endDate: new Date(today.getTime() + 8 * oneDayMs) },
    { userId: employees[3].id, reason: "General body checkup appointment.", status: LeaveStatus.REJECTED, approvedById: engManager.id, startDate: new Date(today.getTime() - 8 * oneDayMs), endDate: new Date(today.getTime() - 8 * oneDayMs) }
  ];
  for (const lv of leavesData) {
    await prisma.leaveRequest.create({
      data: {
        ...lv,
        companyId: company.id
      }
    });
  }

  console.log("Creating Issues...");
  const issue1 = await prisma.issue.create({
    data: {
      title: "GPS location services locking up background process",
      description: "When locking my phone on Android 14, the background location updates stop transmitting. Need permission validation.",
      priority: "Critical",
      status: "In Progress",
      reportedById: employees[0].id,
      assigneeId: engManager.id,
      companyId: company.id
    }
  });

  const issue2 = await prisma.issue.create({
    data: {
      title: "Daily visit report km calculation incorrect",
      description: "Odometer calculations in mobile app did not match my actual odometer reading by 2.3km.",
      priority: "Medium",
      status: "Open",
      reportedById: employees[1].id,
      companyId: company.id
    }
  });

  await prisma.issueUpdate.create({
    data: {
      issueId: issue1.id,
      userId: engManager.id,
      type: "TEXT",
      content: "I will analyze the location tracker configuration. We might be missing the FOREGROUND_SERVICE_LOCATION permissions."
    }
  });

  console.log("Creating Custom Forms and Fields...");
  const form1 = await prisma.form.create({
    data: { name: "Daily Field Visit Report", category: "Operations", status: "Published", companyId: company.id, createdById: admin.id }
  });

  await prisma.formField.createMany({
    data: [
      { formId: form1.id, label: "Client Name", type: "text", required: true },
      { formId: form1.id, label: "Visit Purpose", type: "select", required: true, options: JSON.stringify(["Survey", "Installation", "Issue Fix", "Payment Collection"]) },
      { formId: form1.id, label: "Detailed Remarks", type: "text", required: false },
      { formId: form1.id, label: "Site Photo", type: "photo", required: true }
    ]
  });

  console.log("Creating Form Responses...");
  await prisma.formResponse.create({
    data: {
      formId: form1.id,
      userId: employees[0].id,
      data: JSON.stringify({
        "Client Name": "Agrotech Sector B",
        "Visit Purpose": "Survey",
        "Detailed Remarks": "Tested soil metrics. Soil conductivity looks promising.",
        "Site Photo": "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=500"
      }),
      submittedAt: new Date(today.getTime() - oneDayMs)
    }
  });

  console.log("Creating Templates...");
  await prisma.template.create({
    data: {
      name: "Standard On-Site Safety Inspection",
      type: "Task",
      priority: "High",
      recurrence: "Weekly",
      description: "Inspect site boundaries, check power cabling, ensure helmets/safety gloves are worn, verify fire extinguisher pressure tags."
    }
  });

  console.log("Creating Notifications...");
  await prisma.notification.create({
    data: {
      userId: employees[0].id,
      title: "New Task Assigned",
      message: "Rohan Sharma assigned you task: Perform soil moisture calibration",
      type: "TASK_ASSIGNED"
    }
  });

  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: "Leave Request Submitted",
      message: "Diya Roy submitted a leave request: Attending sister's wedding in Jaipur.",
      type: "SYSTEM"
    }
  });

  console.log("Database seeded successfully!");
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
