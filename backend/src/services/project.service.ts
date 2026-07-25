import { prisma } from "../lib/prisma";
import { addMonths, addWeeks, addDays, startOfMonth, endOfMonth, format } from "date-fns";

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: string;
  priority?: string;
  targetType?: "YEARLY" | "MONTHLY" | "WEEKLY" | string;
  targetQuantity?: number;
  productName?: string;
  productPrice?: number;
  startDate?: string;
  endDate?: string;
  department?: string;
  clientName?: string;
  objectives?: string;
  tags?: string;
  budget?: number;
  deadline?: string;
  assignedUserIds?: string[];
  [key: string]: any;
}

export async function createProject(companyIdOrUser: any, input: CreateProjectInput) {
  const companyId = typeof companyIdOrUser === "string" ? companyIdOrUser : companyIdOrUser.companyId;
  const {
    name, description, status = "Ongoing", priority = "Medium",
    targetType = "YEARLY", targetQuantity = 0, productName, productPrice, startDate, endDate,
    department, clientName, objectives, tags, budget, deadline, assignedUserIds = []
  } = input;

  const start = startDate ? new Date(startDate) : new Date();
  let end: Date;
  if (endDate) {
    end = new Date(endDate);
  } else if (targetType === "YEARLY") {
    end = addMonths(start, 12);
  } else if (targetType === "MONTHLY") {
    end = addMonths(start, 1);
  } else {
    end = addWeeks(start, 1);
  }

  const project = await prisma.project.create({
    data: {
      companyId,
      name,
      description,
      status,
      priority,
      targetType,
      targetQuantity: Number(targetQuantity) || 0,
      productName: productName || undefined,
      productPrice: productPrice != null ? Number(productPrice) : 0,
      startDate: start,
      endDate: end,
      department,
      clientName,
      objectives,
      tags,
      budget: budget ? Number(budget) : undefined,
      deadline: deadline ? new Date(deadline) : undefined
    }
  });

  // Calculate periods per assignment
  const periodsData: Array<{
    periodIndex: number;
    periodType: string;
    periodName: string;
    startDate: Date;
    endDate: Date;
    baseTarget: number;
    carryover: number;
    effectiveTarget: number;
  }> = [];

  const qty = Number(targetQuantity) || 0;

  if (targetType === "YEARLY") {
    const monthlyBase = Math.max(1, Math.floor(qty / 12));
    const remainder = qty % 12;

    for (let i = 1; i <= 12; i++) {
      const periodStart = startOfMonth(addMonths(start, i - 1));
      const periodEnd = endOfMonth(periodStart);
      const monthBase = i === 12 ? monthlyBase + remainder : monthlyBase;

      periodsData.push({
        periodIndex: i,
        periodType: "MONTHLY",
        periodName: format(periodStart, "MMM yyyy"),
        startDate: periodStart,
        endDate: periodEnd,
        baseTarget: monthBase,
        carryover: 0,
        effectiveTarget: monthBase
      });
    }
  } else if (targetType === "MONTHLY") {
    const weeklyBase = Math.max(1, Math.floor(qty / 4));
    const remainder = qty % 4;

    for (let i = 1; i <= 4; i++) {
      const periodStart = addWeeks(start, i - 1);
      const periodEnd = addDays(periodStart, 6);
      const weekBase = i === 4 ? weeklyBase + remainder : weeklyBase;

      periodsData.push({
        periodIndex: i,
        periodType: "WEEKLY",
        periodName: `Week ${i} (${format(periodStart, "d MMM")})`,
        startDate: periodStart,
        endDate: periodEnd,
        baseTarget: weekBase,
        carryover: 0,
        effectiveTarget: weekBase
      });
    }
  } else {
    // WEEKLY
    periodsData.push({
      periodIndex: 1,
      periodType: "WEEKLY",
      periodName: `Week 1 (${format(start, "d MMM")})`,
      startDate: start,
      endDate: end,
      baseTarget: qty,
      carryover: 0,
      effectiveTarget: qty
    });
  }

  // Create assignments for assigned users
  if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
    for (const userId of assignedUserIds) {
      await prisma.projectAssignment.create({
        data: {
          projectId: project.id,
          userId,
          targetQuantity: qty,
          completedCount: 0,
          periods: {
            create: periodsData.map(p => ({
              periodIndex: p.periodIndex,
              periodType: p.periodType,
              periodName: p.periodName,
              startDate: p.startDate,
              endDate: p.endDate,
              baseTarget: p.baseTarget,
              carryover: 0,
              effectiveTarget: p.effectiveTarget,
              completedCount: 0
            }))
          }
        }
      });
    }
  }

  return getProjectById(project.id);
}

