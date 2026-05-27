import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response";
import * as expenseService from "../services/expense.service";

export async function createExpense(req: Request, res: Response): Promise<void> {
  const result = await expenseService.createExpense(req.user!, req.body);
  sendSuccess(res, result, "Expense submitted", 201);
}

export async function listExpenses(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as { userId?: string; date?: Date };
  const result = await expenseService.listExpenses(req.user!, query);
  sendSuccess(res, result, "Expenses fetched");
}

export async function approveExpense(req: Request, res: Response): Promise<void> {
  const result = await expenseService.approveExpense(req.user!, req.params.id, req.body.approved);
  sendSuccess(res, result, "Expense updated");
}
