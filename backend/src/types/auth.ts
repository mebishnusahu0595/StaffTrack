import type { Request } from "express";
import type { UserRole } from "@prisma/client";

export interface AuthUser {
  id: string;
  role: UserRole;
  companyId: string;
  managerId: string | null;
  email: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
