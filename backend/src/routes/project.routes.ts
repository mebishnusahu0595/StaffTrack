import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as managementController from "../controllers/management.controller";

const router = Router();

router.get("/", asyncHandler(managementController.listProjects));
router.post("/", asyncHandler(managementController.createProject));

export default router;
