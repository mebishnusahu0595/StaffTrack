import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { sendSuccess } from "../lib/response";

// Core hardcoded groups that must always exist for every company
const CORE_GROUPS = [
  { name: "Sales", baseSalary: 0 },
  { name: "Field Assistant", baseSalary: 0 },
];

/**
 * Ensures the two core groups ("Sales" and "Field Assistant") exist for the given company.
 * Runs as a fast upsert check on every listGroups call.
 */
async function ensureCoreGroups(companyId: string): Promise<void> {
  const existing = await prisma.group.findMany({
    where: { companyId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((g) => g.name.toLowerCase()));

  for (const core of CORE_GROUPS) {
    if (!existingNames.has(core.name.toLowerCase())) {
      await prisma.group.create({
        data: {
          name: core.name,
          baseSalary: core.baseSalary,
          companyId,
        },
      });
    }
  }
}

export async function listGroups(req: Request, res: Response) {
  const companyId = req.user!.companyId;

  // Auto-seed core groups if missing
  await ensureCoreGroups(companyId);

  const groups = await prisma.group.findMany({
    where: { companyId },
    include: {
      members: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      _count: { select: { members: true } }
    }
  });
  sendSuccess(res, groups, "Groups fetched");
}

export async function createGroup(req: Request, res: Response) {
  const { name, baseSalary, userIds } = req.body;
  const group = await prisma.group.create({
    data: {
      name,
      baseSalary: parseFloat(baseSalary || "0"),
      companyId: req.user!.companyId
    }
  });

  if (userIds && Array.isArray(userIds)) {
    await prisma.user.updateMany({
      where: {
        id: { in: userIds },
        companyId: req.user!.companyId
      },
      data: {
        groupId: group.id
      }
    });
  }

  sendSuccess(res, group, "Group created", 201);
}

export async function updateGroup(req: Request, res: Response) {
  const { id } = req.params;
  const { name, baseSalary, userIds } = req.body;

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { groupId: id, companyId: req.user!.companyId },
      data: { groupId: null }
    }),
    ...(userIds && Array.isArray(userIds) ? [
      prisma.user.updateMany({
        where: { id: { in: userIds }, companyId: req.user!.companyId },
        data: { groupId: id }
      })
    ] : [])
  ]);

  const group = await prisma.group.update({
    where: { id, companyId: req.user!.companyId },
    data: {
      name,
      baseSalary: parseFloat(baseSalary || "0")
    }
  });
  sendSuccess(res, group, "Group updated");
}

export async function deleteGroup(req: Request, res: Response) {
  const { id } = req.params;

  // Prevent deletion of core groups
  const group = await prisma.group.findUnique({ where: { id } });
  if (group) {
    const isCoreGroup = CORE_GROUPS.some(
      (c) => c.name.toLowerCase() === group.name.toLowerCase()
    );
    if (isCoreGroup) {
      res.status(400).json({
        success: false,
        message: `Cannot delete core group "${group.name}". This is a system-required department.`,
      });
      return;
    }
  }

  await prisma.group.delete({
    where: { id, companyId: req.user!.companyId }
  });
  sendSuccess(res, null, "Group deleted");
}
