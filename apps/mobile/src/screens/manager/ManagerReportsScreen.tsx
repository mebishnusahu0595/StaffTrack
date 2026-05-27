import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, Dimensions, Image, TouchableOpacity } from "react-native";
import { Text, Card, Avatar, ActivityIndicator, IconButton, Portal, Modal, Chip } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchAllDayEndReports } from "../../api";
import { AppIcon } from "../../components/AppIcon";
import { API_ORIGIN_URL } from "../../config/env";

const { width } = Dimensions.get("window");

export function ManagerReportsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  const reportsQuery = useQuery({
    queryKey: ["managerDayEndReports"],
    queryFn: fetchAllDayEndReports
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await reportsQuery.refetch();
    setRefreshing(false);
  };

  const list = reportsQuery.data || [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10B981"]} />
        }
      >
        {reportsQuery.isLoading ? (
          <ActivityIndicator color="#1A202C" style={{ marginTop: 40 }} />
        ) : list.length === 0 ? (
          <Card style={styles.emptyCard} elevation={0}>
            <Card.Content style={styles.emptyContent}>
              <AppIcon name="file-document-edit" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>No reports found.</Text>
              <Text style={styles.emptySubtext}>Your team members have not submitted any day-end reports yet.</Text>
            </Card.Content>
          </Card>
        ) : (
          list.map((report: any) => {
            return (
              <Card key={report.id} style={styles.reportCard} elevation={1} onPress={() => setSelectedReport(report)}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <Avatar.Text 
                      size={36} 
                      label={report.user?.name ? report.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "S"} 
                      style={styles.avatar}
                      labelStyle={styles.avatarLabel}
                    />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{report.user?.name || "Staff Member"}</Text>
                      <Text style={styles.userEmail}>{report.user?.email || "No Email"}</Text>
                    </View>
                    <View style={styles.dateBlock}>
                      <Text style={styles.reportDate}>{dayjs(report.date).format("MMM DD")}</Text>
                      <Text style={styles.reportTime}>{dayjs(report.submittedAt).format("hh:mm A")}</Text>
                    </View>
                  </View>

                  {/* Summary Grid */}
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>ORDERS TAKEN</Text>
                      <Text style={styles.summaryVal}>{report.ordersTaken || 0}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>CANCELLED</Text>
                      <Text style={[styles.summaryVal, { color: "#EF4444" }]}>{report.ordersCancelled || 0}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>TOTAL KM</Text>
                      <Text style={[styles.summaryVal, { color: "#10B981" }]}>{(report.kmTravelled || report.totalKmTravelled || 0).toFixed(1)} KM</Text>
                    </View>
                  </View>

                  {/* Points Pill Row */}
                  <View style={styles.pointsRow}>
                    <Chip 
                      icon={() => <AppIcon name="clipboard-list" size={12} color="#475569" />}
                      textStyle={styles.chipText} 
                      style={styles.pointChip}
                    >
                      {report.taskPoints || 0} Task Pts
                    </Chip>
                    <Chip 
                      icon={() => <AppIcon name="coffee" size={12} color="#475569" />}
                      textStyle={styles.chipText} 
                      style={styles.pointChip}
                    >
                      {report.totalPoints || 0} Total Pts
                    </Chip>
                    <IconButton 
                      icon={() => <AppIcon name="chevron-right" size={18} color="#3B82F6" />}
                      style={{ margin: 0, padding: 0 }}
                    />
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Report Details Modal */}
      <Portal>
        <Modal 
          visible={Boolean(selectedReport)} 
          onDismiss={() => setSelectedReport(null)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedReport && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Day End Summary</Text>
                <IconButton 
                  icon={() => <AppIcon name="close" size={24} color="#1A202C" />}
                  onPress={() => setSelectedReport(null)} 
                  style={{ margin: 0 }}
                />
              </View>

              <View style={styles.modalUserRow}>
                <Avatar.Text 
                  size={44} 
                  label={selectedReport.user?.name ? selectedReport.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "S"} 
                  style={styles.avatar}
                  labelStyle={styles.avatarLabel}
                />
                <View style={styles.userInfo}>
                  <Text style={styles.modalUserName}>{selectedReport.user?.name || "Staff Member"}</Text>
                  <Text style={styles.modalUserRole}>Field Agent • Submitted {dayjs(selectedReport.submittedAt).format("h:mm A")}</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Visits Summary</Text>
              <View style={styles.cardBox}>
                <Text style={styles.boxText}>{selectedReport.visitsSummary || "No visits details entered."}</Text>
              </View>

              <Text style={styles.fieldLabel}>Odometer details</Text>
              <View style={styles.odoGrid}>
                <View style={styles.odoCol}>
                  <Text style={styles.odoLabel}>START ODOMETER</Text>
                  <Text style={styles.odoVal}>{selectedReport.startOdometer !== null && selectedReport.startOdometer !== undefined ? `${selectedReport.startOdometer} KM` : "No Reading"}</Text>
                  {selectedReport.startOdometerPhotoUrl ? (
                    <Image source={{ uri: selectedReport.startOdometerPhotoUrl.startsWith("http") ? selectedReport.startOdometerPhotoUrl : `${API_ORIGIN_URL}${selectedReport.startOdometerPhotoUrl}` }} style={styles.odoImage} />
                  ) : (
                    <View style={styles.noOdoImage}>
                      <Text style={styles.noOdoText}>No start photo</Text>
                    </View>
                  )}
                </View>
                <View style={styles.odoCol}>
                  <Text style={styles.odoLabel}>END ODOMETER</Text>
                  <Text style={styles.odoVal}>{selectedReport.endOdometer !== null && selectedReport.endOdometer !== undefined ? `${selectedReport.endOdometer} KM` : "No Reading"}</Text>
                  {selectedReport.endOdometerPhotoUrl ? (
                    <Image source={{ uri: selectedReport.endOdometerPhotoUrl.startsWith("http") ? selectedReport.endOdometerPhotoUrl : `${API_ORIGIN_URL}${selectedReport.endOdometerPhotoUrl}` }} style={styles.odoImage} />
                  ) : (
                    <View style={styles.noOdoImage}>
                      <Text style={styles.noOdoText}>No end photo</Text>
                    </View>
                  )}
                </View>
              </View>

              {selectedReport.remarks ? (
                <>
                  <Text style={styles.fieldLabel}>Remarks</Text>
                  <View style={styles.cardBox}>
                    <Text style={styles.boxText}>{selectedReport.remarks}</Text>
                  </View>
                </>
              ) : null}

              <Text style={styles.fieldLabel}>Point System Summary</Text>
              <View style={styles.pointsGrid}>
                <View style={styles.ptRow}>
                  <Text style={styles.ptLabel}>Task Completion Points</Text>
                  <Text style={styles.ptVal}>+{selectedReport.taskPoints || 0} PTS</Text>
                </View>
                <View style={styles.ptRow}>
                  <Text style={styles.ptLabel}>Travel KM Points</Text>
                  <Text style={styles.ptVal}>+{selectedReport.kmPoints || 0} PTS</Text>
                </View>
                <View style={styles.ptRow}>
                  <Text style={styles.ptLabel}>Order Placements Points</Text>
                  <Text style={styles.ptVal}>+{selectedReport.orderPoints || 0} PTS</Text>
                </View>
                <View style={[styles.ptRow, styles.totalPtRow]}>
                  <Text style={styles.totalPtLabel}>Cumulative Earned Today</Text>
                  <Text style={styles.totalPtVal}>{selectedReport.totalPoints || 0} POINTS</Text>
                </View>
              </View>
            </ScrollView>
          )}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40
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
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center"
  },
  avatar: {
    backgroundColor: "#EEF2F6"
  },
  avatarLabel: {
    color: "#475569",
    fontWeight: "700"
  },
  userInfo: {
    flex: 1,
    marginLeft: 12
  },
  userName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A202C"
  },
  userEmail: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500"
  },
  dateBlock: {
    alignItems: "flex-end"
  },
  reportDate: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1A202C"
  },
  reportTime: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 12,
    marginTop: 12
  },
  summaryItem: {
    alignItems: "center",
    flex: 1
  },
  summaryLabel: {
    fontSize: 8,
    color: "#94A3B8",
    fontWeight: "800",
    letterSpacing: 0.5
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: "900",
    color: "#475569",
    marginTop: 4
  },
  pointsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    borderTopWidth: 1,
    borderColor: "#EEF2F6",
    paddingTop: 10
  },
  pointChip: {
    height: 28,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#F1F5F9"
  },
  chipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569"
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
  modalUserRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  modalUserName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1A202C"
  },
  modalUserRole: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600"
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#1A202C",
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  cardBox: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  boxText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#475569",
    fontWeight: "500"
  },
  odoGrid: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  odoCol: {
    width: "48%"
  },
  odoLabel: {
    fontSize: 8,
    color: "#94A3B8",
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 4
  },
  odoVal: {
    fontSize: 13,
    fontWeight: "900",
    color: "#10B981",
    marginBottom: 8
  },
  odoImage: {
    height: 120,
    borderRadius: 10,
    backgroundColor: "#F1F5F9"
  },
  noOdoImage: {
    height: 120,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed"
  },
  noOdoText: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600"
  },
  pointsGrid: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  ptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6
  },
  ptLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600"
  },
  ptVal: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "800"
  },
  totalPtRow: {
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 6,
    paddingTop: 8
  },
  totalPtLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#1A202C"
  },
  totalPtVal: {
    fontSize: 14,
    fontWeight: "900",
    color: "#3B82F6"
  }
});
