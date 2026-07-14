import * as Location from "expo-location";
import { useCallback, useState } from "react";

import type { LatLng } from "../api";

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestForegroundPermission = useCallback(async () => {
    console.log("[Location] Requesting foreground permissions...");
    const permission = await Location.requestForegroundPermissionsAsync();
    console.log("[Location] Foreground permission status:", permission.status);

    if (permission.status !== Location.PermissionStatus.GRANTED) {
      console.warn("[Location] Permission denied!");
      throw new Error("Location permission is required");
    }

    return permission;
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<Location.LocationObject> => {
    setError(null);
    setIsLoading(true);
    console.log("[Location] Starting to fetch current location...");

    try {
      await requestForegroundPermission();
      console.log("[Location] Permission granted, checking last known position...");
      
      let currentLocation = await Location.getLastKnownPositionAsync().catch(() => null);
      const fiveMinutes = 5 * 60 * 1000;
      
      if (!currentLocation || (Date.now() - currentLocation.timestamp) > fiveMinutes) {
        console.log("[Location] No fresh cached location. Getting current position...");
        try {
          // 15-second timeout to prevent hanging forever on buggy devices
          const positionPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Location request timed out")), 15000)
          );
          
          currentLocation = await Promise.race([positionPromise, timeoutPromise]);
        } catch (gpsError) {
          console.warn("[Location] getCurrentPositionAsync failed or timed out. Falling back to last known position...", gpsError);
          currentLocation = currentLocation || await Location.getLastKnownPositionAsync().catch(() => null);
          if (!currentLocation) {
            throw new Error("GPS signal is weak or not available. Please go to an open area, restart location services, and try again.");
          }
        }
      } else {
        console.log("[Location] Using cached last known position.");
      }
      
      console.log("[Location] Position resolved successfully:", currentLocation.coords);
      setLocation(currentLocation);
      return currentLocation;
    } catch (locationError) {
      console.error("[Location] Error fetching position:", locationError);
      const message =
        locationError instanceof Error ? locationError.message : "Unable to get current location";
      setError(message);
      throw locationError;
    } finally {
      setIsLoading(false);
    }
  }, [requestForegroundPermission]);

  const getCurrentCoordinates = useCallback(async (): Promise<LatLng> => {
    const currentLocation = await getCurrentLocation();

    return {
      lat: currentLocation.coords.latitude,
      lng: currentLocation.coords.longitude
    };
  }, [getCurrentLocation]);

  return {
    error,
    getCurrentCoordinates,
    getCurrentLocation,
    isLoading,
    location,
    requestForegroundPermission
  };
}
