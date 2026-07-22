import React, { useState } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, Alert } from "react-native";
import { Text, Card, Button, ProgressBar, Badge, IconButton, Portal, Modal, TextInput } from "react-native-paper";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchMyProjects, updateProjectPeriodProgress, UserProjectAssignment, ProjectPeriodProgress } from "../api";
import { AppIcon } from "../components/AppIcon";

export function ProjectsScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ProjectPeriodProgress | null>(null);
  const [incrementCount, setIncrementCount] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ["myProjects"],
    queryFn: fetchMyProjects,
    refetchInterval: 30000
  });

  const assignments = projectsQuery.data ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await projectsQuery.refetch();
    setRefreshing(false);
  };

  const handleOpenLogModal = (period: ProjectPeriodProgress) => {
    setSelectedPeriod(period);
    setIncrementCount("1");
    setLogModalVisible(true);
  };

  const handleLogProgress = async () => {
    if (!selectedPeriod) return;
    const inc = parseInt(incrementCount, 10);
    if (isNaN(inc) || inc <= 0) {
      Alert.alert("Invalid input", "Please enter a valid positive number.");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProjectPeriodProgress(selectedPeriod.id, { completedIncrement: inc });
      await queryClient.invalidateQueries({ queryKey: ["myProjects"] });
      setLogModalVisible(false);
      Alert.alert("Success", `Logged +${inc} items to ${selectedPeriod.periodName}!`);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to log progress.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0284C7"]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          My Projects & Targets
        </Text>
        <Text style={styles.subtitle}>
          Track yearly, monthly & weekly assigned targets and progress
        </Text>
      </View>

      {projectsQuery.isLoading ? (
        <Text style={styles.loadingText}>Loading assigned projects...</Text>
      ) : assignments.length === 0 ? (
        <Card style={styles.emptyCard} mode="contained">
          <Card.Content style={styles.emptyContent}>
            <AppIcon name="target" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Projects Assigned</Text>
            <Text style={styles.emptySub}>You have not been assigned any active target projects yet.</Text>
          </Card.Content>
        </Card>
      ) : (
        assignments.map((item: UserProjectAssignment) => {
          const { project, targetQuantity, completedCount, periods } = item;
          const overallProgress = targetQuantity > 0 ? Math.min(1, completedCount / targetQuantity) : 0;
          const percentVal = Math.round(overallProgress * 100);

          // Find active period (matching current date or first uncompleted period)
          const now = dayjs();
          const activePeriod = periods.find(p => {
            const s = dayjs(p.startDate);
            const e = dayjs(p.endDate);
            return now.isAfter(s.subtract(1, "day")) && now.isBefore(e.add(1, "day"));
          }) || periods.find(p => !p.isCompleted) || periods[0];

          return (
            <Card key={item.assignmentId} style={styles.projectCard} mode="contained">
              <Card.Content style={{ padding: 16, gap: 14 }}>
                {/* Project Header */}
                <View style={styles.projectHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.badgeRow}>
                      <Badge style={styles.typeBadge}>
                        {`${project.targetType} TARGET`}
                      </Badge>
                      <Badge style={styles.statusBadge}>
                        {project.status}
                      </Badge>
                    </View>
                    <Text style={styles.projectName}>{project.name}</Text>
                    {project.description ? (
                      <Text style={styles.projectDesc}>{project.description}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Overall Dynamic Progress Bar / Processing Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Overall Completion Bar</Text>
                    <Text style={styles.progressPercent}>{percentVal}%</Text>
                  </View>
                  <ProgressBar progress={overallProgress} color="#0284C7" style={styles.progressBar} />
                  <View style={styles.progressFooter}>
                    <Text style={styles.progressStatText}>
                      Achieved: <Text style={styles.highlightVal}>{completedCount}</Text> / {targetQuantity}
                    </Text>
                    <Text style={styles.progressStatText}>
                      Remaining: <Text style={styles.remainingVal}>{Math.max(0, targetQuantity - completedCount)}</Text>
                    </Text>
                  </View>
                </View>

                {/* Active Period Card */}
                {activePeriod && (
                  <Card style={styles.activePeriodCard} mode="contained">
                    <Card.Content style={{ padding: 12, gap: 8 }}>
                      <View style={styles.activePeriodHeader}>
                        <View>
                          <Text style={styles.activePeriodLabel}>CURRENT PERIOD</Text>
                          <Text style={styles.activePeriodName}>{activePeriod.periodName}</Text>
                        </View>
                        <Button
                          mode="contained"
                          buttonColor="#0284C7"
                          compact
                          onPress={() => handleOpenLogModal(activePeriod)}
                          labelStyle={{ fontSize: 11, fontWeight: "700" }}
                        >
                          + Log Progress
                        </Button>
                      </View>

                      {/* Period Target Breakdown with Carryover */}
                      <View style={styles.targetGrid}>
                        <View style={styles.targetBox}>
                          <Text style={styles.targetBoxLabel}>BASE TARGET</Text>
                          <Text style={styles.targetBoxVal}>{activePeriod.baseTarget}</Text>
                        </View>
                        <View style={styles.targetBox}>
                          <Text style={styles.targetBoxLabel}>CARRYOVER</Text>
                          <Text style={[styles.targetBoxVal, activePeriod.carryover > 0 && { color: "#D97706" }]}>
                            {activePeriod.carryover > 0 ? `+${activePeriod.carryover}` : "0"}
                          </Text>
                        </View>
                        <View style={styles.targetBox}>
                          <Text style={styles.targetBoxLabel}>TOTAL TARGET</Text>
                          <Text style={[styles.targetBoxVal, { color: "#0284C7" }]}>
                            {activePeriod.effectiveTarget}
                          </Text>
                        </View>
                        <View style={styles.targetBox}>
                          <Text style={styles.targetBoxLabel}>COMPLETED</Text>
                          <Text style={[styles.targetBoxVal, { color: "#16A34A" }]}>
                            {activePeriod.completedCount}
                          </Text>
                        </View>
                      </View>
                    </Card.Content>
                  </Card>
                )}

                {/* Full Breakdown per period */}
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.breakdownHeader}>Period Breakdown ({periods.length})</Text>
                  {periods.map((p) => {
                    const pProgress = p.effectiveTarget > 0 ? Math.min(1, p.completedCount / p.effectiveTarget) : 0;
                    const isCurrent = activePeriod?.id === p.id;

                    return (
                      <View key={p.id} style={[styles.periodRow, isCurrent && styles.periodRowActive]}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={styles.periodNameText}>{p.periodName}</Text>
                            {isCurrent && <Badge style={styles.nowBadge}>CURRENT</Badge>}
                          </View>
                          <Text style={styles.periodTargetSub}>
                            Base: {p.baseTarget} {p.carryover > 0 ? `| Carryover: +${p.carryover}` : ""} | Total: {p.effectiveTarget}
                          </Text>
                        </View>

                        <View style={{ alignItems: "flex-end", gap: 2 }}>
                          <Text style={styles.periodCountText}>
                            {p.completedCount} / {p.effectiveTarget}
                          </Text>
                          <IconButton
                            icon="plus-circle"
                            size={20}
                            iconColor="#0284C7"
                            onPress={() => handleOpenLogModal(p)}
                            style={{ margin: 0 }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card.Content>
            </Card>
          );
        })
      )}

      {/* Log Progress Modal */}
      <Portal>
        <Modal
          visible={logModalVisible}
          onDismiss={() => !isSubmitting && setLogModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedPeriod && (
            <View style={{ gap: 14 }}>
              <Text style={styles.modalTitle}>Log Target Progress</Text>
              <Text style={styles.modalSub}>
                Period: <Text style={{ fontWeight: "700", color: "#0284C7" }}>{selectedPeriod.periodName}</Text>
              </Text>
              <Text style={{ fontSize: 12, color: "#64748B" }}>
                Current Done: {selectedPeriod.completedCount} / {selectedPeriod.effectiveTarget}
              </Text>

              <TextInput
                label="Completed Units to Add"
                mode="outlined"
                keyboardType="numeric"
                value={incrementCount}
                onChangeText={setIncrementCount}
                style={{ backgroundColor: "#FFFFFF" }}
              />

              <View style={styles.modalActions}>
                <Button onPress={() => setLogModalVisible(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  buttonColor="#0284C7"
                  onPress={handleLogProgress}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  Confirm Log
                </Button>
              </View>
            </View>
          )}
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 60
  },
  header: {
    gap: 4
  },
  title: {
    fontWeight: "800",
    color: "#0F172A"
  },
  subtitle: {
    fontSize: 12,
    color: "#64748B"
  },
  loadingText: {
    textAlign: "center",
    color: "#64748B",
    marginTop: 40
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center"
  },
  emptyContent: {
    alignItems: "center"
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
    marginTop: 12
  },
  emptySub: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4
  },
  projectCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  projectHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6
  },
  typeBadge: {
    backgroundColor: "#E0F2FE",
    color: "#0284C7",
    fontWeight: "800",
    fontSize: 10
  },
  statusBadge: {
    backgroundColor: "#F1F5F9",
    color: "#475569",
    fontWeight: "700",
    fontSize: 10
  },
  projectName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A"
  },
  projectDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2
  },
  progressContainer: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 14,
    gap: 8
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5
  },
  progressPercent: {
    fontSize: 20,
    fontWeight: "900",
    color: "#38BDF8"
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#334155"
  },
  progressFooter: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressStatText: {
    fontSize: 11,
    color: "#CBD5E1"
  },
  highlightVal: {
    fontWeight: "800",
    color: "#38BDF8"
  },
  remainingVal: {
    fontWeight: "800",
    color: "#F43F5E"
  },
  activePeriodCard: {
    backgroundColor: "#F0F9FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BAE6FD"
  },
  activePeriodHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  activePeriodLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#0369A1",
    letterSpacing: 0.5
  },
  activePeriodName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0C4A6E"
  },
  targetGrid: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4
  },
  targetBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0F2FE"
  },
  targetBoxLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#64748B"
  },
  targetBoxVal: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2
  },
  breakdownHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 8
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#F1F5F9"
  },
  periodRowActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE"
  },
  periodNameText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B"
  },
  nowBadge: {
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "800"
  },
  periodTargetSub: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2
  },
  periodCountText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A"
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A"
  },
  modalSub: {
    fontSize: 13,
    color: "#475569"
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8
  }
});
