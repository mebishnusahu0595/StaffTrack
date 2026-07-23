import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Platform, StyleSheet, View } from "react-native";
import { Button, Card, Text, TouchableRipple, Icon, Dialog, Portal, TextInput } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { API_ORIGIN_URL } from "../config/env";
import { 
  fetchDayEndReports, 
  fetchTodayLocationLogs, 
  fetchExpenses, 
  createExpense, 
  uploadExpenseReceipt, 
  uploadPhoto, 
  type LocationPing, 
  type PunchType 
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { useAttendance } from "../hooks/useAttendance";
import { useLocation } from "../hooks/useLocation";
import { useTimeTracker } from "../hooks/useTimeTracker";
import { AppIcon } from "./AppIcon";

/**
 * Self-contained personal attendance panel: office/field punch with photo +
 * odometer capture, live KM tracking, time summary, day-end-report shortcut and
 * the day's odometer readings. Shared by the staff Home and the Manager Home so
 * a manager can clock their own day exactly like a field employee.
 */
export function PersonalAttendancePanel({ 
  onNavigateDayEnd,
  onNavigateExpense,
  hideTimeSummary = false,
  hideDayEndButton = false
}: { 
  onNavigateDayEnd?: () => void;
  onNavigateExpense?: () => void;
  hideTimeSummary?: boolean;
  hideDayEndButton?: boolean;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { checkIn, checkOut, startBreak, endBreak, isCheckingIn, isCheckingOut, isStartingBreak, isEndingBreak, todayAttendance, activeAttendance, todaySessions, activeBreak } = useAttendance();
  const { getCurrentCoordinates, isLoading: isLocationLoading } = useLocation();
  const [currentTime, setCurrentTime] = useState(dayjs());
  const { officeTime, fieldTime, breakTime, friendlyBreakTime } = useTimeTracker(todaySessions, currentTime);
  const [isTakingPhoto] = useState(false);
  const [liveLocation, setLiveLocation] = useState<Location.LocationObject | null>(null);

  const [odoModalVisible, setOdoModalVisible] = useState(false);
  const [odoValue, setOdoValue] = useState("");
  const [odoTitle, setOdoTitle] = useState("");
  const [odoResolve, setOdoResolve] = useState<{ resolve: (val: number | null) => void } | null>(null);

  function promptOdometerReading(type: "Start" | "End"): Promise<number | null> {
    return new Promise((resolve) => {
      setOdoTitle(`${type} Day Odometer`);
      setOdoValue("");
      setOdoResolve({ resolve });
      setOdoModalVisible(true);
    });
  }

  const reportsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["dayEndReports", user?.id],
    queryFn: () => fetchDayEndReports(user!.id)
  });

  const isCheckedIn = Boolean(activeAttendance);
  const isCheckedOut = !isCheckedIn && todaySessions.length > 0;
  const isFieldPunch = (activeAttendance || todayAttendance)?.punchType === "FIELD";
  const currentStatusLabel = !isCheckedIn
    ? "Ready to Start"
    : activeAttendance?.isCheckInPending
    ? "Pending Approval"
    : activeBreak
    ? "On Break"
    : activeAttendance?.punchType === "OFFICE"
    ? "Office"
    : activeAttendance?.punchType === "FIELD"
    ? "Field"
    : "Active";

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

  // 50km+ Daily Travel Expense calculation & states
  const odoDistanceKm = useMemo(() => {
    const record = todayAttendance || activeAttendance;
    if (record?.startOdometer != null && record?.endOdometer != null) {
      return Math.max(0, record.endOdometer - record.startOdometer);
    }
    return 0;
  }, [todayAttendance?.startOdometer, todayAttendance?.endOdometer, activeAttendance?.startOdometer, activeAttendance?.endOdometer]);

  const effectiveKm = useMemo(() => {
    return Math.max(odoDistanceKm, distanceKm);
  }, [odoDistanceKm, distanceKm]);

  const isToday = useMemo(() => {
    const record = todayAttendance || activeAttendance;
    if (!record) return true;
    return dayjs(record.date).isSame(dayjs(), "day");
  }, [todayAttendance, activeAttendance]);

  // Check if staff is Sales Officer (exclude Field Assistant / F/A)
  const isSalesOfficer = useMemo(() => {
    const d = (user?.designation || "").trim().toLowerCase();
    if (
      d.includes("field assistant") ||
      d.includes("f/a") ||
      d.includes("f.a") ||
      d.includes("field-assistant") ||
      d.includes("assistant")
    ) {
      return false;
    }
    return true;
  }, [user?.designation]);

  const show50KmExpenseCard = Boolean(
    isSalesOfficer &&
    isToday &&
    (todayAttendance || activeAttendance) &&
    !(todayAttendance || activeAttendance)?.isCheckInPending &&
    ((todayAttendance || activeAttendance)?.punchType === "FIELD" || isFieldPunch) &&
    effectiveKm >= 50
  );

  const expensesQuery = useQuery({
    enabled: Boolean(user?.id && show50KmExpenseCard),
    queryKey: ["expenses", user?.id],
    queryFn: () => fetchExpenses()
  });

  const todayTravelExpense = useMemo(() => {
    const expenses = expensesQuery.data ?? [];
    return expenses.find(
      (e) =>
        dayjs(e.date).isSame(dayjs(), "day") &&
        (e.category === "TRAVEL" || e.description?.toLowerCase().includes("travel"))
    );
  }, [expensesQuery.data]);

  const [travelDialogVisible, setTravelDialogVisible] = useState(false);
  const [travelAmount, setTravelAmount] = useState("");
  const [travelDesc, setTravelDesc] = useState("");
  const [travelReceipt, setTravelReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSubmittingTravelExpense, setIsSubmittingTravelExpense] = useState(false);

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
        if (permission.status !== Location.PermissionStatus.GRANTED || cancelled) return;
        const nextSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 25 },
          (loc) => setLiveLocation(loc)
        );
        if (cancelled) {
          nextSubscription.remove();
          return;
        }
        subscription = nextSubscription;
      } catch (error) {
        console.warn("[Panel] Live location watch failed", error);
      }
    }

    void startWatching();
    return () => {
      cancelled = true;
      if (subscription) subscription.remove();
    };
  }, [isCheckedIn, isCheckedOut, isFieldPunch]);

  const alreadySubmittedDer = useMemo(
    () => (reportsQuery.data ?? []).some((report) => dayjs(report.date).isSame(dayjs(), "day")),
    [reportsQuery.data]
  );

  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const isBusy = isCheckingIn || isCheckingOut || isStartingBreak || isEndingBreak || isLocationLoading || isTakingPhoto || Boolean(loadingStep);

  async function pickOdometerImage(type: "Start" | "End"): Promise<ImagePicker.ImagePickerAsset | null> {
    return new Promise((resolve) => {
      Alert.alert(
        "Odometer Photo Required",
        `Please take a clear photo of the vehicle odometer for the ${type === "Start" ? "start" : "end"} of your field day.`,
        [
          { text: "Cancel", onPress: () => resolve(null), style: "cancel" },
          { text: "Take Photo", onPress: async () => resolve(await pickVerificationImage({ quality: 0.5 })) } // quality 0.5 ensures clear numbers
        ],
        { cancelable: false }
      );
    });
  }

  async function handleCheckIn(type: PunchType) {
    try {
      // 1. Enforce Location services enabled (GPS toggle is ON)
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          "Location Required",
          "Please turn ON your phone's location services (GPS) in the quick settings/settings to punch in."
        );
        return;
      }

      // 2. Enforce Foreground Permission
      const foreground = await Location.getForegroundPermissionsAsync();
      if (foreground.status !== Location.PermissionStatus.GRANTED) {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== Location.PermissionStatus.GRANTED) {
          Alert.alert(
            "Location Permission Required",
            "This app requires foreground location permission to punch in. Please enable it in your phone settings."
          );
          return;
        }
      }

      // 3. Enforce Background Permission if FIELD work
      if (type === "FIELD") {
        const background = await Location.getBackgroundPermissionsAsync();
        if (background.status !== Location.PermissionStatus.GRANTED) {
          const reqBg = await Location.requestBackgroundPermissionsAsync();
          if (reqBg.status !== Location.PermissionStatus.GRANTED) {
            Alert.alert(
              "Background Location Required",
              "FIELD work requires background location tracking (Access 'All the time'). Please enable it in your phone settings."
            );
            return;
          }
        }
      }

      const asset = await pickVerificationImage({ quality: 0.4 }); // quality 0.4 for attendance face photo
      if (!asset) return;

      let startOdometerPhotoUrl: string | undefined;
      let startOdometer: number | undefined;
      if (type === "FIELD" && isSalesOfficer) {
        const odoAsset = await pickOdometerImage("Start");
        if (!odoAsset) return;
        const reading = await promptOdometerReading("Start");
        if (reading === null) return;
        startOdometer = reading;
        setLoadingStep("Uploading Odometer...");
        startOdometerPhotoUrl = await uploadPhoto(odoAsset);
      }

      setLoadingStep("Processing...");
      const [photoUrl, coords] = await Promise.all([uploadPhoto(asset), getCurrentCoordinates()]);
      setLoadingStep("Saving...");
      await checkIn({ ...coords, punchType: type, photoUrl, startOdometerPhotoUrl, startOdometer });
      Alert.alert("Success", "Check-in successful");
    } catch (error) {
      Alert.alert("Check-in failed", getErrorMessage(error));
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleCheckOut() {
    try {
      const asset = await pickVerificationImage({ quality: 0.4 }); // quality 0.4 for attendance face photo
      if (!asset) return;

      const isField = activeAttendance?.punchType === "FIELD";
      let endOdometerPhotoUrl: string | undefined;
      let endOdometer: number | undefined;
      if (isField && isSalesOfficer) {
        const odoAsset = await pickOdometerImage("End");
        if (!odoAsset) return;
        const reading = await promptOdometerReading("End");
        if (reading === null) return;
        endOdometer = reading;
        setLoadingStep("Uploading Odometer...");
        endOdometerPhotoUrl = await uploadPhoto(odoAsset);
      }

      setLoadingStep("Processing...");
      const [photoUrl, coords] = await Promise.all([uploadPhoto(asset), getCurrentCoordinates()]);
      setLoadingStep("Saving...");
      await checkOut({ ...coords, photoUrl, endOdometerPhotoUrl, endOdometer });
      Alert.alert("Success", "Check-out successful");
    } catch (error) {
      Alert.alert("Check-out failed", getErrorMessage(error));
    } finally {
      setLoadingStep(null);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Card mode="contained" style={styles.card}>
        <Card.Content>
          <View style={styles.statusContainer}>
            <View style={styles.statusColumn}>
              <Text style={styles.mutedLabel}>CURRENT STATUS</Text>
              <View style={styles.statusIndicatorRow}>
                <View style={[styles.statusDot, { backgroundColor: activeAttendance?.isCheckInPending ? "#F59E0B" : isCheckedIn && !isCheckedOut ? "#A4262C" : "#17633A" }]} />
                <Text style={styles.statusText}>{currentStatusLabel}</Text>
              </View>
              {isCheckedIn && (activeAttendance?.checkInTime || todayAttendance?.checkInTime) && (
                <Text style={{ fontSize: 11, fontWeight: "bold", color: "#64748B", marginTop: 4 }}>
                  Check-in: {dayjs(activeAttendance?.checkInTime || todayAttendance?.checkInTime).format("hh:mm A")}
                </Text>
              )}
            </View>
            <View style={styles.timeColumn}>
              {isCheckedIn ? (
                activeAttendance?.isCheckInPending ? (
                  <>
                    <Text style={[styles.timeText, { color: "#B45309" }]}>--:--:--</Text>
                    <Text style={[styles.amPmText, { color: "#B45309" }]}>PENDING</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.timeText}>{activeBreak ? breakTime : activeAttendance?.punchType === "OFFICE" ? officeTime : fieldTime}</Text>
                    <Text style={styles.amPmText}>{activeBreak ? "BRK" : "HRS"}</Text>
                  </>
                )
              ) : (
                <>
                  <Text style={styles.timeText}>{currentTime.format("hh:mm:ss")}</Text>
                  <Text style={styles.amPmText}>{currentTime.format("A")}</Text>
                </>
              )}
            </View>
          </View>

          {!isCheckedIn ? (
            <View style={styles.punchButtonsRow}>
              <TouchableRipple disabled={isBusy} onPress={() => void handleCheckIn("OFFICE")} style={[styles.punchButton, { borderWidth: 1, borderColor: "#E0E0E0", backgroundColor: "#FFFFFF" }]}>
                <View style={styles.punchButtonContent}>
                  <AppIcon color="#4A6583" name="office-building" size={32} />
                  <Text style={styles.punchButtonLabel}>OFFICE</Text>
                </View>
              </TouchableRipple>
              <TouchableRipple disabled={isBusy} onPress={() => void handleCheckIn("FIELD")} style={[styles.punchButton, { borderWidth: 1, borderColor: "#E0E0E0", backgroundColor: "#FFFFFF" }]}>
                <View style={styles.punchButtonContent}>
                  <AppIcon color="#4A6583" name="map-marker-outline" size={32} />
                  <Text style={styles.punchButtonLabel}>FIELD</Text>
                </View>
              </TouchableRipple>
            </View>
          ) : (
            <View>
              {activeAttendance?.isCheckInPending ? (
                <View style={styles.pendingCard}>
                  <View style={styles.pendingHeaderRow}>
                    <Icon source="clock-alert-outline" size={24} color="#D97706" />
                    <Text style={styles.pendingTitle}>Check-In Pending Approval</Text>
                  </View>
                  <Text style={styles.pendingText}>Your check-in is pending approval because it was registered after your shift start time.</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                  {!activeBreak ? (
                    <Button buttonColor="#F39C12" disabled={isStartingBreak || isEndingBreak} icon="coffee" loading={isStartingBreak} mode="contained" onPress={() => void startBreak()} style={{ flex: 1, borderRadius: 8 }}>Break On</Button>
                  ) : (
                    <Button buttonColor="#27AE60" disabled={isStartingBreak || isEndingBreak} icon="coffee-outline" loading={isEndingBreak} mode="contained" onPress={() => void endBreak()} style={{ flex: 1, borderRadius: 8 }}>Break Off</Button>
                  )}
                  <Button buttonColor="#A4262C" disabled={isBusy || Boolean(activeBreak)} icon="logout" loading={isCheckingOut} mode="contained" onPress={handleCheckOut} style={{ flex: 1, borderRadius: 8 }}>Check out</Button>
                </View>
              )}

              {activeAttendance?.checkInPhotoUrl && (
                <View style={{ marginTop: 16 }}>
                  <View style={{ flexDirection: "row", gap: 12, justifyContent: "center" }}>
                    <View style={activeAttendance?.startOdometerPhotoUrl ? { flex: 1, alignItems: "center" } : { width: 120, alignItems: "center" }}>
                      <PanelImage source={{ uri: absUrl(activeAttendance.checkInPhotoUrl) }} style={{ width: "100%", height: 110, borderRadius: 8, borderWidth: 1, borderColor: "#DDDDDD" }} />
                      <Text style={{ fontSize: 9, color: "#66736F", fontWeight: "700", marginTop: 4 }}>Check-in Photo</Text>
                    </View>
                    {isFieldPunch && activeAttendance?.startOdometerPhotoUrl ? (
                      <View style={{ flex: 1, alignItems: "center" }}>
                        <PanelImage source={{ uri: absUrl(activeAttendance.startOdometerPhotoUrl) }} style={{ width: "100%", height: 110, borderRadius: 8, borderWidth: 1, borderColor: "#DDDDDD" }} />
                        <Text style={{ fontSize: 9, color: "#66736F", fontWeight: "700", marginTop: 4 }}>Odometer Photo</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
            </View>
          )}

          {!isCheckedIn && <Text style={styles.verificationNote}>Requires Image + GPS verification</Text>}
        </Card.Content>
      </Card>

      {/* Time summary */}
      {!hideTimeSummary && (
        <View style={{ gap: 8 }}>
          <View style={styles.summaryRow}>
            <Card mode="contained" style={styles.summaryCard}>
              <Card.Content style={styles.summaryContent}>
                <View style={styles.summaryIconRow}><AppIcon color="#4A6583" name="office-building" size={20} /><Text style={styles.mutedSummaryLabel}>OFFICE TIME</Text></View>
                <Text style={[styles.summaryValue, { fontSize: 16 }]}>{officeTime}</Text>
              </Card.Content>
            </Card>
            <Card mode="contained" style={styles.summaryCard}>
              <Card.Content style={styles.summaryContent}>
                <View style={styles.summaryIconRow}><AppIcon color="#4A6583" name="map-marker-outline" size={20} /><Text style={styles.mutedSummaryLabel}>FIELD TIME</Text></View>
                <Text style={[styles.summaryValue, { fontSize: 16 }]}>{fieldTime}</Text>
              </Card.Content>
            </Card>
          </View>
          <View style={styles.summaryRow}>
            <Card mode="contained" style={styles.summaryCard}>
              <Card.Content style={styles.summaryContent}>
                <View style={styles.summaryIconRow}><AppIcon color="#F39C12" name="coffee" size={20} /><Text style={styles.mutedSummaryLabel}>TOTAL BREAK</Text></View>
                <Text style={[styles.summaryValue, { fontSize: 16 }]}>{friendlyBreakTime}</Text>
              </Card.Content>
            </Card>
            <Card mode="contained" style={styles.summaryCard}>
              <Card.Content style={styles.summaryContent}>
                <View style={styles.summaryIconRow}><AppIcon color="#4A6583" name="map-marker-distance" size={20} /><Text style={styles.mutedSummaryLabel}>KM TODAY</Text></View>
                <Text style={[styles.summaryValue, { fontSize: 16 }]}>{distanceKm.toFixed(1)}</Text>
              </Card.Content>
            </Card>
          </View>
        </View>
      )}

      {/* Live tracking */}
      {!hideTimeSummary && isCheckedIn && !isCheckedOut && isFieldPunch && (
        <Card mode="contained" style={styles.logCard}>
          <Card.Content style={styles.logContent}>
            <View style={styles.logHeader}>
              <View style={styles.logIconBox}><Icon source="history" size={20} color="#4A6583" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.logTitle}>Live Activity Logs</Text>
                <Text style={styles.logSubtitle}>Last ping: {currentTime.format("hh:mm:ss A")}</Text>
              </View>
              <TouchableRipple
                onPress={() => {
                  const lat = liveLocation?.coords.latitude ?? latestLocationLog?.lat;
                  const lng = liveLocation?.coords.longitude ?? latestLocationLog?.lng;
                  if (lat && lng) void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => Alert.alert("Open Maps", "Unable to open maps."));
                }}
                style={styles.mapsButton}
              >
                <Icon source="map-search" size={20} color="#17633A" />
              </TouchableRipple>
            </View>
            <View style={styles.logCoordsRow}>
              <View style={styles.coordBox}><Text style={styles.coordLabel}>LATITUDE</Text><Text style={styles.coordValue}>{(liveLocation?.coords.latitude ?? latestLocationLog?.lat)?.toFixed(6) ?? "0.000000"}</Text></View>
              <View style={styles.coordDivider} />
              <View style={styles.coordBox}><Text style={styles.coordLabel}>LONGITUDE</Text><Text style={styles.coordValue}>{(liveLocation?.coords.longitude ?? latestLocationLog?.lng)?.toFixed(6) ?? "0.000000"}</Text></View>
            </View>
          </Card.Content>
        </Card>
      )}

      {!hideDayEndButton && !alreadySubmittedDer && isCheckedIn && onNavigateDayEnd ? (
        <Button icon="file-document-edit" mode="outlined" onPress={onNavigateDayEnd} style={{ borderRadius: 8 }}>Submit day end report</Button>
      ) : null}

      {/* Today's odometer readings */}
      {!hideTimeSummary && isSalesOfficer && todayAttendance && !todayAttendance.isCheckInPending && todayAttendance.punchType === "FIELD" && (todayAttendance.startOdometerPhotoUrl || todayAttendance.endOdometerPhotoUrl || (todayAttendance.startOdometer !== undefined && todayAttendance.startOdometer !== null)) ? (
        <Card mode="contained" style={{ borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" }}>
          <Card.Content style={{ padding: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#24312D", marginBottom: 12, letterSpacing: 0.5 }}>TODAY&apos;S ODOMETER READINGS</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F8FAFC", borderRadius: 8, padding: 8, marginBottom: 12 }}>
              <View style={{ alignItems: "center", flex: 1 }}>
                <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "700" }}>START ODOMETER</Text>
                <Text style={{ fontSize: 12, color: "#0F172A", fontWeight: "800", marginTop: 2 }}>{todayAttendance.startOdometer != null ? `${todayAttendance.startOdometer} km` : "Not Recorded"}</Text>
              </View>
              <View style={{ width: 1, backgroundColor: "#E2E8F0" }} />
              <View style={{ alignItems: "center", flex: 1 }}>
                <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "700" }}>END ODOMETER</Text>
                <Text style={{ fontSize: 12, color: "#0F172A", fontWeight: "800", marginTop: 2 }}>{todayAttendance.endOdometer != null ? `${todayAttendance.endOdometer} km` : "Not Recorded"}</Text>
              </View>
              {todayAttendance.startOdometer != null && todayAttendance.endOdometer != null ? (
                <>
                  <View style={{ width: 1, backgroundColor: "#E2E8F0" }} />
                  <View style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "700" }}>KM TRAVELLED</Text>
                    <Text style={{ fontSize: 12, color: "#0F172A", fontWeight: "800", marginTop: 2 }}>{Math.max(0, todayAttendance.endOdometer - todayAttendance.startOdometer).toFixed(1)} km</Text>
                  </View>
                </>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {todayAttendance.startOdometerPhotoUrl ? (
                <View style={{ flex: 1, alignItems: "center" }}>
                  <PanelImage source={{ uri: absUrl(todayAttendance.startOdometerPhotoUrl) }} style={{ width: "100%", height: 110, borderRadius: 6, borderWidth: 1, borderColor: "#E2E8F0" }} />
                  <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "600", marginTop: 4 }}>Start Day Odometer</Text>
                </View>
              ) : null}
              {todayAttendance.endOdometerPhotoUrl ? (
                <View style={{ flex: 1, alignItems: "center" }}>
                  <PanelImage source={{ uri: absUrl(todayAttendance.endOdometerPhotoUrl) }} style={{ width: "100%", height: 110, borderRadius: 6, borderWidth: 1, borderColor: "#E2E8F0" }} />
                  <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "600", marginTop: 4 }}>End Day Odometer</Text>
                </View>
              ) : null}
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {/* 50+ KM Daily Travel Expense Claim Option (Inline card at bottom of module, active till 12 AM) */}
      {show50KmExpenseCard ? (
        <Card
          mode="contained"
          style={{
            borderRadius: 16,
            backgroundColor: todayTravelExpense ? "#F0FDF4" : "#EFF6FF",
            borderWidth: 1.5,
            borderColor: todayTravelExpense ? "#86EFAC" : "#BFDBFE",
            marginTop: 4
          }}
        >
          <Card.Content style={{ padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: todayTravelExpense ? "#DCFCE7" : "#DBEAFE",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <AppIcon
                  name={todayTravelExpense ? "check-decagram" : "car-sports"}
                  size={24}
                  color={todayTravelExpense ? "#166534" : "#1D4ED8"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: todayTravelExpense ? "#166534" : "#1E40AF" }}>
                    {todayTravelExpense ? "TRAVEL EXPENSE SUBMITTED" : "50+ KM TRAVEL EXPENSE CLAIM"}
                  </Text>
                  <View style={{ backgroundColor: todayTravelExpense ? "#BBF7D0" : "#93C5FD", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 9, fontWeight: "800", color: todayTravelExpense ? "#14532D" : "#1E3A8A" }}>
                      {effectiveKm.toFixed(1)} KM
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: todayTravelExpense ? "#15803D" : "#3B82F6", marginTop: 2, fontWeight: "500" }}>
                  {todayTravelExpense
                    ? `Amount: INR ${Number(todayTravelExpense.amount).toFixed(2)} (${todayTravelExpense.approved ? "Approved" : "Pending Approval"})`
                    : `You traveled ${effectiveKm.toFixed(1)} km today (over 50 km). Submit your daily travel expense before 12 AM.`}
                </Text>
              </View>
            </View>

            {!todayTravelExpense && (
              <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                <Button
                  mode="contained"
                  buttonColor="#2563EB"
                  textColor="#FFFFFF"
                  icon="cash-plus"
                  onPress={() => {
                    setTravelAmount("");
                    setTravelDesc(`Travel expense for ${effectiveKm.toFixed(1)} km field travel on ${dayjs().format("DD MMM YYYY")}`);
                    setTravelReceipt(null);
                    setTravelDialogVisible(true);
                  }}
                  style={{ flex: 1, borderRadius: 10 }}
                  labelStyle={{ fontSize: 12, fontWeight: "700" }}
                >
                  Submit Travel Expense
                </Button>
                {onNavigateExpense && (
                  <Button
                    mode="outlined"
                    textColor="#1E40AF"
                    onPress={onNavigateExpense}
                    style={{ borderRadius: 10, borderColor: "#93C5FD" }}
                    labelStyle={{ fontSize: 12, fontWeight: "700" }}
                  >
                    View All
                  </Button>
                )}
              </View>
            )}
          </Card.Content>
        </Card>
      ) : null}

      {/* Travel Expense Dialog */}
      <Portal>
        <Dialog visible={travelDialogVisible} onDismiss={() => !isSubmittingTravelExpense && setTravelDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={{ fontWeight: "800", color: "#1E40AF" }}>
            🚗 Travel Expense ({effectiveKm.toFixed(1)} KM)
          </Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <Text style={{ fontSize: 12, color: "#475569" }}>
              Submit your travel/fuel expense for today&apos;s field work ({effectiveKm.toFixed(1)} km).
            </Text>

            <TextInput
              keyboardType="decimal-pad"
              label="Expense Amount (INR) *"
              mode="outlined"
              value={travelAmount}
              onChangeText={setTravelAmount}
              placeholder="e.g. 450"
              style={{ backgroundColor: "#FFFFFF" }}
              autoFocus
            />

            <TextInput
              label="Description / Notes"
              mode="outlined"
              value={travelDesc}
              onChangeText={setTravelDesc}
              placeholder="Notes about travel"
              style={{ backgroundColor: "#FFFFFF" }}
              multiline
              numberOfLines={2}
            />

            <Button
              icon={travelReceipt ? "check-circle" : "camera"}
              mode="outlined"
              onPress={async () => {
                const photo = await pickVerificationImage({ quality: 0.5 });
                if (photo) setTravelReceipt(photo);
              }}
              style={{ borderColor: travelReceipt ? "#16A34A" : "#CBD5E1", borderRadius: 8 }}
              textColor={travelReceipt ? "#16A34A" : "#475569"}
            >
              {travelReceipt ? "Receipt Photo Attached (Tap to change)" : "Attach Receipt Photo *"}
            </Button>

            {travelReceipt && (
              <Image source={{ uri: travelReceipt.uri }} style={{ width: "100%", height: 120, borderRadius: 8, borderWidth: 1, borderColor: "#CBD5E1" }} />
            )}
          </Dialog.Content>

          <Dialog.Actions>
            <Button disabled={isSubmittingTravelExpense} onPress={() => setTravelDialogVisible(false)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              buttonColor="#2563EB"
              disabled={!travelAmount.trim() || isNaN(Number(travelAmount)) || Number(travelAmount) <= 0 || isSubmittingTravelExpense}
              loading={isSubmittingTravelExpense}
              onPress={async () => {
                if (!travelAmount.trim() || Number(travelAmount) <= 0) {
                  Alert.alert("Invalid Amount", "Please enter a valid expense amount.");
                  return;
                }
                if (!travelReceipt) {
                  Alert.alert("Receipt Photo Required", "Please attach a photo of the receipt/bill to submit travel expense.");
                  return;
                }

                setIsSubmittingTravelExpense(true);
                try {
                  const receiptUrl = await uploadExpenseReceipt(travelReceipt);
                  await createExpense({
                    category: "TRAVEL",
                    amount: Number(travelAmount.trim()),
                    description: travelDesc.trim() || `Travel expense for ${effectiveKm.toFixed(1)} km field travel`,
                    receiptUrl,
                    date: dayjs().format("YYYY-MM-DD")
                  });
                  await queryClient.invalidateQueries({ queryKey: ["expenses"] });
                  setTravelDialogVisible(false);
                  Alert.alert("Expense Submitted", "Your travel expense has been successfully submitted for approval!");
                } catch (err) {
                  Alert.alert("Submission Failed", getErrorMessage(err));
                } finally {
                  setIsSubmittingTravelExpense(false);
                }
              }}
            >
              Submit Expense
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Odometer input dialog */}
      <Portal>
        <Dialog visible={odoModalVisible} dismissable={false} style={styles.dialog}>
          <Dialog.Title style={{ fontWeight: "800", color: "#24312D" }}>{odoTitle}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 13, color: "#66736F", marginBottom: 12 }}>Please enter the vehicle odometer reading in KM.</Text>
            <TextInput keyboardType="numeric" label="Odometer (KM)" mode="outlined" value={odoValue} onChangeText={setOdoValue} placeholder="e.g. 12540" style={{ backgroundColor: "#FFFFFF" }} autoFocus />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setOdoModalVisible(false); odoResolve?.resolve(null); }}>Cancel</Button>
            <Button mode="contained" disabled={!odoValue.trim() || isNaN(Number(odoValue))} onPress={() => { const v = Number(odoValue.trim()); setOdoModalVisible(false); odoResolve?.resolve(v); }}>Submit</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {isBusy && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#1A202C" size="large" />
          <Text style={styles.loadingText}>{loadingStep || "Processing..."}</Text>
        </View>
      )}
    </View>
  );
}

