import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response";
import * as dailyAllowanceService from "../services/dailyAllowance.service";

export async function getTodayAllowanceStatus(req: Request, res: Response): Promise<void> {
  const result = await dailyAllowanceService.getTodayAllowanceStatus(req.user!);
  sendSuccess(res, result, "Daily allowance status fetched");
}

export async function submitDailyAllowance(req: Request, res: Response): Promise<void> {
  const result = await dailyAllowanceService.submitDailyAllowance(req.user!, req.body);
  sendSuccess(res, result, "Daily allowance submitted successfully", 201);
}

export async function getDailyAllowanceSubmissions(req: Request, res: Response): Promise<void> {
  const { date, startDate, endDate, userId } = req.query as {
    date?: string;
    startDate?: string;
    endDate?: string;
    userId?: string;
  };
  const result = await dailyAllowanceService.getDailyAllowanceSubmissions(req.user!, {
    date,
    startDate,
    endDate,
    userId
  });
  sendSuccess(res, result, "Daily allowance submissions fetched");
}
