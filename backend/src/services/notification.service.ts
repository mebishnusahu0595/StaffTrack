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
  if (!token || (!token.startsWith("ExponentPushToken") && !token.startsWith("ExpoPushToken"))) {
    console.log("[Push Notification] Invalid Expo push token prefix:", token);
    return;
  }

  try {
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json"
    };

    if (process.env.EXPO_ACCESS_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: token,
        sound: "default",
        title,
        body: message,
        data: data || {},
        channelId: "default",
        priority: "high"
      })
    });
    const result = await response.json();
    console.log("[Push Notification] Expo Response:", result);
  } catch (error) {
    console.error("[Push Notification] Error sending to Expo:", error);
  }
}

export async function sendBroadcastNotification(senderId: string, input: {
  userIds?: string[];
  allSelected?: boolean;
  title: string;
  message: string;
}) {
  const { userIds, allSelected, title, message } = input;
  
  let targetUserIds: string[] = [];
  if (allSelected) {
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ["EMPLOYEE", "MANAGER"]
        }
      },
      select: { id: true }
    });
    targetUserIds = users.map(u => u.id);
  } else if (userIds && userIds.length > 0) {
    targetUserIds = userIds;
  }
  
  if (targetUserIds.length === 0) {
    return { success: false, message: "No target users found" };
  }

  // Create notifications in database
  const notificationsData = targetUserIds.map(userId => ({
    userId,
    title,
    message,
    type: "BROADCAST"
  }));

  await prisma.notification.createMany({
    data: notificationsData
  });

  // Fetch users with tokens to send push notification
  const usersWithTokens = await prisma.user.findMany({
    where: {
      id: { in: targetUserIds },
      expoPushToken: { not: null }
    },
    select: { id: true, expoPushToken: true }
  });

  // Send push notifications in parallel
  const pushPromises = usersWithTokens.map(async (u) => {
    if (u.expoPushToken) {
      try {
        await sendExpoPushNotification(u.expoPushToken, title, message, { type: "BROADCAST" });
      } catch (err) {
        console.error(`Failed to send push to user ${u.id}:`, err);
      }
    }
  });

  await Promise.all(pushPromises);

  return { success: true, count: targetUserIds.length };
}
