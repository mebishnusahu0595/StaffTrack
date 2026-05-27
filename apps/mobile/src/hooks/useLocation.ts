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
      console.log("[Location] Permission granted, getting position...");
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      console.log("[Location] Position fetched successfully:", currentLocation.coords);
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
