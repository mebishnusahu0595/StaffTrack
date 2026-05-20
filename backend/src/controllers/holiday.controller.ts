import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { sendSuccess } from "../lib/response";
import { startOfDay } from "../lib/date";

export async function listHolidays(req: Request, res: Response) {
  const holidays = await prisma.holiday.findMany({
    where: { companyId: req.user!.companyId },
    orderBy: { date: "desc" }
  });
  sendSuccess(res, holidays, "Holidays fetched");
}

export async function createHoliday(req: Request, res: Response) {
  const { date, name, description, type, groupId, userId } = req.body;
  const holiday = await prisma.holiday.create({
    data: {
      date: startOfDay(new Date(date)),
      name,
      description,
      type, // HOLIDAY or PAID_LEAVE
      groupId: groupId || null,
      userId: userId || null,
      companyId: req.user!.companyId
    }
  });
  sendSuccess(res, holiday, "Holiday created", 201);
}

export async function deleteHoliday(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.holiday.delete({
    where: { id, companyId: req.user!.companyId }
  });
  sendSuccess(res, null, "Holiday deleted");
}
