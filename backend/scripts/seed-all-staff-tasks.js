const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const bishnuTasks = [
  // 5 Sep 2026
  { dateStr: '2026-09-05', title: 'Apk build for petrol pump staff', description: 'Category: Build / Release | Compiled and generated release APK build for petrol pump attendants.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-05', title: 'Add html file upload in manager app in sale', description: 'Category: Feature Development | Implemented HTML sales file upload handler in manager mobile app.', status: 'COMPLETED', priority: 'Medium', points: 10 },
  { dateStr: '2026-09-05', title: 'Check apk testing and fixed issue', description: 'Category: Testing & Bug Fixes | Performed APK quality testing and resolved runtime issues.', status: 'COMPLETED', priority: 'Medium', points: 10 },
  // 7 Sep 2026
  { dateStr: '2026-09-07', title: 'Fix jewellery web', description: 'Category: Bugs and Features | Resolved web layout issues and updated jewellery portal features.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-07', title: 'Vaniki dealer play store app upload in play store', description: 'Category: Deployment | Uploaded Vaniki dealer application bundle to Google Play Store console.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-07', title: 'Vaniki user app fixed and complete that', description: 'Category: Bug Fixes / Dev | Completed pending features and fixed bugs in Vaniki user app.', status: 'COMPLETED', priority: 'High', points: 10 },
  // 8 Sep 2026
  { dateStr: '2026-09-08', title: 'Upload vaniki user app in play store', description: 'Category: Deployment | Published Vaniki customer app on Google Play Store production track.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-08', title: 'Setup meta whatsapp account', description: 'Category: Account Setup | Configured Meta Business WhatsApp cloud API account & verified templates.', status: 'COMPLETED', priority: 'Medium', points: 10 },
  // 9 Sep 2026
  { dateStr: '2026-09-09', title: 'Add whatsapp in vaniki user app and dealer app', description: 'Category: Integration | Integrated direct WhatsApp support and messaging in Vaniki apps.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-09', title: 'Write backend of vaniki user app and dealer app', description: 'Category: Backend | Created backend APIs for Vaniki user & dealer order management.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-09', title: 'Connect WhatsApp with Gemini api', description: 'Category: API Integration | Built AI chatbot bridge connecting WhatsApp webhook with Gemini AI API.', status: 'COMPLETED', priority: 'Medium', points: 10 },
  // 10 Sep 2026
  { dateStr: '2026-09-10', title: 'Test all vaniki apps', description: 'Category: Testing / QA | Tested Vaniki User app, Dealer app, and backend synchronization.', status: 'COMPLETED', priority: 'Medium', points: 10 },
  { dateStr: '2026-09-10', title: 'Check warehouse app', description: 'Category: Review / Testing | Reviewed inventory workflows and UI flows in Warehouse app.', status: 'COMPLETED', priority: 'Medium', points: 10 },
  { dateStr: '2026-09-10', title: 'Connect warehouse app to vaniki dealers app', description: 'Category: Integration | Connected warehouse stock levels with Vaniki dealers application.', status: 'COMPLETED', priority: 'Medium', points: 10 },
  // 11 Sep 2026
  { dateStr: '2026-09-11', title: 'Create new vaniki dealers apk and warehouse apk', description: 'Category: Build / Release | Built updated release APKs for Vaniki Dealers & Warehouse.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-11', title: 'Test both of the apps', description: 'Category: Testing / QA | Validated end-to-end dealer ordering and warehouse dispatch.', status: 'COMPLETED', priority: 'Medium', points: 10 },
  // 15 Sep 2026
  { dateStr: '2026-09-15', title: 'Petrol Pump Admin Bug Fixes & Dashboard Optimization', description: 'Category: Bug Fixes / Dev | Fixed admin panel bugs, sales sync issue, and dashboard metric calculations.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-15', title: 'Manager Mobile App Build & Release Generation', description: 'Category: Build / Release | Compiled and generated latest manager APK build with sales HTML upload.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-15', title: 'Tally ERP Data Synchronization & Ledger Sync', description: 'Category: Integration | Configured automatic Tally XML data bridge and ledger mapping sync.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-15', title: 'Facebook Marketing Ads Campaign Publish & Setup', description: 'Category: Marketing / Ads | Setup Meta business manager ads campaign, targeting parameters, creatives.', status: 'COMPLETED', priority: 'Medium', points: 10 },
  // 16 Sep 2026
  { dateStr: '2026-09-16', title: 'Vaniki User App UI/UX Redesign & Navigation Overhaul', description: 'Category: Feature Development | Redesign bottom navigation tab bar, product catalog grid, order history layout.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-16', title: 'Dealer Order Placement & Multi-Item Cart Integration', description: 'Category: Feature Development | Implement fluid product quantity selector, wholesale tier pricing calculation.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-16', title: 'Live WhatsApp Order Status & Push Notification Engine', description: 'Category: Integration | Connect Meta WhatsApp API webhook triggers for order confirmation, dispatch alerts.', status: 'PENDING', priority: 'Medium', points: 10 },
  // 17 Sep 2026
  { dateStr: '2026-09-17', title: 'End-to-End QA Testing & Multi-Device Validation', description: 'Category: Testing / QA | Perform complete functional QA, network interruption tests, UI edge-case validation.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-17', title: 'Production Android App Bundle (.aab) Build & Code Signing', description: 'Category: Build / Release | Configure release keystore, enable ProGuard R8 code shrinking, generate signed release .aab.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-17', title: 'Google Play Console Release Submission & Store Publishing', description: 'Category: Deployment | Draft release notes, upload .aab bundle to Google Play Console, and roll out.', status: 'PENDING', priority: 'High', points: 10 },
  // 18 Sep 2026
  { dateStr: '2026-09-18', title: 'Marg ERP Multi-Tenant Database Schema Architecture', description: 'Category: System Architecture | Design PostgreSQL schema for inventory stock ledgers, GST tax structures.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-18', title: 'Marg Web ERP Design System, UI Wireframes & Layouts', description: 'Category: UI/UX & Design | Build modular design system with responsive data tables, invoice preview modals.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-18', title: 'Marg ERP API Contract Specification & RBAC Security Model', description: 'Category: Architecture / Security | Define OpenAPI REST contracts, JWT authentication architecture.', status: 'PENDING', priority: 'Medium', points: 10 },
  // 19 Sep 2026
  { dateStr: '2026-09-19', title: 'Marg ERP Core Invoicing Engine & Sales Ledger API', description: 'Category: Backend Development | Develop transactional GST invoice creation, automated tax calculations.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-19', title: 'Marg ERP Real-Time Inventory & Stock Movement Engine', description: 'Category: Backend Development | Implement batch tracking, expiry date monitoring, warehouse transfer APIs.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-19', title: 'Marg ERP Financial Reporting Engine & GST Export Pipelines', description: 'Category: Backend / Analytics | Build automated Profit & Loss statements, daily sales summary aggregates.', status: 'PENDING', priority: 'High', points: 10 }
];

