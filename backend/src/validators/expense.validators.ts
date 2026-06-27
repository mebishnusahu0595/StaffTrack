import { ExpenseCategory } from "@prisma/client";
import { z } from "zod";
import { idParamSchema } from "./common.validators";

export const createExpenseBodySchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  amount: z.number().positive(),
  description: z.string().min(1),
  receiptUrl: z.string().min(1),
  date: z.coerce.date()
});

export const listExpensesQuerySchema = z.object({
  userId: z.string().min(1).optional(),
  date: z.coerce.date().optional()
});

export const approveExpenseBodySchema = z.object({
  approved: z.boolean().nullable()
});

export const expenseIdParamSchema = idParamSchema;
