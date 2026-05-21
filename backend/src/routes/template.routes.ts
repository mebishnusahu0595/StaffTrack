import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as managementController from "../controllers/management.controller";

const router = Router();

router.get("/", asyncHandler(managementController.listTemplates));
router.post("/", asyncHandler(managementController.createTemplate));

export default router;
