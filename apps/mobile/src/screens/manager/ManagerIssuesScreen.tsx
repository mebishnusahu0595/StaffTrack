import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, Dimensions, Alert, TouchableOpacity } from "react-native";
import { Text, Card, Avatar, ActivityIndicator, IconButton, Portal, Modal, Chip, Button, Divider, TextInput } from "react-native-paper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchAllIssues, fetchUsers, updateIssue, createIssue, type Issue, type IssueStatus } from "../../api";
import { AppIcon } from "../../components/AppIcon";

export function ManagerIssuesScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Issue Action Modal State
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [assigneePickerVisible, setAssigneePickerVisible] = useState(false);

  // Create Issue Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<string>("General");
  const [newPriority, setNewPriority] = useState<string>("Medium");
  const [newAssigneeId, setNewAssigneeId] = useState<string>("");
  const [createAssigneePickerVisible, setCreateAssigneePickerVisible] = useState(false);

  // Queries
  const issuesQuery = useQuery({
    queryKey: ["managerIssues"],
    queryFn: fetchAllIssues
  });

  const usersQuery = useQuery({
    queryKey: ["managerUsers"],
    queryFn: fetchUsers
  });

  // Mutators
  const updateIssueMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateIssue(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managerIssues"] });
      setSelectedIssue(null);
      Alert.alert("Success", "Issue updated successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to update issue.");
    }
  });

  const createIssueMutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managerIssues"] });
      setCreateModalVisible(false);
      // Reset form
      setNewTitle("");
      setNewDescription("");
      setNewCategory("General");
      setNewPriority("Medium");
      setNewAssigneeId("");
      Alert.alert("Success", "Issue reported successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to report issue.");
    }
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([issuesQuery.refetch(), usersQuery.refetch()]);
    setRefreshing(false);
  };

  const handleStatusUpdate = (status: IssueStatus) => {
    if (!selectedIssue) return;
    updateIssueMutation.mutate({
      id: selectedIssue.id,
      payload: { status }
    });
  };

  const handleAssigneeUpdate = (assigneeId: string) => {
    if (!selectedIssue) return;
    updateIssueMutation.mutate({
      id: selectedIssue.id,
      payload: { assigneeId }
    });
    setAssigneePickerVisible(false);
  };

  const handleCreateSave = () => {
    if (!newTitle.trim()) {
      Alert.alert("Error", "Issue Title is required.");
      return;
    }
    if (!newDescription.trim()) {
      Alert.alert("Error", "Description is required.");
      return;
    }

    createIssueMutation.mutate({
      title: newTitle.trim(),
      description: newDescription.trim(),
      category: newCategory,
      priority: newPriority,
      assigneeId: newAssigneeId || undefined
    });
  };

  const list = issuesQuery.data || [];
  const team = usersQuery.data || [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10B981"]} />
        }
      >
        {issuesQuery.isLoading ? (
          <ActivityIndicator color="#1A202C" style={{ marginTop: 40 }} />
        ) : list.length === 0 ? (
          <Card style={styles.emptyCard} elevation={0}>
            <Card.Content style={styles.emptyContent}>
              <AppIcon name="check-circle-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>No active issues.</Text>
              <Text style={styles.emptySubtext}>Your team members have not reported any issues or problems.</Text>
            </Card.Content>
          </Card>
        ) : (
          list.map((issue) => {
            const isResolved = issue.status === "Resolved" || issue.status === "Closed";
            
            const priorityColors = {
              Critical: { text: "#EF4444", bg: "#FEF2F2" },
              High: { text: "#F59E0B", bg: "#FEF3C7" },
              Medium: { text: "#3B82F6", bg: "#EFF6FF" },
              Low: { text: "#10B981", bg: "#EAFAF1" }
            };
            const pColors = priorityColors[issue.priority || "Medium"];

            const statusColors = {
              Open: { text: "#EF4444", bg: "#FEF2F2" },
              "In Progress": { text: "#3B82F6", bg: "#EFF6FF" },
              Resolved: { text: "#10B981", bg: "#EAFAF1" },
              Closed: { text: "#64748B", bg: "#F1F5F9" }
            };
            const sColors = statusColors[issue.status || "Open"];

            return (
              <Card 
                key={issue.id} 
                style={styles.issueCard} 
                elevation={1} 
                onPress={() => setSelectedIssue(issue)}
              >
                <Card.Content>
                  <View style={styles.issueHeader}>
                    <Text style={styles.issueTitle}>{issue.title}</Text>
                    <Text style={styles.issueCategory}>{issue.category || "General Issue"}</Text>
                  </View>
                  <Text style={styles.issueDesc} numberOfLines={2}>{issue.description}</Text>

                  {/* Badges */}
                  <View style={styles.badgeRow}>
                    <Chip 
                      textStyle={{ color: pColors.text, fontSize: 10, fontWeight: "800" }} 
                      style={[styles.badgeChip, { backgroundColor: pColors.bg }]}
                    >
                      {issue.priority.toUpperCase()}
                    </Chip>
                    <Chip 
                      textStyle={{ color: sColors.text, fontSize: 10, fontWeight: "800" }} 
                      style={[styles.badgeChip, { backgroundColor: sColors.bg }]}
                    >
                      {issue.status.toUpperCase()}
                    </Chip>
                  </View>

                  <View style={styles.peopleRow}>
                    <View style={styles.personItem}>
                      <Text style={styles.personLabel}>REPORTED BY</Text>
                      <Text style={styles.personVal}>{issue.reportedBy?.name || "Employee"}</Text>
                    </View>
                    <View style={[styles.personItem, { alignItems: "flex-end" }]}>
                      <Text style={styles.personLabel}>ASSIGNED TO</Text>
                      <Text style={[styles.personVal, { color: issue.assignee?.name ? "#475569" : "#EF4444" }]}>
                        {issue.assignee?.name || "Unassigned"}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Action Dialog Modal */}
      <Portal>
        <Modal 
          visible={Boolean(selectedIssue)} 
          onDismiss={() => setSelectedIssue(null)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedIssue && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Resolve Team Issue</Text>
                <IconButton 
                  icon={() => <AppIcon name="close" size={24} color="#1A202C" />}
                  onPress={() => setSelectedIssue(null)} 
                  style={{ margin: 0 }}
                />
              </View>

              <Text style={styles.issueModalTitle}>{selectedIssue.title}</Text>
              <Text style={styles.issueModalDesc}>{selectedIssue.description}</Text>

              <View style={styles.modalMetaRow}>
                <View style={styles.metaCol}>
                  <Text style={styles.personLabel}>Reported By</Text>
                  <Text style={styles.metaText}>{selectedIssue.reportedBy?.name || "Employee"}</Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.personLabel}>Date Filed</Text>
                  <Text style={styles.metaText}>{dayjs(selectedIssue.createdAt).format("MMM DD, YYYY")}</Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              {/* Status Update Section */}
              <Text style={styles.sectionLabel}>Update Progress Status</Text>
              <View style={styles.statusChipsContainer}>
                {(["Open", "In Progress", "Resolved", "Closed"] as const).map((status) => {
                  const active = selectedIssue.status === status;
                  return (
                    <Chip
                      key={status}
                      selected={active}
                      onPress={() => handleStatusUpdate(status)}
                      style={[styles.statusChip, active && styles.statusChipActive]}
                      textStyle={[styles.statusChipText, active && styles.statusChipTextActive]}
                    >
                      {status.toUpperCase()}
                    </Chip>
                  );
                })}
              </View>

              <Divider style={styles.divider} />

              {/* Assignee Update Section */}
              <Text style={styles.sectionLabel}>Assign Worker</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setAssigneePickerVisible(true)}>
                <Text style={styles.pickerButtonText}>
                  {selectedIssue.assignee?.name || "No worker assigned..."}
                </Text>
                <AppIcon name="chevron-right" size={20} color="#64748B" style={{ transform: [{ rotate: "90deg" }] }} />
              </TouchableOpacity>

              <View style={{ height: 10 }} />
            </ScrollView>
          )}
        </Modal>

        {/* Assignee choice list modal overlay */}
        <Modal visible={assigneePickerVisible} onDismiss={() => setAssigneePickerVisible(false)} contentContainerStyle={styles.dropdownModal}>
          <Text style={styles.dropdownTitle}>Assign Worker</Text>
          <ScrollView style={styles.dropdownScroll}>
            {team.length === 0 ? (
              <Text style={styles.dropdownEmpty}>No staff members available.</Text>
            ) : (
              team.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.dropdownItem, selectedIssue?.assignee?.id === u.id && styles.dropdownItemActive]}
                  onPress={() => handleAssigneeUpdate(u.id)}
                >
                  <Text style={[styles.dropdownText, selectedIssue?.assignee?.id === u.id && styles.dropdownTextActive]}>{u.name}</Text>
                  <Text style={styles.dropdownEmail}>{u.email}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <Button mode="text" textColor="#EF4444" onPress={() => setAssigneePickerVisible(false)}>
            Close
          </Button>
        </Modal>

        {/* Portal Dialog Modal for Issue Creation */}
        <Modal 
          visible={createModalVisible} 
          onDismiss={() => setCreateModalVisible(false)}
          contentContainerStyle={styles.createModalContainer}
        >
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report & Assign Issue</Text>
              <IconButton 
                icon={() => <AppIcon name="close" size={24} color="#1A202C" />}
                onPress={() => setCreateModalVisible(false)} 
                style={{ margin: 0 }}
              />
            </View>

            <TextInput
              label="Issue Title *"
              value={newTitle}
              onChangeText={setNewTitle}
              mode="outlined"
              activeOutlineColor="#1A202C"
              style={styles.input}
            />

            <TextInput
              label="Description *"
              value={newDescription}
              onChangeText={setNewDescription}
              mode="outlined"
              activeOutlineColor="#1A202C"
              multiline
              numberOfLines={4}
              style={styles.input}
            />

            {/* Category selection */}
            <Text style={styles.pickerTitle}>Category</Text>
            <View style={styles.chipsRow}>
              {(["Technical", "Operational", "HR", "Safety", "Facilities", "General"] as const).map((cat) => {
                const active = newCategory === cat;
                return (
                  <Chip
                    key={cat}
                    selected={active}
                    onPress={() => setNewCategory(cat)}
                    style={[styles.chipItem, active && styles.chipItemActive]}
                    textStyle={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {cat}
                  </Chip>
                );
              })}
            </View>

            {/* Priority selection */}
            <Text style={styles.pickerTitle}>Priority</Text>
            <View style={styles.chipsRow}>
              {(["Low", "Medium", "High", "Critical"] as const).map((prio) => {
                const active = newPriority === prio;
                return (
                  <Chip
                    key={prio}
                    selected={active}
                    onPress={() => setNewPriority(prio)}
                    style={[styles.chipItem, active && styles.chipItemActive]}
                    textStyle={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {prio.toUpperCase()}
                  </Chip>
                );
              })}
            </View>

            {/* Assignee Chooser Trigger */}
            <Text style={styles.pickerTitle}>Assignee (Optional)</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setCreateAssigneePickerVisible(true)}>
              <Text style={styles.pickerButtonText}>
                {newAssigneeId ? (team.find(u => u.id === newAssigneeId)?.name || "Selected worker") : "Select team member..."}
              </Text>
              <AppIcon name="chevron-right" size={20} color="#64748B" style={{ transform: [{ rotate: "90deg" }] }} />
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <Button mode="text" textColor="#64748B" onPress={() => setCreateModalVisible(false)} style={styles.modalBtn}>
                Cancel
              </Button>
              <Button 
                mode="contained" 
                buttonColor="#1A202C" 
                textColor="#FFFFFF" 
                onPress={handleCreateSave} 
                loading={createIssueMutation.isPending}
                style={styles.modalBtn}
              >
                Save
              </Button>
            </View>
          </ScrollView>
        </Modal>

        {/* Creation Assignee choice list modal overlay */}
        <Modal visible={createAssigneePickerVisible} onDismiss={() => setCreateAssigneePickerVisible(false)} contentContainerStyle={styles.dropdownModal}>
          <Text style={styles.dropdownTitle}>Assign Worker</Text>
          <ScrollView style={styles.dropdownScroll}>
            <TouchableOpacity
              style={[styles.dropdownItem, !newAssigneeId && styles.dropdownItemActive]}
              onPress={() => {
                setNewAssigneeId("");
                setCreateAssigneePickerVisible(false);
              }}
            >
              <Text style={[styles.dropdownText, !newAssigneeId && styles.dropdownTextActive]}>Unassigned</Text>
            </TouchableOpacity>
            {team.length === 0 ? (
              <Text style={styles.dropdownEmpty}>No staff members available.</Text>
            ) : (
              team.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.dropdownItem, newAssigneeId === u.id && styles.dropdownItemActive]}
                  onPress={() => {
                    setNewAssigneeId(u.id);
                    setCreateAssigneePickerVisible(false);
                  }}
                >
                  <Text style={[styles.dropdownText, newAssigneeId === u.id && styles.dropdownTextActive]}>{u.name}</Text>
                  <Text style={styles.dropdownEmail}>{u.email}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <Button mode="text" textColor="#EF4444" onPress={() => setCreateAssigneePickerVisible(false)}>
            Close
          </Button>
        </Modal>
      </Portal>

      {/* FAB Create Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
        <AppIcon name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
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
  issueCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  issueHeader: {
    marginBottom: 6
  },
  issueTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1A202C"
  },
  issueCategory: {
    fontSize: 11,
    color: "#3B82F6",
    fontWeight: "700",
    marginTop: 3,
    textTransform: "uppercase"
  },
  issueDesc: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 6,
    lineHeight: 18,
    fontWeight: "500"
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 10
  },
  badgeChip: {
    height: 28,
    justifyContent: "center",
    marginRight: 6,
    borderRadius: 8
  },
  peopleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#EEF2F6",
    paddingTop: 10,
    marginTop: 12
  },
  personItem: {
    flex: 1
  },
  personLabel: {
    fontSize: 8,
    color: "#94A3B8",
    fontWeight: "800",
    letterSpacing: 0.5
  },
  personVal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginTop: 2
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    borderRadius: 20,
    maxHeight: "85%",
    elevation: 5
  },
  modalContent: {
    padding: 20
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1A202C"
  },
  issueModalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1A202C",
    marginBottom: 6
  },
  issueModalDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
    fontWeight: "500",
    marginBottom: 16
  },
  modalMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  metaCol: {
    flex: 1
  },
  metaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginTop: 2
  },
  divider: {
    backgroundColor: "#EEF2F6",
    marginVertical: 16
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#1A202C",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  statusChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6
  },
  statusChip: {
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: "#F1F5F9"
  },
  statusChipActive: {
    backgroundColor: "#1A202C"
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569"
  },
  statusChipTextActive: {
    color: "#FFFFFF"
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
    backgroundColor: "#F8FAFC"
  },
  pickerButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569"
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
  createModalContainer: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    borderRadius: 20,
    maxHeight: "85%",
    elevation: 5
  },
  input: {
    marginBottom: 12,
    backgroundColor: "#FFFFFF"
  },
  pickerTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#1A202C",
    marginTop: 8,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12
  },
  chipItem: {
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: "#F1F5F9"
  },
  chipItemActive: {
    backgroundColor: "#1A202C"
  },
  chipText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569"
  },
  chipTextActive: {
    color: "#FFFFFF"
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16
  },
  modalBtn: {
    marginLeft: 10
  }
});
