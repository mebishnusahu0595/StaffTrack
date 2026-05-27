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
  const { date, name, description, type, groupId, userId, userIds } = req.body;
  
  if (userIds && Array.isArray(userIds) && userIds.length > 0) {
    const holidays = await Promise.all(
      userIds.map((id) =>
        prisma.holiday.create({
          data: {
            date: startOfDay(new Date(date)),
            name,
            description,
            type,
            groupId: groupId || null,
            userId: id,
            companyId: req.user!.companyId
          }
        })
      )
    );
    sendSuccess(res, holidays, "Holidays created for selected employees", 201);
  } else {
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
}

export async function deleteHoliday(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.holiday.delete({
    where: { id, companyId: req.user!.companyId }
  });
  sendSuccess(res, null, "Holiday deleted");
}
