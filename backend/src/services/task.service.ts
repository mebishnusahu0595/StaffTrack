import { Prisma, TaskStatus, UserRole } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { forbidden, notFound } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { ensureManagerCanUseEmployee, getManagerGroupId } from "./access.service";
import * as notificationService from "./notification.service";

interface CreateTaskInput {
  title: string;
  description?: string | null;
  assignedToId: string;
  dueDate: Date;
  startDate?: Date | null;
  endDate?: Date | null;
  location?: {
    lat: number;
    lng: number;
  };
  lat?: number;
  lng?: number;
  priority?: string;
  points?: number;
  isRepeating?: boolean;
  repeatFrequency?: string;
  repeatDays?: string;
  repeatDates?: string;
  skipHolidays?: boolean;
  isSubtask?: boolean;
  validations?: any;
  checklist?: any;
  checklistResponses?: any;
  geofenceLat?: number | null;
  geofenceLng?: number | null;
  geofenceRadius?: number | null;
  reminder?: number | null;
  subtasks?: any[];
  projectId?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

export async function createTask(actor: AuthUser, input: CreateTaskInput) {
  await ensureManagerCanUseEmployee(actor, input.assignedToId);

  const lat = input.location?.lat ?? input.lat;
  const lng = input.location?.lng ?? input.lng;

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      assignedToId: input.assignedToId,
      assignedById: actor.id,
      dueDate: input.dueDate,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      lat,
      lng,
      priority: input.priority || "Medium",
      points: input.points || 0,
      isRepeating: input.isRepeating || false,
      repeatFrequency: input.repeatFrequency,
      repeatDays: input.repeatDays,
      repeatDates: input.repeatDates,
      skipHolidays: input.skipHolidays || false,
      isSubtask: input.isSubtask || false,
      validations: input.validations || null,
      checklist: input.checklist || null,
      checklistResponses: input.checklistResponses || null,
      geofenceLat: input.geofenceLat,
      geofenceLng: input.geofenceLng,
      geofenceRadius: input.geofenceRadius,
      reminder: input.reminder,
      projectId: input.projectId || null,
      attachmentUrl: input.attachmentUrl,
      attachmentName: input.attachmentName
    },
    include: taskInclude
  });

  // If subtasks are provided, create them linked to the parent task
  if (input.subtasks && input.subtasks.length > 0) {
    for (const sub of input.subtasks) {
      await prisma.task.create({
        data: {
          title: sub.title || sub.name || "",
          description: sub.description || "",
          assignedToId: sub.assignedToId || input.assignedToId,
          assignedById: actor.id,
          dueDate: sub.endDate ? new Date(sub.endDate) : (sub.dueDate ? new Date(sub.dueDate) : input.dueDate),
          startDate: sub.startDate ? new Date(sub.startDate) : (input.startDate ? new Date(input.startDate) : null),
          endDate: sub.endDate ? new Date(sub.endDate) : (input.endDate ? new Date(input.endDate) : null),
          lat: sub.lat || null,
          lng: sub.lng || null,
          priority: sub.priority || "Medium",
          points: sub.points || 0,
          isRepeating: false,
          isSubtask: true,
          parentTaskId: task.id,
          validations: sub.validations || null,
          checklist: sub.checklist || null,
          geofenceLat: sub.geofenceLat || null,
          geofenceLng: sub.geofenceLng || null,
          geofenceRadius: sub.geofenceRadius || null,
          reminder: sub.reminder || null
        }
      });
    }
  }

  // If task is repeating, pre-generate occurrences up to 180 days horizon
  if (task.isRepeating) {
    await preGenerateTasksForSeries(task, actor.companyId);
  }

  // Notify employee
  await notificationService.createNotification(
    task.assignedToId,
    "New Task Assigned",
    `You have been assigned a new task: ${task.title}. Due on ${input.dueDate.toLocaleDateString()}`,
    "TASK_ASSIGNED"
  );

  return task;
}

