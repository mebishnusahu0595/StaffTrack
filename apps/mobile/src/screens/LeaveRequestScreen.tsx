import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import * as RN from "react-native";
import { Button, Card, Dialog, FAB, Portal, TextInput } from "react-native-paper";

const { Alert, ScrollView, StyleSheet, View } = RN;
import DateTimePicker from "@react-native-community/datetimepicker";

import { submitLeaveRequest, fetchMyLeaves } from "../api";
import { appIconSource } from "../components/AppIcon";

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
      startDate: dayjs(startDate).format("YYYY-MM-DD"),
      endDate: dayjs(endDate).format("YYYY-MM-DD"),
      reason
    });
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "APPROVED": return { bg: "#C6F6D5", text: "#22543D" };
      case "REJECTED": return { bg: "#FED7D7", text: "#822727" };
      default: return { bg: "#FEEBC8", text: "#7B341E" };
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <RN.Text style={styles.sectionTitle}>My Leave Requests</RN.Text>
        
        {leavesQuery.isLoading ? (
          <RN.Text style={styles.emptyText}>Loading...</RN.Text>
        ) : leaves.length === 0 ? (
          <RN.Text style={styles.emptyText}>No leave requests yet.</RN.Text>
        ) : (
          leaves.map((leave) => {
            const statusStyle = getStatusStyle(leave.status);
            return (
              <Card key={leave.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.header}>
                    <RN.Text style={styles.dateRange}>
                      {dayjs(leave.startDate).format("DD MMM")} - {dayjs(leave.endDate).format("DD MMM YYYY")}
                    </RN.Text>
                    <View style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}>
                      <RN.Text style={[styles.statusText, { color: statusStyle.text }]}>{leave.status}</RN.Text>
                    </View>
                  </View>
                  <RN.Text style={styles.reason}>{leave.reason}</RN.Text>
                  <RN.Text style={styles.meta}>Applied on {dayjs(leave.createdAt).format("DD MMM, YYYY")}</RN.Text>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

        <Dialog visible={isDialogVisible} onDismiss={() => setIsDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title>Apply for Leave</Dialog.Title>
          <Dialog.Content>
            {/* Today quick-select */}
            <View style={styles.quickSelectRow}>
              <Button
                mode="contained-tonal"
                compact
                onPress={() => { const t = new Date(); setStartDate(t); setEndDate(t); }}
                style={styles.todayBtn}
              >
                Today
              </Button>
            </View>

            {/* From Date row */}
            <View style={styles.dateRow}>
              <RN.Text style={styles.dateLabel}>Start Date</RN.Text>
              <RN.TouchableOpacity
                onPress={() => setShowPicker("start")}
                style={styles.dateBtn}
              >
                <RN.Text style={styles.dateBtnText}>From: {dayjs(startDate).format("DD/MM/YYYY")}</RN.Text>
              </RN.TouchableOpacity>
            </View>

            {/* To Date row */}
            <View style={styles.dateRow}>
              <RN.Text style={styles.dateLabel}>End Date</RN.Text>
              <RN.TouchableOpacity
                onPress={() => setShowPicker("end")}
                style={styles.dateBtn}
              >
                <RN.Text style={styles.dateBtnText}>To: {dayjs(endDate).format("DD/MM/YYYY")}</RN.Text>
              </RN.TouchableOpacity>
            </View>

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

      <FAB
        icon={appIconSource("plus")}
        label="Apply Leave"
        style={styles.fab}
        onPress={() => setIsDialogVisible(true)}
        color="#FFFFFF"
      />

      {showPicker && (
        <DateTimePicker
          testID="date-time-picker"
          value={showPicker === "start" ? startDate : endDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowPicker(null);
            if (date) {
              if (showPicker === "start") {
                setStartDate(date);
                if (date > endDate) setEndDate(date);
              } else {
                setEndDate(date);
              }
            }
          }}
        />
      )}
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
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 30,
    minWidth: 76,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  statusText: {
    color: "#24312D",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    textTransform: "uppercase"
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
    backgroundColor: "#1A202C"
  },
  dialog: {
    backgroundColor: "white",
    borderRadius: 20
  },
  quickSelectRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8
  },
  todayBtn: {
    borderRadius: 8
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12
  },
  dateLabel: {
    width: 76,
    fontSize: 13,
    fontWeight: "700",
    color: "#4A5568"
  },
  dateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#79747E",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  dateBtnText: {
    color: "#49454F",
    fontSize: 14,
    fontWeight: "500"
  },
  input: {
    backgroundColor: "white",
    marginTop: 4
  }
});
