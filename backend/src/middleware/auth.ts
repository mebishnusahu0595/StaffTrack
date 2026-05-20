import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { unauthorized } from "../lib/errors";

export async function auth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token = "";
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.slice("Bearer ".length);
    } else if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(";").map(c => c.trim());
      const accessCookie = cookies.find(c => c.startsWith("stafftrack_access_token="));
      if (accessCookie) {
        token = accessCookie.substring("stafftrack_access_token=".length);
      }
    }

    if (!token) {
      unauthorized("Bearer token or access cookie is required");
    }

    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;

    if (!payload.sub) {
      unauthorized("Invalid access token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        companyId: true,
        managerId: true,
        email: true,
        name: true
      }
    });

    if (!user) {
      unauthorized("Invalid access token");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
        error: "Unauthorized"
      });
      return;
    }

    next(error);
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}