export async function listTasks(actor: AuthUser) {
  // Automatically rollover overdue pending / in_progress tasks to today's date for this user's company
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const rolloverWhere: Prisma.TaskWhereInput = {
    status: {
      in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
    },
    dueDate: {
      lt: todayStart
    }
  };

  if (actor.role !== UserRole.SUPERADMIN) {
    rolloverWhere.assignedTo = {
      companyId: actor.companyId
    };
  }

  const overdueTasks = await prisma.task.findMany({
    where: rolloverWhere
  });

  if (overdueTasks.length > 0) {
    await prisma.task.updateMany({
      where: {
        id: {
          in: overdueTasks.map(t => t.id)
        }
      },
      data: {
        dueDate: todayStart,
        points: 0
      }
    });
  }

  const tasks = await prisma.task.findMany({
    where: await taskAccessWhere(actor),
    include: taskInclude,
    orderBy: { createdAt: "desc" }
  });

  // Check for tasks due today and create notifications if they don't exist
  if (actor.role === UserRole.EMPLOYEE) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueToday = tasks.filter(t => 
      t.status === TaskStatus.PENDING && 
      t.dueDate >= today && 
      t.dueDate < tomorrow
    );

    for (const task of dueToday) {
      // Check if notification already exists for this task today
      const existing = await prisma.notification.findFirst({
        where: {
          userId: actor.id,
          type: "TASK_DUE_TODAY",
          message: { contains: task.title },
          createdAt: { gte: today }
        }
      });

      if (!existing) {
        await notificationService.createNotification(
          actor.id,
          "Task Due Today",
          `Your task "${task.title}" is due today. Please complete it.`,
          "TASK_DUE_TODAY"
        );
      }
    }

    const carryForwardTasks = tasks.filter(
      (task) =>
        task.status !== TaskStatus.COMPLETED &&
        task.status !== TaskStatus.CANCELLED &&
        task.dueDate < today
    );

    for (const task of carryForwardTasks) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: actor.id,
          type: "TASK_PENDING_CARRY_FORWARD",
          message: { contains: task.title },
          createdAt: { gte: today }
        }
      });

      if (!existing) {
        await notificationService.createNotification(
          actor.id,
          "Pending Task From Yesterday",
          `Your task "${task.title}" is still pending from yesterday and has been carried forward.`,
          "TASK_PENDING_CARRY_FORWARD"
        );
      }
    }
  }

  return tasks;
}

