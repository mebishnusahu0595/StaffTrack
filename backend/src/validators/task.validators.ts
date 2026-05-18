import { TaskStatus } from "@prisma/client";
import { z } from "zod";
import { idParamSchema, latLngSchema } from "./common.validators";

export const createTaskBodySchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    assignedToId: z.string().min(1),
    dueDate: z.coerce.date(),
    location: latLngSchema.optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    isRepeating: z.boolean().optional(),
    repeatFrequency: z.string().optional(),
    repeatDays: z.string().optional(),
    repeatDates: z.string().optional(),
    skipHolidays: z.boolean().optional(),
    priority: z.string().optional(),
    points: z.number().optional()
  })
  .refine((value) => value.location || (value.lat === undefined && value.lng === undefined) || (value.lat !== undefined && value.lng !== undefined), {
    message: "Both lat and lng are required when setting task coordinates"
  });

export const taskStatusBodySchema = z.object({
  status: z.nativeEnum(TaskStatus),
  completionData: z
    .object({
      photoUrl: z.string().optional(),
      remarks: z.string().optional()
    })
    .optional()
});

export const updateTaskBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  assignedToId: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  isRepeating: z.boolean().optional(),
  repeatFrequency: z.string().optional(),
  repeatDays: z.string().optional(),
  repeatDates: z.string().optional(),
  skipHolidays: z.boolean().optional(),
  priority: z.string().optional(),
  points: z.number().optional()
});

export const taskIdParamSchema = idParamSchema;
