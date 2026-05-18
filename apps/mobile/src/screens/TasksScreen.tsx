import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, View, Image } from "react-native";
import { Menu, Button, Text, Portal, Modal, TextInput, IconButton, Divider, ActivityIndicator, TouchableRipple } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";

import type { Task, TaskStatus } from "../api";
import { TaskCard } from "../components/TaskCard";
import { useTasks } from "../hooks/useTasks";
import { uploadPhoto } from "../api";
import { API_BASE_URL } from "../config/env";

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
  const [selectedDate, setSelectedDate] = useState(dayjs().startOf('day'));

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter by date
    const isToday = selectedDate.isSame(dayjs(), 'day');
    result = result.filter(t => {
      const taskDate = dayjs(t.dueDate);
      if (isToday) {
        return taskDate.isSame(selectedDate, 'day') || (taskDate.isBefore(selectedDate, 'day') && t.status !== "COMPLETED");
      }
      return taskDate.isSame(selectedDate, 'day');
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

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7
    });

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

      await updateStatus({ 
        taskId: selectedTask.id, 
        status: "COMPLETED",
        completionData: { photoUrl, remarks: completionRemarks.trim() }
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
    if (task.status === "CANCELLED") {
      return;
    }

    if (task.status === "IN_PROGRESS" || task.status === "COMPLETED") {
      setSelectedTask(task);
      setCompletionRemarks(task.completionRemarks || "");
      setCompletionPhoto(null); // Reset photo as we need a new one or keep existing?
      setCompletionModalVisible(true);
      return;
    }

    try {
      await updateStatus({ taskId: task.id, status: "IN_PROGRESS" });
    } catch (error) {
      Alert.alert("Task update failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text variant="headlineSmall" style={styles.headerTitle}>My Tasks</Text>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton 
                icon="filter-variant" 
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

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {tasks.filter(t => {
                const taskDate = dayjs(t.dueDate);
                const isToday = selectedDate.isSame(dayjs(), 'day');
                const matchesDate = isToday 
                  ? (taskDate.isSame(selectedDate, 'day') || (taskDate.isBefore(selectedDate, 'day') && t.status !== "COMPLETED"))
                  : taskDate.isSame(selectedDate, 'day');
                return (t.status === 'PENDING' || t.status === 'IN_PROGRESS') && matchesDate;
              }).length}
            </Text>
            <Text style={styles.statLabel}>To Do</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {tasks.filter(t => {
                const taskDate = dayjs(t.dueDate);
                return t.status === 'COMPLETED' && taskDate.isSame(selectedDate, 'day');
              }).length}
            </Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Filter</Text>
            <Text style={[styles.statNumber, { fontSize: 14, color: '#1A202C' }]}>{activeTab}</Text>
          </View>
        </View>

        <View style={styles.dateNavigator}>
          <IconButton 
            icon="chevron-left" 
            size={24} 
            onPress={() => setSelectedDate(curr => curr.subtract(1, 'day'))} 
          />
          <TouchableRipple 
            onPress={() => setSelectedDate(dayjs().startOf('day'))}
            style={styles.dateDisplay}
          >
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.dateTitle}>{selectedDate.isSame(dayjs(), 'day') ? "Today's Tasks" : selectedDate.format("DD MMM YYYY")}</Text>
              <Text style={styles.dateSubtitle}>{selectedDate.format("dddd")}</Text>
            </View>
          </TouchableRipple>
          <IconButton 
            icon="chevron-right" 
            size={24} 
            onPress={() => setSelectedDate(curr => curr.add(1, 'day'))} 
          />
        </View>
      </View>

      <FlatList
        contentContainerStyle={filteredTasks.length > 0 ? styles.list : styles.emptyList}
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TaskCard disabled={isUpdatingStatus} onPress={handleTaskPress} task={item} />
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No tasks found for this status.</Text>}
      />

      <Portal>
        <Modal
          visible={completionModalVisible}
          onDismiss={() => !isSubmittingCompletion && setCompletionModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle} variant="titleLarge">Complete Task</Text>
          <Text style={styles.modalSubtitle} variant="bodyMedium">Please provide proof of completion</Text>
          
          <Divider style={styles.divider} />
          
          <View style={styles.photoSection}>
            {/* Show captured or existing photo */}
            {(completionPhoto || selectedTask?.completionPhotoUrl) && (
              <View style={styles.photoPreview}>
                <Image 
                  source={{ uri: completionPhoto ? completionPhoto.uri : (selectedTask?.completionPhotoUrl?.startsWith('http') ? selectedTask.completionPhotoUrl : `${API_BASE_URL}${selectedTask?.completionPhotoUrl}`) }} 
                  style={styles.thumbnail} 
                />
                <View>
                  <Text style={styles.photoNote}>{completionPhoto ? "New Photo Captured" : "Previous Evidence"}</Text>
                  <Button compact onPress={pickCompletionPhoto} mode="text" labelStyle={{ fontSize: 10 }}>Change Photo</Button>
                </View>
              </View>
            )}

            {!completionPhoto && !selectedTask?.completionPhotoUrl && (
              <Button 
                mode="outlined" 
                onPress={pickCompletionPhoto} 
                icon="camera" 
                style={styles.photoButton}
              >
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
            <Button 
              onPress={() => setCompletionModalVisible(false)} 
              disabled={isSubmittingCompletion}
            >
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={submitCompletion} 
              loading={isSubmittingCompletion}
              disabled={isSubmittingCompletion || (!completionPhoto && !selectedTask?.completionPhotoUrl) || !completionRemarks.trim()}
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
  screen: {
    flex: 1,
    backgroundColor: "#F7F9F8"
  },
  header: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  headerTitle: {
    fontWeight: '800',
    color: '#1A201E'
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F9F8',
    borderRadius: 12,
    padding: 12
  },
  statBox: {
    flex: 1,
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#24312D'
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#66736F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2
  },
  statsDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E0E0E0'
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 4
  },
  dateDisplay: {
    flex: 1,
    paddingVertical: 8
  },
  dateTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#24312D'
  },
  dateSubtitle: {
    fontSize: 10,
    color: '#66736F',
    fontWeight: '700',
    textTransform: 'uppercase'
  },

  list: {
    padding: 16
  },
  emptyList: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  emptyText: {
    color: "#66736F",
    textAlign: "center"
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: 16,
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#1A201E'
  },
  modalSubtitle: {
    color: '#66736F',
    marginTop: 4,
    marginBottom: 16
  },
  divider: {
    marginBottom: 16
  },
  photoSection: {
    marginBottom: 16
  },
  photoButton: {
    marginBottom: 16,
    borderColor: '#E0E0E0'
  },
  photoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8
  },
  photoNote: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: 'bold'
  },
  remarksInput: {
    backgroundColor: 'white',
    marginBottom: 20
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12
  }
});
