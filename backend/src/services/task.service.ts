import { Prisma, TaskStatus, UserRole } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { forbidden, notFound } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { ensureManagerCanUseEmployee } from "./access.service";
import * as notificationService from "./notification.service";

interface CreateTaskInput {
  title: string;
  description: string;
  assignedToId: string;
  dueDate: Date;
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
      lat,
      lng,
      priority: input.priority || "Medium",
      points: input.points || 0,
      isRepeating: input.isRepeating || false,
      repeatFrequency: input.repeatFrequency,
      repeatDays: input.repeatDays,
      repeatDates: input.repeatDates,
      skipHolidays: input.skipHolidays || false
    },
    include: taskInclude
  });

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
  const tasks = await prisma.task.findMany({
    where: taskAccessWhere(actor),
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
    if (task.assignedTo.managerId !== actor.id && task.assignedById !== actor.id) {
      forbidden("Insufficient permissions to update this task");
    }
  } else if (actor.role !== UserRole.SUPERADMIN && actor.role !== UserRole.ADMIN) {
    forbidden("Only admins and managers can update task details");
  }

  if (actor.role !== UserRole.SUPERADMIN && actor.role !== UserRole.ADMIN && task.assignedTo.companyId !== actor.companyId) {
    forbidden("Task is outside your company");
  }

  return prisma.task.update({
    where: { id: taskId },
    data: {
      title: input.title,
      description: input.description,
      status: input.status,
      dueDate: input.dueDate,
      assignedToId: input.assignedToId,
      lat: input.lat,
      lng: input.lng,
      priority: input.priority,
      points: input.points
    },
    include: taskInclude
  });
}

export async function deleteTask(actor: AuthUser, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedTo: {
        select: {
          id: true,
          managerId: true,
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
    if (task.assignedTo.managerId !== actor.id && task.assignedById !== actor.id) {
      forbidden("Insufficient permissions to delete this task");
    }
  } else if (actor.role !== UserRole.SUPERADMIN && actor.role !== UserRole.ADMIN) {
    forbidden("Only admins and managers can delete tasks");
  }

  if (actor.role !== UserRole.SUPERADMIN && actor.role !== UserRole.ADMIN && task.assignedTo.companyId !== actor.companyId) {
    forbidden("Task is outside your company");
  }

  return prisma.task.delete({
    where: { id: taskId }
  });
}

export async function updateTaskStatus(
  actor: AuthUser, 
  taskId: string, 
  status: TaskStatus, 
  completionData?: { photoUrl?: string; remarks?: string }
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedTo: {
        select: {
          id: true,
          managerId: true,
          companyId: true
        }
      }
    }
  });

  if (!task) {
    notFound("Task not found");
  }

  if (actor.role === UserRole.EMPLOYEE && task.assignedToId !== actor.id) {
    forbidden("Employees can only update their own tasks");
  }

  if (
    actor.role === UserRole.MANAGER &&
    task.assignedTo.managerId !== actor.id &&
    task.assignedById !== actor.id
  ) {
    forbidden("Managers can only update team tasks");
  }

  if (actor.role !== UserRole.SUPERADMIN && actor.role !== UserRole.ADMIN && task.assignedTo.companyId !== actor.companyId) {
    forbidden("Task is outside your company");
  }

  const data: Prisma.TaskUpdateInput = { status };

  if (status === TaskStatus.COMPLETED && completionData) {
    data.completionPhotoUrl = completionData.photoUrl;
    data.completionRemarks = completionData.remarks;
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
    const nextDueDate = await calculateNextOccurrence(updatedTask);

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
        points: updatedTask.points
      }
    });
  }

  return updatedTask;
}

function taskAccessWhere(actor: AuthUser): Prisma.TaskWhereInput {
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
    return {
      assignedTo: {
        companyId: actor.companyId,
        managerId: actor.id
      }
    };
  }

  return {
    assignedToId: actor.id
  };
}

async function calculateNextOccurrence(task: any) {
  let next = new Date(task.dueDate);
  next.setHours(0, 0, 0, 0);

  const frequency = task.repeatFrequency;
  const days = task.repeatDays;
  const dates = task.repeatDates;
  const skipHolidays = task.skipHolidays;

  if (frequency === 'DAILY') {
    next.setDate(next.getDate() + 1);
  } else if (frequency === 'WEEKLY' && days) {
    const allowedDays = days.split(',').map(Number); // 0-6
    let count = 0;
    do {
      next.setDate(next.getDate() + 1);
      count++;
    } while (!allowedDays.includes(next.getDay()) && count < 8);
  } else if (frequency === 'MONTHLY' && dates) {
    const allowedDates = dates.split(',').map(Number); // 1-31
    let count = 0;
    do {
      next.setDate(next.getDate() + 1);
      count++;
    } while (!allowedDates.includes(next.getDate()) && count < 32);
  } else {
    // Fallback
    if (frequency === 'DAILY') next.setDate(next.getDate() + 1);
    else if (frequency === 'WEEKLY') next.setDate(next.getDate() + 7);
    else if (frequency === 'MONTHLY') next.setMonth(next.getMonth() + 1);
  }

  if (skipHolidays) {
    let isHoliday = true;
    let iterations = 0;
    while (isHoliday && iterations < 30) {
      const holiday = await prisma.holiday.findFirst({
        where: {
          companyId: task.assignedTo.companyId,
          date: {
            gte: new Date(next.setHours(0,0,0,0)),
            lt: new Date(next.setHours(23,59,59,999))
          }
        }
      });
      if (holiday) {
        next.setDate(next.getDate() + 1);
      } else {
        isHoliday = false;
      }
      iterations++;
    }
  }

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
  }
} satisfies Prisma.TaskInclude;
