import { prisma } from "../lib/prisma";
import { getManagerGroupId } from "./access.service";

export async function listIssues(companyId: string, filter?: any) {
  const where: any = {
    companyId
  };

  if (filter?.status && filter.status !== "All") {
    where.status = filter.status;
  }

  if (filter?.reportedById) {
    where.reportedById = filter.reportedById;
  }

  if (filter?.managerId) {
    const managerGroupId = await getManagerGroupId(filter.managerId);
    where.OR = [
      { reportedById: filter.managerId },
      { reportedBy: { managerId: filter.managerId } },
      { assigneeId: filter.managerId },
      { assignee: { managerId: filter.managerId } },
      ...(managerGroupId ? [
        { reportedBy: { groupId: managerGroupId } },
        { assignee: { groupId: managerGroupId } }
      ] : [])
    ];
  }

  if (filter?.search) {
    const searchOr = [
      { title: { contains: filter.search, mode: "insensitive" } },
      { description: { contains: filter.search, mode: "insensitive" } },
      { category: { contains: filter.search, mode: "insensitive" } },
      { department: { contains: filter.search, mode: "insensitive" } }
    ];
    if (where.OR) {
      where.AND = [
        { OR: where.OR },
        { OR: searchOr }
      ];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  const include: any = {
    assignee: { select: { id: true, name: true, group: true } },
    reportedBy: { select: { id: true, name: true } },
    project: { select: { id: true, name: true } }
  };

  return prisma.issue.findMany({
    where,
    include,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });
}

export async function createIssue(data: any) {
  const issueData: any = {
    title: data.title,
    description: data.description,
    priority: data.priority ?? "Medium",
    category: data.category ?? "General",
    department: data.department ?? null,
    startDate: data.startDate ? new Date(data.startDate) : new Date(),
    projectId: data.projectId ?? null,
    assigneeId: data.assigneeId ?? null,
    status: data.status ?? "Open",
    reportedById: data.reportedById,
    companyId: data.companyId
  };

  const include: any = {
    assignee: { select: { id: true, name: true, group: true } },
    reportedBy: { select: { id: true, name: true } },
    project: { select: { id: true, name: true } }
  };

  return prisma.issue.create({
    data: issueData,
    include
  });
}

export async function getIssue(id: string) {
  const include: any = {
    assignee: true,
    reportedBy: true,
    project: true,
    updates: {
      include: { user: true },
      orderBy: { createdAt: "desc" }
    }
  };

  return prisma.issue.findUniqueOrThrow({
    where: { id },
    include
  });
}

export async function updateIssue(id: string, data: any) {
  const updateData: any = {
    ...data,
    startDate: data.startDate ? new Date(data.startDate) : undefined
  };

  return prisma.issue.update({
    where: { id },
    data: updateData
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