const deepikaTasks = [
  // 15 Sep 2026
  { dateStr: '2026-09-15', title: 'Google Ads Campaign Setup & Search/Display Ads Publish', description: 'Category: Marketing / Ads | Setup Google Ads account, keyword targeting research, budget allocation, conversion tracking.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-15', title: 'Vaniki Official Instagram Business Account Setup & Branding', description: 'Category: Social Media / Marketing | Created and configured official Vaniki Instagram business account, bio branding, highlights.', status: 'COMPLETED', priority: 'Medium', points: 10 },
  { dateStr: '2026-09-15', title: 'Warehouse Backend Architecture & Database Initialization', description: 'Category: Backend / Setup | Setup Node.js Express server structure, PostgreSQL database connection, Prisma ORM schema.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-15', title: 'Warehouse Authentication, RBAC & User Management API', description: 'Category: Backend Development | Implement JWT authentication, password hashing, role-based access control.', status: 'COMPLETED', priority: 'High', points: 10 },
  { dateStr: '2026-09-15', title: 'Warehouse Stock Inward & Product Catalog Endpoints', description: 'Category: Backend Development | Create REST APIs for adding new product SKUs, stock inward receipt logging.', status: 'COMPLETED', priority: 'Medium', points: 10 },
  // 16 Sep 2026
  { dateStr: '2026-09-16', title: 'Warehouse Dispatch Engine & Order Fulfillment APIs', description: 'Category: Backend Development | Build order picking/packing workflows, dispatch challan generation, courier tracking.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-16', title: 'Vaniki Dealers & Mobile App Sync Webhook Bridge', description: 'Category: Integration | Connect warehouse backend with Vaniki dealers app via REST webhooks for live inventory reduction.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-16', title: 'Warehouse Stock Audit Logs & Reorder Thresholds Engine', description: 'Category: Backend Development | Implement automatic stock audit logging, discrepancy reconciliation APIs.', status: 'PENDING', priority: 'Medium', points: 10 },
  // 17 Sep 2026
  { dateStr: '2026-09-17', title: 'Marg ERP Global Design System, Typography & Color Palette', description: 'Category: UI/UX & Design | Establish modern ERP design system tokens, Tailwind/CSS variables, typography scales.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-17', title: 'Marg ERP Public Landing Page & Feature Showcase Design', description: 'Category: Frontend / Design | Design high-converting landing page with hero banner, product feature breakdown.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-17', title: 'Marg ERP Shared UI Component Library & Data Table Components', description: 'Category: Frontend Development | Build reusable UI library: searchable data tables with pagination, filter drawers.', status: 'PENDING', priority: 'Medium', points: 10 },
  // 18 Sep 2026
  { dateStr: '2026-09-18', title: 'Marg Superadmin Multi-Tenant Dashboard & Company Oversight', description: 'Category: UI/UX & Design | Design Superadmin analytics dashboard featuring tenant company cards, active subscription metrics.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-18', title: 'Superadmin Tenant Management & Subscription Billing UI', description: 'Category: Frontend / Design | Design company onboarding wizard, license plan assignment, invoice billing management.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-18', title: 'Superadmin System Configs, Audit Logs & Permission Matrix UI', description: 'Category: Frontend / Design | Design global setting interfaces, platform security rules, audit trail inspection viewer.', status: 'PENDING', priority: 'Medium', points: 10 },
  // 19 Sep 2026
  { dateStr: '2026-09-19', title: 'Marg Admin Operations Dashboard & Financial KPI Overview', description: 'Category: UI/UX & Design | Design comprehensive Admin executive dashboard with live sales metrics, pending order alerts.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-19', title: 'Admin Inventory Management & Stock Warehouse Views', description: 'Category: Frontend / Design | Design product catalogue list view, SKU detail drawer, stock adjustment screens.', status: 'PENDING', priority: 'High', points: 10 },
  { dateStr: '2026-09-19', title: 'Admin Sales Invoicing, Ledger & GST Tax Filing UI', description: 'Category: Frontend / Design | Design GST invoice creation wizard with barcode lookup, customer ledger account views.', status: 'PENDING', priority: 'High', points: 10 }
];