export async function updateTask(actor: AuthUser, taskId: string, input: Partial<CreateTaskInput> & { status?: TaskStatus }) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedTo: {
        select: {
          id: true,
          managerId: true,
          groupId: true,
          companyId: true
        }
      }
    }
  });

  if (!task) {
    notFound("Task not found");
  }

  // Security checks
  if (actor.role === UserRole.MANAGER) {
    const managerGroupId = await getManagerGroupId(actor.id);
    const isDirectReport = task.assignedTo.managerId === actor.id;
    const isInGroup = managerGroupId && task.assignedTo.groupId === managerGroupId;
    const isCreator = task.assignedById === actor.id;
    if (!isDirectReport && !isInGroup && !isCreator) {
      forbidden("Insufficient permissions to update this task");
    }
  } else if (actor.role !== UserRole.SUPERADMIN && actor.role !== UserRole.ADMIN) {
    forbidden("Only admins and managers can update task details");
  }

  if (actor.role !== UserRole.SUPERADMIN && actor.role !== UserRole.ADMIN && task.assignedTo.companyId !== actor.companyId) {
    forbidden("Task is outside your company");
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: input.title,
      description: input.description,
      status: input.status,
      dueDate: input.dueDate,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      assignedToId: input.assignedToId,
      lat: input.lat,
      lng: input.lng,
      isRepeating: input.isRepeating,
      repeatFrequency: input.repeatFrequency,
      repeatDays: input.repeatDays,
      repeatDates: input.repeatDates,
      skipHolidays: input.skipHolidays,
      priority: input.priority,
      points: input.points,
      isSubtask: input.isSubtask,
      validations: input.validations,
      checklist: input.checklist,
      checklistResponses: input.checklistResponses,
      geofenceLat: input.geofenceLat,
      geofenceLng: input.geofenceLng,
      geofenceRadius: input.geofenceRadius,
      reminder: input.reminder,
      projectId: input.projectId !== undefined ? input.projectId : undefined,
      attachmentUrl: input.attachmentUrl,
      attachmentName: input.attachmentName
    },
    include: taskInclude
  });

  // If this task is part of a repeating series, propagate updates to all future pending child tasks
  if (updatedTask.isRepeating) {
    const parentId = updatedTask.parentTaskId || updatedTask.id;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    await prisma.task.updateMany({
      where: {
        parentTaskId: parentId,
        status: TaskStatus.PENDING,
        dueDate: { gte: todayStart }
      },
      data: {
        title: updatedTask.title,
        description: updatedTask.description,
        priority: updatedTask.priority,
        points: updatedTask.points,
        lat: updatedTask.lat,
        lng: updatedTask.lng
      }
    });

    const repeatChanged = 
      input.repeatFrequency !== undefined || 
      input.repeatDays !== undefined || 
      input.repeatDates !== undefined ||
      input.skipHolidays !== undefined;

    if (repeatChanged) {
      // Clear future pending ones and re-generate
      await prisma.task.deleteMany({
        where: {
          parentTaskId: parentId,
          status: TaskStatus.PENDING,
          dueDate: { gte: todayStart }
        }
      });
      await preGenerateTasksForSeries(updatedTask, actor.companyId);
    }
  }

  // Notify employee that task has been updated/re-assigned
  if (task.assignedToId !== updatedTask.assignedToId) {
    // Notify the old assignee
    try {
      await notificationService.createNotification(
        task.assignedToId,
        "Task Unassigned",
        `You have been unassigned from task: ${task.title}.`,
        "TASK_UNASSIGNED"
      );
    } catch (err) {
      console.error("Failed to send task unassigned notification:", err);
    }
    
    // Notify the new assignee
    try {
      await notificationService.createNotification(
        updatedTask.assignedToId,
        "New Task Assigned",
        `You have been assigned a new task: ${updatedTask.title}. Due on ${new Date(updatedTask.dueDate).toLocaleDateString()}`,
        "TASK_ASSIGNED"
      );
    } catch (err) {
      console.error("Failed to send task assigned notification:", err);
    }
  } else if (updatedTask.assignedToId && actor.id !== updatedTask.assignedToId) {
    try {
      await notificationService.createNotification(
        updatedTask.assignedToId,
        "Task Updated",
        `Task "${updatedTask.title}" has been updated by the manager.`,
        "TASK_UPDATED"
      );
    } catch (err) {
      console.error("Failed to send task update notification:", err);
    }
  }

  return updatedTask;
}

export async function deleteTask(actor: AuthUser, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedTo: {
        select: {
          id: true,
          managerId: true,
          groupId: true,
          companyId: true
        }
      }
    }
  });

  if (!task) {
    notFound("Task not found");
  }

  // Security checks
  if (actor.role === UserRole.MANAGER) {
    const managerGroupId = await getManagerGroupId(actor.id);
    const isDirectReport = task.assignedTo.managerId === actor.id;
    const isInGroup = managerGroupId && task.assignedTo.groupId === managerGroupId;
    const isCreator = task.assignedById === actor.id;
    if (!isDirectReport && !isInGroup && !isCreator) {
      forbidden("Insufficient permissions to delete this task");
    }
  } else if (actor.role !== UserRole.SUPERADMIN && actor.role !== UserRole.ADMIN) {
    forbidden("Only admins and managers can delete tasks");
  }

  if (actor.role !== UserRole.SUPERADMIN && actor.role !== UserRole.ADMIN && task.assignedTo.companyId !== actor.companyId) {
    forbidden("Task is outside your company");
  }

  // If this task has a series, clean up all future pending child occurrences
  const parentId = task.parentTaskId || task.id;
  await prisma.task.deleteMany({
    where: {
      parentTaskId: parentId,
      status: TaskStatus.PENDING,
      dueDate: { gte: new Date() }
    }
  });

  return prisma.task.delete({
    where: { id: taskId }
  });
}

