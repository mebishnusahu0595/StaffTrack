import type { Request, Response } from "express";
import { SalarySlipStatus } from "@prisma/client";
import * as salaryService from "../services/salary.service";
import { sendSuccess } from "../lib/response";

export async function listSalarySlips(req: Request, res: Response) {
  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  const result = await salaryService.listSalarySlips(req.user!, { userId, month, year });
  sendSuccess(res, result, "Salary slips fetched");
}

export async function getSalarySlip(req: Request, res: Response) {
  const result = await salaryService.getSalarySlip(req.user!, req.params.id);
  sendSuccess(res, result, "Salary slip fetched");
}

export async function upsertSalarySlip(req: Request, res: Response) {
  const result = await salaryService.upsertSalarySlip(req.user!, req.body);
  sendSuccess(res, result, "Salary slip saved", 201);
}

export async function setSalarySlipStatus(req: Request, res: Response) {
  const status = req.body.status === "PUBLISHED" ? SalarySlipStatus.PUBLISHED : SalarySlipStatus.DRAFT;
  const result = await salaryService.setSalarySlipStatus(req.user!, req.params.id, status);
  sendSuccess(res, result, `Salary slip ${status.toLowerCase()}`);
}

export async function deleteSalarySlip(req: Request, res: Response) {
  await salaryService.deleteSalarySlip(req.user!, req.params.id);
  sendSuccess(res, { id: req.params.id }, "Salary slip deleted");
}
