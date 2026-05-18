import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as authController from "../controllers/auth.controller";
import { validate } from "../validators/validate";
import { loginBodySchema, logoutBodySchema, refreshBodySchema } from "../validators/auth.validators";

const router = Router();

router.post("/login", validate({ body: loginBodySchema }), asyncHandler(authController.login));
router.post("/refresh", validate({ body: refreshBodySchema }), asyncHandler(authController.refresh));
router.post("/logout", validate({ body: logoutBodySchema }), asyncHandler(authController.logout));

export default router;