export async function updateTaskStatus(
  actor: AuthUser, 
  taskId: string, 
  status: TaskStatus, 
  completionData?: { photoUrl?: string; remarks?: string; lat?: number; lng?: number; checklistResponses?: any }
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedTo: {
        select: {
          id: true,
          managerId: true,
          groupId: true,
          companyId: true
        }
      }
    }
  });

  if (!task) {
    notFound("Task not found");
  }

  if (task.assignedToId === actor.id) {
    // Assigned to the user themselves, so they can update it
  } else if (actor.role === UserRole.EMPLOYEE) {
    forbidden("Employees can only update their own tasks");
  } else if (actor.role === UserRole.MANAGER) {
    const managerGroupIdForStatus = await getManagerGroupId(actor.id);
    if (
      task.assignedTo.managerId !== actor.id &&
      !(managerGroupIdForStatus && task.assignedTo.groupId === managerGroupIdForStatus) &&
      task.assignedById !== actor.id
    ) {
      forbidden("Managers can only update team tasks");
    }
  }

  if (actor.role !== UserRole.SUPERADMIN && actor.role !== UserRole.ADMIN && task.assignedTo.companyId !== actor.companyId) {
    forbidden("Task is outside your company");
  }

  const data: Prisma.TaskUpdateInput = { status };

  if (status === TaskStatus.COMPLETED && completionData) {
    data.completionPhotoUrl = completionData.photoUrl;
    data.completionRemarks = completionData.remarks;
    data.completionLat = completionData.lat;
    data.completionLng = completionData.lng;
    if (completionData.checklistResponses !== undefined) {
      data.checklistResponses = completionData.checklistResponses;
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data,
    include: taskInclude
  });

  // Notify creator if completed
  if (status === TaskStatus.COMPLETED) {
    await notificationService.createNotification(
      updatedTask.assignedById,
      "Task Completed",
      `${updatedTask.assignedTo.name} has completed the task: ${updatedTask.title}`,
      "TASK_COMPLETED"
    );
  }

  // Handle repeating tasks
  if (status === TaskStatus.COMPLETED && updatedTask.isRepeating && updatedTask.repeatFrequency) {
    const parentId = updatedTask.parentTaskId || updatedTask.id;
    const nextDueDate = await calculateNextOccurrence(updatedTask);

    // Check if next occurrence already exists in series
    const existingNext = await prisma.task.findFirst({
      where: {
        OR: [
          { id: parentId },
          { parentTaskId: parentId }
        ],
        dueDate: {
          gte: new Date(new Date(nextDueDate).setUTCHours(0, 0, 0, 0)),
          lte: new Date(new Date(nextDueDate).setUTCHours(23, 59, 59, 999))
        }
      }
    });

    if (!existingNext) {
      await prisma.task.create({
        data: {
          title: updatedTask.title,
          description: updatedTask.description,
          assignedToId: updatedTask.assignedToId,
          assignedById: updatedTask.assignedById,
          dueDate: nextDueDate,
          lat: updatedTask.lat,
          lng: updatedTask.lng,
          isRepeating: true,
          repeatFrequency: updatedTask.repeatFrequency,
          repeatDays: updatedTask.repeatDays,
          repeatDates: updatedTask.repeatDates,
          skipHolidays: updatedTask.skipHolidays,
          priority: updatedTask.priority,
          points: updatedTask.points,
          parentTaskId: parentId
        }
      });
    }
  }

  return updatedTask;
}

async function taskAccessWhere(actor: AuthUser): Promise<Prisma.TaskWhereInput> {
  if (actor.role === UserRole.SUPERADMIN) {
    return {};
  }

  if (actor.role === UserRole.ADMIN) {
    return {
      assignedTo: {
        companyId: actor.companyId
      }
    };
  }

  if (actor.role === UserRole.MANAGER) {
    // Managers see tasks of their direct reports / group members, tasks they
    // created, and their own tasks — not every employee in the company.
    const managerGroupId = await getManagerGroupId(actor.id);
    return {
      assignedTo: { companyId: actor.companyId },
      OR: [
        { assignedTo: { managerId: actor.id } },
        ...(managerGroupId ? [{ assignedTo: { groupId: managerGroupId } }] : []),
        { assignedById: actor.id },
        { assignedToId: actor.id }
      ]
    };
  }

  return {
    assignedToId: actor.id
  };
}

