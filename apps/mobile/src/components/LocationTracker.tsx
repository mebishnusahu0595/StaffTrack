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
  startHour: 7,
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

const LOCATION_QUEUE_KEY = "@location_sync_queue";
const LOCATION_QUEUE_MAX = 1000;

async function readQueue(): Promise<LocationPing[]> {
  try {
    const stored = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
    return stored ? (JSON.parse(stored) as LocationPing[]) : [];
  } catch (err) {
    console.warn("[LocationTracker] Failed to read location queue:", err);
    return [];
  }
}

// Single entry point for persisting pings: append the new logs to whatever is
// already queued, then attempt to flush the whole queue. If the device is
// offline the send throws, so we keep the pings on disk and retry on the next
// tick. This is what makes location survive an internet outage — nothing is
// dropped, it just syncs once connectivity returns.
async function enqueueLocationLogs(newLogs: LocationPing[]) {
  let queue = await readQueue();
  queue.push(...newLogs);
  if (queue.length > LOCATION_QUEUE_MAX) {
    queue = queue.slice(-LOCATION_QUEUE_MAX);
  }

  if (queue.length === 0) return;

  try {
    console.log(`[LocationTracker] Syncing ${queue.length} cached coordinate(s)...`);
    await sendLocationLogs(queue);
    await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);
    console.log("[LocationTracker] Synced successfully. Queue cleared.");
  } catch (error) {
    console.log("[LocationTracker] Offline — keeping pings queued for later sync.");
    try {
      await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(queue));
    } catch (saveErr) {
      console.error("[LocationTracker] Failed to save queue:", saveErr);
    }
  }
}

async function syncOfflineQueue() {
  // Flush whatever is queued without adding new pings.
  await enqueueLocationLogs([]);
}

