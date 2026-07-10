import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState, useMemo } from "react";
import { ScrollView, StyleSheet, View, Alert, Linking, TouchableOpacity, Image } from "react-native";
import { Avatar, Badge, Button, Card, Dialog, Icon, IconButton, Portal, Text, TouchableRipple, Modal, TextInput, Divider, Menu } from "react-native-paper";
import relativeTime from "dayjs/plugin/relativeTime";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker";

dayjs.extend(relativeTime);

import { fetchExpenses, fetchNotifications, markNotificationAsRead, fetchMonthlyPerformanceReport, uploadPhoto, uploadFile, type Task, fetchTodayLocationLogs, fetchDayEndReports } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useTasks } from "../hooks/useTasks";
import { useForms } from "../hooks/useForms";
import { useAttendance } from "../hooks/useAttendance";
import { useTimeTracker } from "../hooks/useTimeTracker";
import type { MainDrawerParamList } from "../navigation/AppNavigator";
import { appIconSource, AppIcon } from "../components/AppIcon";
import { PersonalAttendancePanel } from "../components/PersonalAttendancePanel";
import { TaskCard } from "../components/TaskCard";
import { API_ORIGIN_URL } from "../config/env";

type HomeNavigation = DrawerNavigationProp<MainDrawerParamList, "Home">;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const { user } = useAuth();
  const { tasks, isUpdatingStatus: tasksUpdatingStatus, refetch: refetchTasks, updateStatus } = useTasks();
  const { forms } = useForms();
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [showNotifications, setShowNotifications] = useState(false);

  // Time tracking & attendance states
  const { todaySessions, activeAttendance, todayAttendance, activeBreak } = useAttendance();
  const { officeTime, fieldTime, breakTime, friendlyBreakTime } = useTimeTracker(todaySessions, currentTime);
  const isCheckedIn = Boolean(activeAttendance);
  const isCheckedOut = !isCheckedIn && todaySessions.length > 0;
  const isFieldPunch = (activeAttendance || todayAttendance)?.punchType === "FIELD";

  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL");
  const [taskMenuVisible, setTaskMenuVisible] = useState(false);

  const locationLogsQuery = useQuery({
    enabled: Boolean(user?.id && isFieldPunch),
    queryKey: ["locationLogs", user?.id, "today"],
    queryFn: () => fetchTodayLocationLogs(user!.id),
    refetchInterval: isFieldPunch && !isCheckedOut ? 30_000 : false
  });

  const distanceKm = useMemo(() => {
    const logs = locationLogsQuery.data ?? [];
    const ACCURACY_THRESHOLD = 50;
    const MIN_DISTANCE_THRESHOLD = 0.03;
    const filteredLogs = logs
      .filter((log) => log.accuracy > 0 && log.accuracy <= ACCURACY_THRESHOLD)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let totalDistance = 0;
    let lastStablePoint: any = null;
    for (const point of filteredLogs) {
      if (!lastStablePoint) { lastStablePoint = point; continue; }
      const distance = haversineKm(lastStablePoint, point);
      if (distance >= MIN_DISTANCE_THRESHOLD) { totalDistance += distance; lastStablePoint = point; }
    }
    return totalDistance;
  }, [locationLogsQuery.data]);

  const reportsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["dayEndReports", user?.id],
    queryFn: () => fetchDayEndReports(user!.id)
  });

  const alreadySubmittedDer = useMemo(
    () => (reportsQuery.data ?? []).some((report) => dayjs(report.date).isSame(dayjs(), "day")),
    [reportsQuery.data]
  );

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

  const [selectedDate, setSelectedDate] = useState(dayjs().startOf("day"));
  // Completion Modal State
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [completionPhoto, setCompletionPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [completionRemarks, setCompletionRemarks] = useState("");
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [checklistResponses, setChecklistResponses] = useState<Record<string, { text?: string; dropdown?: string; image?: string; video?: string; audio?: string; file?: { url: string; name: string }; geotag?: { lat: number; lng: number } }>>({});

  const isChecklistComplete = useMemo(() => {
    if (!selectedTask?.checklist) return true;
    const checklist = selectedTask.checklist as any[];
    for (const item of checklist) {
      if (item.required) {
        const resp = checklistResponses[item.id] || {};
        for (const valType of (item.validations || [])) {
          if (valType === "TEXT" && !resp.text?.trim()) return false;
          if (valType === "DROPDOWN" && !resp.dropdown) return false;
          if (valType === "IMAGE" && !resp.image) return false;
          if (valType === "VIDEO" && !resp.video) return false;
          if (valType === "AUDIO" && !resp.audio) return false;
          if (valType === "FILE" && !resp.file) return false;
          if (valType === "GEOTAG" && !resp.geotag) return false;
        }
      }
    }
    return true;
  }, [selectedTask, checklistResponses]);

  async function captureChecklistImage(itemId: string) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Camera access is needed to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ 
      allowsEditing: true, 
      aspect: [4, 3], 
      quality: 0.7 
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      try {
        Alert.alert("Uploading", "Please wait while your image is uploading...");
        const url = await uploadPhoto(asset);
        setChecklistResponses(prev => ({
          ...prev,
          [itemId]: {
            ...prev[itemId],
            image: url
          }
        }));
        Alert.alert("Success", "Image uploaded successfully.");
      } catch (err) {
        Alert.alert("Upload failed", err instanceof Error ? err.message : "Error uploading file");
      }
    }
  }

  async function captureChecklistVideo(itemId: string) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Camera access is needed to record a video.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true, 
      quality: 0.7 
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      try {
        Alert.alert("Uploading", "Please wait while your video is uploading...");
        const url = await uploadFile(asset.uri, `video-${Date.now()}.mp4`, "video/mp4");
        setChecklistResponses(prev => ({
          ...prev,
          [itemId]: {
            ...prev[itemId],
            video: url
          }
        }));
        Alert.alert("Success", "Video uploaded successfully.");
      } catch (err) {
        Alert.alert("Upload failed", err instanceof Error ? err.message : "Error uploading file");
      }
    }
  }

  async function selectChecklistFile(itemId: string, isAudio = false) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: isAudio ? "audio/*" : "*/*",
        copyToCacheDirectory: true
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        Alert.alert("Uploading", "Please wait while your file is uploading...");
        const url = await uploadFile(asset.uri, asset.name, asset.mimeType || "application/octet-stream");
        setChecklistResponses(prev => ({
          ...prev,
          [itemId]: {
            ...prev[itemId],
            [isAudio ? "audio" : "file"]: isAudio ? url : { url, name: asset.name }
          }
        }));
        Alert.alert("Success", `${isAudio ? "Audio" : "File"} uploaded successfully.`);
      }
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Error uploading file");
    }
  }

  async function captureChecklistGeoTag(itemId: string) {
    try {
      Alert.alert("Locating", "Fetching current GPS coordinates...");
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        Alert.alert("Permission required", "Location permission is required to capture geo tag.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setChecklistResponses(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          geotag: {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude
          }
        }
      }));
      Alert.alert("Success", `Geo tag captured: ${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
    } catch (err) {
      Alert.alert("Failed", "Failed to retrieve live coordinates.");
    }
  }

  const matchesDate = (t: Task) => {
    const taskDateString = dayjs(t.dueDate).format("YYYY-MM-DD");
    const selectedDateString = selectedDate.format("YYYY-MM-DD");
    const isSelectedToday = selectedDateString === dayjs().format("YYYY-MM-DD");
    if (isSelectedToday) {
      return (
        taskDateString === selectedDateString ||
        (taskDateString < selectedDateString && t.status !== "COMPLETED" && t.status !== "CANCELLED")
      );
    }
    return taskDateString === selectedDateString;
  };

  const todoCount = useMemo(() => {
    return tasks.filter((t) => (t.status === "PENDING" || t.status === "IN_PROGRESS") && matchesDate(t)).length;
  }, [tasks, selectedDate]);

  const doneCount = useMemo(() => {
    return tasks.filter((t) => t.status === "COMPLETED" && matchesDate(t)).length;
  }, [tasks, selectedDate]);

  const filteredTasks = useMemo(() => {
    const dailyTasks = tasks.filter(matchesDate);
    if (activeTab === "PENDING") {
      return dailyTasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS");
    }
    if (activeTab === "COMPLETED") {
      return dailyTasks.filter((t) => t.status === "COMPLETED");
    }
    return dailyTasks;
  }, [tasks, selectedDate, activeTab]);

  async function pickCompletionPhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Camera access is needed to complete the task.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled) {
      setCompletionPhoto(result.assets[0]);
    }
  }

  async function submitCompletion() {
    if (!selectedTask) return;
    if (!isChecklistComplete) {
      Alert.alert("Incomplete Checklist", "Please complete all required checklist items first.");
      return;
    }
    setIsSubmittingCompletion(true);
    try {
      let photoUrl = selectedTask.completionPhotoUrl || "";
      if (completionPhoto) {
        photoUrl = await uploadPhoto(completionPhoto);
      }
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const foregroundPerm = await Location.requestForegroundPermissionsAsync();
        if (foregroundPerm.status === Location.PermissionStatus.GRANTED) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch (locErr) {
        console.warn("[HomeScreen] Failed to retrieve GPS:", locErr);
      }

      const compiledResponses: any[] = [];
      if (selectedTask?.checklist) {
        const checklist = (selectedTask.checklist as any[]);
        for (const item of checklist) {
          const resp = checklistResponses[item.id] || {};
          for (const valType of (item.validations || [])) {
            if (valType === "TEXT" && resp.text) {
              compiledResponses.push({ id: item.id, title: item.title, type: "TEXT", value: resp.text });
            }
            if (valType === "DROPDOWN" && resp.dropdown) {
              compiledResponses.push({ id: item.id, title: item.title, type: "DROPDOWN", value: resp.dropdown });
            }
            if (valType === "IMAGE" && resp.image) {
              compiledResponses.push({ id: item.id, title: item.title, type: "IMAGE", fileUrl: resp.image });
            }
            if (valType === "VIDEO" && resp.video) {
              compiledResponses.push({ id: item.id, title: item.title, type: "VIDEO", fileUrl: resp.video });
            }
            if (valType === "AUDIO" && resp.audio) {
              compiledResponses.push({ id: item.id, title: item.title, type: "AUDIO", fileUrl: resp.audio });
            }
            if (valType === "FILE" && resp.file) {
              compiledResponses.push({ id: item.id, title: item.title, type: "FILE", fileUrl: resp.file.url, fileName: resp.file.name });
            }
            if (valType === "GEOTAG" && resp.geotag) {
              compiledResponses.push({ 
                id: item.id, 
                title: item.title, 
                type: "GEOTAG", 
                value: `${resp.geotag.lat},${resp.geotag.lng}` 
              });
            }
          }
        }
      }

      await updateStatus({
        taskId: selectedTask.id,
        status: "COMPLETED",
        completionData: { photoUrl, remarks: completionRemarks.trim(), lat, lng, checklistResponses: compiledResponses },
      });
      setCompletionModalVisible(false);
      setCompletionPhoto(null);
      setCompletionRemarks("");
      setChecklistResponses({});
      setSelectedTask(null);
      Alert.alert("Success", "Task submission updated.");
    } catch (error) {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSubmittingCompletion(false);
    }
  }

  async function handleTaskPress(task: Task) {
    if (task.status === "CANCELLED") return;
    if (task.status === "IN_PROGRESS" || task.status === "COMPLETED") {
      setSelectedTask(task);
      setCompletionRemarks(task.completionRemarks || "");
      setCompletionPhoto(null);

      const initialResponses: any = {};
      if (task.checklistResponses) {
        const responsesArray = (task.checklistResponses as any[]);
        for (const resp of responsesArray) {
          if (!initialResponses[resp.id]) {
            initialResponses[resp.id] = {};
          }
          if (resp.type === "TEXT") {
            initialResponses[resp.id].text = resp.value;
          }
          if (resp.type === "DROPDOWN") {
            initialResponses[resp.id].dropdown = resp.value;
          }
          if (resp.type === "IMAGE") {
            initialResponses[resp.id].image = resp.fileUrl;
          }
          if (resp.type === "VIDEO") {
            initialResponses[resp.id].video = resp.fileUrl;
          }
          if (resp.type === "AUDIO") {
            initialResponses[resp.id].audio = resp.fileUrl;
          }
          if (resp.type === "FILE") {
            initialResponses[resp.id].file = { url: resp.fileUrl, name: resp.fileName || "File" };
          }
          if (resp.type === "GEOTAG" && resp.value) {
            const [latStr, lngStr] = resp.value.split(",");
            initialResponses[resp.id].geotag = { lat: parseFloat(latStr), lng: parseFloat(lngStr) };
          }
        }
      }
      setChecklistResponses(initialResponses);

      setCompletionModalVisible(true);
      return;
    }
    try {
      await updateStatus({ taskId: task.id, status: "IN_PROGRESS" });
    } catch (error) {
      Alert.alert("Task update failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  function openAttachment(task: Task) {
    if (!task.attachmentUrl) return;
    const fullUrl = task.attachmentUrl.startsWith("http")
      ? task.attachmentUrl
      : `${API_ORIGIN_URL}${task.attachmentUrl}`;
    Linking.openURL(fullUrl).catch(() => Alert.alert("Error", "Could not open this file."));
  }

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  const monthlyReportQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["monthlyReportHome", user?.id],
    queryFn: () => fetchMonthlyPerformanceReport(user!.id, dayjs().month() + 1, dayjs().year())
  });

  const notificationsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["notifications", user?.id],
    queryFn: fetchNotifications,
    refetchInterval: 30_000
  });

  const expensesQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["expenses", user?.id, "home"],
    queryFn: () => fetchExpenses(user!.id)
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const expenses = expensesQuery.data ?? [];
  const pendingExpenseCount = expenses.filter((expense) => !expense.approved && !expense.approvedById).length;
  const approvedExpenseTotal = expenses
    .filter((expense) => expense.approved)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const showTasksOnTop = isCheckedIn && todoCount > 0;

  const tasksSection = (
    <Card mode="contained" style={styles.tasksSectionCard}>
      <Card.Content style={{ padding: 12 }}>
        {/* Task Stats Row */}
        <View style={styles.taskStatsRow}>
          <TouchableRipple onPress={() => setActiveTab("PENDING")} style={styles.taskStatBox}>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.taskStatNumber}>{todoCount}</Text>
              <Text style={styles.taskStatLabel}>To do</Text>
            </View>
          </TouchableRipple>
          <View style={styles.taskStatsDivider} />
          <TouchableRipple onPress={() => setActiveTab("COMPLETED")} style={styles.taskStatBox}>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.taskStatNumber}>{doneCount}</Text>
              <Text style={styles.taskStatLabel}>Done</Text>
            </View>
          </TouchableRipple>
          <View style={styles.taskStatsDivider} />
          <View style={styles.taskStatBox}>
            <Menu
              visible={taskMenuVisible}
              onDismiss={() => setTaskMenuVisible(false)}
              anchor={
                <Button 
                  mode="text" 
                  compact 
                  onPress={() => setTaskMenuVisible(true)}
                  labelStyle={{ fontSize: 11, fontWeight: "700", color: "#4A6583" }}
                >
                  Filter: {activeTab}
                </Button>
              }
            >
              <Menu.Item onPress={() => { setActiveTab("ALL"); setTaskMenuVisible(false); }} title="All" />
              <Menu.Item onPress={() => { setActiveTab("PENDING"); setTaskMenuVisible(false); }} title="Pending" />
              <Menu.Item onPress={() => { setActiveTab("COMPLETED"); setTaskMenuVisible(false); }} title="Completed" />
            </Menu>
          </View>
        </View>

        <Divider style={{ marginVertical: 8 }} />

        <View style={styles.dateNavigator}>
          <IconButton
            icon={appIconSource("chevron-left")}
            size={24}
            onPress={() => setSelectedDate((curr) => curr.subtract(1, "day"))}
          />
          <TouchableRipple
            onPress={() => setSelectedDate(dayjs().startOf("day"))}
            style={styles.dateDisplay}
          >
            <View style={{ alignItems: "center" }}>
              <Text style={styles.dateTitle}>
                {selectedDate.isSame(dayjs(), "day") ? "Today's Tasks" : selectedDate.format("DD MMM YYYY")}
              </Text>
              <Text style={styles.dateSubtitle}>{selectedDate.format("dddd")}</Text>
            </View>
          </TouchableRipple>
          <IconButton
            icon={appIconSource("chevron-right")}
            size={24}
            onPress={() => setSelectedDate((curr) => curr.add(1, "day"))}
          />
        </View>

        <View style={{ marginTop: 8 }}>
          {filteredTasks.length === 0 ? (
            <Text style={[styles.emptyText, { marginVertical: 16 }]}>No tasks for this day.</Text>
          ) : (
            filteredTasks.map((item) => (
              <View key={item.id} style={{ marginBottom: 12 }}>
                <TaskCard disabled={tasksUpdatingStatus} onPress={handleTaskPress} task={item} />
                {item.attachmentUrl && (
                  <TouchableOpacity style={styles.attachmentChip} onPress={() => openAttachment(item)}>
                    <Text style={styles.attachmentChipText}>📎 {item.attachmentName || "View Attachment"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const attendancePanel = (
    <PersonalAttendancePanel 
      hideTimeSummary={true} 
      hideDayEndButton={true} 
      onNavigateDayEnd={() => navigation.navigate("DayEndReport")} 
    />
  );

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.dateText}>{currentTime.format("dddd, MMM DD")}</Text>
          <Text style={styles.greeting} variant="headlineMedium">
            {getGreeting()}, {user?.name ?? "User"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
            <View style={{ backgroundColor: "#E0F2FE", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <AppIcon name="star" size={14} color="#0284C7" />
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#0284C7" }}>
                {monthlyReportQuery.data?.stats?.monthlyPoints ?? 0} PTS
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.notificationWrapper}>
          <IconButton
            icon={appIconSource(unreadCount > 0 ? "bell-badge" : "bell-outline")}
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

      {showTasksOnTop ? (
        <>
          {tasksSection}
          {attendancePanel}
        </>
      ) : (
        <>
          {attendancePanel}
          {tasksSection}
        </>
      )}

      {/* Time Summary Cards Section */}
      <View style={{ gap: 8 }}>
        <View style={styles.summaryRow}>
          <Card mode="contained" style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <View style={styles.summaryIconRow}>
                <AppIcon color="#4A6583" name="office-building" size={20} />
                <Text style={styles.mutedSummaryLabel}>OFFICE TIME</Text>
              </View>
              <Text style={[styles.summaryValue, { fontSize: 16 }]}>{officeTime}</Text>
            </Card.Content>
          </Card>
          <Card mode="contained" style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <View style={styles.summaryIconRow}>
                <AppIcon color="#4A6583" name="map-marker-outline" size={20} />
                <Text style={styles.mutedSummaryLabel}>FIELD TIME</Text>
              </View>
              <Text style={[styles.summaryValue, { fontSize: 16 }]}>{fieldTime}</Text>
            </Card.Content>
          </Card>
        </View>
        <View style={styles.summaryRow}>
          <Card mode="contained" style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <View style={styles.summaryIconRow}>
                <AppIcon color="#F39C12" name="coffee" size={20} />
                <Text style={styles.mutedSummaryLabel}>TOTAL BREAK</Text>
              </View>
              <Text style={[styles.summaryValue, { fontSize: 16 }]}>{friendlyBreakTime}</Text>
            </Card.Content>
          </Card>
          <Card mode="contained" style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <View style={styles.summaryIconRow}>
                <AppIcon color="#4A6583" name="map-marker-distance" size={20} />
                <Text style={styles.mutedSummaryLabel}>KM TODAY</Text>
              </View>
              <Text style={[styles.summaryValue, { fontSize: 16 }]}>{distanceKm.toFixed(1)}</Text>
            </Card.Content>
          </Card>
        </View>
      </View>

      {/* Submit Day End Report Button */}
      {isCheckedIn && !alreadySubmittedDer && (
        <Button 
          icon="file-document-edit" 
          mode="contained" 
          buttonColor="#A4262C"
          onPress={() => navigation.navigate("DayEndReport")} 
          style={{ borderRadius: 8, marginVertical: 8, paddingVertical: 4 }}
          labelStyle={{ fontSize: 14, fontWeight: "700" }}
        >
          Submit day end report
        </Button>
      )}

      {/* Shortcuts 2x3 Grid */}
      <View style={styles.summaryRow}>
        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("Forms")}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <AppIcon color="#24312D" name="file-document-edit-outline" size={20} />
              <Text style={styles.mutedSummaryLabel}>FORMS</Text>
            </View>
            <Text style={styles.summaryValue}>{forms.length}</Text>
          </Card.Content>
        </Card>

        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("LeaveRequest")}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <AppIcon color="#24312D" name="calendar-clock" size={20} />
              <Text style={styles.mutedSummaryLabel}>LEAVE</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 14 }]}>Apply</Text>
          </Card.Content>
        </Card>

        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("MonthlyReport")}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <AppIcon color="#24312D" name="file-document-outline" size={20} />
              <Text style={styles.mutedSummaryLabel}>REPORTS</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 14 }]}>View</Text>
          </Card.Content>
        </Card>
      </View>

      <View style={styles.summaryRow}>
        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("Expenses")}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <AppIcon color="#24312D" name="cash-multiple" size={20} />
              <Text style={styles.mutedSummaryLabel}>EXPENSES</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 14 }]}>
              INR {approvedExpenseTotal.toFixed(0)}
            </Text>
          </Card.Content>
        </Card>

        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("Issues")}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <AppIcon color="#24312D" name="alert-circle-outline" size={20} />
              <Text style={styles.mutedSummaryLabel}>ISSUES</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 14 }]}>Report</Text>
          </Card.Content>
        </Card>

        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("Attendance")}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <AppIcon color="#24312D" name="calendar-check" size={20} />
              <Text style={styles.mutedSummaryLabel}>ATTENDANCE</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 14 }]}>History</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Hide department section on mobile app per user request */}

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
                      setShowNotifications(false);
                      if (n.type && n.type.startsWith("TASK_")) {
                        navigation.navigate("Tasks");
                      } else if (n.type === "DAY_END_REPORT") {
                        navigation.navigate("DayEndReport");
                      } else {
                        navigation.navigate("Home");
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

        <Modal
          visible={completionModalVisible}
          onDismiss={() => !isSubmittingCompletion && setCompletionModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle} variant="titleLarge">
              Complete Task
            </Text>
            <Text style={styles.modalSubtitle} variant="bodyMedium">
              Please provide proof of completion
            </Text>

            <Divider style={styles.divider} />

            {/* Checklist Section */}
            {selectedTask?.checklist && (selectedTask.checklist as any[]).length > 0 && (
              <View style={styles.checklistSection}>
                <Text style={styles.checklistHeading}>Task Checklist</Text>
                {(selectedTask.checklist as any[]).map((item) => {
                  const resp = checklistResponses[item.id] || {};
                  return (
                    <View key={item.id} style={styles.checklistItem}>
                      <Text style={styles.checklistItemTitle}>
                        {item.title} {item.required ? <Text style={{ color: "#EF4444" }}>*</Text> : ""}
                      </Text>
                      <View style={styles.checklistFields}>
                        {(item.validations || []).map((valType: string) => {
                          if (valType === "TEXT") {
                            return (
                              <TextInput
                                key="TEXT"
                                label="Enter Text"
                                mode="outlined"
                                value={resp.text || ""}
                                onChangeText={(text) =>
                                  setChecklistResponses((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], text }
                                  }))
                                }
                                style={styles.checklistTextInput}
                              />
                            );
                          }
                          if (valType === "DROPDOWN") {
                            const options = ["Yes", "No", "Done", "Pending", "N/A"];
                            return (
                              <View key="DROPDOWN" style={styles.dropdownContainer}>
                                <Text style={styles.fieldLabel}>Select Status:</Text>
                                <View style={styles.optionsButtonGroup}>
                                  {options.map((opt) => (
                                    <TouchableOpacity
                                      key={opt}
                                      style={[
                                        styles.optionButton,
                                        resp.dropdown === opt && styles.optionButtonActive
                                      ]}
                                      onPress={() =>
                                        setChecklistResponses((prev) => ({
                                          ...prev,
                                          [item.id]: { ...prev[item.id], dropdown: opt }
                                        }))
                                      }
                                    >
                                      <Text
                                        style={[
                                          styles.optionText,
                                          resp.dropdown === opt && styles.optionTextActive
                                        ]}
                                      >
                                        {opt}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            );
                          }
                          if (valType === "GEOTAG") {
                            return (
                              <View key="GEOTAG" style={styles.checklistFieldRow}>
                                <Button
                                  mode="outlined"
                                  compact
                                  icon="map-marker"
                                  onPress={() => captureChecklistGeoTag(item.id)}
                                >
                                  {resp.geotag
                                    ? `Geo Tag Captured (${resp.geotag.lat.toFixed(4)}, ${resp.geotag.lng.toFixed(4)})`
                                    : "Capture Geo Tag"}
                                </Button>
                              </View>
                            );
                          }
                          if (valType === "IMAGE") {
                            return (
                              <View key="IMAGE" style={styles.checklistFieldRow}>
                                {resp.image ? (
                                  <View style={styles.mediaPreviewContainer}>
                                    <Image source={{ uri: resp.image }} style={styles.mediaPreview} />
                                    <Button compact mode="text" onPress={() => captureChecklistImage(item.id)}>
                                      Change Image
                                    </Button>
                                  </View>
                                ) : (
                                  <Button
                                    mode="outlined"
                                    compact
                                    icon="camera"
                                    onPress={() => captureChecklistImage(item.id)}
                                  >
                                    Capture Image
                                  </Button>
                                )}
                              </View>
                            );
                          }
                          if (valType === "VIDEO") {
                            return (
                              <View key="VIDEO" style={styles.checklistFieldRow}>
                                {resp.video ? (
                                  <View style={styles.mediaPreviewContainer}>
                                    <Text style={styles.uploadedFileName}>🎥 Video Uploaded</Text>
                                    <Button compact mode="text" onPress={() => captureChecklistVideo(item.id)}>
                                      Re-capture Video
                                    </Button>
                                  </View>
                                ) : (
                                  <Button
                                    mode="outlined"
                                    compact
                                    icon="video"
                                    onPress={() => captureChecklistVideo(item.id)}
                                  >
                                    Record Video
                                  </Button>
                                )}
                              </View>
                            );
                          }
                          if (valType === "AUDIO") {
                            return (
                              <View key="AUDIO" style={styles.checklistFieldRow}>
                                {resp.audio ? (
                                  <View style={styles.mediaPreviewContainer}>
                                    <Text style={styles.uploadedFileName}>🎵 Audio Uploaded</Text>
                                    <Button compact mode="text" onPress={() => selectChecklistFile(item.id, true)}>
                                      Re-select Audio
                                    </Button>
                                  </View>
                                ) : (
                                  <Button
                                    mode="outlined"
                                    compact
                                    icon="microphone"
                                    onPress={() => selectChecklistFile(item.id, true)}
                                  >
                                    Upload Audio File
                                  </Button>
                                )}
                              </View>
                            );
                          }
                          if (valType === "FILE") {
                            return (
                              <View key="FILE" style={styles.checklistFieldRow}>
                                {resp.file ? (
                                  <View style={styles.mediaPreviewContainer}>
                                    <Text style={styles.uploadedFileName}>📎 {resp.file.name}</Text>
                                    <Button compact mode="text" onPress={() => selectChecklistFile(item.id, false)}>
                                      Re-select File
                                    </Button>
                                  </View>
                                ) : (
                                  <Button
                                    mode="outlined"
                                    compact
                                    icon="file"
                                    onPress={() => selectChecklistFile(item.id, false)}
                                  >
                                    Upload Document/File
                                  </Button>
                                )}
                              </View>
                            );
                          }
                          return null;
                        })}
                      </View>
                      <Divider style={{ marginVertical: 8 }} />
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.photoSection}>
              {(completionPhoto || selectedTask?.completionPhotoUrl) && (
                <View style={styles.photoPreview}>
                  <Image
                    source={{
                      uri: completionPhoto
                        ? completionPhoto.uri
                        : selectedTask?.completionPhotoUrl?.startsWith("http")
                        ? selectedTask.completionPhotoUrl
                        : `${API_ORIGIN_URL}${selectedTask?.completionPhotoUrl}`,
                    }}
                    style={styles.thumbnail}
                  />
                  <View>
                    <Text style={styles.photoNote}>
                      {completionPhoto ? "New Photo Captured" : "Previous Evidence"}
                    </Text>
                    <Button compact onPress={pickCompletionPhoto} mode="text" labelStyle={{ fontSize: 10 }}>
                      Change Photo
                    </Button>
                  </View>
                </View>
              )}
              {!completionPhoto && !selectedTask?.completionPhotoUrl && (
                <Button mode="outlined" onPress={pickCompletionPhoto} icon="camera" style={styles.photoButton}>
                  Take Completion Photo
                </Button>
              )}
            </View>

            <TextInput
              label="Remarks / Description"
              mode="outlined"
              multiline
              numberOfLines={4}
              value={completionRemarks}
              onChangeText={setCompletionRemarks}
              placeholder="Describe what you did..."
              style={styles.remarksInput}
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <Button onPress={() => setCompletionModalVisible(false)} disabled={isSubmittingCompletion}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={submitCompletion}
              loading={isSubmittingCompletion}
              disabled={
                isSubmittingCompletion ||
                !isChecklistComplete
              }
            >
              {selectedTask?.status === "COMPLETED" ? "Update Submission" : "Confirm Completion"}
            </Button>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
}

function getGreeting() {
  const hour = dayjs().hour();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
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
    position: "relative"
  },
  badgeCount: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#A4262C",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "bold"
  },
  notificationDialog: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginHorizontal: 20
  },
  dialogTitle: {
    fontWeight: "800",
    color: "#24312D"
  },
  notificationItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0"
  },
  unreadItem: {
    backgroundColor: "#F8F9FA"
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#24312D"
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#A4262C"
  },
  notificationMsg: {
    fontSize: 12,
    color: "#66736F",
    lineHeight: 18
  },
  notificationTime: {
    fontSize: 10,
    color: "#9BA3A1",
    marginTop: 6,
    fontWeight: "600"
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingTop: 12
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
  summaryRow: {
    flexDirection: "row",
    gap: 8
  },
  summaryCard: {
    borderRadius: 8,
    backgroundColor: "#EEEEEE",
    flex: 1
  },
  summaryCardWide: {
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
  summarySubValue: {
    color: "#66736F",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4
  },
  emptyText: {
    color: "#66736F",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center"
  },
  // Tasks Navigation and Completion styles from TasksScreen
  dateNavigator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 4,
  },
  dateDisplay: { flex: 1, paddingVertical: 8 },
  dateTitle: { fontSize: 14, fontWeight: "800", color: "#24312D", textAlign: "center" },
  dateSubtitle: { fontSize: 10, color: "#66736F", fontWeight: "700", textTransform: "uppercase", textAlign: "center" },
  attachmentChip: {
    marginTop: 4,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    alignSelf: "flex-start",
  },
  attachmentChipText: { fontSize: 11, fontWeight: "700", color: "#2563EB" },
  modalContent: { backgroundColor: "white", padding: 24, margin: 20, borderRadius: 16, maxHeight: "90%" },
  modalTitle: { fontWeight: "bold", color: "#1A201E" },
  modalSubtitle: { color: "#66736F", marginTop: 4, marginBottom: 16 },
  divider: { marginBottom: 16 },
  photoSection: { marginBottom: 16 },
  photoButton: { marginBottom: 16, borderColor: "#E0E0E0" },
  photoPreview: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  thumbnail: { width: 60, height: 60, borderRadius: 8 },
  photoNote: { fontSize: 12, color: "#2E7D32", fontWeight: "bold" },
  remarksInput: { backgroundColor: "white", marginBottom: 20 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, borderTopWidth: 1, borderTopColor: "#E0E0E0", paddingTop: 12 },
  checklistSection: { marginTop: 8, marginBottom: 16 },
  checklistHeading: { fontSize: 14, fontWeight: "bold", color: "#1A201E", marginBottom: 12 },
  checklistItem: { marginBottom: 12 },
  checklistItemTitle: { fontSize: 13, fontWeight: "800", color: "#24312D", marginBottom: 6 },
  checklistFields: { gap: 8, paddingLeft: 4 },
  checklistTextInput: { backgroundColor: "white", height: 45, fontSize: 12, marginVertical: 4 },
  dropdownContainer: { marginVertical: 4 },
  fieldLabel: { fontSize: 11, fontWeight: "bold", color: "#66736F", marginBottom: 4 },
  optionsButtonGroup: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  optionButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: "#E0E0E0", backgroundColor: "#F7F9F8" },
  optionButtonActive: { borderColor: "#1A201E", backgroundColor: "#1A201E" },
  optionText: { fontSize: 11, fontWeight: "bold", color: "#66736F" },
  optionTextActive: { color: "white" },
  checklistFieldRow: { flexDirection: "row", alignItems: "center", marginVertical: 4 },
  mediaPreviewContainer: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  mediaPreview: { width: 50, height: 50, borderRadius: 6 },
  uploadedFileName: { fontSize: 11, fontWeight: "bold", color: "#2E7D32" },
  tasksSectionCard: {
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 16,
  },
  taskStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F9F8",
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  taskStatBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  taskStatNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#24312D",
  },
  taskStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#66736F",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  taskStatsDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E0E0E0",
  }
});
