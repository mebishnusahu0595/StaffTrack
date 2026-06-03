import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response";
import * as attendanceService from "../services/attendance.service";
import { getIO, SOCKET_EVENTS } from "../lib/socket";

export async function checkIn(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.checkIn(req.user!, req.body);
  
  // Emit WebSocket event
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
    userId: req.user!.id,
    type: "check-in",
    data: result
  });

  sendSuccess(res, result, "Checked in", 201);
}

export async function checkOut(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.checkOut(req.user!, req.body);
  
  // Emit WebSocket event
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
    userId: req.user!.id,
    type: "check-out",
    data: result
  });

  sendSuccess(res, result, "Checked out");
}

export async function markAttendance(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.markAttendance(req.user!, req.body);

  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
    userId: result.userId,
    type: "manual-status",
    data: result
  });

  sendSuccess(res, result, "Attendance status updated");
}

export async function getMonthlyAttendance(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as { month?: number; year?: number };
  const result = await attendanceService.getMonthlyAttendance(
    req.user!,
    req.params.userId,
    query.month,
    query.year
  );
  sendSuccess(res, result, "Attendance fetched");
}

export async function getCompanyAttendance(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as { month?: number; year?: number };
  const result = await attendanceService.getCompanyAttendance(
    req.user!,
    query.month,
    query.year
  );
  sendSuccess(res, result, "Company attendance fetched");
}

export async function getAttendanceByDate(req: Request, res: Response): Promise<void> {
  const dateStr = req.query.date as string;
  const result = await attendanceService.getAttendanceByDate(req.user!, dateStr);
  sendSuccess(res, result, "Attendance by date fetched");
}

export async function startBreak(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.startBreak(req.user!);
  
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
    userId: req.user!.id,
    type: "break-start",
    data: result
  });

  sendSuccess(res, result, "Break started", 201);
}

export async function endBreak(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.endBreak(req.user!);
  
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
    userId: req.user!.id,
    type: "break-end",
    data: result
  });

  sendSuccess(res, result, "Break ended");
}

export async function clearAttendance(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.clearAttendance(
    req.user!,
    req.body.userId,
    req.body.date
  );
  sendSuccess(res, result, "Attendance cleared");
}

export async function getAttendanceDashboardSummary(req: Request, res: Response): Promise<void> {
  const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const result = await attendanceService.getAttendanceDashboardSummary(req.user!, dateStr);
  sendSuccess(res, result, "Attendance dashboard summary fetched");
}

export async function getAttendanceRequests(req: Request, res: Response): Promise<void> {
  const status = req.query.status as string;
  const result = await attendanceService.getAttendanceRequests(req.user!, status);
  sendSuccess(res, result, "Attendance requests fetched");
}

export async function approveAttendanceRequest(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.approveAttendanceRequest(req.user!, req.params.id);
  sendSuccess(res, result, "Attendance request approved");
}

export async function rejectAttendanceRequest(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.rejectAttendanceRequest(req.user!, req.params.id);
  sendSuccess(res, result, "Attendance request rejected");
}

export async function getPendingLateCheckIns(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.getPendingLateCheckIns(req.user!);
  sendSuccess(res, result, "Pending late check-ins fetched");
}

export async function approveLateCheckIn(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.approveLateCheckIn(req.user!, req.params.id);
  
  // Emit WS update to sync UI
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
    userId: result.userId,
    type: "late-checkin-approve",
    data: result
  });

  sendSuccess(res, result, "Late check-in approved");
}

export async function rejectLateCheckIn(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.rejectLateCheckIn(req.user!, req.params.id);

  // Emit WS update to sync UI
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
    type: "late-checkin-reject",
    data: { id: req.params.id }
  });

  sendSuccess(res, result, "Late check-in rejected");
}

export async function forceCheckout(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.forceCheckout(req.user!, req.body.userId);
  
  getIO().to(`company:${req.user!.companyId}`).emit(SOCKET_EVENTS.ATTENDANCE_UPDATE, {
    userId: req.body.userId,
    type: "check-out",
    data: result
  });

  sendSuccess(res, result, "Force checked out successfully");
}

