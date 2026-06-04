import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchNotifications } from "../api";

/**
 * Firebase-free notifications.
 *
 * Instead of remote push (which on Android requires FCM/Firebase), we poll the
 * backend while the app is open and raise NATIVE LOCAL notifications for any new
 * server-side notification. Local notifications need no FCM, no google-services.json
 * and work in a plain Expo/Gradle build as well as Expo Go.
 */
const POLL_INTERVAL_MS = 30_000;

export function useLocalNotifications() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const lastSeenRef = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const userId = user.id;
    const storageKey = `@last_notif_ts:${userId}`;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function ensureAndroidChannel() {
      if (Platform.OS !== "android") return;
      try {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#10B981"
        });
      } catch {
        // channel setup is best-effort
      }
    }

    async function poll(silentBaseline = false) {
      try {
        const list = await fetchNotifications();
        if (cancelled || !Array.isArray(list) || list.length === 0) return;

        const sorted = [...list].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const newestTs = new Date(sorted[0].createdAt).getTime();

        // First ever run for this user: remember the high-water mark but don't
        // replay the whole history as notifications.
        if (silentBaseline) {
          lastSeenRef.current = newestTs;
          await AsyncStorage.setItem(storageKey, String(newestTs));
          return;
        }

        const fresh = sorted.filter(
          (n) => new Date(n.createdAt).getTime() > lastSeenRef.current
        );
        if (fresh.length === 0) return;

        // Fire oldest -> newest so the latest ends up on top.
        for (const n of fresh.slice().reverse()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: n.title,
              body: n.message,
              data: { type: n.type, notificationId: n.id },
              sound: "default"
            },
            trigger: null // deliver immediately
          });
        }

        lastSeenRef.current = newestTs;
        await AsyncStorage.setItem(storageKey, String(newestTs));
        // Refresh the in-app bell / lists.
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } catch {
        // network hiccups are non-fatal; next poll will retry
      }
    }

    void (async () => {
      await ensureAndroidChannel();
      const stored = await AsyncStorage.getItem(storageKey);
      lastSeenRef.current = stored ? Number(stored) : 0;
      // No stored baseline => establish one silently; otherwise surface anything
      // that arrived while the app was closed.
      await poll(!stored);
      if (cancelled) return;
      interval = setInterval(() => void poll(false), POLL_INTERVAL_MS);
    })();

    // Re-check the moment the app comes back to the foreground.
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void poll(false);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      sub.remove();
    };
  }, [isAuthenticated, user?.id, queryClient]);
}
