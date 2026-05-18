import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodTypeAny } from "zod";
import { sendValidationError } from "../lib/response";

interface RequestSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export function validate(schemas: RequestSchemas): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const [key, schema] of Object.entries(schemas)) {
      if (!schema) {
        continue;
      }

      const result = schema.safeParse(req[key as keyof Request]);

      if (!result.success) {
        console.error("VALIDATION ERROR:", JSON.stringify(result.error.flatten(), null, 2), "req.body:", req.body);
        sendValidationError(res, result.error.flatten());
        return;
      }

      (req as unknown as Record<string, unknown>)[key] = result.data;
    }

    next();
  };
}
