import * as Battery from "expo-battery";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useEffect } from "react";
import { Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { sendLocationLogs, updateLocationStatus, type LocationPing } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useAttendance } from "../hooks/useAttendance";

let lastLocationState: boolean | null = null;
let isAlertOpen = false;

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

async function syncOfflineQueue() {
  try {
    const stored = await AsyncStorage.getItem("@location_sync_queue");
    if (!stored) return;
    const queue = JSON.parse(stored);
    if (queue.length === 0) return;
    
    console.log(`[LocationTracker] [Periodic] Syncing ${queue.length} cached logs...`);
    await sendLocationLogs(queue);
    await AsyncStorage.removeItem("@location_sync_queue");
    console.log("[LocationTracker] [Periodic] Cached logs synced and cleared.");
  } catch (error) {
    console.log("[LocationTracker] [Periodic] Cached logs sync failed (offline).");
  }
}

export function LocationTracker() {
  const { isAuthenticated } = useAuth();
  const { activeAttendance, activeBreak, startBreak } = useAttendance();
  const isCheckedIn = Boolean(activeAttendance);
  const isCheckedOut = false; // By definition, if activeAttendance exists, it's not checked out
  const isFieldPunch = activeAttendance?.punchType === "FIELD";

  useEffect(() => {
    let mounted = true;
    let webInterval: any = null;

    async function checkLocationAndAutoBreak() {
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        const permission = await Location.getForegroundPermissionsAsync();
        const locationIsOn = enabled && permission.status === "granted";

        if (locationIsOn) {
          isAlertOpen = false;
        }

        // If location is OFF, and they are checked in and NOT on break, trigger auto break!
        if (!locationIsOn && isCheckedIn && !activeBreak && isFieldPunch) {
          console.log("[LocationTracker] Location turned off during field check-in. Triggering auto-break!");
          try {
            await startBreak();
          } catch (breakErr) {
            console.warn("[LocationTracker] Failed to start auto-break:", breakErr);
          }
        }

        if (lastLocationState === null) {
          lastLocationState = locationIsOn;
          if (!locationIsOn && !isAlertOpen && isCheckedIn && isFieldPunch) {
            isAlertOpen = true;
            Alert.alert(
              "Location Required!",
              "Your location services are disabled. Your working hours are paused and auto-break has started. Please turn on location services immediately to resume work.",
              [{ text: "OK", onPress: () => { isAlertOpen = false; } }],
              { cancelable: false }
            );
          }
          return;
        }

        if (locationIsOn !== lastLocationState) {
          console.log(`[LocationTracker] Location state changed. Was: ${lastLocationState}, Now: ${locationIsOn}`);
          lastLocationState = locationIsOn;

          const level = await Battery.getBatteryLevelAsync();
          const batteryLevel = level >= 0 ? Math.round(level * 100) : undefined;

          // Report to backend
          await updateLocationStatus({ isLocationOn: locationIsOn, batteryLevel }).catch((err) => {
            console.warn("[LocationTracker] Failed to update location status on backend:", err);
          });
        }

        // Always alert the employee if location is turned off and no alert is currently open
        if (!locationIsOn && !isAlertOpen && isCheckedIn && isFieldPunch) {
          isAlertOpen = true;
          Alert.alert(
            "Location Required!",
            "Your location services are disabled. Your working hours are paused and auto-break has started. Please turn on location services immediately to resume work.",
            [{ text: "OK", onPress: () => { isAlertOpen = false; } }],
            { cancelable: false }
          );
        }
      } catch (err) {
        console.warn("[LocationTracker] Error checking location status:", err);
      }
    }

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

        // Sync cached locations if any
        void syncOfflineQueue();

        // Monitor location provider toggle and trigger auto-break
        void checkLocationAndAutoBreak();
      }
    }

    void syncTracking();
    const interval = setInterval(() => {
      void syncTracking();
    }, 20 * 1000);

    return () => {
      mounted = false;
      if (webInterval) clearInterval(webInterval);
      clearInterval(interval);
    };
  }, [isAuthenticated, isCheckedIn, isCheckedOut, isFieldPunch, activeBreak, startBreak]);

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
        notificationColor: "#1A202C"
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

  console.log(`[LocationTracker] [Mobile] Received ${locations.length} background locations. Queuing/Sending...`);
  const batteryLevel = await getBatteryPercentage().catch(() => undefined);
  const newLogs: LocationPing[] = locations.map((location) => ({
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy ?? 0,
    timestamp: new Date(location.timestamp).toISOString(),
    batteryLevel
  }));

  // Fetch current queue from storage
  let queue: LocationPing[] = [];
  try {
    const stored = await AsyncStorage.getItem("@location_sync_queue");
    if (stored) {
      queue = JSON.parse(stored);
    }
  } catch (err) {
    console.warn("[LocationTracker] Failed to read location queue:", err);
  }

  // Append new logs to queue
  queue.push(...newLogs);

  // Limit queue size to avoid memory overflow (e.g. max 1000 items)
  if (queue.length > 1000) {
    queue = queue.slice(-1000);
  }

  try {
    console.log(`[LocationTracker] Attempting to sync ${queue.length} coordinates...`);
    await sendLocationLogs(queue);
    // Success! Clear queue
    await AsyncStorage.removeItem("@location_sync_queue");
    console.log("[LocationTracker] Synced successfully. Queue cleared.");
  } catch (error) {
    console.warn("[LocationTracker] Offline. Saving pings locally.", error);
    try {
      await AsyncStorage.setItem("@location_sync_queue", JSON.stringify(queue));
    } catch (saveErr) {
      console.error("[LocationTracker] Failed to save queue:", saveErr);
    }
  }
}

async function getBatteryPercentage(): Promise<number | undefined> {
  const level = await Battery.getBatteryLevelAsync();

  if (level < 0) {
    return undefined;
  }

  return Math.round(level * 100);
}
