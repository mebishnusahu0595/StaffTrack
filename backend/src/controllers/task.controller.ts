import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response";
import * as taskService from "../services/task.service";
import { getIO, SOCKET_EVENTS } from "../lib/socket";

export async function createTask(req: Request, res: Response): Promise<void> {
  const result = await taskService.createTask(req.user!, req.body);
  
  // Emit WebSocket event
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.TASK_UPDATE, {
    type: "create",
    data: result
  });

  sendSuccess(res, result, "Task created", 201);
}

export async function listTasks(req: Request, res: Response): Promise<void> {
  const dateStr = req.query.date as string | undefined;
  const assignedToId = (req.query.assignedToId || req.query.userId) as string | undefined;
  const status = req.query.status as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

  const result = await taskService.listTasks(req.user!, { dateStr, assignedToId, status, limit });
  sendSuccess(res, result, "Tasks fetched");
}

export async function updateTaskStatus(req: Request, res: Response): Promise<void> {
  const result = await taskService.updateTaskStatus(req.user!, req.params.id, req.body.status, req.body.completionData);
  
  // Emit WebSocket event
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.TASK_UPDATE, {
    type: "status-update",
    data: result
  });

  sendSuccess(res, result, "Task status updated");
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const result = await taskService.updateTask(req.user!, req.params.id, req.body);
  
  // Emit WebSocket event
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.TASK_UPDATE, {
    type: "update",
    data: result
  });

  sendSuccess(res, result, "Task updated");
}

export async function deleteAllTasks(req: Request, res: Response): Promise<void> {
  const result = await taskService.deleteAllTasks(req.user!);

  // Emit WebSocket event so connected staff/admin clients clear their task lists.
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.TASK_UPDATE, {
    type: "delete-all",
    data: { count: result.count }
  });

  sendSuccess(res, result, "All tasks deleted");
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  const deleteAllSeries = req.query.deleteAllSeries !== "false";
  await taskService.deleteTask(req.user!, req.params.id, deleteAllSeries);
  
  // Emit WebSocket event
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.TASK_UPDATE, {
    type: "delete",
    data: { id: req.params.id }
  });

  sendSuccess(res, null, "Task deleted");
}

export async function bulkDeleteTasks(req: Request, res: Response): Promise<void> {
  const { ids, deleteAllSeries } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    sendSuccess(res, { count: 0 }, "No tasks specified for deletion");
    return;
  }
  const shouldDeleteAllSeries = deleteAllSeries !== false && req.query.deleteAllSeries !== "false";
  const result = await taskService.bulkDeleteTasks(req.user!, ids, shouldDeleteAllSeries);
  
  // Emit WebSocket event
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.TASK_UPDATE, {
    type: "bulk-delete",
    data: { ids }
  });

  sendSuccess(res, result, "Selected tasks deleted");
}

export async function deleteUserTasks(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { option } = req.query;
  const result = await taskService.deleteUserTasks(req.user!, userId, (option as string) || "all");

  // Emit WebSocket event
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.TASK_UPDATE, {
    type: "user-tasks-deleted",
    data: { userId }
  });

  sendSuccess(res, result, `Deleted ${result.count} tasks for user`);
}
