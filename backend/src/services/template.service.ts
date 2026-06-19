import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listTemplates(type?: string, search?: string) {
  return prisma.template.findMany({
    where: {
      type: type || undefined,
      name: search ? { contains: search, mode: "insensitive" } : undefined
    },
    orderBy: { usageCount: "desc" }
  });
}

export async function createTemplate(data: any) {
  return prisma.template.create({
    data: {
      ...data,
      data: typeof data.data === 'string' ? data.data : JSON.stringify(data.data)
    }
  });
}

export async function useTemplate(id: string) {
  return prisma.template.update({
    where: { id },
    data: { usageCount: { increment: 1 } }
  });
}

export async function deleteTemplate(id: string) {
  return prisma.template.delete({
    where: { id }
  });
}
