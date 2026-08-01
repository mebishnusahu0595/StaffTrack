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

/** Streaming endpoint — SSE, chunks arrive like GPT typewriter effect */
export async function chatStream(req: AuthRequest, res: Response) {
  const { message } = req.body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ success: false, error: "Message is required" });
    return;
  }
  const adminId = req.user!.id;
  const companyId = req.user!.companyId;
  if (!companyId) {
    res.status(400).json({ success: false, error: "Company context missing" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  try {
    const stream = aiAssistantService.chatWithAssistantStream(adminId, companyId, message.trim());
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      if (typeof (res as any).flush === "function") (res as any).flush();
    }
  } catch (err) {
    console.error("[AI Stream Controller] error:", err);
    res.write(`data: ${JSON.stringify({ text: " [AI error, please retry]" })}\n\n`);
  } finally {
    res.write("data: [DONE]\n\n");
    res.end();
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
