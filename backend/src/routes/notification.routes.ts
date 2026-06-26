import { Router } from "express";
import * as notificationService from "../services/notification.service";
import { AuthRequest } from "../types/auth";
import { roleGuard } from "../middleware/roleGuard";
import { UserRole } from "@prisma/client";

const router = Router();

router.get("/", async (req: AuthRequest, res) => {
  try {
    const notifications = await notificationService.listNotifications(req.user!.id);
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
});

router.post("/broadcast", roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res) => {
  try {
    const { userIds, allSelected, title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, error: "Title and message are required" });
    }
    const result = await notificationService.sendBroadcastNotification(req.user!.id, {
      userIds,
      allSelected,
      title,
      message
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to send broadcast" });
  }
});

router.patch("/:id/read", async (req: AuthRequest, res) => {
  try {
    await notificationService.markAsRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to mark notification as read" });
  }
});

export default router;
