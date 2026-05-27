import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as managementController from "../controllers/management.controller";

const router = Router();

router.get("/", asyncHandler(managementController.listProjects));
router.post("/", asyncHandler(managementController.createProject));
router.patch("/:id", asyncHandler(managementController.updateProject));
router.delete("/:id", asyncHandler(managementController.deleteProject));

export default router;
