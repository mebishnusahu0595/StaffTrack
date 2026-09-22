const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const tasksToInsert = [
  // 5 Sep 2026
  {
    dateStr: '2026-09-05',
    title: 'Apk build for petrol pump staff',
    description: 'Category: Build / Release',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-05',
    title: 'Add html file upload in manager app in sale',
    description: 'Category: Feature Development',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  {
    dateStr: '2026-09-05',
    title: 'Check apk testing and fixed issue',
    description: 'Category: Testing & Bug Fixes',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  // 7 Sep 2026
  {
    dateStr: '2026-09-07',
    title: 'Fix jewellery web',
    description: 'Category: Bugs and Features',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-07',
    title: 'Vaniki dealer play store app upload in play store',
    description: 'Category: Deployment',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-07',
    title: 'Vaniki user app fixed and complete that',
    description: 'Category: Bug Fixes / Dev',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  // 8 Sep 2026
  {
    dateStr: '2026-09-08',
    title: 'Upload vaniki user app in play store',
    description: 'Category: Deployment',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-08',
    title: 'Setup meta whatsapp account',
    description: 'Category: Account Setup',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },
  // 9 Sep 2026
  {
    dateStr: '2026-09-09',
    title: 'Add whatsapp in vaniki user app and dealer app',
    description: 'Category: Integration',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-09',
    title: 'Write backend of vaniki user app and dealer app',
    description: 'Category: Backend',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-09',
    title: 'Connect WhatsApp with Gemini api',
    description: 'Category: API Integration',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },
  // 10 Sep 2026
  {
    dateStr: '2026-09-10',
    title: 'Test all vaniki apps',
    description: 'Category: Testing / QA',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },
  {
    dateStr: '2026-09-10',
    title: 'Check warehouse app',
    description: 'Category: Review / Testing',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },
  {
    dateStr: '2026-09-10',
    title: 'Connect warehouse app to vaniki dealers app',
    description: 'Category: Integration',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },
  // 11 Sep 2026
  {
    dateStr: '2026-09-11',
    title: 'Create new vaniki dealers apk and warehouse apk',
    description: 'Category: Build / Release',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-11',
    title: 'Test both of the apps',
    description: 'Category: Testing / QA',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  }
];

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: 'bishnusahu@gmail.com',
        mode: 'insensitive'
      }
    }
  });

  if (!user) {
    console.error('User bishnusahu@gmail.com not found!');
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user.id}), company: ${user.companyId}`);

  // Find admin or assigner
  const admin = await prisma.user.findFirst({
    where: {
      companyId: user.companyId,
      role: { in: ['ADMIN', 'SUPERADMIN', 'MANAGER'] }
    }
  });

  const assignerId = admin ? admin.id : user.id;
  console.log(`Assigner ID: ${assignerId}`);

  let createdCount = 0;
  for (const item of tasksToInsert) {
    // Due date set to 18:00 IST on that date (12:30 UTC)
    // Start date set to 09:00 IST on that date (03:30 UTC)
    const [year, month, day] = item.dateStr.split('-').map(Number);
    // UTC dates corresponding to IST:
    // IST = UTC + 5:30
    // 09:00 IST = 03:30 UTC
    // 18:00 IST = 12:30 UTC
    const startDate = new Date(Date.UTC(year, month - 1, day, 3, 30, 0));
    const dueDate = new Date(Date.UTC(year, month - 1, day, 12, 30, 0));
    const completedAt = item.status === 'COMPLETED' ? dueDate : null;

    // Check if task already exists for this title and dueDate
    const existing = await prisma.task.findFirst({
      where: {
        assignedToId: user.id,
        title: item.title,
        dueDate: dueDate
      }
    });

    if (existing) {
      console.log(`Task already exists: "${item.title}" for ${item.dateStr}, updating...`);
      await prisma.task.update({
        where: { id: existing.id },
        data: {
          status: item.status,
          description: item.description,
          startDate,
          dueDate,
          completedAt,
          priority: item.priority,
          points: item.points
        }
      });
    } else {
      console.log(`Creating task: "${item.title}" for ${item.dateStr} (Status: ${item.status})...`);
      await prisma.task.create({
        data: {
          title: item.title,
          description: item.description,
          status: item.status,
          assignedToId: user.id,
          assignedById: assignerId,
          startDate,
          dueDate,
          completedAt,
          priority: item.priority,
          points: item.points
        }
      });
      createdCount++;
    }
  }

  console.log(`\nSuccessfully processed all ${tasksToInsert.length} tasks (${createdCount} newly created).`);
}

main()
  .catch((e) => {
    console.error('Error inserting tasks:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
