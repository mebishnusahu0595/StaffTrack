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
router.post("/attendance/bulk", asyncHandler(superadminController.bulkMarkAttendance));


router.get("/expenses", asyncHandler(superadminController.getAllExpenses));
router.patch("/expenses/:id", asyncHandler(superadminController.updateExpense));
router.delete("/expenses/:id", asyncHandler(superadminController.deleteExpense));

router.get("/leaves", asyncHandler(superadminController.getAllLeaves));
router.patch("/leaves/:id", asyncHandler(superadminController.updateLeave));
router.delete("/leaves/:id", asyncHandler(superadminController.deleteLeave));

router.get("/tasks", asyncHandler(superadminController.getAllTasks));
router.patch("/tasks/:id", asyncHandler(superadminController.updateTask));
router.delete("/tasks/:id", asyncHandler(superadminController.deleteTask));

router.patch("/travel", asyncHandler(superadminController.updateTravelDistance));

export default router;

