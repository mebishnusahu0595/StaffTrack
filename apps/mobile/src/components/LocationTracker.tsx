import * as Battery from "expo-battery";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useEffect } from "react";
import { Platform } from "react-native";

import { sendLocationLogs, type LocationPing } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useAttendance } from "../hooks/useAttendance";

export const LOCATION_TASK_NAME = "background-location";

export type WorkHours = {
  startHour: number;
  endHour: number;
};

const TRACKING_INTERVAL = 20 * 1000;

export const DEFAULT_WORK_HOURS: WorkHours = {
  startHour: 8,
  endHour: 19
};

if (Platform.OS !== "web") {
  try {
    TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
      if (error) {
        console.warn("[LocationTracker] Background task error", error);
        return;
      }

      void handleBackgroundLocations(data).catch((taskError) => {
        console.warn("[LocationTracker] Background location sync failed", taskError);
      });
    });
  } catch (error) {
    console.warn("[LocationTracker] Background task registration failed", error);
  }
}

export function LocationTracker() {
  const { isAuthenticated } = useAuth();
  const { activeAttendance } = useAttendance();
  const isCheckedIn = Boolean(activeAttendance);
  const isCheckedOut = false; // By definition, if activeAttendance exists, it's not checked out
  const isFieldPunch = activeAttendance?.punchType === "FIELD";

  useEffect(() => {
    let mounted = true;
    let webInterval: any = null;

    async function syncTracking() {
      if (!mounted) {
        return;
      }

      if (!isAuthenticated || !isCheckedIn || isCheckedOut || !isFieldPunch) {
        console.log("[LocationTracker] Tracking inactive (Not logged in or not punched in)");
        await stopBackgroundLocationTracking().catch((error) => {
          console.warn("[LocationTracker] Failed to stop tracking", error);
        });
        if (webInterval) clearInterval(webInterval);
        return;
      }

      console.log("[LocationTracker] Syncing tracking status... Interval: 20s");
      if (Platform.OS === "web") {
        // Web location tracking logic
        const trackWeb = () => {
          if ("geolocation" in navigator) {
            console.log("[LocationTracker] [Web] Fetching current position...");
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                if (position.coords.accuracy > 100) {
                  console.log("[LocationTracker] [Web] Skipping ping due to low accuracy:", position.coords.accuracy);
                  return;
                }
                const logs: LocationPing[] = [{
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  timestamp: new Date().toISOString(),
                  batteryLevel: undefined // Battery API not standard on web
                }];
                console.log("[LocationTracker] [Web] Sending ping to server:", logs[0]);
                await sendLocationLogs(logs);
              },
              (err) => console.error("Web Geolocation Error:", err),
              { enableHighAccuracy: true }
            );
          }
        };

        trackWeb();
        if (!webInterval) {
          webInterval = setInterval(trackWeb, TRACKING_INTERVAL);
        }
      } else {
        console.log("[LocationTracker] Starting mobile background tracking...");
        await startBackgroundLocationTracking().catch((error) => {
          console.warn("[LocationTracker] Failed to start tracking", error);
          return false;
        });
      }
    }

    void syncTracking();
    const interval = setInterval(() => {
      void syncTracking();
    }, 60 * 1000);

    return () => {
      mounted = false;
      if (webInterval) clearInterval(webInterval);
      clearInterval(interval);
    };
  }, [isAuthenticated, isCheckedIn, isCheckedOut, isFieldPunch]);

  return null;
}

export async function startBackgroundLocationTracking(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    const foreground = await Location.requestForegroundPermissionsAsync();

    if (foreground.status !== Location.PermissionStatus.GRANTED) {
      console.warn("[LocationTracker] Foreground location permission denied.");
      return false;
    }

    const background = await Location.requestBackgroundPermissionsAsync();

    if (background.status !== Location.PermissionStatus.GRANTED) {
      console.warn("[LocationTracker] Background location permission denied.");
      return false;
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (alreadyStarted) {
      return true;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      activityType: Location.ActivityType.AutomotiveNavigation,
      deferredUpdatesInterval: TRACKING_INTERVAL,
      distanceInterval: 10, // decreased from 25 for better 15s accuracy
      foregroundService: {
        notificationTitle: "StaffTrack is tracking your location",
        notificationBody: "Live location tracking is active.",
        notificationColor: "#146C5C"
      },
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: true,
      timeInterval: TRACKING_INTERVAL
    });

    return true;
  } catch (error) {
    console.error("[LocationTracker] Error starting background location tracking:", error);
    return false;
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }

  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (started) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (error) {
    console.error("[LocationTracker] Error stopping background location tracking:", error);
  }
}

export function isWithinWorkHours(date = new Date(), workHours: WorkHours = DEFAULT_WORK_HOURS) {
  const currentHour = date.getHours() + date.getMinutes() / 60;

  if (workHours.startHour <= workHours.endHour) {
    return currentHour >= workHours.startHour && currentHour < workHours.endHour;
  }

  return currentHour >= workHours.startHour || currentHour < workHours.endHour;
}

async function handleBackgroundLocations(data: unknown) {
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];

  if (locations.length === 0) {
    return;
  }

  console.log(`[LocationTracker] [Mobile] Received ${locations.length} background locations. Sending to server...`);
  const batteryLevel = await getBatteryPercentage().catch(() => undefined);
  const logs: LocationPing[] = locations.map((location) => ({
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy ?? 0,
    timestamp: new Date(location.timestamp).toISOString(),
    batteryLevel
  }));

  await sendLocationLogs(logs).catch((error) => {
    console.warn("[LocationTracker] Failed to send location logs", error);
  });
  console.log("[LocationTracker] [Mobile] Ping sent successfully.");
}

async function getBatteryPercentage(): Promise<number | undefined> {
  const level = await Battery.getBatteryLevelAsync();

  if (level < 0) {
    return undefined;
  }

  return Math.round(level * 100);
}
