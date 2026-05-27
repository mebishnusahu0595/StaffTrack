import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as holidayController from "../controllers/holiday.controller";

const router = Router();

router.get("/", asyncHandler(holidayController.listHolidays));
router.post("/", asyncHandler(holidayController.createHoliday));
router.delete("/:id", asyncHandler(holidayController.deleteHoliday));

export default router;
