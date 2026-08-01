import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { roleGuard } from "../middleware/roleGuard";
import { UserRole } from "@prisma/client";
import * as aiAssistantController from "../controllers/aiAssistant.controller";

const router = Router();

// All endpoints restricted to ADMIN and SUPERADMIN only
const adminGuard = roleGuard(UserRole.ADMIN, UserRole.SUPERADMIN);

router.post("/chat", adminGuard, asyncHandler(aiAssistantController.chat));
router.post("/chat-stream", adminGuard, aiAssistantController.chatStream); // SSE — no asyncHandler (streams)

router.post("/clear-session", adminGuard, asyncHandler(aiAssistantController.clearSession));
router.get("/smart-notifications", adminGuard, asyncHandler(aiAssistantController.getSmartNotifications));
router.post("/notify", adminGuard, asyncHandler(aiAssistantController.sendNotifications));

export default router;
