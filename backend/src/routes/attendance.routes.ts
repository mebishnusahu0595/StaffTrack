import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { roleGuard } from "../middleware/roleGuard";
import * as attendanceController from "../controllers/attendance.controller";
import { validate } from "../validators/validate";
import {
  attendanceMonthQuerySchema,
  checkInBodySchema,
  checkOutBodySchema,
  attendanceUserParamSchema,
  manualAttendanceBodySchema
} from "../validators/attendance.validators";

const router = Router();

router.post(
  "/checkin",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE),
  validate({ body: checkInBodySchema }),
  asyncHandler(attendanceController.checkIn)
);
router.post(
  "/checkout",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE),
  validate({ body: checkOutBodySchema }),
  asyncHandler(attendanceController.checkOut)
);
router.post(
  "/mark",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  validate({ body: manualAttendanceBodySchema }),
  asyncHandler(attendanceController.markAttendance)
);
router.post(
  "/clear",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(attendanceController.clearAttendance)
);
router.post(
  "/break/start",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE),
  asyncHandler(attendanceController.startBreak)
);
router.post(
  "/break/end",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE),
  asyncHandler(attendanceController.endBreak)
);
router.get(
  "/company/all",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  validate({ query: attendanceMonthQuerySchema }),
  asyncHandler(attendanceController.getCompanyAttendance)
);

router.get(
  "/",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(attendanceController.getAttendanceByDate)
);

router.get(
  "/dashboard/summary",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(attendanceController.getAttendanceDashboardSummary)
);
router.get(
  "/requests/all",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(attendanceController.getAttendanceRequests)
);

// Mobile app uses /by-date path (alias for the root GET handler)
router.get(
  "/by-date",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(attendanceController.getAttendanceByDate)
);

router.post(
  "/requests/:id/approve",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(attendanceController.approveAttendanceRequest)
);
router.post(
  "/requests/:id/reject",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(attendanceController.rejectAttendanceRequest)
);

router.get(
  "/late-checkins/pending",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(attendanceController.getPendingLateCheckIns)
);

router.post(
  "/late-checkins/:id/approve",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(attendanceController.approveLateCheckIn)
);

router.post(
  "/late-checkins/:id/reject",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(attendanceController.rejectLateCheckIn)
);

router.get(
  "/:userId",
  validate({ params: attendanceUserParamSchema, query: attendanceMonthQuerySchema }),
  asyncHandler(attendanceController.getMonthlyAttendance)
);

export default router;
