import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as authController from "../controllers/auth.controller";
import { validate } from "../validators/validate";
import { loginBodySchema, logoutBodySchema, refreshBodySchema } from "../validators/auth.validators";
import { z } from "zod";

const router = Router();

const forgotPasswordSendOtpSchema = z.object({
  identifier: z.string().min(1)
});

const forgotPasswordResetSchema = z.object({
  identifier: z.string().min(1),
  verificationId: z.string().min(1),
  code: z.string().min(1),
  newPassword: z.string().min(1)
});

router.post("/login", validate({ body: loginBodySchema }), asyncHandler(authController.login));
router.post("/refresh", validate({ body: refreshBodySchema }), asyncHandler(authController.refresh));
router.post("/logout", validate({ body: logoutBodySchema }), asyncHandler(authController.logout));

router.post("/forgot-password/send-otp", validate({ body: forgotPasswordSendOtpSchema }), asyncHandler(authController.forgotPasswordSendOtp));
router.post("/forgot-password/reset", validate({ body: forgotPasswordResetSchema }), asyncHandler(authController.forgotPasswordReset));

export default router;
