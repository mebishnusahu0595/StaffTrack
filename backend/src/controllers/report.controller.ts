import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response";
import * as reportService from "../services/report.service";

export async function createDayEndReport(req: Request, res: Response): Promise<void> {
  const result = await reportService.createDayEndReport(req.user!, req.body);
  sendSuccess(res, result, "Day end report submitted", 201);
}

export async function getDayEndReportHistory(req: Request, res: Response): Promise<void> {
  const result = await reportService.getDayEndReportHistory(req.user!, req.params.userId);
  sendSuccess(res, result, "Day end reports fetched");
}

export async function listDayEndReports(req: Request, res: Response): Promise<void> {
  const { userId } = req.query;
  const result = await reportService.listDayEndReports(req.user!, userId as string);
  sendSuccess(res, result, "Day end reports fetched");
}

export async function getDaySummary(req: Request, res: Response): Promise<void> {
  const userId = (req.query.userId as string) || req.user!.id;
  const dateStr = req.query.date as string;
  const date = dateStr ? new Date(dateStr) : new Date();
  const result = await reportService.getDaySummary(req.user!, userId, date);
  sendSuccess(res, result, "Day summary fetched");
}

export async function getMonthlyPerformanceReport(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { month, year } = req.query;
  const result = await reportService.getMonthlyPerformanceReport(
    req.user!,
    userId,
    parseInt(month as string),
    parseInt(year as string)
  );
  sendSuccess(res, result, "Monthly performance report fetched");
}
