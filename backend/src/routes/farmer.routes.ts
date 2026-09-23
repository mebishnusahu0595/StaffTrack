import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as farmerController from "../controllers/farmer.controller";

const router = Router();

router.get("/", asyncHandler(farmerController.listFarmersHandler));
router.get("/:id", asyncHandler(farmerController.getFarmerHandler));
router.get("/:id/visits", asyncHandler(farmerController.getFarmerVisitsHandler));
router.post("/", asyncHandler(farmerController.createFarmerHandler));
router.patch("/:id", asyncHandler(farmerController.updateFarmerHandler));
router.delete("/:id", asyncHandler(farmerController.deleteFarmerHandler));

export default router;

