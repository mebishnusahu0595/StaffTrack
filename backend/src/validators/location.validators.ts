import { z } from "zod";
import { userIdParamSchema } from "./common.validators";

export const locationLogSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative(),
  timestamp: z.coerce.date(),
  batteryLevel: z.number().min(0).max(100).optional()
});

export const locationBatchBodySchema = z.union([
  z.array(locationLogSchema).min(1),
  z.object({
    logs: z.array(locationLogSchema).min(1)
  })
]);

export const locationUserParamSchema = userIdParamSchema;
