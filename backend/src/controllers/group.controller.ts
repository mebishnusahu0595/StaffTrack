import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { sendSuccess } from "../lib/response";

export async function listGroups(req: Request, res: Response) {
  const groups = await prisma.group.findMany({
    where: { companyId: req.user!.companyId },
    include: { _count: { select: { members: true } } }
  });
  sendSuccess(res, groups, "Groups fetched");
}

export async function createGroup(req: Request, res: Response) {
  const { name, baseSalary } = req.body;
  const group = await prisma.group.create({
    data: {
      name,
      baseSalary: parseFloat(baseSalary),
      companyId: req.user!.companyId
    }
  });
  sendSuccess(res, group, "Group created", 201);
}

export async function updateGroup(req: Request, res: Response) {
  const { id } = req.params;
  const { name, baseSalary } = req.body;
  const group = await prisma.group.update({
    where: { id, companyId: req.user!.companyId },
    data: {
      name,
      baseSalary: parseFloat(baseSalary)
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
