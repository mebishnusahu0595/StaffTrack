import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { roleGuard } from "../middleware/roleGuard";
import * as salaryController from "../controllers/salary.controller";

const router = Router();

// All authenticated users can list (employees are scoped to their own published
// slips inside the service); only supervisory roles can create/edit/delete.
router.get("/", asyncHandler(salaryController.listSalarySlips));
router.get("/:id", asyncHandler(salaryController.getSalarySlip));

router.post(
  "/",
  roleGuard(UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERADMIN),
  asyncHandler(salaryController.upsertSalarySlip)
);
router.patch(
  "/:id/status",
  roleGuard(UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERADMIN),
  asyncHandler(salaryController.setSalarySlipStatus)
);
router.delete(
  "/:id",
  roleGuard(UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERADMIN),
  asyncHandler(salaryController.deleteSalarySlip)
);

export default router;
