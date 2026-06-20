import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as managementController from "../controllers/management.controller";

const router = Router();

router.get("/", asyncHandler(managementController.listForms));
router.post("/", asyncHandler(managementController.createForm));
router.get("/responses/user/:userId", asyncHandler(managementController.getUserFormResponses));
router.get("/:id", asyncHandler(managementController.getForm));
router.patch("/:id", asyncHandler(managementController.updateForm));
router.delete("/:id", asyncHandler(managementController.deleteForm));
router.get("/:id/responses", asyncHandler(managementController.getFormResponses));
router.post("/:id/submit", asyncHandler(managementController.submitFormResponse));

export default router;
