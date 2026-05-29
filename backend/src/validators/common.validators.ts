import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().min(1)
});

export const userIdParamSchema = z.object({
  userId: z.string().min(1)
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(10000).default(25)
});

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});