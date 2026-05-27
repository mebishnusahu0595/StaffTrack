import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response";
import * as locationService from "../services/location.service";
import { getIO, SOCKET_EVENTS } from "../lib/socket";

export async function createLocationLogs(req: Request, res: Response): Promise<void> {
  const result = await locationService.createLocationLogs(req.user!, req.body);
  
  // Emit WebSocket event (send the last ping for real-time tracking)
  const lastPing = req.body.logs?.[req.body.logs.length - 1];
  if (lastPing) {
    getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.LOCATION_UPDATE, {
      userId: req.user!.id,
      location: lastPing
    });
  }

  sendSuccess(res, result, "Location logs stored", 201);
}

export async function getTodayLocationLogs(req: Request, res: Response): Promise<void> {
  const dateStr = req.query.date as string | undefined;
  const result = await locationService.getTodayLocationLogs(req.user!, req.params.userId, dateStr);
  sendSuccess(res, result, "Location logs fetched");
}
