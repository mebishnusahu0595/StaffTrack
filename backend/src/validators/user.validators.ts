import { UserRole, WorkMode } from "@prisma/client";
import { z } from "zod";
import { idParamSchema, paginationQuerySchema } from "./common.validators";

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  workMode: z.nativeEnum(WorkMode).optional().or(z.literal("ALL")),
  role: z.enum([UserRole.EMPLOYEE, UserRole.MANAGER, "ALL"]).optional()
});

export const createUserBodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(7),
  role: z.enum([UserRole.EMPLOYEE, UserRole.MANAGER]).default(UserRole.EMPLOYEE),
  workMode: z.nativeEnum(WorkMode).default(WorkMode.BOTH),
  companyId: z.string().min(1),
  managerId: z.string().optional(),
  avatarUrl: z.string().optional(),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  groupId: z.string().optional(),
  designation: z.string().optional(),
  joiningDate: z.coerce.date().optional(),
  baseSalary: z.coerce.number().optional()
});

export const updateUserBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    phone: z.string().min(7).optional(),
    role: z.nativeEnum(UserRole).optional(),
    workMode: z.nativeEnum(WorkMode).optional(),
    companyId: z.string().min(1).optional(),
    managerId: z.string().nullable().optional(),
    groupId: z.string().nullable().optional(),
    avatarUrl: z.string().optional(),
    shiftStart: z.string().optional(),
    shiftEnd: z.string().optional(),
    designation: z.string().optional(),
    joiningDate: z.coerce.date().optional(),
    baseSalary: z.coerce.number().optional(),
    expoPushToken: z.string().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

export const userIdRouteParamSchema = idParamSchema;
