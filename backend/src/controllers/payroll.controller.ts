import type { Request, Response } from "express";
import { sendSuccess, sendError } from "../lib/response";
import * as payrollService from "../services/payroll.service";

export async function getPayrollReport(req: Request, res: Response) {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const report = await payrollService.calculateMonthlyPayroll(
      req.user!.companyId,
      month,
      year
    );

    sendSuccess(res, report, "Payroll report generated");
  } catch (error: any) {
    console.error("Payroll calculation error:", error);
    sendError(res, "Failed to generate payroll report", 500);
  }
}

export async function getSalaryMatrix(req: Request, res: Response) {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    
    const report = await payrollService.calculateSalaryMatrix(
      req.user!.companyId,
      month,
      year
    );

    sendSuccess(res, report, "Salary matrix generated");
  } catch (error) {
    console.error("Salary matrix calculation error:", error);
    sendError(res, "Failed to generate salary matrix", 500);
  }
}

export async function getMusterReport(req: Request, res: Response) {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    
    const report = await payrollService.calculateMusterReport(
      req.user!.companyId,
      month,
      year
    );

    sendSuccess(res, report, "Muster report generated");
  } catch (error) {
    console.error("Muster report calculation error:", error);
    sendError(res, "Failed to generate muster report", 500);
  }
}
