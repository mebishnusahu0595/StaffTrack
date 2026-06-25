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
  const holidayDate = startOfDay(new Date(date));
  const companyId = req.user!.companyId;
  
  if (userIds && Array.isArray(userIds) && userIds.length > 0) {
    const holidays = [];
    for (const id of userIds) {
      const existing = await prisma.holiday.findFirst({
        where: {
          date: holidayDate,
          name,
          companyId,
          userId: id
        }
      });
      if (!existing) {
        const created = await prisma.holiday.create({
          data: {
            date: holidayDate,
            name,
            description,
            type,
            groupId: groupId || null,
            userId: id,
            companyId
          }
        });
        holidays.push(created);
      } else {
        holidays.push(existing);
      }
    }
    sendSuccess(res, holidays, "Holidays processed for selected employees", 201);
  } else {
    const targetUserId = userId || null;
    const existing = await prisma.holiday.findFirst({
      where: {
        date: holidayDate,
        name,
        companyId,
        userId: targetUserId
      }
    });
    if (!existing) {
      const holiday = await prisma.holiday.create({
        data: {
          date: holidayDate,
          name,
          description,
          type, // HOLIDAY or PAID_LEAVE
          groupId: groupId || null,
          userId: targetUserId,
          companyId
        }
      });
      sendSuccess(res, holiday, "Holiday created", 201);
    } else {
      sendSuccess(res, existing, "Holiday already exists", 200);
    }
  }
}

export async function deleteHoliday(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.holiday.delete({
    where: { id, companyId: req.user!.companyId }
  });
  sendSuccess(res, null, "Holiday deleted");
}
