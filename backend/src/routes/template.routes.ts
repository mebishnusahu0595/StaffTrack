import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as managementController from "../controllers/management.controller";

const router = Router();

router.get("/", asyncHandler(managementController.listTemplates));
router.post("/", asyncHandler(managementController.createTemplate));
router.delete("/:id", asyncHandler(managementController.deleteTemplate));
router.patch("/:id", asyncHandler(managementController.updateTemplate));

export default router;