// Standard checklist for Dealer Call-up & Farmer Call-up
const dealerChecklist = [
  { id: '1', title: 'Dealer Name', required: true, validations: ['TEXT'] },
  { id: '2', title: 'Location (Village)', required: true, validations: ['TEXT'] },
  { id: '3', title: 'Questions', required: true, validations: ['TEXT'] },
  { id: '4', title: 'Answers', required: true, validations: ['TEXT'] },
  { id: '5', title: 'Product Discussed', required: true, validations: ['TEXT'] },
  { id: '6', title: 'Crop Name', required: true, validations: ['TEXT'] },
  { id: '7', title: 'Disease Name', required: true, validations: ['TEXT'] },
  { id: '8', title: 'Mobile Company', required: true, validations: ['TEXT'] },
  { id: '9', title: 'Your Name', required: true, validations: ['TEXT'] },
  { id: '10', title: 'Documents', required: true, validations: ['AUDIO'] }
];

const farmerChecklist = [
  { id: '1', title: 'Farmer Name', required: true, validations: ['TEXT'] },
  { id: '2', title: 'Location (Village)', required: true, validations: ['TEXT'] },
  { id: '3', title: 'Questions', required: true, validations: ['TEXT'] },
  { id: '4', title: 'Answers', required: true, validations: ['TEXT'] },
  { id: '5', title: 'Product Discussed', required: true, validations: ['TEXT'] },
  { id: '6', title: 'Crop Name', required: true, validations: ['TEXT'] },
  { id: '7', title: 'Disease Name', required: true, validations: ['TEXT'] },
  { id: '8', title: 'Mobile Company', required: true, validations: ['TEXT'] },
  { id: '9', title: 'Your Name', required: true, validations: ['TEXT'] },
  { id: '10', title: 'Documents', required: true, validations: ['AUDIO'] }
];

