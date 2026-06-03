import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { roleGuard } from "../middleware/roleGuard";
import * as teamController from "../controllers/team.controller";

const router = Router();

// Only supervisory roles may inspect team data.
router.use(roleGuard(UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERADMIN));

router.get("/members", asyncHandler(teamController.listTeamMembers));
router.get("/overview", asyncHandler(teamController.getTeamOverview));

export default router;
