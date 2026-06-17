import bcrypt from "bcryptjs";
import { Prisma, UserRole, WorkMode } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { ensureCanAccessUser, getManagerGroupId } from "./access.service";
import { prisma } from "../lib/prisma";

const PASSWORD_ROUNDS = 12;

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  workMode: true,
  companyId: true,
  managerId: true,
  groupId: true,
  group: {
    select: {
      id: true,
      name: true
    }
  },
  avatarUrl: true,
  shiftStart: true,
  shiftEnd: true,
  designation: true,
  joiningDate: true,
  baseSalary: true,
  batteryLevel: true,
  isLocationOn: true,
  locationOffAt: true,
  createdAt: true
} satisfies Prisma.UserSelect;

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  workMode: WorkMode;
  companyId: string;
  managerId?: string;
  groupId?: string;
  avatarUrl?: string;
  shiftStart?: string;
  shiftEnd?: string;
  designation?: string;
  joiningDate?: Date;
  baseSalary?: number;
}

interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  role?: UserRole;
  workMode?: WorkMode;
  companyId?: string;
  managerId?: string | null;
  groupId?: string | null;
  avatarUrl?: string;
  shiftStart?: string;
  shiftEnd?: string;
  designation?: string;
  joiningDate?: Date;
  baseSalary?: number;
  expoPushToken?: string;
}

export async function listUsers(
  actor: AuthUser,
  page: number,
  pageSize: number,
  search?: string,
  workMode?: WorkMode,
  role?: UserRole | "ALL"
) {
  const roleFilter = role && role !== "ALL" ? role : undefined;
  const where: Prisma.UserWhereInput = {
    companyId: actor.companyId,
    role: roleFilter ? roleFilter : { in: [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.ADMIN] },
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ]
    }),
    ...(workMode && { workMode })
  };

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.user.count({ where })
  ]);

  return {
    items,
    total,
    page,
    pageSize
  };
}

export async function createUser(input: CreateUserInput) {
  const passwordHash = await bcrypt.hash(input.password, PASSWORD_ROUNDS);

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      phone: input.phone,
      role: input.role,
      workMode: input.workMode,
      companyId: input.companyId,
      managerId: input.managerId,
      groupId: input.groupId,
      avatarUrl: input.avatarUrl,
      shiftStart: input.shiftStart,
      shiftEnd: input.shiftEnd,
      designation: input.designation,
      joiningDate: input.joiningDate,
      baseSalary: input.baseSalary
    },
    select: publicUserSelect
  });
}

export async function getUser(actor: AuthUser, id: string) {
  await ensureCanAccessUser(actor, id);

  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      ...publicUserSelect,
      group: {
        select: {
          id: true,
          name: true,
          members: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarUrl: true,
              designation: true
            }
          }
        }
      }
    }
  });
}

export async function updateUser(actor: AuthUser, id: string, input: UpdateUserInput) {
  await ensureCanAccessUser(actor, id);

  const data = await buildUpdateData(actor, input);

  return prisma.user.update({
    where: { id },
    data,
    select: publicUserSelect
  });
}

async function buildUpdateData(
  actor: AuthUser,
  input: UpdateUserInput
): Promise<Prisma.UserUpdateInput> {
  const data: Prisma.UserUpdateInput = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.phone !== undefined) {
    data.phone = input.phone;
  }

  if (input.avatarUrl !== undefined) {
    data.avatarUrl = input.avatarUrl;
  }

  if (input.designation !== undefined) {
    data.designation = input.designation;
  }

  if (input.joiningDate !== undefined) {
    data.joiningDate = input.joiningDate;
  }

  if (input.baseSalary !== undefined) {
    data.baseSalary = input.baseSalary;
  }

  if (input.expoPushToken !== undefined) {
    data.expoPushToken = input.expoPushToken;
  }

  if (actor.role !== UserRole.EMPLOYEE && input.email !== undefined) {
    data.email = input.email;
  }

  if (actor.role === UserRole.SUPERADMIN || actor.role === UserRole.ADMIN) {
    if (input.role !== undefined) {
      data.role = input.role;
    }

    if (input.workMode !== undefined) {
      data.workMode = input.workMode;
    }

    if (input.companyId !== undefined) {
      data.company = {
        connect: { id: input.companyId }
      };
    }

    if (input.managerId !== undefined) {
      data.manager =
        input.managerId === null
          ? { disconnect: true }
          : {
              connect: { id: input.managerId }
            };
    }

    if (input.groupId !== undefined) {
      data.group =
        input.groupId === null
          ? { disconnect: true }
          : {
              connect: { id: input.groupId }
            };
    }

    if (input.shiftStart !== undefined) {
      data.shiftStart = input.shiftStart;
    }

    if (input.shiftEnd !== undefined) {
      data.shiftEnd = input.shiftEnd;
    }
  }

  if (input.password !== undefined) {
    data.passwordHash = await bcrypt.hash(input.password, PASSWORD_ROUNDS);
  }

  return data;
}

export async function deleteUser(actor: AuthUser, id: string) {
  await ensureCanAccessUser(actor, id);

  // Delete all related records in a transaction
  await prisma.$transaction([
    prisma.locationLog.deleteMany({ where: { userId: id } }),
    prisma.task.deleteMany({ where: { OR: [{ assignedToId: id }, { assignedById: id }] } }),
    prisma.attendance.deleteMany({ where: { userId: id } }),
    prisma.dayEndReport.deleteMany({ where: { userId: id } }),
    prisma.expense.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } })
  ]);

  return { deleted: true };
}
