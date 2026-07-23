import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { roleGuard } from "../middleware/roleGuard";
import { UserRole } from "@prisma/client";
import * as documentController from "../controllers/document.controller";

const router = Router();

router.get("/", asyncHandler(documentController.listDocuments));
router.post(
  "/",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(documentController.createDocument)
);
router.delete(
  "/:id",
  roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER),
  asyncHandler(documentController.deleteDocument)
);

export default router;
