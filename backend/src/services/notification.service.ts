import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

export async function createNotification(userId: string, title: string, message: string, type: string) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type
    }
  });

  // Fetch token and send push notification asynchronously to avoid blocking the caller
  prisma.user.findUnique({
    where: { id: userId },
    select: { expoPushToken: true }
  }).then((user) => {
    if (user?.expoPushToken) {
      sendFcmPushNotification(user.expoPushToken, title, message, { notificationId: notification.id, type })
        .catch((error) => {
          console.error("[Notification Service] Error sending push notification:", error);
        });
    }
  }).catch((error) => {
    console.error("[Notification Service] Error fetching push token for notification:", error);
  });

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

interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
  private_key_id: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccount | null {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(process.cwd(), "firebase-service-account.json");
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content) as ServiceAccount;
    }
  } catch (error) {
    console.error(`[Push Notification] Failed to read Firebase Service Account JSON from ${filePath}:`, error);
  }
  return null;
}

async function getFcmAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const token = jwt.sign(payload, serviceAccount.private_key, {
    algorithm: "RS256",
    keyid: serviceAccount.private_key_id
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: token
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to get OAuth2 access token from Google: ${errText}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in
  };

  return data.access_token;
}

async function sendFcmPushNotification(token: string, title: string, message: string, data?: any) {
  if (!token) return;

  if (token.startsWith("ExponentPushToken") || token.startsWith("ExpoPushToken")) {
    console.log("[Push Notification] Skipping legacy Expo token. Device needs to upgrade to version 1.0.6:", token);
    return;
  }

  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    console.log("[Push Notification] Skipping push notification: Firebase Service Account JSON not configured.");
    return;
  }

  try {
    const accessToken = await getFcmAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;
    
    // Ensure all data values are string types (FCM v1 requires all values in the 'data' block to be strings)
    const stringData: Record<string, string> = {};
    if (data) {
      Object.keys(data).forEach((key) => {
        if (data[key] !== undefined && data[key] !== null) {
          stringData[key] = String(data[key]);
        }
      });
    }

    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title,
            body: message
          },
          data: stringData,
          android: {
            priority: "HIGH",
            notification: {
              channelId: "default",
              sound: "default"
            }
          }
        }
      })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("[Push Notification] FCM Server Error:", result);
    } else {
      console.log("[Push Notification] FCM Send Success:", result);
    }
  } catch (error) {
    console.error("[Push Notification] Error sending FCM message:", error);
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
        await sendFcmPushNotification(u.expoPushToken, title, message, { type: "BROADCAST" });
      } catch (err) {
        console.error(`Failed to send push to user ${u.id}:`, err);
      }
    }
  });

  await Promise.all(pushPromises);

  return { success: true, count: targetUserIds.length };
}
