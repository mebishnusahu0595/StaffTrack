const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const tasksToInsert = [
  // ==========================================
  // 15 Sep 2026 (COMPLETED - Warehouse backend setup)
  // ==========================================
  {
    dateStr: '2026-09-15',
    title: 'Warehouse Backend Architecture & Database Initialization',
    description: 'Category: Backend / Setup | Setup Node.js Express server structure, PostgreSQL database connection, Prisma ORM schema, and environment configurations.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Warehouse Authentication, RBAC & User Management API',
    description: 'Category: Backend Development | Implement JWT authentication, password hashing, role-based access control (Warehouse Staff, Supervisor, Manager), and profile routes.',
    status: 'COMPLETED',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-15',
    title: 'Warehouse Stock Inward & Product Catalog Endpoints',
    description: 'Category: Backend Development | Create REST APIs for adding new product SKUs, stock inward receipt logging, batch number tracking, and inventory status.',
    status: 'COMPLETED',
    priority: 'Medium',
    points: 10
  },

  // ==========================================
  // 16 Sep 2026 (PENDING - Warehouse backend setup)
  // ==========================================
  {
    dateStr: '2026-09-16',
    title: 'Warehouse Dispatch Engine & Order Fulfillment APIs',
    description: 'Category: Backend Development | Build order picking/packing workflows, dispatch challan generation, courier tracking number assignment, and status transitions.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-16',
    title: 'Vaniki Dealers & Mobile App Sync Webhook Bridge',
    description: 'Category: Integration | Connect warehouse backend with Vaniki dealers app via REST webhooks for live inventory reduction and real-time dispatch updates.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-16',
    title: 'Warehouse Stock Audit Logs & Reorder Thresholds Engine',
    description: 'Category: Backend Development | Implement automatic stock audit logging, discrepancy reconciliation APIs, and low-stock notification triggers.',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },

  // ==========================================
  // 17 Sep 2026 (PENDING - Marg website designing)
  // ==========================================
  {
    dateStr: '2026-09-17',
    title: 'Marg ERP Global Design System, Typography & Color Palette',
    description: 'Category: UI/UX & Design | Establish modern ERP design system tokens, Tailwind/CSS variables, typography scales, light/dark themes, and responsive grid layout.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-17',
    title: 'Marg ERP Public Landing Page & Feature Showcase Design',
    description: 'Category: Frontend / Design | Design high-converting landing page with hero banner, product feature breakdown, pricing tier comparison, and contact inquiry form.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-17',
    title: 'Marg ERP Shared UI Component Library & Data Table Components',
    description: 'Category: Frontend Development | Build reusable UI library: searchable data tables with pagination, filter drawers, stat metric cards, modal dialogs, and toast alerts.',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },

  // ==========================================
  // 18 Sep 2026 (PENDING - Marg website designing all pages for superadmin)
  // ==========================================
  {
    dateStr: '2026-09-18',
    title: 'Marg Superadmin Multi-Tenant Dashboard & Company Oversight',
    description: 'Category: UI/UX & Design | Design Superadmin analytics dashboard featuring tenant company cards, active subscription metrics, system health logs, and revenue overview.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-18',
    title: 'Superadmin Tenant Management & Subscription Billing UI',
    description: 'Category: Frontend / Design | Design company onboarding wizard, license plan assignment, invoice billing management, and storage/quota monitoring interface.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-18',
    title: 'Superadmin System Configs, Audit Logs & Permission Matrix UI',
    description: 'Category: Frontend / Design | Design global setting interfaces, platform security rules, audit trail inspection viewer, and role permission matrices.',
    status: 'PENDING',
    priority: 'Medium',
    points: 10
  },

  // ==========================================
  // 19 Sep 2026 (PENDING - Marg website designing all pages for admin)
  // ==========================================
  {
    dateStr: '2026-09-19',
    title: 'Marg Admin Operations Dashboard & Financial KPI Overview',
    description: 'Category: UI/UX & Design | Design comprehensive Admin executive dashboard with live sales metrics, pending order alerts, top customers widget, and cash flow charts.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-19',
    title: 'Admin Inventory Management & Stock Warehouse Views',
    description: 'Category: Frontend / Design | Design product catalogue list view, SKU detail drawer, stock adjustment screens, batch tracking table, and purchase order screens.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  },
  {
    dateStr: '2026-09-19',
    title: 'Admin Sales Invoicing, Ledger & GST Tax Filing UI',
    description: 'Category: Frontend / Design | Design GST invoice creation wizard with barcode lookup, customer ledger account views, payment collection modal, and GST summary report UI.',
    status: 'PENDING',
    priority: 'High',
    points: 10
  }
];

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: 'deepikatandulkar2@gmail.com',
        mode: 'insensitive'
      }
    }
  });

  if (!user) {
    console.error('User deepikatandulkar2@gmail.com not found!');
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

  console.log(`\nSuccessfully processed all ${tasksToInsert.length} tasks for Deepika (${createdCount} newly created, ${updatedCount} updated).`);
}

main()
  .catch((e) => {
    console.error('Error inserting tasks for Deepika:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
