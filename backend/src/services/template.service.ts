import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listTemplates(type?: string, search?: string) {
  return prisma.template.findMany({
    where: {
      type: type || undefined,
      name: search ? { contains: search, mode: "insensitive" } : undefined
    },
    include: {
      createdBy: {
        select: { name: true }
      }
    },
    orderBy: { usageCount: "desc" }
  });
}

export async function createTemplate(data: any) {
  return prisma.template.create({
    data: {
      ...data,
      data: typeof data.data === 'string' ? data.data : JSON.stringify(data.data)
    }
  });
}

export async function useTemplate(id: string) {
  return prisma.template.update({
    where: { id },
    data: { usageCount: { increment: 1 } }
  });
}

export async function updateTemplate(id: string, data: any) {
  const updatedTemplate = await prisma.template.update({
    where: { id },
    data: {
      ...data,
      data: typeof data.data === 'string' ? data.data : (data.data ? JSON.stringify(data.data) : undefined)
    }
  });

  // Update pending future tasks linked to this template
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  await prisma.task.updateMany({
    where: {
      templateId: id,
      status: "PENDING",
      dueDate: { gte: todayStart }
    },
    data: {
      title: updatedTemplate.name,
      description: updatedTemplate.description || updatedTemplate.name,
      priority: updatedTemplate.priority
    }
  });

  return updatedTemplate;
}

export async function deleteTemplateTasks(id: string, option: string) {
  let whereClause: any = { templateId: id };
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  if (option === "future") {
    whereClause.dueDate = { gte: todayStart };
  } else if (option === "past") {
    whereClause.dueDate = { lt: todayStart };
  } else if (option === "recent") {
    const last7Days = new Date(todayStart);
    last7Days.setDate(last7Days.getDate() - 7);
    whereClause.dueDate = { gte: last7Days, lt: todayStart };
  } else if (option === "all") {
    // leave as is
  } else {
    throw new Error("Invalid delete option");
  }

  return prisma.task.deleteMany({
    where: whereClause
  });
}

export async function deleteTemplate(id: string, deleteTasksOption?: string) {
  // When a template is deleted its tasks should be removed too, so they no longer
  // appear in the admin web or on the staff app. Default to deleting all linked
  // tasks unless the caller explicitly opts to keep them ("none").
  const option = deleteTasksOption || "all";
  if (option !== "none") {
    await deleteTemplateTasks(id, option);
  }
  return prisma.template.delete({
    where: { id }
  });
}

export async function cleanupTemplateDuplicates(id: string) {
  // Find all tasks for this template
  const tasks = await prisma.task.findMany({
    where: { templateId: id },
    select: { id: true, assignedToId: true, dueDate: true }
  });

  // Group by assignedToId and dueDate (date part only)
  const groupedTasks: Record<string, string[]> = {};
  for (const task of tasks) {
    const dateStr = task.dueDate.toISOString().split('T')[0];
    const key = `${task.assignedToId}_${dateStr}`;
    if (!groupedTasks[key]) {
      groupedTasks[key] = [];
    }
    groupedTasks[key].push(task.id);
  }

  // Find IDs to delete (keep the first one, delete the rest)
  const idsToDelete: string[] = [];
  for (const key in groupedTasks) {
    if (groupedTasks[key].length > 1) {
      // Keep first, delete the rest
      idsToDelete.push(...groupedTasks[key].slice(1));
    }
  }

  if (idsToDelete.length > 0) {
    return prisma.task.deleteMany({
      where: { id: { in: idsToDelete } }
    });
  }

  return { count: 0 };
}
