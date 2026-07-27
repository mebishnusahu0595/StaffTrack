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
  const periodsData = generatePeriodsData(Number(targetQuantity) || 0, targetType, start);

  // Create assignments for assigned users
  if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
    for (const userId of assignedUserIds) {
      await prisma.projectAssignment.create({
        data: {
          projectId: project.id,
          userId,
          targetQuantity: Number(targetQuantity) || 0,
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
              effectiveTarget: p.baseTarget,
              completedCount: 0
            }))
          }
        }
      });
    }
  }

  return getProjectById(project.id);
}

export async function syncProjectPeriods(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      assignments: {
        include: {
          periods: { orderBy: { periodIndex: "asc" } }
        }
      }
    }
  });

  if (!project) return;

  const targetType = String(project.targetType || "YEARLY").trim().toUpperCase();
  const expectedCount = targetType === "YEARLY" ? 12 : targetType === "MONTHLY" ? 4 : 1;
  const startDate = project.startDate ? new Date(project.startDate) : new Date();

  for (const assignment of project.assignments) {
    if (assignment.targetQuantity !== project.targetQuantity) {
      await prisma.projectAssignment.update({
        where: { id: assignment.id },
        data: { targetQuantity: project.targetQuantity }
      });
    }

    const sumBaseTargets = assignment.periods.reduce((acc, p) => acc + p.baseTarget, 0);
    const countMismatch = assignment.periods.length !== expectedCount;
    const targetMismatch = project.targetQuantity > 0 && sumBaseTargets !== project.targetQuantity;

    if (countMismatch || targetMismatch) {
      const totalCompleted = assignment.completedCount || 0;
      await prisma.projectPeriodProgress.deleteMany({ where: { assignmentId: assignment.id } });

      const newPeriods = generatePeriodsData(project.targetQuantity, targetType, startDate);
      let runningCarryover = 0;

      for (let i = 0; i < newPeriods.length; i++) {
        const p = newPeriods[i];
        const periodCompleted = i === 0 ? totalCompleted : 0;
        const currentCarryover = runningCarryover;
        const currentEffective = p.baseTarget + currentCarryover;
        const shortfall = Math.max(0, currentEffective - periodCompleted);
        runningCarryover = shortfall;

        await prisma.projectPeriodProgress.create({
          data: {
            assignmentId: assignment.id,
            periodIndex: p.periodIndex,
            periodType: p.periodType,
            periodName: p.periodName,
            startDate: p.startDate,
            endDate: p.endDate,
            baseTarget: p.baseTarget,
            carryover: currentCarryover,
            effectiveTarget: currentEffective,
            completedCount: periodCompleted,
            isCompleted: periodCompleted >= currentEffective
          }
        });
      }
    }
  }
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

  const projects = await prisma.project.findMany({
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

  // Auto-sync any existing project whose period counts or target mismatch
  let needsReFetch = false;
  for (const project of projects) {
    const targetType = String(project.targetType || "YEARLY").trim().toUpperCase();
    const expectedCount = targetType === "YEARLY" ? 12 : targetType === "MONTHLY" ? 4 : 1;
    for (const assignment of project.assignments) {
      const sumBaseTargets = assignment.periods.reduce((acc, p) => acc + p.baseTarget, 0);
      const countMismatch = assignment.periods.length !== expectedCount;
      const targetMismatch = project.targetQuantity > 0 && sumBaseTargets !== project.targetQuantity;
      const qtyMismatch = assignment.targetQuantity !== project.targetQuantity;

      if (countMismatch || targetMismatch || qtyMismatch) {
        await syncProjectPeriods(project.id);
        needsReFetch = true;
        break;
      }
    }
  }

  if (needsReFetch) {
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

  return projects;
}

export async function getProjectById(projectId: string) {
  let project = await prisma.project.findUnique({
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

  if (project) {
    const targetType = String(project.targetType || "YEARLY").trim().toUpperCase();
    const expectedCount = targetType === "YEARLY" ? 12 : targetType === "MONTHLY" ? 4 : 1;
    let hasMismatch = false;

    for (const assignment of project.assignments) {
      const sumBaseTargets = assignment.periods.reduce((acc, p) => acc + p.baseTarget, 0);
      const countMismatch = assignment.periods.length !== expectedCount;
      const targetMismatch = project.targetQuantity > 0 && sumBaseTargets !== project.targetQuantity;
      const qtyMismatch = assignment.targetQuantity !== project.targetQuantity;

      if (countMismatch || targetMismatch || qtyMismatch) {
        hasMismatch = true;
        break;
      }
    }

    if (hasMismatch) {
      await syncProjectPeriods(project.id);
      project = await prisma.project.findUnique({
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
  }

  return project;
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

function generatePeriodsData(qty: number, targetType: string, start: Date) {
  const periodsData: Array<{
    periodIndex: number;
    periodType: string;
    periodName: string;
    startDate: Date;
    endDate: Date;
    baseTarget: number;
  }> = [];

  const type = String(targetType || "YEARLY").trim().toUpperCase();

  if (type === "YEARLY") {
    const monthlyBase = Math.max(0, Math.floor(qty / 12));
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
        baseTarget: monthBase
      });
    }
  } else if (type === "MONTHLY") {
    const weeklyBase = Math.max(0, Math.floor(qty / 4));
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
        baseTarget: weekBase
      });
    }
  } else {
    // WEEKLY
    periodsData.push({
      periodIndex: 1,
      periodType: "WEEKLY",
      periodName: `Week 1 (${format(start, "d MMM")})`,
      startDate: start,
      endDate: addWeeks(start, 1),
      baseTarget: qty
    });
  }

  return periodsData;
}

export async function updateProject(arg1: any, arg2: any, arg3?: any) {
  const projectId = typeof arg1 === "string" ? arg1 : arg2;
  const data = typeof arg1 === "string" ? arg2 : arg3;

  const existingProject = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      assignments: {
        include: {
          periods: { orderBy: { periodIndex: "asc" } }
        }
      }
    }
  });

  if (!existingProject) {
    throw new Error("Project not found");
  }

  const updatedTargetQty = data.targetQuantity !== undefined ? Number(data.targetQuantity) : existingProject.targetQuantity;
  const updatedTargetType = data.targetType || existingProject.targetType;
  const startDate = data.startDate ? new Date(data.startDate) : (existingProject.startDate ? new Date(existingProject.startDate) : new Date());

  await prisma.project.update({
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
      targetQuantity: updatedTargetQty,
      targetType: updatedTargetType,
      productName: data.productName !== undefined ? data.productName : undefined,
      productPrice: data.productPrice !== undefined ? Number(data.productPrice) : undefined
    }
  });

  const newPeriods = generatePeriodsData(updatedTargetQty, updatedTargetType, startDate);

  // Sync assigned users if assignedUserIds was provided in payload
  const assignedUserIds: string[] | undefined = Array.isArray(data.assignedUserIds) ? data.assignedUserIds : undefined;
  const existingAssignments = existingProject.assignments;
  const existingAssignedUserIds = existingAssignments.map((a) => a.userId);
  const targetUserIds = assignedUserIds || existingAssignedUserIds;

  // Unassign users that were removed
  if (assignedUserIds) {
    for (const assignment of existingAssignments) {
      if (!assignedUserIds.includes(assignment.userId)) {
        await prisma.projectPeriodProgress.deleteMany({ where: { assignmentId: assignment.id } });
        await prisma.projectAssignment.delete({ where: { id: assignment.id } });
      }
    }
  }

  // Update existing assignments or create new assignments for target user IDs
  for (const userId of targetUserIds) {
    let assignment = existingAssignments.find((a) => a.userId === userId);

    if (!assignment) {
      await prisma.projectAssignment.create({
        data: {
          projectId,
          userId,
          targetQuantity: updatedTargetQty,
          completedCount: 0,
          periods: {
            create: newPeriods.map((p) => ({
              periodIndex: p.periodIndex,
              periodType: p.periodType,
              periodName: p.periodName,
              startDate: p.startDate,
              endDate: p.endDate,
              baseTarget: p.baseTarget,
              carryover: 0,
              effectiveTarget: p.baseTarget,
              completedCount: 0
            }))
          }
        }
      });
    } else {
      // Update targetQuantity on assignment
      await prisma.projectAssignment.update({
        where: { id: assignment.id },
        data: { targetQuantity: updatedTargetQty }
      });

      const existingPeriods = assignment.periods;
      const targetTypeChanged = existingProject.targetType !== updatedTargetType;

      if (existingPeriods.length !== newPeriods.length || targetTypeChanged) {
        // Target type changed (e.g. MONTHLY -> YEARLY), re-create periods preserving completed sales
        const totalCompleted = assignment.completedCount || 0;
        await prisma.projectPeriodProgress.deleteMany({ where: { assignmentId: assignment.id } });
        
        let runningCarryover = 0;
        for (let i = 0; i < newPeriods.length; i++) {
          const p = newPeriods[i];
          const periodCompleted = i === 0 ? totalCompleted : 0;
          const currentCarryover = runningCarryover;
          const currentEffective = p.baseTarget + currentCarryover;
          const shortfall = Math.max(0, currentEffective - periodCompleted);
          runningCarryover = shortfall;

          await prisma.projectPeriodProgress.create({
            data: {
              assignmentId: assignment.id,
              periodIndex: p.periodIndex,
              periodType: p.periodType,
              periodName: p.periodName,
              startDate: p.startDate,
              endDate: p.endDate,
              baseTarget: p.baseTarget,
              carryover: currentCarryover,
              effectiveTarget: currentEffective,
              completedCount: periodCompleted,
              isCompleted: periodCompleted >= currentEffective
            }
          });
        }
      } else {
        // Same period count and target type, update baseTargets and recalculate carryover cascade!
        let runningCarryover = 0;
        for (let i = 0; i < newPeriods.length; i++) {
          const np = newPeriods[i];
          const ep = existingPeriods[i];

          const currentCompleted = ep ? ep.completedCount : 0;
          const currentCarryover = runningCarryover;
          const currentEffective = np.baseTarget + currentCarryover;
          const shortfall = Math.max(0, currentEffective - currentCompleted);
          runningCarryover = shortfall;

          if (ep) {
            await prisma.projectPeriodProgress.update({
              where: { id: ep.id },
              data: {
                periodName: np.periodName,
                startDate: np.startDate,
                endDate: np.endDate,
                baseTarget: np.baseTarget,
                carryover: currentCarryover,
                effectiveTarget: currentEffective,
                isCompleted: currentCompleted >= currentEffective
              }
            });
          }
        }
      }
    }
  }

  return getProjectById(projectId);
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
