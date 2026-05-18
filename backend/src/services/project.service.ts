import { PrismaClient } from "@prisma/client";
import type { AuthUser } from "../types/auth";

const prisma = new PrismaClient();

export async function listProjects(user: AuthUser, search?: string) {
  return prisma.project.findMany({
    where: {
      companyId: user.companyId,
      name: search ? { contains: search, mode: "insensitive" } : undefined
    },
    include: {
      tasks: {
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        }
      },
      _count: {
        select: { tasks: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function createProject(user: AuthUser, data: any) {
  return prisma.project.create({
    data: {
      ...data,
      companyId: user.companyId
    }
  });
}

export async function updateProject(user: AuthUser, id: string, data: any) {
  return prisma.project.update({
    where: { id, companyId: user.companyId },
    data
  });
}

export async function deleteProject(user: AuthUser, id: string) {
  return prisma.project.delete({
    where: { id, companyId: user.companyId }
  });
}
