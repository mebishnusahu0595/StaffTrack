import { z } from "zod";
import { userIdParamSchema } from "./common.validators";

import { AttendanceStatus, PunchType } from "@prisma/client";

export const checkInBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  punchType: z.nativeEnum(PunchType),
  photoUrl: z.string().optional()
});

export const checkOutBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  photoUrl: z.string().optional()
});

export const attendanceUserParamSchema = userIdParamSchema;

export const attendanceMonthQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(3000).optional()
});

export const manualAttendanceBodySchema = z.object({
  userId: z.string().min(1),
  date: z.string().min(1),
  status: z.nativeEnum(AttendanceStatus)
});