export async function listProjects(companyIdOrUser: any, search?: string) {
  const companyId = typeof companyIdOrUser === "string" ? companyIdOrUser : companyIdOrUser.companyId;
  const where: any = { companyId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { department: { contains: search, mode: "insensitive" } }
    ];
  }

  return prisma.project.findMany({
    where,
    include: {
      tasks: { select: { id: true, title: true, status: true, assignedTo: { select: { id: true, name: true } } } },
      assignments: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true, designation: true } },
          periods: { orderBy: { periodIndex: "asc" } }
        }
      },
      _count: { select: { tasks: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getProjectById(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: { select: { id: true, title: true, status: true, assignedTo: { select: { id: true, name: true } } } },
      assignments: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true, designation: true } },
          periods: { orderBy: { periodIndex: "asc" } }
        }
      },
      _count: { select: { tasks: true } }
    }
  });
}

export async function getUserProjects(userId: string) {
  const assignments = await prisma.projectAssignment.findMany({
    where: { userId },
    include: {
      project: true,
      periods: { orderBy: { periodIndex: "asc" } }
    },
    orderBy: { createdAt: "desc" }
  });

  return assignments.map(a => ({
    assignmentId: a.id,
    targetQuantity: a.targetQuantity,
    completedCount: a.completedCount,
    project: a.project,
    periods: a.periods
  }));
}

export async function updateProject(arg1: any, arg2: any, arg3?: any) {
  const projectId = typeof arg1 === "string" ? arg1 : arg2;
  const data = typeof arg1 === "string" ? arg2 : arg3;

  return prisma.project.update({
    where: { id: projectId },
    data: {
      name: data.name,
      description: data.description,
      status: data.status,
      priority: data.priority,
      department: data.department,
      clientName: data.clientName,
      objectives: data.objectives,
      tags: data.tags,
      budget: data.budget ? Number(data.budget) : undefined,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      targetQuantity: data.targetQuantity ? Number(data.targetQuantity) : undefined,
      targetType: data.targetType,
      productName: data.productName !== undefined ? data.productName : undefined,
      productPrice: data.productPrice !== undefined ? Number(data.productPrice) : undefined
    }
  });
}

export async function updatePeriodProgress(
  periodId: string,
  input: { completedIncrement?: number; completedCount?: number }
) {
  const period = await prisma.projectPeriodProgress.findUnique({
    where: { id: periodId },
    include: { assignment: { include: { periods: { orderBy: { periodIndex: "asc" } } } } }
  });

  if (!period) throw new Error("Period not found");

  let newCompleted = period.completedCount;
  if (input.completedIncrement !== undefined) {
    newCompleted = Math.max(0, period.completedCount + input.completedIncrement);
  } else if (input.completedCount !== undefined) {
    newCompleted = Math.max(0, input.completedCount);
  }

  // Update current period
  const isCompleted = newCompleted >= period.effectiveTarget;
  await prisma.projectPeriodProgress.update({
    where: { id: periodId },
    data: {
      completedCount: newCompleted,
      isCompleted
    }
  });

  // Re-fetch all periods of this assignment to recalculate carryover cascade
  const allPeriods = await prisma.projectPeriodProgress.findMany({
    where: { assignmentId: period.assignmentId },
    orderBy: { periodIndex: "asc" }
  });

  let runningCarryover = 0;
  let totalAssignmentCompleted = 0;

  for (let i = 0; i < allPeriods.length; i++) {
    const p = allPeriods[i];
    const currentCompleted = p.id === periodId ? newCompleted : p.completedCount;
    totalAssignmentCompleted += currentCompleted;

    const currentCarryover = runningCarryover;
    const currentEffective = p.baseTarget + currentCarryover;

    const shortfall = Math.max(0, currentEffective - currentCompleted);
    runningCarryover = shortfall; // Shortfall carries over to next period!

    if (p.carryover !== currentCarryover || p.effectiveTarget !== currentEffective) {
      await prisma.projectPeriodProgress.update({
        where: { id: p.id },
        data: {
          carryover: currentCarryover,
          effectiveTarget: currentEffective,
          isCompleted: currentCompleted >= currentEffective
        }
      });
    }
  }

  // Update total assignment completed count
  await prisma.projectAssignment.update({
    where: { id: period.assignmentId },
    data: { completedCount: totalAssignmentCompleted }
  });

  return prisma.projectAssignment.findUnique({
    where: { id: period.assignmentId },
    include: { project: true, periods: { orderBy: { periodIndex: "asc" } } }
  });
}

export async function deleteProject(arg1: any, arg2?: string) {
  const projectId = typeof arg1 === "string" ? arg1 : arg2;
  if (!projectId) throw new Error("Project ID is required");
  return prisma.project.delete({ where: { id: projectId } });
}
