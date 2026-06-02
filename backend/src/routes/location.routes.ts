import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { roleGuard } from "../middleware/roleGuard";
import * as locationController from "../controllers/location.controller";
import { validate } from "../validators/validate";
import {
  locationBatchBodySchema,
  locationUserParamSchema
} from "../validators/location.validators";

const router = Router();

router.post(
  "/",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE),
  validate({ body: locationBatchBodySchema }),
  asyncHandler(locationController.createLocationLogs)
);
router.post(
  "/status",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE),
  asyncHandler(locationController.updateLocationStatus)
);

router.get(
  "/:userId/today",
  validate({ params: locationUserParamSchema }),
  asyncHandler(locationController.getTodayLocationLogs)
);

export default router;
