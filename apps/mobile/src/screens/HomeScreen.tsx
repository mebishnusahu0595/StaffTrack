import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Text, TouchableRipple, Icon, Dialog, Portal, IconButton } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

import { API_BASE_URL } from "../config/env";
import { fetchDayEndReports, fetchTodayLocationLogs, uploadPhoto, fetchNotifications, markNotificationAsRead, type AppNotification, type LocationPing, type PunchType } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useAttendance } from "../hooks/useAttendance";
import { useLocation } from "../hooks/useLocation";
import { useTasks } from "../hooks/useTasks";
import { useTimeTracker } from "../hooks/useTimeTracker";
import type { MainDrawerParamList } from "../navigation/AppNavigator";

type HomeNavigation = DrawerNavigationProp<MainDrawerParamList, "Home">;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const { user } = useAuth();
  const { checkIn, checkOut, startBreak, endBreak, isCheckingIn, isCheckingOut, isStartingBreak, isEndingBreak, todayAttendance, activeAttendance, todaySessions, activeBreak } = useAttendance();
  const { getCurrentCoordinates, isLoading: isLocationLoading } = useLocation();
  const { todaysTasks } = useTasks();
  const [currentTime, setCurrentTime] = useState(dayjs());
  const { officeTime, fieldTime, breakTime } = useTimeTracker(todaySessions, currentTime);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [liveLocation, setLiveLocation] = useState<Location.LocationObject | null>(null);

  const reportsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["dayEndReports", user?.id],
    queryFn: () => fetchDayEndReports(user!.id)
  });

  const notificationsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["notifications", user?.id],
    queryFn: fetchNotifications,
    refetchInterval: 30_000
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const isCheckedIn = Boolean(activeAttendance);
  const isCheckedOut = !isCheckedIn && todaySessions.length > 0;
  const isFieldPunch = (activeAttendance || todayAttendance)?.punchType === "FIELD";

  const locationLogsQuery = useQuery({
    enabled: Boolean(user?.id && isFieldPunch),
    queryKey: ["locationLogs", user?.id, "today"],
    queryFn: () => fetchTodayLocationLogs(user!.id),
    refetchInterval: isFieldPunch && !isCheckedOut ? 30_000 : false
  });

  const distanceKm = useMemo(
    () => calculateDistanceKm(locationLogsQuery.data ?? []),
    [locationLogsQuery.data]
  );
  const workMetric = useMemo(() => {
    if (!isCheckedIn) {
      return {
        icon: "hand-pointing-up",
        label: "WORK MODE",
        value: "Select Mode"
      };
    }

    if (isFieldPunch) {
      return {
        icon: "map-marker-distance",
        label: "KM TRACKED",
        value: distanceKm.toFixed(1)
      };
    }

    return {
      icon: "office-building",
      label: "WORK MODE",
      value: "Office"
    };
  }, [distanceKm, isCheckedIn, isFieldPunch]);

  const latestLocationLog = useMemo(() => {
    const logs = locationLogsQuery.data ?? [];
    return logs.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [locationLogsQuery.data]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    async function startWatching() {
      if (!isCheckedIn || isCheckedOut || !isFieldPunch) {
        setLiveLocation(null);
        return;
      }

      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (permission.status !== Location.PermissionStatus.GRANTED || cancelled) {
          return;
        }

        console.log("[Home] Starting live location watch...");
        const nextSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 15000,
              distanceInterval: 25
            },
            (loc) => {
              setLiveLocation(loc);
            }
          );

        if (cancelled) {
          nextSubscription.remove();
          return;
        }

        subscription = nextSubscription;
      } catch (error) {
        console.warn("[Home] Live location watch failed", error);
      }
    }

    void startWatching();

    return () => {
      cancelled = true;
      if (subscription) {
        console.log("[Home] Stopping live location watch...");
        subscription.remove();
      }
    };
  }, [isCheckedIn, isCheckedOut, isFieldPunch]);

  const alreadySubmittedDer = useMemo(
    () => (reportsQuery.data ?? []).some((report) => dayjs(report.date).isSame(dayjs(), "day")),
    [reportsQuery.data]
  );

  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const isBusy = isCheckingIn || isCheckingOut || isStartingBreak || isEndingBreak || isLocationLoading || isTakingPhoto || Boolean(loadingStep);

  async function handleCheckIn(type: PunchType) {
    console.log("[Punch] Starting Check-In flow for type:", type);
    try {
      console.log("[Punch] Requesting camera and picking image...");
      const asset = await pickVerificationImage();
      
      if (!asset) {
        console.log("[Punch] Image picking cancelled or failed.");
        return;
      }

      setLoadingStep("Processing...");
      console.log("[Punch] Running upload and GPS in parallel...");
      
      const [photoUrl, coords] = await Promise.all([
        uploadPhoto(asset).then(url => {
          console.log("[Punch] Photo upload complete.");
          return url;
        }),
        getCurrentCoordinates().then(c => {
          console.log("[Punch] GPS fetch complete.");
          return c;
        })
      ]);
      
      setLoadingStep("Saving...");
      console.log("[Punch] Saving attendance to database...");
      await checkIn({ ...coords, punchType: type, photoUrl });
      console.log("[Punch] Attendance saved successfully!");
      
      Alert.alert("Success", "Check-in successful");
    } catch (error) {
      console.error("[Punch] Error during Check-In:", error);
      Alert.alert("Check-in failed", getErrorMessage(error));
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleCheckOut() {
    console.log("[Punch] Starting Check-Out flow");
    try {
      console.log("[Punch] Requesting camera and picking image...");
      const asset = await pickVerificationImage();
      
      if (!asset) {
        console.log("[Punch] Image picking cancelled or failed.");
        return;
      }

      setLoadingStep("Processing...");
      console.log("[Punch] Running upload and GPS in parallel...");

      const [photoUrl, coords] = await Promise.all([
        uploadPhoto(asset).then(url => {
          console.log("[Punch] Photo upload complete.");
          return url;
        }),
        getCurrentCoordinates().then(c => {
          console.log("[Punch] GPS fetch complete.");
          return c;
        })
      ]);
      
      setLoadingStep("Saving...");
      console.log("[Punch] Saving checkout to database...");
      await checkOut({ ...coords, photoUrl });
      console.log("[Punch] Checkout saved successfully!");
      
      Alert.alert("Success", "Check-out successful");
    } catch (error) {
      console.error("[Punch] Error during Check-Out:", error);
      Alert.alert("Check-out failed", getErrorMessage(error));
    } finally {
      setLoadingStep(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.dateText}>{currentTime.format("dddd, MMM DD")}</Text>
          <Text style={styles.greeting} variant="headlineMedium">
            {getGreeting()}, {user?.name ?? "User"}
          </Text>
        </View>
        <View style={styles.notificationWrapper}>
          <IconButton 
            icon={unreadCount > 0 ? "bell-badge" : "bell-outline"} 
            iconColor={unreadCount > 0 ? "#A4262C" : "#4A6583"}
            size={28}
            onPress={() => setShowNotifications(true)}
          />
          {unreadCount > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      <Card mode="contained" style={styles.card}>
        <Card.Content>
          <View style={styles.statusContainer}>
            <View style={styles.statusColumn}>
              <Text style={styles.mutedLabel}>CURRENT STATUS</Text>
              <View style={styles.statusIndicatorRow}>
                <View style={[styles.statusDot, { backgroundColor: isCheckedIn && !isCheckedOut ? "#A4262C" : "#17633A" }]} />
                <Text style={styles.statusText}>
                  {!isCheckedIn
                    ? "Ready to Start"
                    : activeBreak
                    ? "On Break"
                    : `${activeAttendance?.punchType === "OFFICE" ? "Office" : "Field"}`}
                </Text>
              </View>
            </View>
            <View style={styles.timeColumn}>
              {isCheckedIn ? (
                <>
                  <Text style={styles.timeText}>
                    {activeBreak ? breakTime : activeAttendance?.punchType === "OFFICE" ? officeTime : fieldTime}
                  </Text>
                  <Text style={styles.amPmText}>
                    {activeBreak ? "BRK" : "HRS"}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.timeText}>
                    {currentTime.format("hh:mm:ss")}
                  </Text>
                  <Text style={styles.amPmText}>{currentTime.format("A")}</Text>
                </>
              )}
            </View>
          </View>

          {!isCheckedIn ? (
            <View style={styles.punchButtonsRow}>
              <TouchableRipple
                  disabled={isBusy}
                  onPress={() => void handleCheckIn("OFFICE")}
                  style={[styles.punchButton, { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E0E0E0" }]}
                >
                  <View style={styles.punchButtonContent}>
                    <Icon color="#4A6583" size={32} source="office-building" />
                    <Text style={styles.punchButtonLabel}>OFFICE</Text>
                  </View>
                </TouchableRipple>
              <TouchableRipple
                  disabled={isBusy}
                  onPress={() => void handleCheckIn("FIELD")}
                  style={[styles.punchButton, { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E0E0E0" }]}
                >
                  <View style={styles.punchButtonContent}>
                    <Icon color="#4A6583" size={32} source="map-marker-outline" />
                    <Text style={styles.punchButtonLabel}>FIELD</Text>
                  </View>
                </TouchableRipple>
            </View>
          ) : (
            <View>
              {activeAttendance?.checkInPhotoUrl && (
                <View style={styles.photoContainer}>
                  <Image
                    resizeMode="cover"
                    source={{ uri: activeAttendance.checkInPhotoUrl.startsWith("http") ? activeAttendance.checkInPhotoUrl : `${API_BASE_URL}${activeAttendance.checkInPhotoUrl}` }}
                    style={styles.verificationPhoto}
                  />
                  <Text style={styles.photoLabel}>Check-in Verification Photo</Text>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
                {!activeBreak ? (
                  <Button
                    buttonColor="#F39C12"
                    disabled={isBusy}
                    icon="coffee"
                    loading={isStartingBreak}
                    mode="contained"
                    onPress={() => void startBreak()}
                    style={{ flex: 1, borderRadius: 8 }}
                  >
                    Break On
                  </Button>
                ) : (
                  <Button
                    buttonColor="#27AE60"
                    disabled={isBusy}
                    icon="coffee-outline"
                    loading={isEndingBreak}
                    mode="contained"
                    onPress={() => void endBreak()}
                    style={{ flex: 1, borderRadius: 8 }}
                  >
                    Break Off
                  </Button>
                )}
                <Button
                  buttonColor="#A4262C"
                  disabled={isBusy || Boolean(activeBreak)}
                  icon="logout"
                  loading={isCheckingOut}
                  mode="contained"
                  onPress={handleCheckOut}
                  style={{ flex: 1, borderRadius: 8 }}
                >
                  Check out
                </Button>
              </View>
            </View>
          )}

          {!isCheckedIn && (
            <Text style={styles.verificationNote}>
              Requires Image + GPS verification
            </Text>
          )}
        </Card.Content>
      </Card>

      <View style={styles.summaryRow}>
        <Card mode="contained" style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <Icon color="#4A6583" size={20} source="office-building" />
              <Text style={styles.mutedSummaryLabel}>OFFICE TIME</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 16 }]}>{officeTime}</Text>
          </Card.Content>
        </Card>
        
        <Card mode="contained" style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <Icon color="#4A6583" size={20} source="map-marker-outline" />
              <Text style={styles.mutedSummaryLabel}>FIELD TIME</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 16 }]}>{fieldTime}</Text>
          </Card.Content>
        </Card>

        <Card mode="contained" style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <Icon color="#4A6583" size={20} source="coffee" />
              <Text style={styles.mutedSummaryLabel}>BREAK TIME</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 16, color: activeBreak ? "#F39C12" : "#24312D" }]}>{breakTime}</Text>
          </Card.Content>
        </Card>
      </View>

      <View style={styles.summaryRow}>
        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("Tasks")}>
          <Card.Content>
            <View style={styles.summaryIconRow}>
              <Icon color="#24312D" size={20} source="check-circle-outline" />
              <Text style={styles.mutedSummaryLabel}>TASKS</Text>
            </View>
            <Text style={styles.summaryValue}>{todaysTasks.length}</Text>
          </Card.Content>
        </Card>
        
        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("LeaveRequest")}>
          <Card.Content>
            <View style={styles.summaryIconRow}>
              <Icon color="#24312D" size={20} source="calendar-clock" />
              <Text style={styles.mutedSummaryLabel}>LEAVE</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 14 }]}>Apply</Text>
          </Card.Content>
        </Card>

        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("MonthlyReport")}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <Icon color="#24312D" size={20} source="file-document-outline" />
              <Text style={styles.mutedSummaryLabel}>REPORTS</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 14 }]}>View</Text>
          </Card.Content>
        </Card>
      </View>

      {isCheckedIn && !isCheckedOut && isFieldPunch && (
        <View style={styles.liveTrackingContainer}>
          <View style={styles.liveTrackingHeader}>
            <View style={styles.liveTrackingBadge}>
              <View style={styles.liveTrackingDot} />
              <Text style={styles.liveTrackingText}>Live Tracking Active</Text>
            </View>
            <View style={styles.coordinatesPill}>
              <Icon source="crosshairs-gps" size={14} color="#66736F" />
              <Text style={styles.coordinatesText}>
                {liveLocation ? `${liveLocation.coords.latitude.toFixed(4)}, ${liveLocation.coords.longitude.toFixed(4)}` : "Locating..."}
              </Text>
            </View>
          </View>
          
          <Card mode="contained" style={styles.logCard}>
            <Card.Content style={styles.logContent}>
              <View style={styles.logHeader}>
                <View style={styles.logIconBox}>
                  <Icon source="history" size={20} color="#4A6583" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logTitle}>Live Activity Logs</Text>
                  <Text style={styles.logSubtitle}>Last ping: {currentTime.format("hh:mm:ss A")}</Text>
                </View>
                <TouchableRipple
                  onPress={() => {
                    const lat = liveLocation?.coords.latitude ?? latestLocationLog?.lat;
                    const lng = liveLocation?.coords.longitude ?? latestLocationLog?.lng;
                    if (lat && lng) {
                      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                      if (Platform.OS === "web") {
                        void Linking.openURL(url);
                      } else {
                        void Linking.openURL(url).catch(() => {
                          Alert.alert("Open Maps", "Unable to open maps on this device.");
                        });
                      }
                    }
                  }}
                  style={styles.mapsButton}
                >
                  <Icon source="map-search" size={20} color="#17633A" />
                </TouchableRipple>
              </View>
              <View style={styles.logCoordsRow}>
                <View style={styles.coordBox}>
                   <Text style={styles.coordLabel}>LATITUDE</Text>
                   <Text style={styles.coordValue}>{(liveLocation?.coords.latitude ?? latestLocationLog?.lat)?.toFixed(6) ?? "0.000000"}</Text>
                </View>
                <View style={styles.coordDivider} />
                <View style={styles.coordBox}>
                   <Text style={styles.coordLabel}>LONGITUDE</Text>
                   <Text style={styles.coordValue}>{(liveLocation?.coords.longitude ?? latestLocationLog?.lng)?.toFixed(6) ?? "0.000000"}</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        </View>
      )}

      {!alreadySubmittedDer && isCheckedIn ? (
        <Button
          icon="file-document-edit"
          mode="outlined"
          onPress={() => navigation.navigate("DayEndReport")}
          style={styles.derButton}
        >
          Submit day end report
        </Button>
      ) : null}

      {/* Notifications Modal */}
      <Portal>
        <Dialog visible={showNotifications} onDismiss={() => setShowNotifications(false)} style={styles.notificationDialog}>
          <Dialog.Title style={styles.dialogTitle}>Notifications</Dialog.Title>
          <Dialog.Content style={{ maxHeight: 400 }}>
            <ScrollView>
              {notifications.length === 0 ? (
                <Text style={styles.emptyText}>No notifications yet.</Text>
              ) : (
                notifications.map((n) => (
                  <TouchableRipple 
                    key={n.id} 
                    onPress={async () => {
                      if (!n.isRead) {
                        await markNotificationAsRead(n.id);
                        notificationsQuery.refetch();
                      }
                    }}
                    style={[styles.notificationItem, !n.isRead && styles.unreadItem]}
                  >
                    <View>
                      <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle}>{n.title}</Text>
                        {!n.isRead && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notificationMsg}>{n.message}</Text>
                      <Text style={styles.notificationTime}>{dayjs(n.createdAt).fromNow()}</Text>
                    </View>
                  </TouchableRipple>
                ))
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowNotifications(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {isBusy && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#1A202C" size="large" />
          <Text style={styles.loadingText}>{loadingStep || "Processing..."}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function getGreeting() {
  const hour = dayjs().hour();

  if (hour < 12) {
    return "Good Morning";
  }

  if (hour < 17) {
    return "Good Afternoon";
  }

  return "Good Evening";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Please try again.";
}

function calculateDistanceKm(logs: LocationPing[]) {
  const ACCURACY_THRESHOLD = 50; // Ignore points with > 50m error
  const MIN_DISTANCE_THRESHOLD = 0.03; // 30 meters (to filter drift)

  const filteredLogs = logs
    .filter((log) => log.accuracy > 0 && log.accuracy <= ACCURACY_THRESHOLD)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let totalDistance = 0;
  let lastStablePoint: LocationPing | null = null;

  for (const point of filteredLogs) {
    if (!lastStablePoint) {
      lastStablePoint = point;
      continue;
    }

    const distance = haversineKm(lastStablePoint, point);
    if (distance >= MIN_DISTANCE_THRESHOLD) {
      totalDistance += distance;
      lastStablePoint = point;
    }
  }

  return totalDistance;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * radiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

async function pickVerificationImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  console.log("[Camera] Requesting permissions...");
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    console.warn("[Camera] Permission denied!");
    Alert.alert("Permission denied", "Camera access is required for verification.");
    return null;
  }

  console.log("[Camera] Launching camera...");
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.5
  });

  console.log("[Camera] Launch results:", result.canceled ? "Cancelled" : "Success");
  return result.canceled ? null : result.assets[0];
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9F8"
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 100
  },
  notificationWrapper: {
    position: 'relative'
  },
  badgeCount: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#A4262C',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold'
  },
  notificationDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 20
  },
  dialogTitle: {
    fontWeight: '800',
    color: '#24312D'
  },
  notificationItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  unreadItem: {
    backgroundColor: '#F8F9FA'
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#24312D'
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A4262C'
  },
  notificationMsg: {
    fontSize: 12,
    color: '#66736F',
    lineHeight: 18
  },
  notificationTime: {
    fontSize: 10,
    color: '#9BA3A1',
    marginTop: 6,
    fontWeight: '600'
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingTop: 12
  },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 10
  },
  headerCopy: {
    flex: 1
  },
  greeting: {
    color: "#24312D",
    fontWeight: "700"
  },
  dateText: {
    color: "#66736F",
    fontSize: 16,
    marginBottom: 4
  },
  card: {
    borderRadius: 16,
    backgroundColor: "#EEEEEE"
  },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8
  },
  statusColumn: {
    flex: 2
  },
  timeColumn: {
    flex: 1,
    alignItems: "flex-end"
  },
  mutedLabel: {
    color: "#66736F",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 2
  },
  statusIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  statusText: {
    color: "#24312D",
    fontWeight: "700",
    fontSize: 14
  },
  timeText: {
    color: "#4A6583",
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 22
  },
  amPmText: {
    color: "#4A6583",
    fontSize: 10,
    fontWeight: "700"
  },
  punchButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24
  },
  punchButton: {
    flex: 1,
    borderRadius: 16,
    height: 100,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      web: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.05)"
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
      }
    })
  },

  punchButtonContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  punchButtonLabel: {
    color: "#4A6583",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.5
  },
  verificationNote: {
    color: "#66736F",
    textAlign: "center",
    fontSize: 12,
    marginTop: 16
  },
  completeText: {
    color: "#17633A",
    fontWeight: "700",
    textAlign: "center"
  },
  photoContainer: {
    marginTop: 20,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD"
  },
  verificationPhoto: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
  },
  photoLabel: {
    marginTop: 8,
    fontSize: 12,
    color: "#66736F",
    fontWeight: "600"
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8
  },
  summaryCard: {
    borderRadius: 8,
    backgroundColor: "#EEEEEE",
    flex: 1
  },
  summaryContent: {
    padding: 12,
    paddingHorizontal: 8
  },
  summaryIconRow: {
    flexDirection: "column",
    gap: 4,
    marginBottom: 4
  },
  mutedSummaryLabel: {
    color: "#24312D",
    fontSize: 10,
    fontWeight: "600"
  },
  summaryValue: {
    color: "#24312D",
    fontSize: 20,
    fontWeight: "700"
  },
  derButton: {
    borderRadius: 8,
    marginTop: 16
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000
  },
  loadingText: {
    marginTop: 12,
    color: "#1A202C",
    fontWeight: "600"
  },
  liveTrackingContainer: {
    marginTop: 8,
    gap: 12
  },
  liveTrackingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  liveTrackingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 8
  },
  liveTrackingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#17633A"
  },
  liveTrackingText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#17633A",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  coordinatesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEEEEE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  coordinatesText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#66736F"
  },
  logCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0"
  },
  logContent: {
    padding: 16
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16
  },
  logIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F0F4F8",
    alignItems: "center",
    justifyContent: "center"
  },
  logTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#24312D"
  },
  logSubtitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "#66736F",
    marginTop: 2
  },
  mapsButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E7F3EF",
    alignItems: "center",
    justifyContent: "center"
  },
  logCoordsRow: {
    flexDirection: "row",
    backgroundColor: "#F7F9F8",
    borderRadius: 12,
    padding: 12,
    alignItems: "center"
  },
  coordBox: {
    flex: 1,
    alignItems: "center"
  },
  coordLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#66736F",
    marginBottom: 4,
    letterSpacing: 1
  },
  coordValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4A6583",
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  coordDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E0E0E0"
  },
  emptyText: {
    color: "#66736F",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center"
  }
});
