import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { sendSuccess } from "../lib/response";

export async function listGroups(req: Request, res: Response) {
  const groups = await prisma.group.findMany({
    where: { companyId: req.user!.companyId },
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
  await prisma.group.delete({
    where: { id, companyId: req.user!.companyId }
  });
  sendSuccess(res, null, "Group deleted");
}
