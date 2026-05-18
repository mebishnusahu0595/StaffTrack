import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Chip, Dialog, FAB, List, Portal, Text, TextInput } from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";

import { submitLeaveRequest, fetchMyLeaves, type LeaveRequest } from "../api";

export function LeaveRequestScreen() {
  const queryClient = useQueryClient();
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState("");
  const [showPicker, setShowPicker] = useState<"start" | "end" | null>(null);

  const leavesQuery = useQuery({
    queryKey: ["my-leaves"],
    queryFn: fetchMyLeaves
  });

  const mutation = useMutation({
    mutationFn: submitLeaveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
      setIsDialogVisible(false);
      setReason("");
      Alert.alert("Success", "Leave request submitted for approval.");
    },
    onError: (error) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to submit request");
    }
  });

  const leaves = leavesQuery.data ?? [];

  function handleSubmit() {
    if (!reason.trim()) {
      Alert.alert("Missing Reason", "Please provide a reason for your leave.");
      return;
    }
    mutation.mutate({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      reason
    });
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>My Leave Requests</Text>
        
        {leavesQuery.isLoading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : leaves.length === 0 ? (
          <Text style={styles.emptyText}>No leave requests yet.</Text>
        ) : (
          leaves.map((leave) => (
            <Card key={leave.id} style={styles.card}>
              <Card.Content>
                <View style={styles.header}>
                  <Text style={styles.dateRange}>
                    {dayjs(leave.startDate).format("DD MMM")} - {dayjs(leave.endDate).format("DD MMM YYYY")}
                  </Text>
                  <Chip 
                    style={[
                      styles.statusChip, 
                      { backgroundColor: leave.status === "PENDING" ? "#FEEBC8" : leave.status === "APPROVED" ? "#C6F6D5" : "#FED7D7" }
                    ]}
                    textStyle={{ fontSize: 10, fontWeight: "bold" }}
                  >
                    {leave.status}
                  </Chip>
                </View>
                <Text style={styles.reason}>{leave.reason}</Text>
                <Text style={styles.meta}>Applied on {dayjs(leave.createdAt).format("DD MMM, YYYY")}</Text>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={isDialogVisible} onDismiss={() => setIsDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title>Apply for Leave</Dialog.Title>
          <Dialog.Content>
            <View style={styles.dateButtons}>
              <Button mode="outlined" onPress={() => setShowPicker("start")} style={styles.dateBtn}>
                From: {dayjs(startDate).format("DD/MM/YYYY")}
              </Button>
              <Button mode="outlined" onPress={() => setShowPicker("end")} style={styles.dateBtn}>
                To: {dayjs(endDate).format("DD/MM/YYYY")}
              </Button>
            </View>

            {showPicker && (
              <DateTimePicker
                value={showPicker === "start" ? startDate : endDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowPicker(null);
                  if (date) {
                    if (showPicker === "start") setStartDate(date);
                    else setEndDate(date);
                  }
                }}
              />
            )}

            <TextInput
              label="Reason for leave"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              mode="outlined"
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsDialogVisible(false)}>Cancel</Button>
            <Button loading={mutation.isPending} onPress={handleSubmit}>Submit</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        label="Apply Leave"
        style={styles.fab}
        onPress={() => setIsDialogVisible(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9F8"
  },
  content: {
    padding: 16,
    paddingBottom: 80
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#24312D",
    marginBottom: 16
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: "white"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  dateRange: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4A6583"
  },
  statusChip: {
    height: 24
  },
  reason: {
    fontSize: 14,
    color: "#66736F",
    marginBottom: 8
  },
  meta: {
    fontSize: 10,
    color: "#9BA3A1",
    fontWeight: "600"
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    color: "#9BA3A1"
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
    borderRadius: 20
  },
  dateButtons: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16
  },
  dateBtn: {
    flex: 1
  },
  input: {
    backgroundColor: "white"
  }
});
