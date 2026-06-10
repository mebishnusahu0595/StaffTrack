import type { Request, Response } from "express";
import { sendMessage, sendSuccess } from "../lib/response";
import * as authService from "../services/auth.service";

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body.email, req.body.password);
  
  // Set cookies for the frontend
  const cookieOptions = {
    httpOnly: false, // Frontend middleware needs to read some of these
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  res.cookie("stafftrack_access_token", result.accessToken, cookieOptions);
  res.cookie("stafftrack_refresh_token", result.refreshToken, cookieOptions);
  res.cookie("stafftrack_user", JSON.stringify(result.user), cookieOptions);

  sendSuccess(res, result, "Login successful");
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const result = await authService.refreshAccessToken(req.body.refreshToken);
  
  res.cookie("stafftrack_access_token", result.accessToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  sendSuccess(res, result, "Access token refreshed");
}

export async function logout(_req: Request, res: Response): Promise<void> {
  authService.logout();
  
  res.clearCookie("stafftrack_access_token");
  res.clearCookie("stafftrack_refresh_token");
  res.clearCookie("stafftrack_user");

  sendMessage(res, "Logged out");
}

export async function forgotPasswordSendOtp(req: Request, res: Response): Promise<void> {
  const result = await authService.forgotPasswordSendOtp(req.body.identifier);
  sendSuccess(res, result, "OTP sent successfully");
}

export async function forgotPasswordReset(req: Request, res: Response): Promise<void> {
  const result = await authService.forgotPasswordReset(
    req.body.identifier,
    req.body.verificationId,
    req.body.code,
    req.body.newPassword
  );
  sendSuccess(res, result, "Password reset successfully");
}
