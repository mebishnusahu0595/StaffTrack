import { z } from "zod";
import { userIdParamSchema } from "./common.validators";

export const dayEndReportBodySchema = z
  .object({
    date: z.coerce.date(),
    visitsSummary: z.string().min(1),
    ordersTaken: z.number().int().nonnegative(),
    ordersCancelled: z.number().int().nonnegative(),
    kmTravelled: z.number().nonnegative().optional(),
    totalKmTravelled: z.number().nonnegative().optional(),
    startOdometer: z.number().nonnegative().optional(),
    endOdometer: z.number().nonnegative().optional(),
    startOdometerPhotoUrl: z.string().optional(),
    kmPhotoUrl: z.string().optional(),
    remarks: z.string().default("")
  })
  .refine((value) => value.kmTravelled !== undefined || value.totalKmTravelled !== undefined, {
    message: "kmTravelled or totalKmTravelled is required"
  })
  .transform((value) => ({
    date: value.date,
    visitsSummary: value.visitsSummary,
    ordersTaken: value.ordersTaken,
    ordersCancelled: value.ordersCancelled,
    kmTravelled: value.kmTravelled ?? value.totalKmTravelled ?? 0,
    startOdometer: value.startOdometer,
    endOdometer: value.endOdometer,
    startOdometerPhotoUrl: value.startOdometerPhotoUrl,
    kmPhotoUrl: value.kmPhotoUrl,
    remarks: value.remarks
  }));

export const dayEndReportUserParamSchema = userIdParamSchema;
