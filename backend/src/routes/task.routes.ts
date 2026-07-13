import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { roleGuard } from "../middleware/roleGuard";
import * as taskController from "../controllers/task.controller";
import { validate } from "../validators/validate";
import {
  createTaskBodySchema,
  taskIdParamSchema,
  taskStatusBodySchema,
  updateTaskBodySchema
} from "../validators/task.validators";

const router = Router();

router.post(
  "/",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  validate({ body: createTaskBodySchema }),
  asyncHandler(taskController.createTask)
);
router.get("/", asyncHandler(taskController.listTasks));
router.patch(
  "/:id",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: taskIdParamSchema, body: updateTaskBodySchema }),
  asyncHandler(taskController.updateTask)
);
router.patch(
  "/:id/status",
  validate({ params: taskIdParamSchema, body: taskStatusBodySchema }),
  asyncHandler(taskController.updateTaskStatus)
);
router.post(
  "/bulk-delete",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(taskController.bulkDeleteTasks)
);
router.delete(
  "/all",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN),
  asyncHandler(taskController.deleteAllTasks)
);
router.delete(
  "/:id",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: taskIdParamSchema }),
  asyncHandler(taskController.deleteTask)
);

export default router;
