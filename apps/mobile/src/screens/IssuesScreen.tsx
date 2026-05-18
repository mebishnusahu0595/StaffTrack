import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Chip, Dialog, FAB, List, Portal, Text, TextInput, SegmentedButtons } from "react-native-paper";

import { createIssue, fetchMyIssues, type Issue, type IssuePriority } from "../api";
import { useAuth } from "../auth/AuthContext";

export function IssuesScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [filter, setFilter] = useState("All");

  const [newIssue, setNewIssue] = useState({
    title: "",
    description: "",
    priority: "Medium" as IssuePriority
  });

  const issuesQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["issues", user?.id],
    queryFn: () => fetchMyIssues(user!.id)
  });

  const createMutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", user?.id] });
      setIsDialogVisible(false);
      setNewIssue({ title: "", description: "", priority: "Medium" });
      Alert.alert("Issue Raised", "Management has been notified of your concern.");
    },
    onError: (error) => {
      Alert.alert("Failed", error instanceof Error ? error.message : "Could not raise issue");
    }
  });

  const issues = issuesQuery.data ?? [];
  const filteredIssues = issues.filter(i => filter === "All" || i.status === filter);

  function handleCreate() {
    if (!newIssue.title.trim() || !newIssue.description.trim()) {
      Alert.alert("Missing Info", "Please provide a title and description.");
      return;
    }
    createMutation.mutate(newIssue);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={setFilter}
          buttons={[
            { value: "All", label: "All" },
            { value: "Open", label: "Open" },
            { value: "Resolved", label: "Fixed" }
          ]}
          style={styles.segmented}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {issuesQuery.isLoading ? (
          <Text style={styles.emptyText}>Loading issues...</Text>
        ) : filteredIssues.length === 0 ? (
          <View style={styles.emptyContainer}>
            <List.Icon icon="check-circle-outline" color="#CCC" />
            <Text style={styles.emptyText}>No {filter === "All" ? "" : filter.toLowerCase()} issues found.</Text>
          </View>
        ) : (
          filteredIssues.map((issue) => (
            <Card key={issue.id} mode="elevated" style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text style={styles.issueTitle}>{issue.title}</Text>
                  <Chip 
                    selectedColor={issue.status === "Open" ? "#A4262C" : "#17633A"}
                    style={[styles.statusChip, { backgroundColor: issue.status === "Open" ? "#FADBD8" : "#D4EFDF" }]}
                    textStyle={styles.chipText}
                  >
                    {issue.status}
                  </Chip>
                </View>
                <Text style={styles.description}>{issue.description}</Text>
                <View style={styles.footer}>
                  <View style={styles.meta}>
                    <List.Icon icon="clock-outline" color="#66736F" style={styles.smallIcon} />
                    <Text style={styles.metaText}>{dayjs(issue.createdAt).fromNow()}</Text>
                  </View>
                  <Chip style={styles.priorityChip} textStyle={styles.priorityText}>
                    {issue.priority}
                  </Chip>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={isDialogVisible} onDismiss={() => setIsDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Raise an Issue</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <TextInput
              label="Issue Title"
              mode="outlined"
              value={newIssue.title}
              onChangeText={(title) => setNewIssue({ ...newIssue, title })}
              style={styles.input}
              placeholder="e.g. Broken Tool, Software Bug"
            />
            <TextInput
              label="Describe the problem"
              mode="outlined"
              multiline
              numberOfLines={4}
              value={newIssue.description}
              onChangeText={(description) => setNewIssue({ ...newIssue, description })}
              style={styles.input}
            />
            <Text style={styles.label}>Priority</Text>
            <SegmentedButtons
              value={newIssue.priority}
              onValueChange={(p) => setNewIssue({ ...newIssue, priority: p as IssuePriority })}
              buttons={[
                { value: "Low", label: "Low" },
                { value: "Medium", label: "Med" },
                { value: "High", label: "High" },
                { value: "Critical", label: "Crit" }
              ]}
              style={styles.priorityButtons}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsDialogVisible(false)}>Cancel</Button>
            <Button 
              loading={createMutation.isPending} 
              onPress={handleCreate} 
              mode="contained"
              style={styles.createButton}
            >
              Raise Issue
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setIsDialogVisible(true)}
        label="Raise Issue"
        color="white"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9F8"
  },
  filterContainer: {
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0"
  },
  segmented: {
    height: 40
  },
  content: {
    padding: 16,
    paddingBottom: 100
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: "white"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8
  },
  issueTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#24312D",
    flex: 1,
    marginRight: 8
  },
  statusChip: {
    height: 24,
    borderRadius: 6
  },
  chipText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  description: {
    fontSize: 14,
    color: "#66736F",
    lineHeight: 20,
    marginBottom: 16
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 12
  },
  meta: {
    flexDirection: "row",
    alignItems: "center"
  },
  smallIcon: {
    margin: 0,
    padding: 0,
    width: 20,
    height: 20
  },
  metaText: {
    fontSize: 12,
    color: "#9BA3A1",
    fontWeight: "600"
  },
  priorityChip: {
    height: 22,
    backgroundColor: "#F0F4F8"
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "700"
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100
  },
  emptyText: {
    color: "#9BA3A1",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: "#146C5C"
  },
  dialog: {
    backgroundColor: "white",
    borderRadius: 24
  },
  dialogTitle: {
    fontWeight: "800",
    color: "#24312D"
  },
  dialogContent: {
    gap: 16
  },
  input: {
    backgroundColor: "white"
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#66736F",
    marginTop: 8
  },
  priorityButtons: {
    marginTop: 4
  },
  createButton: {
    borderRadius: 8,
    backgroundColor: "#146C5C"
  }
});