export function LocationTracker() {
  const { isAuthenticated, user } = useAuth();
  const { activeAttendance, activeBreak, startBreak } = useAttendance();
  const isCheckedIn = Boolean(activeAttendance);
  const isCheckedOut = false; // By definition, if activeAttendance exists, it's not checked out
  const isFieldPunch = activeAttendance?.punchType === "FIELD";
  
  // Track location during shift hours (07:00 AM to 07:00 PM) for all authenticated employees (office and field),
  // as well as anytime an employee is checked in
  const isShiftTime = isWithinWorkHours(new Date(), DEFAULT_WORK_HOURS);
  const shouldTrackLocation = isAuthenticated && (isCheckedIn || isShiftTime);

  useEffect(() => {
    let mounted = true;
    let foregroundInterval: any = null;

    async function checkLocationAndAutoBreak() {
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        const permission = await Location.getForegroundPermissionsAsync();
        const locationIsOn = enabled && permission.status === "granted";

        if (locationIsOn) {
          isAlertOpen = false;
        }

        // If location is OFF, and they are checked in as FIELD and NOT on break, trigger auto break!
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

          // Report initial state to backend on startup/resume
          const level = await Battery.getBatteryLevelAsync().catch(() => -1);
          const batteryLevel = level >= 0 ? Math.round(level * 100) : undefined;
          await updateLocationStatus({ isLocationOn: locationIsOn, batteryLevel }).catch((err) => {
            console.warn("[LocationTracker] Failed to update initial location status on backend:", err);
          });

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

      if (!shouldTrackLocation) {
        console.log("[LocationTracker] Tracking inactive (Not logged in or not checked in)");
        await stopBackgroundLocationTracking().catch((error) => {
          console.warn("[LocationTracker] Failed to stop tracking", error);
        });
        if (foregroundInterval) {
          clearInterval(foregroundInterval);
          foregroundInterval = null;
        }
        return;
      }

      const trackingInterval = user?.trackingInterval ?? 60 * 1000; // Default to 60s
      console.log(`[LocationTracker] Syncing tracking status... Interval: ${trackingInterval / 1000}s`);
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
                console.log("[LocationTracker] [Web] Queuing ping:", logs[0]);
                await enqueueLocationLogs(logs);
              },
              (err) => console.error("Web Geolocation Error:", err),
              { enableHighAccuracy: true }
            );
          }
        };

        trackWeb();
        if (!foregroundInterval) {
          foregroundInterval = setInterval(trackWeb, trackingInterval);
        }
      } else {
        console.log("[LocationTracker] Starting mobile background tracking...");
        await startBackgroundLocationTracking(user).catch((error) => {
          console.warn("[LocationTracker] Failed to start tracking", error);
          return false;
        });

        // Sync cached locations if any
        void syncOfflineQueue();

        // Monitor location provider toggle and trigger auto-break
        void checkLocationAndAutoBreak();

        // Mobile foreground location tracking logic (active pinging while app is in foreground)
        const trackMobileForeground = async () => {
          try {
            const enabled = await Location.hasServicesEnabledAsync();
            const permission = await Location.getForegroundPermissionsAsync();
            if (enabled && permission.status === "granted") {
              let position = await Location.getLastKnownPositionAsync().catch(() => null);
              if (!position) {
                position = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
              }

              if (position) {
                const level = await Battery.getBatteryLevelAsync().catch(() => -1);
                const batteryLevel = level >= 0 ? Math.round(level * 100) : undefined;

                const logs: LocationPing[] = [{
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: position.coords.accuracy ?? 0,
                  timestamp: new Date(position.timestamp).toISOString(),
                  batteryLevel
                }];
                console.log("[LocationTracker] [Mobile Foreground] Queuing ping:", logs[0]);
                await enqueueLocationLogs(logs);
              }
            }
          } catch (err) {
            console.warn("[LocationTracker] [Mobile Foreground] Failed to get/send position:", err);
          }
        };

        void trackMobileForeground();
        if (!foregroundInterval) {
          foregroundInterval = setInterval(() => {
            void trackMobileForeground();
          }, trackingInterval);
        }
      }
    }

    void syncTracking();
    const interval = setInterval(() => {
      void syncTracking();
    }, (user?.trackingInterval ?? 60 * 1000));

    return () => {
      mounted = false;
      if (foregroundInterval) clearInterval(foregroundInterval);
      clearInterval(interval);
    };
  }, [isAuthenticated, user, isCheckedIn, isCheckedOut, isFieldPunch, shouldTrackLocation, activeBreak, startBreak]);

  return null;
}

export async function startBackgroundLocationTracking(user?: any): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  const trackingInterval = user?.trackingInterval ?? 60 * 1000; // Default to 60s (1 min)

  try {
    const foreground = await Location.requestForegroundPermissionsAsync();

    if (foreground.status !== Location.PermissionStatus.GRANTED) {
      console.warn("[LocationTracker] Foreground location permission denied.");
      return false;
    }

    const background = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: Location.PermissionStatus.DENIED }));

    if (background.status !== Location.PermissionStatus.GRANTED) {
      console.warn("[LocationTracker] Background location permission denied or not yet granted. Foreground tracking will operate.");
      return false;
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High, // High accuracy GPS tracking
      activityType: Location.ActivityType.AutomotiveNavigation,
      deferredUpdatesInterval: trackingInterval,
      distanceInterval: 0, // No distance gate — send pings on time basis so stationary users aren't falsely marked offline
      foregroundService: {
        notificationTitle: "StaffTrack is running",
        notificationBody: "Location service active.",
        notificationColor: "#1A202C"
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      timeInterval: trackingInterval
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
  // Use Indian Standard Time (IST) hours
  const currentHour = ((date.getUTCHours() + 5) % 24) + (date.getUTCMinutes() + 30) / 60;

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

  await enqueueLocationLogs(newLogs);
}

async function getBatteryPercentage(): Promise<number | undefined> {
  const level = await Battery.getBatteryLevelAsync();

  if (level < 0) {
    return undefined;
  }

  return Math.round(level * 100);
}
