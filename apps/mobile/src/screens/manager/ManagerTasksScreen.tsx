import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, Alert, TouchableOpacity, Linking } from "react-native";
import { Text, Card, Button, ActivityIndicator, IconButton, Portal, Modal, TextInput, Chip, Avatar } from "react-native-paper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { fetchTasks, fetchUsers, createTask, deleteTask, updateTask, fetchTemplates, type Task } from "../../api";
import { AppIcon } from "../../components/AppIcon";
import { API_ORIGIN_URL } from "../../config/env";

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

  // Subtasks (only when creating a new task)
  type DraftSubtask = { id: string; title: string; points: string; assignedToId: string };
  const [subtasks, setSubtasks] = useState<DraftSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskPoints, setNewSubtaskPoints] = useState("5");

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
    setSubtasks([]);
    setNewSubtaskTitle("");
    setNewSubtaskPoints("5");
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
    setSubtasks([]); // subtasks are only added at creation time
    setFormVisible(true);
  };

  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: Math.random().toString(), title: newSubtaskTitle.trim(), points: newSubtaskPoints || "0", assignedToId }
    ]);
    setNewSubtaskTitle("");
    setNewSubtaskPoints("5");
  };

  const removeSubtask = (id: string) => setSubtasks((prev) => prev.filter((s) => s.id !== id));

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
      createTaskMutation.mutate({
        ...payload,
        subtasks: subtasks.map((s) => ({
          title: s.title,
          points: parseInt(s.points) || 0,
          assignedToId: s.assignedToId || assignedToId,
          priority,
          dueDate: dayjs(dueDate).toISOString()
        }))
      });
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
    // Hide subtasks from the top level — they are shown nested under their parent.
    const list = (tasksQuery.data || []).filter((t) => !t.isSubtask);
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

  function openAttachment(task: Task) {
    if (!task.attachmentUrl) return;
    const fullUrl = task.attachmentUrl.startsWith("http") ? task.attachmentUrl : `${API_ORIGIN_URL}${task.attachmentUrl}`;
    Linking.openURL(fullUrl).catch(() => Alert.alert("Error", "Could not open this file."));
  }

  async function exportDailyPDF() {
    const dateLabel = dayjs().format("dddd, DD MMMM YYYY");
    const tasks = tasksQuery.data || [];
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "COMPLETED").length;
    const pending = tasks.filter(t => t.status === "PENDING").length;
    const inProgress = tasks.filter(t => t.status === "IN_PROGRESS").length;
    const statusColor: Record<string, string> = {
      COMPLETED: "#10b981", PENDING: "#f59e0b", IN_PROGRESS: "#3b82f6",
      MISSED: "#ef4444", REVIEW: "#8b5cf6", CANCELLED: "#94a3b8"
    };
    const taskRows = tasks.map((task, i) => `
      <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#ffffff"};">
        <td style="padding:10px 14px;font-weight:700;color:#1e293b;font-size:12px;">${i + 1}. ${task.title}</td>
        <td style="padding:10px 14px;color:#64748b;font-size:11px;">${task.assignedTo?.name || "—"}</td>
        <td style="padding:10px 14px;text-align:center;">
          <span style="background:${(statusColor[task.status] || "#94a3b8")}20;color:${statusColor[task.status] || "#94a3b8"};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;text-transform:uppercase;">${task.status.replace("_", " ")}</span>
        </td>
        <td style="padding:10px 14px;color:#64748b;font-size:11px;font-weight:600;">${task.priority || "Medium"}</td>
        <td style="padding:10px 14px;color:#64748b;font-size:11px;">${task.attachmentName ? "📎 " + task.attachmentName.slice(0, 18) : "—"}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Team Daily Schedule</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;}.page{max-width:900px;margin:0 auto;background:white;}.header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:white;padding:36px 40px 28px;}.badge{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:4px 12px;display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px;}h1{font-size:24px;font-weight:900;margin-bottom:4px;}.header p{color:rgba(255,255,255,0.65);font-size:12px;}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px 40px;background:#f8fafc;border-bottom:1px solid #e2e8f0;}.stat{background:white;border-radius:10px;padding:12px;text-align:center;border:1px solid #e2e8f0;}.stat-num{font-size:22px;font-weight:900;color:#1e293b;}.stat-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-top:2px;}.content{padding:28px 40px;}.section-title{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:12px;}table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;}th{background:#1e293b;color:white;padding:10px 14px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;}.footer{padding:16px 40px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;background:#f8fafc;}.footer p{color:#94a3b8;font-size:10px;font-weight:700;}</style></head><body>
<div class="page"><div class="header"><div class="badge">StaffTrack – Manager View</div><h1>Team Daily Schedule</h1><p>${dateLabel}</p></div>
<div class="stats"><div class="stat"><div class="stat-num">${total}</div><div class="stat-label">Total</div></div><div class="stat"><div class="stat-num" style="color:#10b981;">${completed}</div><div class="stat-label">Done</div></div><div class="stat"><div class="stat-num" style="color:#3b82f6;">${inProgress}</div><div class="stat-label">In Progress</div></div><div class="stat"><div class="stat-num" style="color:#f59e0b;">${pending}</div><div class="stat-label">Pending</div></div></div>
<div class="content"><p class="section-title">All Tasks</p><table><thead><tr><th>Task</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Attachment</th></tr></thead><tbody>${taskRows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">No tasks</td></tr>'}</tbody></table></div>
<div class="footer"><p>Generated by StaffTrack</p><p>Confidential</p></div></div></body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Team Daily Schedule" });
      } else {
        Alert.alert("PDF Saved", "Team daily schedule PDF has been generated.");
      }
    } catch (err) {
      Alert.alert("Error", "Could not generate PDF.");
    }
  }

  const team = usersQuery.data || [];
  const selectedAssignee = team.find(u => u.id === assignedToId);

  return (
    <View style={styles.container}>
      {/* Top Tabs + PDF button */}
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
        <TouchableOpacity style={styles.pdfTabBtn} onPress={exportDailyPDF}>
          <Text style={styles.pdfTabBtnText}>📄 PDF</Text>
        </TouchableOpacity>
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
                  {task.attachmentUrl && (
                    <TouchableOpacity style={styles.attachmentRow} onPress={() => openAttachment(task)}>
                      <Text style={styles.attachmentRowText}>📎 {task.attachmentName || "View Attachment"}</Text>
                    </TouchableOpacity>
                  )}

                  {task.subtasks && task.subtasks.length > 0 ? (
                    <View style={styles.subtaskBlock}>
                      <Text style={styles.subtaskBlockTitle}>
                        SUBTASKS ({task.subtasks.filter((s) => s.status === "COMPLETED").length}/{task.subtasks.length})
                      </Text>
                      {task.subtasks.map((sub) => {
                        const done = sub.status === "COMPLETED";
                        return (
                          <View key={sub.id} style={styles.subtaskItem}>
                            <AppIcon
                              name={done ? "check-circle-outline" : "calendar-clock"}
                              size={16}
                              color={done ? "#10B981" : "#F59E0B"}
                            />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                              <Text style={[styles.subtaskItemTitle, done && { textDecorationLine: "line-through", color: "#94A3B8" }]}>
                                {sub.title}
                              </Text>
                              <Text style={styles.subtaskItemMeta}>
                                {sub.assignedTo?.name || "Unassigned"} · {sub.points || 0} pts
                              </Text>
                            </View>
                            <Text style={[styles.subtaskStatus, { color: done ? "#10B981" : "#F59E0B" }]}>
                              {sub.status.replace("_", " ")}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
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

          {/* Subtasks (creation only) */}
          {!editingTask && (
            <View style={{ marginTop: 4, marginBottom: 8 }}>
              <Text style={styles.pickerTitle}>Subtasks</Text>
              {subtasks.map((s) => {
                const sa = team.find((u) => u.id === s.assignedToId);
                return (
                  <View key={s.id} style={styles.subtaskRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subtaskTitle}>{s.title}</Text>
                      <Text style={styles.subtaskMeta}>{s.points} pts · {sa ? sa.name : "Same assignee"}</Text>
                    </View>
                    <IconButton
                      icon={() => <AppIcon name="close" size={16} color="#EF4444" />}
                      onPress={() => removeSubtask(s.id)}
                      style={{ margin: 0 }}
                    />
                  </View>
                );
              })}
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 }}>
                <TextInput
                  label="Subtask title"
                  value={newSubtaskTitle}
                  onChangeText={setNewSubtaskTitle}
                  mode="outlined"
                  dense
                  activeOutlineColor="#1A202C"
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                />
                <TextInput
                  label="Pts"
                  value={newSubtaskPoints}
                  onChangeText={setNewSubtaskPoints}
                  mode="outlined"
                  dense
                  keyboardType="numeric"
                  activeOutlineColor="#1A202C"
                  style={[styles.input, { width: 64, marginBottom: 0 }]}
                />
                <Button mode="contained-tonal" compact onPress={addSubtask} style={{ borderRadius: 10 }}>
                  Add
                </Button>
              </View>
              <Text style={styles.subtaskHint}>Subtasks are assigned to the same staff member. Open each later to reassign.</Text>
            </View>
          )}

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
    borderColor: "#E2E8F0",
    alignItems: "center"
  },
  pdfTabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0"
  },
  pdfTabBtnText: {
    color: "#065F46",
    fontWeight: "800",
    fontSize: 10
  },
  attachmentRow: {
    marginTop: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    alignSelf: "flex-start"
  },
  attachmentRowText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB"
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
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    paddingLeft: 12,
    marginBottom: 6
  },
  subtaskTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1A202C"
  },
  subtaskMeta: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2
  },
  subtaskHint: {
    fontSize: 10,
    color: "#94A3B8",
    fontStyle: "italic",
    marginTop: 6
  },
  subtaskBlock: {
    marginTop: 12,
    borderTopWidth: 1,
    borderColor: "#EEF2F6",
    paddingTop: 10
  },
  subtaskBlockTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 8
  },
  subtaskItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 8,
    marginBottom: 6
  },
  subtaskItemTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A202C"
  },
  subtaskItemMeta: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
    fontWeight: "600"
  },
  subtaskStatus: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase"
  }
});
