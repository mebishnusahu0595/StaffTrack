import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, Alert, TouchableOpacity } from "react-native";
import { Text, Card, Button, ActivityIndicator, IconButton, Portal, Modal, TextInput, Chip, Avatar } from "react-native-paper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchTasks, fetchUsers, createTask, deleteTask, updateTask, fetchTemplates, type Task } from "../../api";
import { AppIcon } from "../../components/AppIcon";

type TabValue = "ALL" | "PENDING" | "COMPLETED";

export function ManagerTasksScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabValue>("ALL");
  const [refreshing, setRefreshing] = useState(false);

  // Form Modals State
  const [formVisible, setFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState("10");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [dueDate, setDueDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [assignedToId, setAssignedToId] = useState("");

  // Assignee Dropdown Picker State
  const [pickerVisible, setPickerVisible] = useState(false);

  // Template Picker State
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);

  // Fetch Team Tasks & Users
  const tasksQuery = useQuery({
    queryKey: ["managerTasks"],
    queryFn: fetchTasks
  });

  const usersQuery = useQuery({
    queryKey: ["managerUsers"],
    queryFn: fetchUsers
  });

  const templatesQuery = useQuery({
    queryKey: ["managerTemplates"],
    queryFn: () => fetchTemplates({ type: "Task" })
  });

  // Mutators
  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managerTasks"] });
      closeForm();
      Alert.alert("Success", "Task created successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to create task.");
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateTask(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managerTasks"] });
      closeForm();
      Alert.alert("Success", "Task updated successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to update task.");
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managerTasks"] });
      Alert.alert("Success", "Task deleted successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to delete task.");
    }
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([tasksQuery.refetch(), usersQuery.refetch()]);
    setRefreshing(false);
  };

  const openCreateForm = () => {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setPoints("10");
    setPriority("Medium");
    setDueDate(dayjs().format("YYYY-MM-DD"));
    const users = usersQuery.data || [];
    setAssignedToId(users.length > 0 ? users[0].id : "");
    setFormVisible(true);
  };

  const openEditForm = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setPoints((task.points || 10).toString());
    setPriority(task.priority || "Medium");
    setDueDate(dayjs(task.dueDate).format("YYYY-MM-DD"));
    setAssignedToId(task.assignedTo?.id || "");
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingTask(null);
  };

  const handleSave = () => {
    if (!title.trim() || !assignedToId) {
      Alert.alert("Error", "Task Title and Assignee are required.");
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      points: parseInt(points) || 0,
      priority,
      dueDate: dayjs(dueDate).toISOString(),
      assignedToId
    };

    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, payload });
    } else {
      createTaskMutation.mutate(payload);
    }
  };

  const handleDelete = (taskId: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this task?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => deleteTaskMutation.mutate(taskId) 
        }
      ]
    );
  };

  const filteredTasks = useMemo(() => {
    const list = tasksQuery.data || [];
    switch (activeTab) {
      case "PENDING":
        return list.filter(t => t.status === "PENDING" || t.status === "IN_PROGRESS");
      case "COMPLETED":
        return list.filter(t => t.status === "COMPLETED");
      case "ALL":
      default:
        return list;
    }
  }, [tasksQuery.data, activeTab]);

  const team = usersQuery.data || [];
  const selectedAssignee = team.find(u => u.id === assignedToId);

  return (
    <View style={styles.container}>
      {/* Top Tabs */}
      <View style={styles.tabHeader}>
        {(["ALL", "PENDING", "COMPLETED"] as TabValue[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10B981"]} />
        }
      >
        {tasksQuery.isLoading ? (
          <ActivityIndicator color="#1A202C" style={{ marginTop: 40 }} />
        ) : filteredTasks.length === 0 ? (
          <Card style={styles.emptyCard} elevation={0}>
            <Card.Content style={styles.emptyContent}>
              <AppIcon name="clipboard-list" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>No tasks found.</Text>
              <Text style={styles.emptySubtext}>Use the button below to assign a new task to your team.</Text>
            </Card.Content>
          </Card>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === "COMPLETED";
            const priorityColors = {
              High: { text: "#EF4444", bg: "#FEF2F2" },
              Medium: { text: "#F59E0B", bg: "#FEF3C7" },
              Low: { text: "#10B981", bg: "#EAFAF1" }
            };
            const priorityVal = task.priority || "Medium";
            const pColors = priorityColors[priorityVal];

            return (
              <Card key={task.id} style={styles.taskCard} elevation={1}>
                <Card.Content>
                  <View style={styles.taskHeader}>
                    <View style={styles.headerLeft}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      {task.description ? (
                        <Text style={styles.taskDesc}>{task.description}</Text>
                      ) : null}
                    </View>
                    <IconButton 
                      icon={() => <AppIcon name="close" size={20} color="#EF4444" />}
                      onPress={() => handleDelete(task.id)}
                      style={styles.deleteButton}
                    />
                  </View>

                  {/* Badges / Meta Info */}
                  <View style={styles.metaRow}>
                    <Chip 
                      textStyle={{ color: pColors.text, fontSize: 10, fontWeight: "800" }} 
                      style={[styles.badgeChip, { backgroundColor: pColors.bg }]}
                    >
                      {priorityVal.toUpperCase()}
                    </Chip>
                    <Chip 
                      textStyle={{ color: isCompleted ? "#10B981" : "#F59E0B", fontSize: 10, fontWeight: "800" }} 
                      style={[styles.badgeChip, { backgroundColor: isCompleted ? "#EAFAF1" : "#FEF3C7" }]}
                    >
                      {task.status.replace("_", " ")}
                    </Chip>
                    <Chip 
                      icon={() => <AppIcon name="coffee" size={12} color="#475569" />}
                      textStyle={{ color: "#475569", fontSize: 10, fontWeight: "800" }} 
                      style={[styles.badgeChip, { backgroundColor: "#F1F5F9" }]}
                    >
                      {task.points || 0} PTS
                    </Chip>
                  </View>

                  <View style={styles.assigneeRow}>
                    <Avatar.Text 
                      size={28} 
                      label={task.assignedTo?.name ? task.assignedTo.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "S"} 
                      style={styles.assigneeAvatar}
                      labelStyle={styles.assigneeAvatarLabel}
                    />
                    <View style={styles.assigneeInfo}>
                      <Text style={styles.assigneeLabel}>ASSIGNED TO</Text>
                      <Text style={styles.assigneeName}>{task.assignedTo?.name || "Unassigned"}</Text>
                    </View>
                    <View style={styles.dueInfo}>
                      <Text style={styles.assigneeLabel}>DUE DATE</Text>
                      <Text style={styles.dueVal}>{dayjs(task.dueDate).format("MMM DD, YYYY")}</Text>
                    </View>
                    <IconButton 
                      icon={() => <AppIcon name="chevron-right" size={20} color="#3B82F6" style={{ transform: [{ rotate: "180deg" }] }} />}
                      style={{ margin: 0, padding: 0 }}
                      onPress={() => openEditForm(task)}
                    />
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* FAB Create Button */}
      <TouchableOpacity style={styles.fab} onPress={openCreateForm}>
        <AppIcon name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Portal Dialog Modal for Task Creation / Editing */}
      <Portal>
        <Modal visible={formVisible} onDismiss={closeForm} contentContainerStyle={styles.modalContent}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={styles.modalTitle}>{editingTask ? "Edit Task" : "Assign New Task"}</Text>
            {!editingTask && (
              <Button 
                mode="text" 
                compact 
                icon="library-outline" 
                labelStyle={{ fontSize: 11, fontWeight: "800", color: "#10B981" }} 
                onPress={() => setTemplatePickerVisible(true)}
              >
                Use Template
              </Button>
            )}
          </View>
          
          <TextInput
            label="Task Title *"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            activeOutlineColor="#1A202C"
            style={styles.input}
          />

          <TextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            activeOutlineColor="#1A202C"
            multiline
            numberOfLines={3}
            style={styles.input}
          />

          {/* Assignee Chooser Trigger */}
          <Text style={styles.pickerTitle}>Assignee *</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setPickerVisible(true)}>
            <Text style={styles.pickerButtonText}>
              {selectedAssignee ? selectedAssignee.name : "Select team member..."}
            </Text>
            <AppIcon name="chevron-right" size={20} color="#64748B" style={{ transform: [{ rotate: "90deg" }] }} />
          </TouchableOpacity>

          <View style={styles.formRow}>
            <TextInput
              label="Points *"
              value={points}
              onChangeText={setPoints}
              mode="outlined"
              activeOutlineColor="#1A202C"
              keyboardType="numeric"
              style={[styles.input, { flex: 1, marginRight: 8 }]}
            />

            <TextInput
              label="Due Date (YYYY-MM-DD) *"
              value={dueDate}
              onChangeText={setDueDate}
              mode="outlined"
              activeOutlineColor="#1A202C"
              style={[styles.input, { flex: 1.5 }]}
            />
          </View>

          {/* Priority Chips selection */}
          <Text style={styles.pickerTitle}>Priority</Text>
          <View style={styles.chipsRow}>
            {(["Low", "Medium", "High"] as const).map((p) => {
              const active = priority === p;
              return (
                <Chip
                  key={p}
                  selected={active}
                  onPress={() => setPriority(p)}
                  style={[styles.priorityChip, active && styles.priorityChipActive]}
                  textStyle={[styles.priorityChipText, active && styles.priorityChipTextActive]}
                >
                  {p.toUpperCase()}
                </Chip>
              );
            })}
          </View>

          <View style={styles.modalButtons}>
            <Button mode="text" textColor="#64748B" onPress={closeForm} style={styles.modalBtn}>
              Cancel
            </Button>
            <Button 
              mode="contained" 
              buttonColor="#1A202C" 
              textColor="#FFFFFF" 
              onPress={handleSave} 
              loading={createTaskMutation.isPending || updateTaskMutation.isPending}
              style={styles.modalBtn}
            >
              Save
            </Button>
          </View>
        </Modal>

        {/* Assignee dropdown overlay sheet */}
        <Modal visible={pickerVisible} onDismiss={() => setPickerVisible(false)} contentContainerStyle={styles.dropdownModal}>
          <Text style={styles.dropdownTitle}>Choose Assignee</Text>
          <ScrollView style={styles.dropdownScroll}>
            {team.length === 0 ? (
              <Text style={styles.dropdownEmpty}>No staff members available.</Text>
            ) : (
              team.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.dropdownItem, assignedToId === u.id && styles.dropdownItemActive]}
                  onPress={() => {
                    setAssignedToId(u.id);
                    setPickerVisible(false);
                  }}
                >
                  <Text style={[styles.dropdownText, assignedToId === u.id && styles.dropdownTextActive]}>{u.name}</Text>
                  <Text style={styles.dropdownEmail}>{u.email}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <Button mode="text" textColor="#EF4444" onPress={() => setPickerVisible(false)}>
            Close
          </Button>
        </Modal>

        {/* Templates list overlay sheet */}
        <Modal visible={templatePickerVisible} onDismiss={() => setTemplatePickerVisible(false)} contentContainerStyle={styles.dropdownModal}>
          <Text style={styles.dropdownTitle}>Select Predefined Blueprint</Text>
          <ScrollView style={styles.dropdownScroll}>
            {templatesQuery.isLoading ? (
              <ActivityIndicator color="#1A202C" style={{ paddingVertical: 20 }} />
            ) : (templatesQuery.data?.length ?? 0) === 0 ? (
              <Text style={styles.dropdownEmpty}>No task blueprints saved.</Text>
            ) : (
              templatesQuery.data?.map((tpl) => (
                <TouchableOpacity
                  key={tpl.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setTitle(tpl.name);
                    setDescription(tpl.description || "");
                    setPriority((tpl.priority as "High" | "Medium" | "Low") || "Medium");
                    setTemplatePickerVisible(false);
                  }}
                >
                  <Text style={styles.dropdownText}>{tpl.name}</Text>
                  <Text style={styles.dropdownEmail}>Priority: {tpl.priority} • Recurrence: {tpl.recurrence}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <Button mode="text" textColor="#EF4444" onPress={() => setTemplatePickerVisible(false)}>
            Cancel
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  tabHeader: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0"
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6
  },
  tabButtonActive: {
    borderBottomWidth: 3,
    borderColor: "#1A202C"
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase"
  },
  tabTextActive: {
    color: "#1A202C"
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 20
  },
  emptyContent: {
    alignItems: "center",
    justifyContent: "center"
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#475569",
    marginTop: 12,
    textAlign: "center"
  },
  emptySubtext: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 6,
    textAlign: "center"
  },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  headerLeft: {
    flex: 1
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1A202C"
  },
  taskDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18,
    fontWeight: "500"
  },
  deleteButton: {
    margin: 0,
    marginTop: -4
  },
  metaRow: {
    flexDirection: "row",
    marginTop: 10,
    flexWrap: "wrap"
  },
  badgeChip: {
    height: 28,
    justifyContent: "center",
    marginRight: 6,
    borderRadius: 8
  },
  assigneeRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#EEF2F6",
    paddingTop: 10,
    marginTop: 12
  },
  assigneeAvatar: {
    backgroundColor: "#F1F5F9"
  },
  assigneeAvatarLabel: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 12
  },
  assigneeInfo: {
    flex: 1,
    marginLeft: 10
  },
  assigneeLabel: {
    fontSize: 8,
    color: "#94A3B8",
    fontWeight: "800",
    letterSpacing: 0.5
  },
  assigneeName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginTop: 2
  },
  dueInfo: {
    marginRight: 10
  },
  dueVal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#EF4444",
    marginTop: 2
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1A202C",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 }
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    margin: 20,
    borderRadius: 20,
    padding: 20,
    elevation: 5
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1A202C",
    marginBottom: 16
  },
  input: {
    marginBottom: 12,
    backgroundColor: "#FFFFFF"
  },
  formRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  pickerTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    marginTop: 4,
    marginBottom: 6,
    textTransform: "uppercase"
  },
  pickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#F8FAFC"
  },
  pickerButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569"
  },
  chipsRow: {
    flexDirection: "row",
    marginBottom: 20
  },
  priorityChip: {
    marginRight: 8,
    backgroundColor: "#F1F5F9"
  },
  priorityChipActive: {
    backgroundColor: "#1A202C"
  },
  priorityChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569"
  },
  priorityChipTextActive: {
    color: "#FFFFFF"
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10
  },
  modalBtn: {
    marginLeft: 10
  },
  dropdownModal: {
    backgroundColor: "#FFFFFF",
    margin: 30,
    borderRadius: 16,
    padding: 16,
    maxHeight: "60%",
    elevation: 5
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1A202C",
    marginBottom: 12
  },
  dropdownScroll: {
    marginBottom: 12
  },
  dropdownEmpty: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 20
  },
  dropdownItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9"
  },
  dropdownItemActive: {
    backgroundColor: "#F8FAFC"
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A202C"
  },
  dropdownTextActive: {
    color: "#3B82F6"
  },
  dropdownEmail: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  }
});
