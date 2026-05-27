import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { forbidden, unauthorized } from "../lib/errors";

export function roleGuard(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized("Authentication is required");
    }

    if (!roles.includes(req.user.role)) {
      forbidden("Insufficient permissions");
    }

    next();
  };
}
