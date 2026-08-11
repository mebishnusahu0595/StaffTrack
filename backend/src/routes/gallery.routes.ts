import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { roleGuard } from "../middleware/roleGuard";
import { UserRole } from "@prisma/client";

const router = Router();

// Allow SUPERADMIN and ADMIN roles for gallery routes
router.use(roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN));


export interface MediaItem {
  id: string;
  url: string;
  category: "ATTENDANCE" | "ODOMETER" | "EXPENSE" | "TASK" | "ISSUE" | "FORM" | "FILE";
  title: string;
  subtitle?: string;
  userName?: string;
  userEmail?: string;
  userId?: string;
  createdAt: string;
  extraInfo?: string;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = parseInt((req.query.page as string) || "1", 10);
    const pageSize = Math.min(parseInt((req.query.pageSize as string) || "24", 10), 100);
    const category = ((req.query.category as string) || "ALL").toUpperCase();
    const search = ((req.query.search as string) || "").trim().toLowerCase();
    const startDate = (req.query.startDate as string) || "";
    const endDate = (req.query.endDate as string) || "";

    const mediaList: MediaItem[] = [];

    // 1. Attendance Photos (Selfies & Odometers)
    if (category === "ALL" || category === "ATTENDANCE" || category === "ODOMETER") {
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          OR: [
            { checkInPhotoUrl: { not: null } },
            { checkOutPhotoUrl: { not: null } },
            { startOdometerPhotoUrl: { not: null } },
            { endOdometerPhotoUrl: { not: null } }
          ]
        },
        include: {
          user: { select: { id: true, name: true, email: true } }
        },
        orderBy: { date: "desc" }
      });

      for (const rec of attendanceRecords) {
        const uName = rec.user?.name || "Employee";
        const uEmail = rec.user?.email || "";
        const uId = rec.user?.id || rec.userId;

        if (rec.checkInPhotoUrl && (category === "ALL" || category === "ATTENDANCE")) {
          mediaList.push({
            id: `att-in-${rec.id}`,
            url: rec.checkInPhotoUrl,
            category: "ATTENDANCE",
            title: `${uName} - Check-In Selfie`,
            subtitle: `Punch Type: ${rec.punchType || "MANUAL"}`,
            userName: uName,
            userEmail: uEmail,
            userId: uId,
            createdAt: rec.checkInTime ? new Date(rec.checkInTime).toISOString() : rec.date.toISOString(),
            extraInfo: `Status: ${rec.status}`
          });
        }

        if (rec.checkOutPhotoUrl && (category === "ALL" || category === "ATTENDANCE")) {
          mediaList.push({
            id: `att-out-${rec.id}`,
            url: rec.checkOutPhotoUrl,
            category: "ATTENDANCE",
            title: `${uName} - Check-Out Selfie`,
            subtitle: `Punch Type: ${rec.punchType || "MANUAL"}`,
            userName: uName,
            userEmail: uEmail,
            userId: uId,
            createdAt: rec.checkOutTime ? new Date(rec.checkOutTime).toISOString() : rec.date.toISOString(),
            extraInfo: `Status: ${rec.status}`
          });
        }

        if (rec.startOdometerPhotoUrl && (category === "ALL" || category === "ODOMETER")) {
          mediaList.push({
            id: `odo-start-${rec.id}`,
            url: rec.startOdometerPhotoUrl,
            category: "ODOMETER",
            title: `${uName} - Start Odometer`,
            subtitle: `Start Reading: ${rec.startOdometer ?? "--"} KM`,
            userName: uName,
            userEmail: uEmail,
            userId: uId,
            createdAt: rec.checkInTime ? new Date(rec.checkInTime).toISOString() : rec.date.toISOString(),
            extraInfo: `Start Odometer Photo`
          });
        }

        if (rec.endOdometerPhotoUrl && (category === "ALL" || category === "ODOMETER")) {
          mediaList.push({
            id: `odo-end-${rec.id}`,
            url: rec.endOdometerPhotoUrl,
            category: "ODOMETER",
            title: `${uName} - End Odometer`,
            subtitle: `End Reading: ${rec.endOdometer ?? "--"} KM`,
            userName: uName,
            userEmail: uEmail,
            userId: uId,
            createdAt: rec.checkOutTime ? new Date(rec.checkOutTime).toISOString() : rec.date.toISOString(),
            extraInfo: `End Odometer Photo`
          });
        }
      }
    }

    // 2. Day End Reports (DER Photos)
    if (category === "ALL" || category === "ODOMETER") {
      const derReports = await prisma.dayEndReport.findMany({
        where: {
          OR: [
            { kmPhotoUrl: { not: null } },
            { startOdometerPhotoUrl: { not: null } }
          ]
        },
        include: {
          user: { select: { id: true, name: true, email: true } }
        },
        orderBy: { date: "desc" }
      });

      for (const der of derReports) {
        const uName = der.user?.name || "Employee";
        if (der.kmPhotoUrl) {
          mediaList.push({
            id: `der-km-${der.id}`,
            url: der.kmPhotoUrl,
            category: "ODOMETER",
            title: `${uName} - DER Odometer Photo`,
            subtitle: `DER KM Travelled: ${der.kmTravelled} KM`,
            userName: uName,
            userEmail: der.user?.email || "",
            userId: der.userId,
            createdAt: der.submittedAt ? der.submittedAt.toISOString() : der.date.toISOString(),
            extraInfo: `DER Visits: ${der.visitsSummary || "--"}`
          });
        }
      }
    }

    // 3. Expense Receipts
    if (category === "ALL" || category === "EXPENSE") {
      const expenses = await prisma.expense.findMany({
        where: {
          receiptUrl: { not: "" }
        },
        include: {
          user: { select: { id: true, name: true, email: true } }
        },
        orderBy: { date: "desc" }
      });

      for (const exp of expenses) {
        if (!exp.receiptUrl) continue;
        const uName = exp.user?.name || "Employee";
        mediaList.push({
          id: `exp-${exp.id}`,
          url: exp.receiptUrl,
          category: "EXPENSE",
          title: `${uName} - ${exp.category} Receipt`,
          subtitle: `Amount: ₹${exp.amount}`,
          userName: uName,
          userEmail: exp.user?.email || "",
          userId: exp.userId,
          createdAt: exp.date.toISOString(),
          extraInfo: exp.description || `Category: ${exp.category}`
        });
      }
    }

    // 4. Task Attachments & Completion Photos
    if (category === "ALL" || category === "TASK") {
      const tasks = await prisma.task.findMany({
        where: {
          OR: [
            { attachmentUrl: { not: null } },
            { completionPhotoUrl: { not: null } }
          ]
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: "desc" }
      });

      for (const task of tasks) {
        const uName = task.assignedTo?.name || "Staff";
        if (task.attachmentUrl) {
          mediaList.push({
            id: `task-att-${task.id}`,
            url: task.attachmentUrl,
            category: "TASK",
            title: `Task Attachment: ${task.title}`,
            subtitle: `Assigned: ${uName}`,
            userName: uName,
            userEmail: task.assignedTo?.email || "",
            userId: task.assignedToId || undefined,
            createdAt: task.createdAt.toISOString(),
            extraInfo: `Status: ${task.status}`
          });
        }

        if (task.completionPhotoUrl) {
          mediaList.push({
            id: `task-comp-${task.id}`,
            url: task.completionPhotoUrl,
            category: "TASK",
            title: `Task Completion Photo: ${task.title}`,
            subtitle: `Completed by: ${uName}`,
            userName: uName,
            userEmail: task.assignedTo?.email || "",
            userId: task.assignedToId || undefined,
            createdAt: task.completedAt ? task.completedAt.toISOString() : task.updatedAt.toISOString(),
            extraInfo: task.completionRemarks || `Status: ${task.status}`
          });
        }
      }
    }

    // Filter by Search Query
    let filtered = mediaList;
    if (search) {
      filtered = filtered.filter(
        (m) =>
          m.title.toLowerCase().includes(search) ||
          (m.userName && m.userName.toLowerCase().includes(search)) ||
          (m.userEmail && m.userEmail.toLowerCase().includes(search)) ||
          (m.subtitle && m.subtitle.toLowerCase().includes(search)) ||
          (m.extraInfo && m.extraInfo.toLowerCase().includes(search))
      );
    }

    // Filter by Date Range
    if (startDate) {
      const sDate = new Date(startDate + "T00:00:00.000Z").getTime();
      filtered = filtered.filter((m) => new Date(m.createdAt).getTime() >= sDate);
    }
    if (endDate) {
      const eDate = new Date(endDate + "T23:59:59.999Z").getTime();
      filtered = filtered.filter((m) => new Date(m.createdAt).getTime() <= eDate);
    }

    // Sort by createdAt desc
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedItems = filtered.slice(startIndex, startIndex + pageSize);

    res.json({
      success: true,
      data: paginatedItems,
      pagination: {
        page: currentPage,
        pageSize,
        totalCount,
        totalPages
      }
    });
  })
);

export default router;
