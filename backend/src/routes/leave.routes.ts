import { Router } from "express";
import * as leaveController from "../controllers/leave.controller";
import { auth } from "../middleware/auth";

const router = Router();

router.use(auth);

router.get("/", leaveController.listLeaveRequests);
router.post("/", leaveController.createLeaveRequest);
router.patch("/:id/status", leaveController.updateLeaveStatus);

router.get("/types", leaveController.listLeaveTypes);
router.post("/types", leaveController.createLeaveType);

router.get("/holiday-templates", leaveController.listHolidayTemplates);
router.post("/holiday-templates", leaveController.createHolidayTemplate);
router.post("/holiday-templates/assign", leaveController.assignHolidayTemplate);

export default router;

