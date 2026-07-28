import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { auth } from "../middleware/auth";
import { validate } from "../validators/validate";
import * as dailyAllowanceController from "../controllers/dailyAllowance.controller";
import { submitDailyAllowanceSchema } from "../validators/dailyAllowance.validators";

const router = Router();
router.use(auth);

router.get("/today-status", asyncHandler(dailyAllowanceController.getTodayAllowanceStatus));
router.post(
  "/submit",
  validate({ body: submitDailyAllowanceSchema }),
  asyncHandler(dailyAllowanceController.submitDailyAllowance)
);
router.get("/submissions", asyncHandler(dailyAllowanceController.getDailyAllowanceSubmissions));

export default router;
