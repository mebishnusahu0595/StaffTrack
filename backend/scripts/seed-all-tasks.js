const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const bishnuTasks = [
  // 5 Sep 2026
  {
    dateStr: '2026-09-05',
    title: 'Apk build for petrol pump staff',
    description: 'Category: Build / Release | Compiled and generated release APK build for petrol pump attendants.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-05',
    title: 'Add html file upload in manager app in sale',
    description: 'Category: Feature Development | Implemented HTML sales file upload handler in manager mobile app.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  {
    dateStr: '2026-09-05',
    title: 'Check apk testing and fixed issue',
    description: 'Category: Testing & Bug Fixes | Performed APK quality testing and resolved runtime issues.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  // 7 Sep 2026
  {
    dateStr: '2026-09-07',
    title: 'Fix jewellery web',
    description: 'Category: Bugs and Features | Resolved web layout issues and updated jewellery portal features.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-07',
    title: 'Vaniki dealer play store app upload in play store',
    description: 'Category: Deployment | Uploaded Vaniki dealer application bundle to Google Play Store console.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-07',
    title: 'Vaniki user app fixed and complete that',
    description: 'Category: Bug Fixes / Dev | Completed pending features and fixed bugs in Vaniki user app.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  // 8 Sep 2026
  {
    dateStr: '2026-09-08',
    title: 'Upload vaniki user app in play store',
    description: 'Category: Deployment | Published Vaniki customer app on Google Play Store production track.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-08',
    title: 'Setup meta whatsapp account',
    description: 'Category: Account Setup | Configured Meta Business WhatsApp cloud API account & verified templates.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  // 9 Sep 2026
  {
    dateStr: '2026-09-09',
    title: 'Add whatsapp in vaniki user app and dealer app',
    description: 'Category: Integration | Integrated direct WhatsApp support and messaging in Vaniki apps.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-09',
    title: 'Write backend of vaniki user app and dealer app',
    description: 'Category: Backend | Created backend APIs for Vaniki user & dealer order management.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-09',
    title: 'Connect WhatsApp with Gemini api',
    description: 'Category: API Integration | Built AI chatbot bridge connecting WhatsApp webhook with Gemini AI API.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  // 10 Sep 2026
  {
    dateStr: '2026-09-10',
    title: 'Test all vaniki apps',
    description: 'Category: Testing / QA | Tested Vaniki User app, Dealer app, and backend synchronization.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  {
    dateStr: '2026-09-10',
    title: 'Check warehouse app',
    description: 'Category: Review / Testing | Reviewed inventory workflows and UI flows in Warehouse app.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  {
    dateStr: '2026-09-10',
    title: 'Connect warehouse app to vaniki dealers app',
    description: 'Category: Integration | Connected warehouse stock levels with Vaniki dealers application.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  // 11 Sep 2026
  {
    dateStr: '2026-09-11',
    title: 'Create new vaniki dealers apk and warehouse apk',
    description: 'Category: Build / Release | Built updated release APKs for Vaniki Dealers & Warehouse.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-11',
    title: 'Test both of the apps',
    description: 'Category: Testing / QA | Validated end-to-end dealer ordering and warehouse dispatch.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  // 15 Sep 2026
  {
    dateStr: '2026-09-15',
    title: 'Petrol Pump Admin Bug Fixes & Dashboard Optimization',
    description: 'Category: Bug Fixes / Dev | Fixed admin panel bugs, sales sync issue, and dashboard metric calculations.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Manager Mobile App Build & Release Generation',
    description: 'Category: Build / Release | Compiled and generated latest manager APK build with sales HTML upload.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Tally ERP Data Synchronization & Ledger Sync',
    description: 'Category: Integration | Configured automatic Tally XML data bridge and ledger mapping sync.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Facebook Marketing Ads Campaign Publish & Setup',
    description: 'Category: Marketing / Ads | Setup Meta business manager ads campaign, targeting parameters, creatives.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  // 16 Sep 2026
  {
    dateStr: '2026-09-16',
    title: 'Vaniki User App UI/UX Redesign & Navigation Overhaul',
    description: 'Category: Feature Development | Redesign bottom navigation tab bar, product catalog grid, order history layout.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-16',
    title: 'Dealer Order Placement & Multi-Item Cart Integration',
    description: 'Category: Feature Development | Implement fluid product quantity selector, wholesale tier pricing calculation.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-16',
    title: 'Live WhatsApp Order Status & Push Notification Engine',
    description: 'Category: Integration | Connect Meta WhatsApp API webhook triggers for order confirmation, dispatch alerts.',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },
  // 17 Sep 2026
  {
    dateStr: '2026-09-17',
    title: 'End-to-End QA Testing & Multi-Device Validation',
    description: 'Category: Testing / QA | Perform complete functional QA, network interruption tests, UI edge-case validation.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-17',
    title: 'Production Android App Bundle (.aab) Build & Code Signing',
    description: 'Category: Build / Release | Configure release keystore, enable ProGuard R8 code shrinking, generate signed release .aab.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-17',
    title: 'Google Play Console Release Submission & Store Publishing',
    description: 'Category: Deployment | Draft release notes, upload .aab bundle to Google Play Console, and roll out.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  // 18 Sep 2026
  {
    dateStr: '2026-09-18',
    title: 'Marg ERP Multi-Tenant Database Schema Architecture',
    description: 'Category: System Architecture | Design PostgreSQL schema for inventory stock ledgers, GST tax structures.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-18',
    title: 'Marg Web ERP Design System, UI Wireframes & Layouts',
    description: 'Category: UI/UX & Design | Build modular design system with responsive data tables, invoice preview modals.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-18',
    title: 'Marg ERP API Contract Specification & RBAC Security Model',
    description: 'Category: Architecture / Security | Define OpenAPI REST contracts, JWT authentication architecture.',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },
  // 19 Sep 2026
  {
    dateStr: '2026-09-19',
    title: 'Marg ERP Core Invoicing Engine & Sales Ledger API',
    description: 'Category: Backend Development | Develop transactional GST invoice creation, automated tax calculations.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-19',
    title: 'Marg ERP Real-Time Inventory & Stock Movement Engine',
    description: 'Category: Backend Development | Implement batch tracking, expiry date monitoring, warehouse transfer APIs.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-19',
    title: 'Marg ERP Financial Reporting Engine & GST Export Pipelines',
    description: 'Category: Backend / Analytics | Build automated Profit & Loss statements, daily sales summary aggregates.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  }
];

const deepikaTasks = [
  // 15 Sep 2026
  {
    dateStr: '2026-09-15',
    title: 'Google Ads Campaign Setup & Search/Display Ads Publish',
    description: 'Category: Marketing / Ads | Setup Google Ads account, keyword targeting research, budget allocation, conversion tracking.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Vaniki Official Instagram Business Account Setup & Branding',
    description: 'Category: Social Media / Marketing | Created and configured official Vaniki Instagram business account, bio branding, highlights.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Warehouse Backend Architecture & Database Initialization',
    description: 'Category: Backend / Setup | Setup Node.js Express server structure, PostgreSQL database connection, Prisma ORM schema.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Warehouse Authentication, RBAC & User Management API',
    description: 'Category: Backend Development | Implement JWT authentication, password hashing, role-based access control.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Warehouse Stock Inward & Product Catalog Endpoints',
    description: 'Category: Backend Development | Create REST APIs for adding new product SKUs, stock inward receipt logging.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },
  // 16 Sep 2026
  {
    dateStr: '2026-09-16',
    title: 'Warehouse Dispatch Engine & Order Fulfillment APIs',
    description: 'Category: Backend Development | Build order picking/packing workflows, dispatch challan generation, courier tracking.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-16',
    title: 'Vaniki Dealers & Mobile App Sync Webhook Bridge',
    description: 'Category: Integration | Connect warehouse backend with Vaniki dealers app via REST webhooks for live inventory reduction.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-16',
    title: 'Warehouse Stock Audit Logs & Reorder Thresholds Engine',
    description: 'Category: Backend Development | Implement automatic stock audit logging, discrepancy reconciliation APIs.',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },
  // 17 Sep 2026
  {
    dateStr: '2026-09-17',
    title: 'Marg ERP Global Design System, Typography & Color Palette',
    description: 'Category: UI/UX & Design | Establish modern ERP design system tokens, Tailwind/CSS variables, typography scales.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-17',
    title: 'Marg ERP Public Landing Page & Feature Showcase Design',
    description: 'Category: Frontend / Design | Design high-converting landing page with hero banner, product feature breakdown.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-17',
    title: 'Marg ERP Shared UI Component Library & Data Table Components',
    description: 'Category: Frontend Development | Build reusable UI library: searchable data tables with pagination, filter drawers.',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },
  // 18 Sep 2026
  {
    dateStr: '2026-09-18',
    title: 'Marg Superadmin Multi-Tenant Dashboard & Company Oversight',
    description: 'Category: UI/UX & Design | Design Superadmin analytics dashboard featuring tenant company cards, active subscription metrics.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-18',
    title: 'Superadmin Tenant Management & Subscription Billing UI',
    description: 'Category: Frontend / Design | Design company onboarding wizard, license plan assignment, invoice billing management.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-18',
    title: 'Superadmin System Configs, Audit Logs & Permission Matrix UI',
    description: 'Category: Frontend / Design | Design global setting interfaces, platform security rules, audit trail inspection viewer.',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },
  // 19 Sep 2026
  {
    dateStr: '2026-09-19',
    title: 'Marg Admin Operations Dashboard & Financial KPI Overview',
    description: 'Category: UI/UX & Design | Design comprehensive Admin executive dashboard with live sales metrics, pending order alerts.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-19',
    title: 'Admin Inventory Management & Stock Warehouse Views',
    description: 'Category: Frontend / Design | Design product catalogue list view, SKU detail drawer, stock adjustment screens.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-19',
    title: 'Admin Sales Invoicing, Ledger & GST Tax Filing UI',
    description: 'Category: Frontend / Design | Design GST invoice creation wizard with barcode lookup, customer ledger account views.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  }
];

async function seedUserTasks(email, taskList) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });

  if (!user) {
    console.error(`User ${email} not found!`);
    return 0;
  }

  const admin = await prisma.user.findFirst({
    where: {
      companyId: user.companyId,
      role: { in: ['ADMIN', 'SUPERADMIN', 'MANAGER'] }
    }
  });
  const assignerId = admin ? admin.id : user.id;

  console.log(`Seeding ${taskList.length} tasks for ${user.name} (${email})...`);

  let count = 0;
  for (const item of taskList) {
    const [year, month, day] = item.dateStr.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, day, 3, 30, 0));
    const dueDate = new Date(Date.UTC(year, month - 1, day, 12, 30, 0));
    const completedAt = item.status === 'COMPLETED' ? dueDate : null;

    const existing = await prisma.task.findFirst({
      where: {
        assignedToId: user.id,
        title: item.title,
        dueDate: dueDate
      }
    });

    if (existing) {
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
    }
    count++;
  }
  return count;
}

async function main() {
  const count1 = await seedUserTasks('bishnusahu@gmail.com', bishnuTasks);
  const count2 = await seedUserTasks('deepikatandulkar2@gmail.com', deepikaTasks);
  console.log(`\nDONE: Seeded ${count1} tasks for Bishnu and ${count2} tasks for Deepika!`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
