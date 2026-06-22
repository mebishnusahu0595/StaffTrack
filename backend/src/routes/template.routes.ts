import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as managementController from "../controllers/management.controller";

const router = Router();

router.get("/", asyncHandler(managementController.listTemplates));
router.post("/", asyncHandler(managementController.createTemplate));
router.put("/:id", asyncHandler(managementController.updateTemplate));
router.delete("/:id/tasks", asyncHandler(managementController.deleteTemplateTasks));
router.delete("/:id", asyncHandler(managementController.deleteTemplate));
router.post("/:id/cleanup-duplicates", asyncHandler(managementController.cleanupTemplateDuplicates));

export default router;
