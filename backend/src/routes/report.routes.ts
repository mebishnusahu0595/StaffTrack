import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { roleGuard } from "../middleware/roleGuard";
import * as reportController from "../controllers/report.controller";
import { validate } from "../validators/validate";
import {
  dayEndReportBodySchema,
  dayEndReportUserParamSchema
} from "../validators/report.validators";

const router = Router();

router.post(
  "/der",
  roleGuard(UserRole.EMPLOYEE, UserRole.MANAGER),
  validate({ body: dayEndReportBodySchema }),
  asyncHandler(reportController.createDayEndReport)
);
router.get(
  "/der",
  asyncHandler(reportController.listDayEndReports)
);
router.get(
  "/der/:userId",
  validate({ params: dayEndReportUserParamSchema }),
  asyncHandler(reportController.getDayEndReportHistory)
);

router.get(
  "/monthly/:userId",
  asyncHandler(reportController.getMonthlyPerformanceReport)
);

export default router;
