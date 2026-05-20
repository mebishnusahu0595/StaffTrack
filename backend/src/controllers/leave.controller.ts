import type { Request, Response } from "express";
import * as leaveService from "../services/leave.service";
import { leaveSetupService } from "../services/leave-setup.service";
import { sendSuccess } from "../lib/response";

export async function createLeaveRequest(req: Request, res: Response) {
  const result = await leaveService.createLeaveRequest(
    req.user!.id,
    req.user!.companyId,
    req.body
  );
  sendSuccess(res, result, "Leave request submitted", 201);
}

export async function listLeaveRequests(req: Request, res: Response) {
  const result = await leaveService.listLeaveRequests(req.user!.companyId, req.query);
  sendSuccess(res, result, "Leave requests fetched");
}

export async function updateLeaveStatus(req: Request, res: Response) {
  const { status } = req.body;
  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw new Error("Invalid status");
  }
  const result = await leaveService.updateLeaveStatus(req.params.id, req.user!.id, status);
  sendSuccess(res, result, `Leave request ${status.toLowerCase()}`);
}

export async function createLeaveType(req: Request, res: Response) {
  const result = await leaveSetupService.createLeaveType(req.user!, req.body);
  sendSuccess(res, result, "Leave type created successfully", 201);
}

export async function listLeaveTypes(req: Request, res: Response) {
  const result = await leaveSetupService.getLeaveTypes(req.user!);
  sendSuccess(res, result, "Leave types fetched successfully");
}

export async function listHolidayTemplates(req: Request, res: Response) {
  const result = await leaveSetupService.getHolidayTemplates(req.user!);
  sendSuccess(res, result, "Holiday templates fetched successfully");
}

export async function createHolidayTemplate(req: Request, res: Response) {
  const result = await leaveSetupService.createHolidayTemplate(req.user!, req.body);
  sendSuccess(res, result, "Holiday template created successfully", 201);
}

export async function assignHolidayTemplate(req: Request, res: Response) {
  const { templateId, userIds } = req.body;
  const result = await leaveSetupService.assignHolidayTemplate(req.user!, templateId, userIds);
  sendSuccess(res, result, "Holiday template assigned successfully");
}