async function preGenerateTasksForSeries(baseTask: any, companyId: string) {
  const horizonDays = 180;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + horizonDays);

  let currentTaskState = {
    dueDate: new Date(baseTask.dueDate),
    repeatFrequency: baseTask.repeatFrequency,
    repeatDays: baseTask.repeatDays,
    repeatDates: baseTask.repeatDates,
    skipHolidays: baseTask.skipHolidays,
    assignedTo: { companyId }
  };

  const tasksToCreate = [];

  while (true) {
    const nextDueDate = await calculateNextOccurrence(currentTaskState);
    if (nextDueDate > maxDate) {
      break;
    }

    tasksToCreate.push({
      title: baseTask.title,
      description: baseTask.description,
      assignedToId: baseTask.assignedToId,
      assignedById: baseTask.assignedById,
      dueDate: new Date(nextDueDate),
      lat: baseTask.lat,
      lng: baseTask.lng,
      isRepeating: true,
      repeatFrequency: baseTask.repeatFrequency,
      repeatDays: baseTask.repeatDays,
      repeatDates: baseTask.repeatDates,
      skipHolidays: baseTask.skipHolidays,
      priority: baseTask.priority,
      points: baseTask.points,
      parentTaskId: baseTask.id,
      attachmentUrl: baseTask.attachmentUrl,
      attachmentName: baseTask.attachmentName
    });

    // Move state to next occurrence
    currentTaskState.dueDate = new Date(nextDueDate);
  }

  if (tasksToCreate.length > 0) {
    await prisma.task.createMany({
      data: tasksToCreate
    });
  }
}

async function calculateNextOccurrence(task: any) {
  let next = new Date(task.dueDate);
  next.setUTCHours(0, 0, 0, 0);

  const frequency = task.repeatFrequency;
  const days = task.repeatDays;
  const dates = task.repeatDates;
  const skipHolidays = task.skipHolidays;

  if (frequency === 'DAILY') {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (frequency === 'WEEKLY' && days) {
    const allowedDays = days.split(',').map(Number); // 0-6
    let count = 0;
    do {
      next.setUTCDate(next.getUTCDate() + 1);
      count++;
    } while (!allowedDays.includes(next.getUTCDay()) && count < 8);
  } else if (frequency === 'MONTHLY' && dates) {
    const allowedDates = dates.split(',').map(Number); // 1-31
    let count = 0;
    do {
      next.setUTCDate(next.getUTCDate() + 1);
      count++;
    } while (!allowedDates.includes(next.getUTCDate()) && count < 32);
  } else {
    // Fallback
    if (frequency === 'DAILY') next.setUTCDate(next.getUTCDate() + 1);
    else if (frequency === 'WEEKLY') next.setUTCDate(next.getUTCDate() + 7);
    else if (frequency === 'MONTHLY') next.setUTCMonth(next.getUTCMonth() + 1);
  }

  if (skipHolidays) {
    let isHoliday = true;
    let iterations = 0;
    while (isHoliday && iterations < 30) {
      next.setUTCHours(0, 0, 0, 0);
      const startOfDay = new Date(next.getTime());
      const endOfDay = new Date(next.getTime());
      endOfDay.setUTCHours(23, 59, 59, 999);

      const holiday = await prisma.holiday.findFirst({
        where: {
          companyId: task.assignedTo.companyId,
          date: {
            gte: startOfDay,
            lt: endOfDay
          }
        }
      });
      if (holiday) {
        next.setUTCDate(next.getUTCDate() + 1);
      } else {
        isHoliday = false;
      }
      iterations++;
    }
  }

  next.setUTCHours(0, 0, 0, 0);
  return next;
}

const taskInclude = {
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      companyId: true,
      managerId: true
    }
  },
  assignedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      companyId: true,
      managerId: true
    }
  },
  project: {
    select: {
      id: true,
      name: true,
      status: true
    }
  },
  subtasks: {
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          companyId: true,
          managerId: true
        }
      }
    }
  },
  parentTask: {
    select: {
      id: true,
      title: true
    }
  }
} satisfies Prisma.TaskInclude;
