import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function listIssues(companyId: string, filter?: any) {
  return prisma.issue.findMany({
    where: { 
      companyId,
      ...(filter?.status && filter.status !== 'All' && { status: filter.status }),
      ...(filter?.reportedById && { reportedById: filter.reportedById })
    },
    include: {
      assignee: { select: { id: true, name: true, group: true } },
      reportedBy: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createIssue(data: any) {
  return prisma.issue.create({ data });
}

export async function getIssue(id: string) {
  return prisma.issue.findUniqueOrThrow({
    where: { id },
    include: {
      assignee: true,
      reportedBy: true,
      updates: {
        include: { user: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
}

export async function updateIssue(id: string, data: any) {
  return prisma.issue.update({
    where: { id },
    data
  });
}

export async function addIssueUpdate(issueId: string, userId: string, data: any) {
  return prisma.issueUpdate.create({
    data: {
      issueId,
      userId,
      type: data.type,
      content: data.content
    }
  });
}
