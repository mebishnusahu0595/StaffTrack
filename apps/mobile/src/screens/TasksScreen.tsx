import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, TouchableOpacity, View, Image, ScrollView } from "react-native";
import { Menu, Button, Text, Portal, Modal, TextInput, IconButton, Divider, TouchableRipple } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import type { Task, TaskStatus } from "../api";
import { TaskCard } from "../components/TaskCard";
import { useTasks } from "../hooks/useTasks";
import { uploadPhoto, uploadFile } from "../api";
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
      quality: 0.5 
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
      quality: 0.5 
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

  const filteredTasks = useMemo(() => {
    let result = tasks;

    const selectedDateString = selectedDate.format("YYYY-MM-DD");

    result = result.filter((t) => {
      const taskDateString = dayjs(t.dueDate).format("YYYY-MM-DD");
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
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.5 });
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
      let remarksVal = completionRemarks.trim();

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

      // Map specific fields for DEALER/FARMER tasks if checklist responses are available
      if (selectedTask?.taskType === "DEALER") {
        const dealerPhoto = checklistResponses["dl_photo"]?.image;
        if (dealerPhoto) photoUrl = dealerPhoto;
        const dealerRemarks = checklistResponses["dl_remarks"]?.text;
        if (dealerRemarks) remarksVal = dealerRemarks;
      } else if (selectedTask?.taskType === "FARMER") {
        const farmerPhoto = checklistResponses["fm_photo"]?.image;
        if (farmerPhoto) photoUrl = farmerPhoto;
        const farmerRemarks = checklistResponses["fm_remarks"]?.text;
        if (farmerRemarks) remarksVal = farmerRemarks;
      }

      await updateStatus({
        taskId: selectedTask.id,
        status: "COMPLETED",
        completionData: { photoUrl, remarks: remarksVal, lat, lng, checklistResponses: compiledResponses },
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
                  const taskDateString = dayjs(t.dueDate).format("YYYY-MM-DD");
                  const selectedDateString = selectedDate.format("YYYY-MM-DD");
                  return (t.status === "PENDING" || t.status === "IN_PROGRESS") && taskDateString === selectedDateString;
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
                  const taskDateString = dayjs(t.dueDate).format("YYYY-MM-DD");
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
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle} variant="titleLarge">
              Complete Task
            </Text>
            <Text style={styles.modalSubtitle} variant="bodyMedium">
              Please provide proof of completion
            </Text>

            <Divider style={styles.divider} />

            {selectedTask?.taskType === "DEALER" && (
              <View style={{ backgroundColor: "#E0F2FE", padding: 12, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: "#BAE6FD" }}>
                <Text style={{ fontWeight: "800", color: "#0369A1", fontSize: 13 }}>🤝 DEALER VISIT TASK</Text>
                <Text style={{ fontSize: 11, color: "#0284C7", marginTop: 2 }}>
                  All Dealer details (Dealer Name, Contact No., Location, Product Discussed, Photo, User Remarks) are compulsory.
                </Text>
              </View>
            )}

            {selectedTask?.taskType === "FARMER" && (
              <View style={{ backgroundColor: "#DCFCE7", padding: 12, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: "#BBF7D0" }}>
                <Text style={{ fontWeight: "800", color: "#15803D", fontSize: 13 }}>🌾 FARMER VISIT TASK</Text>
                <Text style={{ fontSize: 11, color: "#166534", marginTop: 2 }}>
                  All Farmer details (Farmer Name, Contact No., Village, Farm Land, Crop Name, Photo, User Remarks) are compulsory.
                </Text>
              </View>
            )}

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

            {selectedTask?.taskType !== "DEALER" && selectedTask?.taskType !== "FARMER" && (
              <>
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
              </>
            )}
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
});
