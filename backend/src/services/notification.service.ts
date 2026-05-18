import { prisma } from "../lib/prisma";

export async function createNotification(userId: string, title: string, message: string, type: string) {
  return prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type
    }
  });
}

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20
  });
}

export async function markAsRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: { isRead: true }
  });
}
