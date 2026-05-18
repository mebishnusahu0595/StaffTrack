import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { roleGuard } from "../middleware/roleGuard";
import * as userController from "../controllers/user.controller";
import { validate } from "../validators/validate";
import {
  createUserBodySchema,
  listUsersQuerySchema,
  updateUserBodySchema,
  userIdRouteParamSchema
} from "../validators/user.validators";

const router = Router();

router.get(
  "/",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  validate({ query: listUsersQuerySchema }),
  asyncHandler(userController.listUsers)
);
router.post(
  "/",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN),
  validate({ body: createUserBodySchema }),
  asyncHandler(userController.createUser)
);
router.get(
  "/:id",
  validate({ params: userIdRouteParamSchema }),
  asyncHandler(userController.getUser)
);
router.patch(
  "/:id",
  validate({ params: userIdRouteParamSchema, body: updateUserBodySchema }),
  asyncHandler(userController.updateUser)
);
router.delete(
  "/:id",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN),
  validate({ params: userIdRouteParamSchema }),
  asyncHandler(userController.deleteUser)
);

export default router;
