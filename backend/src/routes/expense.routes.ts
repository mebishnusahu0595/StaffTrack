import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { roleGuard } from "../middleware/roleGuard";
import * as expenseController from "../controllers/expense.controller";
import { validate } from "../validators/validate";
import {
  approveExpenseBodySchema,
  createExpenseBodySchema,
  expenseIdParamSchema,
  listExpensesQuerySchema
} from "../validators/expense.validators";

const router = Router();

router.post(
  "/",
  roleGuard(UserRole.EMPLOYEE),
  validate({ body: createExpenseBodySchema }),
  asyncHandler(expenseController.createExpense)
);
router.get(
  "/",
  validate({ query: listExpensesQuerySchema }),
  asyncHandler(expenseController.listExpenses)
);
router.patch(
  "/:id/approve",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: expenseIdParamSchema, body: approveExpenseBodySchema }),
  asyncHandler(expenseController.approveExpense)
);

export default router;
