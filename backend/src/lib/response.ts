import type { Response } from "express";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "OK",
  statusCode = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
    message
  } satisfies ApiResponse<T>);
}

export function sendMessage(res: Response, message = "OK", statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    message
  } satisfies ApiResponse<never>);
}

export function sendValidationError(res: Response, error: unknown): void {
  res.status(400).json({
    success: false,
    message: "Validation failed",
    error: JSON.stringify(error)
  } satisfies ApiResponse<never>);
}

export function sendError(res: Response, message = "Internal Server Error", statusCode = 500, error?: string): void {
  res.status(statusCode).json({
    success: false,
    message,
    error: error || message
  } satisfies ApiResponse<never>);
}
