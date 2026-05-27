import { Router } from "express";
import * as payrollController from "../controllers/payroll.controller";

const router = Router();

router.get("/report", payrollController.getPayrollReport);
router.get("/matrix", payrollController.getSalaryMatrix);
router.get("/muster", payrollController.getMusterReport);

export default router;
