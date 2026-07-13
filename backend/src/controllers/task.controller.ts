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
  const result = await taskService.listTasks(req.user!);
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
  await taskService.deleteTask(req.user!, req.params.id);
  
  // Emit WebSocket event
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.TASK_UPDATE, {
    type: "delete",
    data: { id: req.params.id }
  });

  sendSuccess(res, null, "Task deleted");
}

export async function bulkDeleteTasks(req: Request, res: Response): Promise<void> {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    sendSuccess(res, { count: 0 }, "No tasks specified for deletion");
    return;
  }
  const result = await taskService.bulkDeleteTasks(req.user!, ids);
  
  // Emit WebSocket event
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.TASK_UPDATE, {
    type: "bulk-delete",
    data: { ids }
  });

  sendSuccess(res, result, "Selected tasks deleted");
}
