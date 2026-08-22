import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly error = message
  ) {
    super(message);
  }
}

export function notFound(message = "Resource not found"): never {
  throw new AppError(404, message);
}

export function forbidden(message = "Forbidden"): never {
  throw new AppError(403, message);
}

export function unauthorized(message = "Unauthorized"): never {
  throw new AppError(401, message);
}

export function conflict(message = "Resource already exists"): never {
  throw new AppError(409, message);
}

export function badRequest(message = "Bad request"): never {
  throw new AppError(400, message);
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error for debugging
  console.error("[Error Handler]:", error);

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: error.error
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({
        success: false,
        message: "Unique constraint failed",
        error: "Duplicate resource"
      });
      return;
    }

    if (error.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Resource not found",
        error: "Resource not found"
      });
      return;
    }
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: error instanceof Error ? error.message : "Unknown error"
  });
}
