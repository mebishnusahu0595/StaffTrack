import { Prisma, UserRole } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { forbidden, notFound } from "../lib/errors";
import { prisma } from "../lib/prisma";

export async function getManagerGroupId(managerId: string): Promise<string | null> {
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { groupId: true }
  });
  return manager?.groupId || null;
}

export async function ensureCanAccessUser(actor: AuthUser, targetUserId: string) {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      role: true,
      companyId: true,
      managerId: true,
      groupId: true
    }
  });

  if (!targetUser) {
    notFound("User not found");
  }

  if (actor.role === UserRole.SUPERADMIN || actor.role === UserRole.ADMIN) {
    return targetUser;
  }

  if (targetUser.companyId !== actor.companyId) {
    forbidden("User is outside your company");
  }

  if (actor.role === UserRole.EMPLOYEE && targetUser.id !== actor.id) {
    forbidden("Employees can only access their own data");
  }

  if (actor.role === UserRole.MANAGER && targetUser.id !== actor.id) {
    if (targetUser.role !== UserRole.EMPLOYEE || targetUser.companyId !== actor.companyId) {
      forbidden("Managers can only access employee data within their company");
    }
    // Managers may only access their own direct reports (or members of their group).
    const managerGroupId = await getManagerGroupId(actor.id);
    const isDirectReport = targetUser.managerId === actor.id;
    const isInGroup = !!managerGroupId && targetUser.groupId === managerGroupId;
    if (!isDirectReport && !isInGroup) {
      forbidden("Managers can only access their own team members");
    }
  }

  return targetUser;
}

export async function accessibleUserWhere(actor: AuthUser): Promise<Prisma.UserWhereInput> {
  if (actor.role === UserRole.SUPERADMIN || actor.role === UserRole.ADMIN) {
    return {};
  }

  if (actor.role === UserRole.MANAGER) {
    const managerGroupId = await getManagerGroupId(actor.id);
    return {
      companyId: actor.companyId,
      OR: [
        { id: actor.id },
        { managerId: actor.id },
        ...(managerGroupId ? [{ groupId: managerGroupId }] : [])
      ]
    };
  }

  return {
    id: actor.id
  };
}

export async function ensureManagerCanUseEmployee(actor: AuthUser, employeeId: string): Promise<void> {
  const employee = await ensureCanAccessUser(actor, employeeId);

  if (actor.role === UserRole.MANAGER && employee.role !== UserRole.EMPLOYEE) {
    forbidden("Managers can only assign work to employees");
  }

  if (actor.role === UserRole.MANAGER) {
    if (employee.companyId !== actor.companyId) {
      forbidden("Managers can only assign work to employees within their company");
    }
  }
}
