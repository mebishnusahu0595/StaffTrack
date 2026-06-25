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
      holidays: t.holidays.map(h => ({
        id: h.id,
        date: h.date,
        name: h.name,
        description: h.description
      })),
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

  async updateHolidayTemplate(user: AuthUser, id: string, data: {
    name: string;
    holidays: { date: string; name: string; description?: string }[];
    deleteOption: "future" | "present" | "all";
  }) {
    return await prisma.$transaction(async (tx) => {
      // 1. Get currently assigned users
      const assignedUsers = await tx.user.findMany({
        where: { companyId: user.companyId, holidayTemplateId: id },
        select: { id: true }
      });
      const userIds = assignedUsers.map(u => u.id);

      // 2. Get old template items
      const oldItems = await tx.holidayTemplateItem.findMany({
        where: { templateId: id }
      });

      // 3. Update the template name
      const template = await tx.holidayTemplate.update({
        where: { id, companyId: user.companyId },
        data: { name: data.name }
      });

      // 4. Delete old template items and create new ones
      await tx.holidayTemplateItem.deleteMany({
        where: { templateId: id }
      });

      if (data.holidays && data.holidays.length > 0) {
        await tx.holidayTemplateItem.createMany({
          data: data.holidays.map(h => ({
            templateId: id,
            date: new Date(h.date),
            name: h.name,
            description: h.description
          }))
        });
      }

      // 5. Delete old template-generated holidays for assigned users based on deleteOption
      if (userIds.length > 0 && oldItems.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let dateCondition: any = undefined;
        if (data.deleteOption === "future") {
          dateCondition = { gt: today };
        } else if (data.deleteOption === "present") {
          dateCondition = { gte: today };
        }

        for (const item of oldItems) {
          await tx.holiday.deleteMany({
            where: {
              companyId: user.companyId,
              userId: { in: userIds },
              name: item.name,
              date: {
                equals: item.date,
                ...(dateCondition ? dateCondition : {})
              }
            }
          });
        }
      }

      // 6. Create new template holidays for assigned users
      if (userIds.length > 0 && data.holidays && data.holidays.length > 0) {
        for (const item of data.holidays) {
          const itemDate = new Date(item.date);
          itemDate.setHours(0, 0, 0, 0);

          for (const uId of userIds) {
            const existing = await tx.holiday.findFirst({
              where: {
                date: itemDate,
                name: item.name,
                companyId: user.companyId,
                userId: uId
              }
            });
            if (!existing) {
              await tx.holiday.create({
                data: {
                  date: itemDate,
                  name: item.name,
                  type: "HOLIDAY",
                  userId: uId,
                  companyId: user.companyId
                }
              });
            }
          }
        }
      }

      return template;
    });
  }

  async deleteHolidayTemplate(user: AuthUser, id: string, deleteOption: "future" | "present" | "all") {
    return await prisma.$transaction(async (tx) => {
      // 1. Get currently assigned users
      const assignedUsers = await tx.user.findMany({
        where: { companyId: user.companyId, holidayTemplateId: id },
        select: { id: true }
      });
      const userIds = assignedUsers.map(u => u.id);

      // 2. Get the template items
      const items = await tx.holidayTemplateItem.findMany({
        where: { templateId: id }
      });

      // 3. Delete matching holidays from the Holiday table for these users
      if (userIds.length > 0 && items.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let dateCondition: any = undefined;
        if (deleteOption === "future") {
          dateCondition = { gt: today };
        } else if (deleteOption === "present") {
          dateCondition = { gte: today };
        }

        for (const item of items) {
          await tx.holiday.deleteMany({
            where: {
              companyId: user.companyId,
              userId: { in: userIds },
              name: item.name,
              date: {
                equals: item.date,
                ...(dateCondition ? dateCondition : {})
              }
            }
          });
        }
      }

      // 4. Unassign the template from users
      await tx.user.updateMany({
        where: { companyId: user.companyId, holidayTemplateId: id },
        data: { holidayTemplateId: null }
      });

      // 5. Delete the template itself (will cascade delete HolidayTemplateItems)
      await tx.holidayTemplate.delete({
        where: { id, companyId: user.companyId }
      });

      return { success: true };
    });
  }

  async assignHolidayTemplate(user: AuthUser, templateId: string, userIds: string[]) {
    return await prisma.$transaction(async (tx) => {
      const currentAssigned = await tx.user.findMany({
        where: { companyId: user.companyId, holidayTemplateId: templateId },
        select: { id: true }
      });
      const currentIds = currentAssigned.map(u => u.id);

      const newlyAssigned = userIds.filter(id => !currentIds.includes(id));
      const newlyUnassigned = currentIds.filter(id => !userIds.includes(id));

      const items = await tx.holidayTemplateItem.findMany({
        where: { templateId }
      });

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

      if (newlyAssigned.length > 0 && items.length > 0) {
        for (const item of items) {
          for (const uId of newlyAssigned) {
            const existing = await tx.holiday.findFirst({
              where: {
                date: item.date,
                name: item.name,
                companyId: user.companyId,
                userId: uId
              }
            });
            if (!existing) {
              await tx.holiday.create({
                data: {
                  date: item.date,
                  name: item.name,
                  type: "HOLIDAY",
                  userId: uId,
                  companyId: user.companyId
                }
              });
            }
          }
        }
      }

      if (newlyUnassigned.length > 0 && items.length > 0) {
        for (const item of items) {
          await tx.holiday.deleteMany({
            where: {
              companyId: user.companyId,
              userId: { in: newlyUnassigned },
              name: item.name,
              date: item.date
            }
          });
        }
      }

      return { success: true };
    });
  }
}

export const leaveSetupService = new LeaveSetupService();
