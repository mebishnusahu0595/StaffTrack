import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as superadminController from "../controllers/superadmin.controller";
import { roleGuard } from "../middleware/roleGuard";
import { UserRole } from "@prisma/client";

const router = Router();

// All routes here require SUPERADMIN role
router.use(roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN));

router.get("/users", asyncHandler(superadminController.getAllUsers));
router.patch("/users/:id", asyncHandler(superadminController.updateUser));
router.get("/managers", asyncHandler(superadminController.getManagers));

router.get("/attendance", asyncHandler(superadminController.getAttendanceLogs));
router.patch("/attendance/:id", asyncHandler(superadminController.updateAttendance));

export default router;
