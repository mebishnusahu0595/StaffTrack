import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, TouchableOpacity, View, Image } from "react-native";
import { Menu, Button, Text, Portal, Modal, TextInput, IconButton, Divider, TouchableRipple } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { Task, TaskStatus } from "../api";
import { TaskCard } from "../components/TaskCard";
import { useTasks } from "../hooks/useTasks";
import { uploadPhoto } from "../api";
import { API_ORIGIN_URL } from "../config/env";
import { appIconSource } from "../components/AppIcon";

type TabValue = "ALL" | "PENDING" | "COMPLETED";

export function TasksScreen() {
  const { tasks, isFetching, isUpdatingStatus, refetch, updateStatus } = useTasks();
  const [activeTab, setActiveTab] = useState<TabValue>("ALL");
  const [menuVisible, setMenuVisible] = useState(false);

  // Completion Modal State
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [completionPhoto, setCompletionPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [completionRemarks, setCompletionRemarks] = useState("");
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs().startOf("day"));

  const filteredTasks = useMemo(() => {
    let result = tasks;

    const selectedDateString = selectedDate.format("YYYY-MM-DD");
    const isSelectedToday = selectedDateString === dayjs().format("YYYY-MM-DD");

    result = result.filter((t) => {
      const taskDateString = t.dueDate.split("T")[0];
      if (isSelectedToday) {
        return (
          taskDateString === selectedDateString ||
          (taskDateString < selectedDateString && t.status !== "COMPLETED" && t.status !== "CANCELLED")
        );
      }
      return taskDateString === selectedDateString;
    });

    switch (activeTab) {
      case "PENDING":
        return result.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS");
      case "COMPLETED":
        return result.filter((t) => t.status === "COMPLETED");
      case "ALL":
      default:
        return result;
    }
  }, [tasks, activeTab, selectedDate]);

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

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
    const hasExistingPhoto = !!selectedTask?.completionPhotoUrl;
    if (!selectedTask || (!completionPhoto && !hasExistingPhoto) || !completionRemarks.trim()) {
      Alert.alert("Missing Details", "Photo and remarks are required to complete this task.");
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
        console.warn("[TasksScreen] Failed to retrieve GPS:", locErr);
      }
      await updateStatus({
        taskId: selectedTask.id,
        status: "COMPLETED",
        completionData: { photoUrl, remarks: completionRemarks.trim(), lat, lng },
      });
      setCompletionModalVisible(false);
      setCompletionPhoto(null);
      setCompletionRemarks("");
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

  async function exportDailyPDF() {
    const dateLabel = selectedDate.format("dddd, DD MMMM YYYY");
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((t) => t.status === "COMPLETED").length;
    const pending = filteredTasks.filter((t) => t.status === "PENDING").length;
    const inProgress = filteredTasks.filter((t) => t.status === "IN_PROGRESS").length;

    const statusColor: Record<string, string> = {
      COMPLETED: "#10b981",
      PENDING: "#f59e0b",
      IN_PROGRESS: "#3b82f6",
      MISSED: "#ef4444",
      REVIEW: "#8b5cf6",
      CANCELLED: "#94a3b8",
    };

    const taskRows = filteredTasks
      .map(
        (task, i) => `
      <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#ffffff"};">
        <td style="padding:10px 14px;font-weight:700;color:#1e293b;font-size:12px;">${i + 1}. ${task.title}</td>
        <td style="padding:10px 14px;text-align:center;">
          <span style="background:${(statusColor[task.status] || "#94a3b8")}20;color:${statusColor[task.status] || "#94a3b8"};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;text-transform:uppercase;">${task.status.replace("_", " ")}</span>
        </td>
        <td style="padding:10px 14px;color:#64748b;font-size:11px;font-weight:600;">${task.priority || "Medium"}</td>
        <td style="padding:10px 14px;color:#64748b;font-size:11px;">${task.attachmentName ? "📎 " + task.attachmentName.slice(0, 18) : "—"}</td>
      </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>My Daily Task Schedule</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#0f172a;}
  .page{max-width:800px;margin:0 auto;background:white;}
  .header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:white;padding:36px 40px 28px;}
  .badge{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:4px 12px;display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px;}
  h1{font-size:24px;font-weight:900;margin-bottom:4px;}
  .header p{color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px 40px;background:#f8fafc;border-bottom:1px solid #e2e8f0;}
  .stat{background:white;border-radius:10px;padding:12px;text-align:center;border:1px solid #e2e8f0;}
  .stat-num{font-size:22px;font-weight:900;color:#1e293b;}
  .stat-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-top:2px;}
  .content{padding:28px 40px;}
  .section-title{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:12px;}
  table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;}
  th{background:#1e293b;color:white;padding:10px 14px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;}
  .footer{padding:16px 40px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;background:#f8fafc;}
  .footer p{color:#94a3b8;font-size:10px;font-weight:700;}
</style></head><body>
<div class="page">
  <div class="header">
    <div class="badge">StaffTrack</div>
    <h1>My Daily Schedule</h1>
    <p>${dateLabel}</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-num">${total}</div><div class="stat-label">Total</div></div>
    <div class="stat"><div class="stat-num" style="color:#10b981;">${completed}</div><div class="stat-label">Done</div></div>
    <div class="stat"><div class="stat-num" style="color:#3b82f6;">${inProgress}</div><div class="stat-label">In Progress</div></div>
    <div class="stat"><div class="stat-num" style="color:#f59e0b;">${pending}</div><div class="stat-label">Pending</div></div>
  </div>
  <div class="content">
    <p class="section-title">Tasks</p>
    <table>
      <thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Attachment</th></tr></thead>
      <tbody>${taskRows || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8;">No tasks for this day</td></tr>'}</tbody>
    </table>
  </div>
  <div class="footer">
    <p>Generated by StaffTrack</p>
    <p>Confidential</p>
  </div>
</div>
</body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Daily Task Schedule" });
      } else {
        Alert.alert("PDF Saved", "Your daily schedule PDF has been generated.");
      }
    } catch (err) {
      Alert.alert("Error", "Could not generate PDF. Please try again.");
      console.error(err);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            My Tasks
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.pdfButton} onPress={exportDailyPDF}>
              <Text style={styles.pdfButtonText}>📄 PDF</Text>
            </TouchableOpacity>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon={appIconSource("filter-variant")}
                  mode="contained-tonal"
                  containerColor="#E7F3EF"
                  iconColor="#1A202C"
                  onPress={() => setMenuVisible(true)}
                />
              }
            >
              <Menu.Item onPress={() => { setActiveTab("ALL"); setMenuVisible(false); }} title="All Tasks" />
              <Menu.Item onPress={() => { setActiveTab("PENDING"); setMenuVisible(false); }} title="Pending" />
              <Menu.Item onPress={() => { setActiveTab("COMPLETED"); setMenuVisible(false); }} title="Completed" />
            </Menu>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {
                tasks.filter((t) => {
                  const taskDateString = t.dueDate.split("T")[0];
                  const selectedDateString = selectedDate.format("YYYY-MM-DD");
                  const isSelectedToday = selectedDateString === dayjs().format("YYYY-MM-DD");
                  const matchesDate = isSelectedToday
                    ? taskDateString === selectedDateString ||
                      (taskDateString < selectedDateString && t.status !== "COMPLETED" && t.status !== "CANCELLED")
                    : taskDateString === selectedDateString;
                  return (t.status === "PENDING" || t.status === "IN_PROGRESS") && matchesDate;
                }).length
              }
            </Text>
            <Text style={styles.statLabel}>To Do</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {
                tasks.filter((t) => {
                  const taskDateString = t.dueDate.split("T")[0];
                  const selectedDateString = selectedDate.format("YYYY-MM-DD");
                  return t.status === "COMPLETED" && taskDateString === selectedDateString;
                }).length
              }
            </Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Filter</Text>
            <Text style={[styles.statNumber, { fontSize: 14, color: "#1A202C" }]}>{activeTab}</Text>
          </View>
        </View>

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
      </View>

      <FlatList
        contentContainerStyle={filteredTasks.length > 0 ? styles.list : styles.emptyList}
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View>
            <TaskCard disabled={isUpdatingStatus} onPress={handleTaskPress} task={item} />
            {item.attachmentUrl && (
              <TouchableOpacity style={styles.attachmentChip} onPress={() => openAttachment(item)}>
                <Text style={styles.attachmentChipText}>📎 {item.attachmentName || "View Attachment"}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No tasks found for this status.</Text>}
      />

      <Portal>
        <Modal
          visible={completionModalVisible}
          onDismiss={() => !isSubmittingCompletion && setCompletionModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle} variant="titleLarge">
            Complete Task
          </Text>
          <Text style={styles.modalSubtitle} variant="bodyMedium">
            Please provide proof of completion
          </Text>

          <Divider style={styles.divider} />

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
                (!completionPhoto && !selectedTask?.completionPhotoUrl) ||
                !completionRemarks.trim()
              }
            >
              {selectedTask?.status === "COMPLETED" ? "Update Submission" : "Confirm Completion"}
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F9F8" },
  header: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: { fontWeight: "800", color: "#1A201E" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  pdfButton: {
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  pdfButtonText: { color: "#065F46", fontWeight: "800", fontSize: 11 },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F9F8",
    borderRadius: 12,
    padding: 12,
  },
  statBox: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "800", color: "#24312D" },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#66736F",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statsDivider: { width: 1, height: 24, backgroundColor: "#E0E0E0" },
  dateNavigator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 4,
  },
  dateDisplay: { flex: 1, paddingVertical: 8 },
  dateTitle: { fontSize: 14, fontWeight: "800", color: "#24312D" },
  dateSubtitle: { fontSize: 10, color: "#66736F", fontWeight: "700", textTransform: "uppercase" },
  list: { padding: 16 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: "#66736F", textAlign: "center" },
  attachmentChip: {
    marginHorizontal: 16,
    marginTop: -8,
    marginBottom: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    alignSelf: "flex-start",
  },
  attachmentChipText: { fontSize: 11, fontWeight: "700", color: "#2563EB" },
  modalContent: { backgroundColor: "white", padding: 24, margin: 20, borderRadius: 16 },
  modalTitle: { fontWeight: "bold", color: "#1A201E" },
  modalSubtitle: { color: "#66736F", marginTop: 4, marginBottom: 16 },
  divider: { marginBottom: 16 },
  photoSection: { marginBottom: 16 },
  photoButton: { marginBottom: 16, borderColor: "#E0E0E0" },
  photoPreview: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  thumbnail: { width: 60, height: 60, borderRadius: 8 },
  photoNote: { fontSize: 12, color: "#2E7D32", fontWeight: "bold" },
  remarksInput: { backgroundColor: "white", marginBottom: 20 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
});