const fieldDailyTasksTemplate = [
  {
    title: 'Dealer Call-up',
    description: 'Call assigned dealer, inspect stock requirements, discuss products & record audio notes.',
    checklist: dealerChecklist,
    points: 10,
    priority: 'High'
  },
  {
    title: 'Farmer Call-up',
    description: 'Conduct farmer advisory call, understand crop pest/disease concerns & provide solutions.',
    checklist: farmerChecklist,
    points: 10,
    priority: 'High'
  },
  {
    title: 'Farmer Call-up 2',
    description: 'Follow-up with key farmers on bio-stimulant performance and yield feedback.',
    checklist: farmerChecklist,
    points: 10,
    priority: 'Medium'
  },
  {
    title: 'Dealer Visit & Booking Order Collection',
    description: 'Physical dealer visit, verify display stock, collect new booking orders & payment cheques.',
    points: 15,
    priority: 'High'
  },
  {
    title: 'Farmer Meeting & Demonstration',
    description: 'Conduct field demonstration of crop protection solutions in target village block.',
    points: 15,
    priority: 'High'
  }
];

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', companyId: 'demo-corp-company' }
  });
  const assignerId = admin ? admin.id : 'cmpkss2zj0003gtxohnxrsfky';

  console.log('Seeding specific developer tasks for Bishnu & Deepika...');

  // 1. Seed Bishnu tasks
  const bishnuUser = await prisma.user.findFirst({ where: { email: 'bishnusahu@gmail.com' } });
  if (bishnuUser) {
    for (const item of bishnuTasks) {
      const [year, month, day] = item.dateStr.split('-').map(Number);
      const startDate = new Date(Date.UTC(year, month - 1, day, 3, 30, 0));
      const dueDate = new Date(Date.UTC(year, month - 1, day, 12, 30, 0));
      const completedAt = item.status === 'COMPLETED' ? dueDate : null;

      const existing = await prisma.task.findFirst({
        where: { assignedToId: bishnuUser.id, title: item.title, dueDate: dueDate }
      });

      if (existing) {
        await prisma.task.update({
          where: { id: existing.id },
          data: { status: item.status, description: item.description, startDate, dueDate, completedAt, priority: item.priority, points: item.points }
        });
      } else {
        await prisma.task.create({
          data: { title: item.title, description: item.description, status: item.status, assignedToId: bishnuUser.id, assignedById: assignerId, startDate, dueDate, completedAt, priority: item.priority, points: item.points }
        });
      }
    }
  }

  // 2. Seed Deepika tasks
  const deepikaUser = await prisma.user.findFirst({ where: { email: 'deepikatandulkar2@gmail.com' } });
  if (deepikaUser) {
    for (const item of deepikaTasks) {
      const [year, month, day] = item.dateStr.split('-').map(Number);
      const startDate = new Date(Date.UTC(year, month - 1, day, 3, 30, 0));
      const dueDate = new Date(Date.UTC(year, month - 1, day, 12, 30, 0));
      const completedAt = item.status === 'COMPLETED' ? dueDate : null;

      const existing = await prisma.task.findFirst({
        where: { assignedToId: deepikaUser.id, title: item.title, dueDate: dueDate }
      });

      if (existing) {
        await prisma.task.update({
          where: { id: existing.id },
          data: { status: item.status, description: item.description, startDate, dueDate, completedAt, priority: item.priority, points: item.points }
        });
      } else {
        await prisma.task.create({
          data: { title: item.title, description: item.description, status: item.status, assignedToId: deepikaUser.id, assignedById: assignerId, startDate, dueDate, completedAt, priority: item.priority, points: item.points }
        });
      }
    }
  }

  // 3. Seed tasks for all other field employees & sales officers across days (12, 13, 14, 15, 16, 17, 18, 19 Sep)
  const allFieldEmployees = await prisma.user.findMany({
    where: {
      companyId: 'demo-corp-company',
      role: { in: ['EMPLOYEE', 'MANAGER'] },
      email: { notIn: ['bishnusahu@gmail.com', 'deepikatandulkar2@gmail.com', 'test@gmail.com'] }
    }
  });

  console.log(`Generating daily & recurring tasks for ${allFieldEmployees.length} team members...`);

  const datesList = [
    { dateStr: '2026-09-14', isPast: true },
    { dateStr: '2026-09-15', isPast: true },
    { dateStr: '2026-09-16', isPast: false },
    { dateStr: '2026-09-17', isPast: false },
    { dateStr: '2026-09-18', isPast: false },
    { dateStr: '2026-09-19', isPast: false }
  ];

  let otherCreatedCount = 0;

  for (const emp of allFieldEmployees) {
    for (const d of datesList) {
      const [year, month, day] = d.dateStr.split('-').map(Number);
      const startDate = new Date(Date.UTC(year, month - 1, day, 3, 30, 0));
      const dueDate = new Date(Date.UTC(year, month - 1, day, 12, 30, 0));

      // Each employee gets 2 to 4 daily tasks
      const empSeed = (emp.name.charCodeAt(0) + day) % 3;
      const tasksForEmp = empSeed === 0 
        ? [fieldDailyTasksTemplate[0], fieldDailyTasksTemplate[1], fieldDailyTasksTemplate[3]]
        : empSeed === 1
        ? [fieldDailyTasksTemplate[0], fieldDailyTasksTemplate[1], fieldDailyTasksTemplate[2], fieldDailyTasksTemplate[4]]
        : [fieldDailyTasksTemplate[0], fieldDailyTasksTemplate[1], fieldDailyTasksTemplate[4]];

      for (const tpl of tasksForEmp) {
        // Status: If past date, mostly COMPLETED with a few PENDING, if today/future: PENDING
        let status = 'PENDING';
        if (d.isPast) {
          status = ((emp.name.charCodeAt(0) + day) % 5 === 0) ? 'PENDING' : 'COMPLETED';
        }
        const completedAt = status === 'COMPLETED' ? dueDate : null;

        const existing = await prisma.task.findFirst({
          where: {
            assignedToId: emp.id,
            title: tpl.title,
            dueDate: dueDate
          }
        });

        if (existing) {
          await prisma.task.update({
            where: { id: existing.id },
            data: {
              status,
              description: tpl.description,
              checklist: tpl.checklist || null,
              startDate,
              dueDate,
              completedAt,
              priority: tpl.priority,
              points: tpl.points
            }
          });
        } else {
          await prisma.task.create({
            data: {
              title: tpl.title,
              description: tpl.description,
              checklist: tpl.checklist || null,
              status,
              assignedToId: emp.id,
              assignedById: assignerId,
              startDate,
              dueDate,
              completedAt,
              priority: tpl.priority,
              points: tpl.points
            }
          });
          otherCreatedCount++;
        }
      }
    }
  }

  const finalTotal = await prisma.task.count();
  console.log(`\nSUCCESS: Successfully populated tasks! Total in database: ${finalTotal}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
