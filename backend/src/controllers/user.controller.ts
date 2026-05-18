import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response";
import * as userService from "../services/user.service";

export async function listUsers(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as { 
    page?: string; 
    pageSize?: string;
    search?: string;
    workMode?: any;
    role?: any;
  };
  
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 10);
  const workMode = query.workMode && query.workMode !== "ALL" ? query.workMode : undefined;
  
  const result = await userService.listUsers(
    req.user!, 
    page, 
    pageSize,
    query.search,
    workMode,
    query.role
  );
  sendSuccess(res, result, "Users fetched");
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const result = await userService.createUser(req.body);
  sendSuccess(res, result, "User created", 201);
}

export async function getUser(req: Request, res: Response): Promise<void> {
  const result = await userService.getUser(req.user!, req.params.id);
  sendSuccess(res, result, "User fetched");
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const result = await userService.updateUser(req.user!, req.params.id, req.body);
  sendSuccess(res, result, "User updated");
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const result = await userService.deleteUser(req.user!, req.params.id);
  sendSuccess(res, result, "User deleted");
}
