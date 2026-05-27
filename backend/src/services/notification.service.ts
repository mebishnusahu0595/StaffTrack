import { prisma } from "../lib/prisma";

export async function createNotification(userId: string, title: string, message: string, type: string) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type
    }
  });

  // Fetch the user's expoPushToken and send an Expo push notification
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true }
    });

    if (user?.expoPushToken) {
      await sendExpoPushNotification(user.expoPushToken, title, message, { notificationId: notification.id, type });
    }
  } catch (error) {
    console.error("[Notification Service] Error sending push notification:", error);
  }

  return notification;
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

async function sendExpoPushNotification(token: string, title: string, message: string, data?: any) {
  if (!token || !token.startsWith("ExponentPushToken")) {
    console.log("[Push Notification] Invalid Expo push token:", token);
    return;
  }

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: token,
        sound: "default",
        title,
        body: message,
        data: data || {}
      })
    });
    const result = await response.json();
    console.log("[Push Notification] Expo Response:", result);
  } catch (error) {
    console.error("[Push Notification] Error sending to Expo:", error);
  }
}
