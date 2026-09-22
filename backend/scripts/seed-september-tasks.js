const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const tasksToInsert = [
  // ==========================================
  // 15 Sep 2026 (COMPLETED)
  // ==========================================
  {
    dateStr: '2026-09-15',
    title: 'Petrol Pump Admin Bug Fixes & Dashboard Optimization',
    description: 'Category: Bug Fixes / Dev | Fixed admin panel bugs, sales sync issue, and dashboard metric calculations for petrol pump management.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Manager Mobile App Build & Release Generation',
    description: 'Category: Build / Release | Compiled and generated latest manager APK build with sales HTML upload and attendance optimizations.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Tally ERP Data Synchronization & Ledger Sync',
    description: 'Category: Integration | Configured automatic Tally XML data bridge and ledger mapping sync for petrol pump accounting.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Facebook Marketing Ads Campaign Publish & Setup',
    description: 'Category: Marketing / Ads | Setup Meta business manager ads campaign, targeting parameters, creatives, and live published ads.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },

  // ==========================================
  // 16 Sep 2026 (PENDING - Vaniki user app updates)
  // ==========================================
  {
    dateStr: '2026-09-16',
    title: 'Vaniki User App UI/UX Redesign & Navigation Overhaul',
    description: 'Category: Feature Development | Redesign bottom navigation tab bar, product catalog grid, order history layout, and modernize theme styling.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-16',
    title: 'Dealer Order Placement & Multi-Item Cart Integration',
    description: 'Category: Feature Development | Implement fluid product quantity selector, wholesale tier pricing calculation, tax breakup, and checkout flow.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-16',
    title: 'Live WhatsApp Order Status & Push Notification Engine',
    description: 'Category: Integration | Connect Meta WhatsApp API webhook triggers for order confirmation, dispatch alerts, and FCM push notifications.',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },

  // ==========================================
  // 17 Sep 2026 (PENDING - Test & build .aab and publish)
  // ==========================================
  {
    dateStr: '2026-09-17',
    title: 'End-to-End QA Testing & Multi-Device Validation',
    description: 'Category: Testing / QA | Perform complete functional QA, network interruption tests, UI edge-case validation across multiple Android OS versions.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-17',
    title: 'Production Android App Bundle (.aab) Build & Code Signing',
    description: 'Category: Build / Release | Configure release keystore, enable ProGuard R8 code shrinking, bundle size optimization, and generate signed release .aab.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-17',
    title: 'Google Play Console Release Submission & Store Publishing',
    description: 'Category: Deployment | Draft release notes, verify privacy policy compliance, upload .aab bundle to Google Play Console, and roll out to production track.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },

  // ==========================================
  // 18 Sep 2026 (PENDING - Marg website erp system design)
  // ==========================================
  {
    dateStr: '2026-09-18',
    title: 'Marg ERP Multi-Tenant Database Schema Architecture',
    description: 'Category: System Architecture | Design PostgreSQL schema for inventory stock ledgers, GST tax structures, customer accounts, and audit log tables.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-18',
    title: 'Marg Web ERP Design System, UI Wireframes & Layouts',
    description: 'Category: UI/UX & Design | Build modular design system with responsive data tables, fast keyboard shortcuts, invoice preview modals, and dashboards.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-18',
    title: 'Marg ERP API Contract Specification & RBAC Security Model',
    description: 'Category: Architecture / Security | Define OpenAPI REST contracts, JWT authentication architecture, granular role-based permissions matrix, and rate limiting.',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },

  // ==========================================
  // 19 Sep 2026 (PENDING - Marg website erp backend)
  // ==========================================
  {
    dateStr: '2026-09-19',
    title: 'Marg ERP Core Invoicing Engine & Sales Ledger API',
    description: 'Category: Backend Development | Develop transactional GST invoice creation, automated tax calculations (CGST/SGST/IGST), customer debit/credit ledgers.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-19',
    title: 'Marg ERP Real-Time Inventory & Stock Movement Engine',
    description: 'Category: Backend Development | Implement batch tracking, expiry date monitoring, warehouse transfer APIs, stock adjustments, and low-inventory alerts.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-19',
    title: 'Marg ERP Financial Reporting Engine & GST Export Pipelines',
    description: 'Category: Backend / Analytics | Build automated Profit & Loss statements, daily sales summary aggregates, GSTR-1 JSON export generator, and PDF invoice templates.',
    status: 'PENDING',
    priority: 'High',
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
  let updatedCount = 0;

  for (const item of tasksToInsert) {
    // Due date set to 18:00 IST on that date (12:30 UTC)
    // Start date set to 09:00 IST on that date (03:30 UTC)
    const [year, month, day] = item.dateStr.split('-').map(Number);
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
      updatedCount++;
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

  console.log(`\nSuccessfully processed all ${tasksToInsert.length} tasks (${createdCount} newly created, ${updatedCount} updated).`);
}

main()
  .catch((e) => {
    console.error('Error inserting tasks:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
