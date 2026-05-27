import { TaskStatus } from "@prisma/client";
import { z } from "zod";
import { idParamSchema, latLngSchema } from "./common.validators";

export const createTaskBodySchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    assignedToId: z.string().min(1),
    dueDate: z.coerce.date(),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    location: latLngSchema.optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    isRepeating: z.boolean().optional(),
    repeatFrequency: z.string().optional(),
    repeatDays: z.string().optional(),
    repeatDates: z.string().optional(),
    skipHolidays: z.boolean().optional(),
    priority: z.string().optional(),
    points: z.number().optional(),
    isSubtask: z.boolean().optional(),
    validations: z.any().optional(),
    checklist: z.any().optional(),
    checklistResponses: z.any().optional(),
    geofenceLat: z.number().optional().nullable(),
    geofenceLng: z.number().optional().nullable(),
    geofenceRadius: z.number().optional().nullable(),
    reminder: z.number().optional().nullable(),
    subtasks: z.array(z.any()).optional()
  })
  .refine((value) => value.location || (value.lat === undefined && value.lng === undefined) || (value.lat !== undefined && value.lng !== undefined), {
    message: "Both lat and lng are required when setting task coordinates"
  });

export const taskStatusBodySchema = z.object({
  status: z.nativeEnum(TaskStatus),
  completionData: z
    .object({
      photoUrl: z.string().optional(),
      remarks: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional()
    })
    .optional()
});

export const updateTaskBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  assignedToId: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  isRepeating: z.boolean().optional(),
  repeatFrequency: z.string().optional(),
  repeatDays: z.string().optional(),
  repeatDates: z.string().optional(),
  skipHolidays: z.boolean().optional(),
  priority: z.string().optional(),
  points: z.number().optional(),
  isSubtask: z.boolean().optional(),
  validations: z.any().optional(),
  checklist: z.any().optional(),
  checklistResponses: z.any().optional(),
  geofenceLat: z.number().optional().nullable(),
  geofenceLng: z.number().optional().nullable(),
  geofenceRadius: z.number().optional().nullable(),
  reminder: z.number().optional().nullable(),
  subtasks: z.array(z.any()).optional()
});


export const taskIdParamSchema = idParamSchema;
