import { Response } from "express";
import { AuthRequest } from "../types/auth";
import * as aiAssistantService from "../services/aiAssistant.service";

export async function chat(req: AuthRequest, res: Response) {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Message is required" });
    }
    const adminId = req.user!.id;
    const companyId = req.user!.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, error: "Company context missing" });
    }
    const reply = await aiAssistantService.chatWithAssistant(adminId, companyId, message.trim());
    return res.json({ success: true, data: { reply } });
  } catch (error) {
    console.error("[AI Assistant Controller] chat error:", error);
    return res.status(500).json({ success: false, error: "AI chat failed" });
  }
}

export async function clearSession(req: AuthRequest, res: Response) {
  try {
    aiAssistantService.clearChatSession(req.user!.id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to clear session" });
  }
}

export async function getSmartNotifications(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user!.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, error: "Company context missing" });
    }
    const notifications = await aiAssistantService.generateSmartNotifications(companyId);
    return res.json({ success: true, data: notifications });
  } catch (error) {
    console.error("[AI Assistant Controller] smart notifications error:", error);
    return res.status(500).json({ success: false, error: "Failed to generate smart notifications" });
  }
}

export async function sendNotifications(req: AuthRequest, res: Response) {
  try {
    const { notifications } = req.body;
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({ success: false, error: "notifications array is required" });
    }
    const adminId = req.user!.id;
    const result = await aiAssistantService.sendSmartNotifications(adminId, notifications);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("[AI Assistant Controller] sendNotifications error:", error);
    return res.status(500).json({ success: false, error: "Failed to send notifications" });
  }
}