function absUrl(url: string) {
  return url.startsWith("http") ? url : `${API_ORIGIN_URL}${url}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Please try again.";
}

function calculateDistanceKm(logs: LocationPing[]) {
  const ACCURACY_THRESHOLD = 50;
  const MIN_DISTANCE_THRESHOLD = 0.03;
  const filteredLogs = logs
    .filter((log) => log.accuracy > 0 && log.accuracy <= ACCURACY_THRESHOLD)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let totalDistance = 0;
  let lastStablePoint: LocationPing | null = null;
  for (const point of filteredLogs) {
    if (!lastStablePoint) { lastStablePoint = point; continue; }
    const distance = haversineKm(lastStablePoint, point);
    if (distance >= MIN_DISTANCE_THRESHOLD) { totalDistance += distance; lastStablePoint = point; }
  }
  return totalDistance;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

async function pickVerificationImage(options?: { quality?: number }): Promise<ImagePicker.ImagePickerAsset | null> {
  return new Promise((resolve) => {
    Alert.alert(
      "Verification Photo",
      "Take a new photo or choose an existing one from the gallery:",
      [
        {
          text: "Cancel",
          onPress: () => resolve(null),
          style: "cancel"
        },
        {
          text: "Take Photo (Camera)",
          onPress: async () => {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
              Alert.alert("Permission denied", "Camera access is required for verification.");
              resolve(null);
              return;
            }
            try {
              const result = await ImagePicker.launchCameraAsync({ 
                allowsEditing: false, // Disabling editing intent prevents memory crashes on low-end/budget phones
                quality: options?.quality ?? 0.4 
              });
              resolve(result.canceled ? null : result.assets[0]);
            } catch (cameraErr) {
              console.error("[Camera] launchCameraAsync failed:", cameraErr);
              Alert.alert("Camera Error", "Failed to launch camera. Opening gallery instead...");
              resolve(await pickFromGallery(options));
            }
          }
        },
        {
          text: "Choose from Gallery",
          onPress: async () => {
            resolve(await pickFromGallery(options));
          }
        }
      ],
      { cancelable: true }
    );
  });
}

async function pickFromGallery(options?: { quality?: number }): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission denied", "Gallery access is required.");
    return null;
  }
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: options?.quality ?? 0.4
    });
    return result.canceled ? null : result.assets[0];
  } catch (err) {
    console.error("[Gallery] launchImageLibraryAsync failed:", err);
    Alert.alert("Error", "Failed to open gallery.");
    return null;
  }
}

function PanelImage({ source, style }: { source: any; style: any }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  return (
    <View style={[{ position: "relative", overflow: "hidden", backgroundColor: "#F1F5F9" }, style]}>
      <Image resizeMode="cover" source={source} style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]} onLoadStart={() => { setLoading(true); setError(false); }} onLoadEnd={() => setLoading(false)} onError={() => { setLoading(false); setError(true); }} />
      {loading && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center", backgroundColor: "#F1F5F9" }]}>
          <ActivityIndicator color="#4A6583" size="small" />
        </View>
      )}
      {error && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center", backgroundColor: "#FEF2F2" }]}>
          <Icon source="image-broken-variant" size={24} color="#EF4444" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, backgroundColor: "#EEEEEE" },
  statusContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8 },
  statusColumn: { flex: 2 },
  timeColumn: { flex: 1, alignItems: "flex-end" },
  mutedLabel: { color: "#66736F", fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 },
  statusIndicatorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusText: { color: "#24312D", fontWeight: "700", fontSize: 14 },
  timeText: { color: "#4A6583", fontWeight: "800", fontSize: 20, lineHeight: 22 },
  amPmText: { color: "#4A6583", fontSize: 10, fontWeight: "700" },
  punchButtonsRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  punchButton: {
    flex: 1, borderRadius: 16, height: 100, justifyContent: "center", backgroundColor: "#FFFFFF",
    ...Platform.select({ web: { boxShadow: "0px 2px 4px rgba(0,0,0,0.05)" }, default: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 } })
  },
  punchButtonContent: { alignItems: "center", justifyContent: "center", gap: 8 },
  punchButtonLabel: { color: "#4A6583", fontSize: 12, fontWeight: "700", marginTop: 4, letterSpacing: 0.5 },
  verificationNote: { color: "#66736F", textAlign: "center", fontSize: 12, marginTop: 16 },
  photoContainer: { marginTop: 20, alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#DDDDDD" },
  verificationPhoto: { width: "100%", aspectRatio: 1, borderRadius: 8 },
  photoLabel: { marginTop: 8, fontSize: 12, color: "#66736F", fontWeight: "600" },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: { borderRadius: 8, backgroundColor: "#EEEEEE", flex: 1 },
  summaryContent: { padding: 12, paddingHorizontal: 8 },
  summaryIconRow: { flexDirection: "column", gap: 4, marginBottom: 4 },
  mutedSummaryLabel: { color: "#24312D", fontSize: 10, fontWeight: "600" },
  summaryValue: { color: "#24312D", fontSize: 20, fontWeight: "700" },
  pendingCard: { backgroundColor: "#FEF3C7", borderColor: "#F59E0B", borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 20, gap: 8 },
  pendingHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pendingTitle: { fontSize: 15, fontWeight: "800", color: "#B45309" },
  pendingText: { fontSize: 13, color: "#92400E", lineHeight: 18, fontWeight: "500" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.8)", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  loadingText: { marginTop: 12, color: "#1A202C", fontWeight: "600" },
  logCard: { borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E0E0E0" },
  logContent: { padding: 16 },
  logHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  logIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F0F4F8", alignItems: "center", justifyContent: "center" },
  logTitle: { fontSize: 14, fontWeight: "700", color: "#24312D" },
  logSubtitle: { fontSize: 10, fontWeight: "600", color: "#66736F", marginTop: 2 },
  mapsButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#E7F3EF", alignItems: "center", justifyContent: "center" },
  logCoordsRow: { flexDirection: "row", backgroundColor: "#F7F9F8", borderRadius: 12, padding: 12, alignItems: "center" },
  coordBox: { flex: 1, alignItems: "center" },
  coordLabel: { fontSize: 8, fontWeight: "800", color: "#66736F", marginBottom: 4, letterSpacing: 1 },
  coordValue: { fontSize: 13, fontWeight: "700", color: "#4A6583", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  coordDivider: { width: 1, height: 24, backgroundColor: "#E0E0E0" },
  dialog: { backgroundColor: "#FFFFFF", borderRadius: 24, marginHorizontal: 20 },
  odometerSmallContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 8, padding: 8, marginTop: 12, borderWidth: 1, borderColor: "#DDDDDD", gap: 12 },
  odometerSmallPhoto: { width: 60, height: 60, borderRadius: 6 },
  odometerSmallInfo: { flex: 1, justifyContent: "center" },
  odometerSmallTitle: { fontSize: 12, color: "#24312D", fontWeight: "700" },
  odometerSmallStatus: { fontSize: 11, color: "#66736F", marginTop: 2 }
});
