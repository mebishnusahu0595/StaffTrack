import { PrismaClient } from "@prisma/client";
import type { AuthUser } from "../types/auth";

const prisma = new PrismaClient();

export class LeaveSetupService {
  async getLeaveTypes(user: AuthUser) {
    return await prisma.leaveType.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" }
    });
  }

  async createLeaveType(user: AuthUser, data: {
    name: string;
    alias: string;
    description?: string;
    autoAllocationCount: number;
    autoAllocationFreq: string;
    carryForward: number;
    carryForwardFreq: string;
    encashment: boolean;
    leaveCycle: string;
  }) {
    return await prisma.leaveType.create({
      data: {
        ...data,
        companyId: user.companyId
      }
    });
  }

  async getHolidayTemplates(user: AuthUser) {
    const templates = await prisma.holidayTemplate.findMany({
      where: { companyId: user.companyId },
      include: {
        holidays: true,
        users: {
          select: { id: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return templates.map(t => ({
      id: t.id,
      name: t.name,
      holidayCount: t.holidays.length,
      assignedCount: t.users.length,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));
  }

  async createHolidayTemplate(user: AuthUser, data: {
    name: string;
    holidays: { date: string; name: string; description?: string }[];
  }) {
    return await prisma.$transaction(async (tx) => {
      const template = await tx.holidayTemplate.create({
        data: {
          name: data.name,
          companyId: user.companyId
        }
      });

      if (data.holidays && data.holidays.length > 0) {
        await tx.holidayTemplateItem.createMany({
          data: data.holidays.map(h => ({
            templateId: template.id,
            date: new Date(h.date),
            name: h.name,
            description: h.description
          }))
        });
      }

      return template;
    });
  }

  async assignHolidayTemplate(user: AuthUser, templateId: string, userIds: string[]) {
    return await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { companyId: user.companyId, holidayTemplateId: templateId },
        data: { holidayTemplateId: null }
      });

      if (userIds.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: userIds } },
          data: { holidayTemplateId: templateId }
        });
      }

      return { success: true };
    });
  }
}

export const leaveSetupService = new LeaveSetupService();
