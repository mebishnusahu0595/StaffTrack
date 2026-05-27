import { Router } from "express";
import * as notificationService from "../services/notification.service";
import { AuthRequest } from "../types/auth";

const router = Router();

router.get("/", async (req: AuthRequest, res) => {
  try {
    const notifications = await notificationService.listNotifications(req.user!.id);
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
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
