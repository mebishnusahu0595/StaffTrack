import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, Dimensions, Image, TouchableOpacity, Modal, Linking } from "react-native";
import { Text, Card, Avatar, ActivityIndicator, IconButton } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchAttendanceByDate, fetchTodayLocationLogs } from "../../api";
import { AppIcon } from "../../components/AppIcon";
import { API_ORIGIN_URL } from "../../config/env";

const { width } = Dimensions.get("window");

export function ManagerAttendanceScreen() {
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const dateStr = useMemo(() => selectedDate.format("YYYY-MM-DD"), [selectedDate]);
  const [refreshing, setRefreshing] = useState(false);

  // Location history log modal states
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [historyUserName, setHistoryUserName] = useState<string>("");
  const [locationLogs, setLocationLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Expanded card state to show photos
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>({});

  // Image zoom modal state
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const attendanceQuery = useQuery({
    queryKey: ["managerAttendanceByDate", dateStr],
    queryFn: () => fetchAttendanceByDate(dateStr)
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await attendanceQuery.refetch();
    setRefreshing(false);
  };

  const changeDate = (days: number) => {
    setSelectedDate(prev => prev.add(days, "day"));
    setExpandedUserIds({});
  };

  const toggleExpand = (userId: string) => {
    setExpandedUserIds(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleViewHistory = async (userId: string, name: string) => {
    setHistoryUserId(userId);
    setHistoryUserName(name);
    setIsLoadingLogs(true);
    setLocationLogs([]);
    try {
      const logs = await fetchTodayLocationLogs(userId, dateStr);
      setLocationLogs(logs || []);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch location logs.");
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const list = attendanceQuery.data || [];

  return (
    <View style={styles.container}>
      {/* Date Header Controller */}
      <View style={styles.dateHeader}>
        <IconButton 
          icon={() => <AppIcon name="chevron-left" size={24} color="#1A202C" />}
          onPress={() => changeDate(-1)} 
        />
        <View style={styles.dateLabelContainer}>
          <Text style={styles.dateText}>{selectedDate.format("MMMM D, YYYY")}</Text>
          <Text style={styles.dayText}>{selectedDate.format("dddd")}</Text>
        </View>
        <IconButton 
          icon={() => <AppIcon name="chevron-right" size={24} color="#1A202C" />}
          onPress={() => changeDate(1)}
          disabled={selectedDate.isSame(dayjs(), "day")}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10B981"]} />
        }
      >
        {attendanceQuery.isLoading ? (
          <ActivityIndicator color="#1A202C" style={{ marginTop: 40 }} />
        ) : list.length === 0 ? (
          <Card style={styles.emptyCard} elevation={0}>
            <Card.Content style={styles.emptyContent}>
              <AppIcon name="calendar-check" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>No attendance records found.</Text>
              <Text style={styles.emptySubtext}>There is no team activity reported for this day.</Text>
            </Card.Content>
          </Card>
        ) : (
          list.map((record: any) => {
            const isAbsent = record.status === "ABSENT" || (!record.checkInTime && record.status !== "ON_LEAVE");
            const isCheckedOut = Boolean(record.checkOutTime);
            const isField = record.punchType === "FIELD";
            const userId = record.user?.id || record.userId;
            const isExpanded = Boolean(expandedUserIds[userId]);

            let statusText = "Absent";
            let statusColor = "#EF4444";
            let statusBg = "#FEF2F2";

            if (record.status === "ON_LEAVE") {
              statusText = "On Leave";
              statusColor = "#F59E0B";
              statusBg = "#FEF3C7";
            } else if (isCheckedOut) {
              statusText = "Checked Out";
              statusColor = "#3B82F6";
              statusBg = "#EFF6FF";
            } else if (record.checkInTime) {
              statusText = "Checked In";
              statusColor = "#10B981";
              statusBg = "#EAFAF1";
            }

            return (
              <Card key={record.id} style={styles.recordCard} elevation={1}>
                <Card.Content>
                  {/* User Profile Info */}
                  <TouchableOpacity style={styles.recordHeader} onPress={() => toggleExpand(userId)}>
                    <Avatar.Text 
                      size={38} 
                      label={record.user?.name ? record.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "S"} 
                      style={styles.avatar} 
                      labelStyle={styles.avatarLabel}
                    />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{record.user?.name || "Staff Member"}</Text>
                      <Text style={styles.userEmail}>{record.user?.email || "No Email"}</Text>
                    </View>
                    <View style={styles.headerRight}>
                      <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                      </View>
                      <IconButton 
                        icon={() => <AppIcon name={isExpanded ? "chevron-left" : "chevron-right"} size={18} color="#64748B" style={{ transform: [{ rotate: isExpanded ? "90deg" : "-90deg" }] }} />}
                        size={18}
                        style={{ margin: 0 }}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Direct details if present */}
                  {!isAbsent && (
                    <View style={styles.directDetails}>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailLabel}>IN TIME</Text>
                        <Text style={styles.detailVal}>
                          {record.checkInTime ? dayjs(record.checkInTime).format("hh:mm A") : "--:--"}
                        </Text>
                      </View>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailLabel}>OUT TIME</Text>
                        <Text style={styles.detailVal}>
                          {isCheckedOut ? dayjs(record.checkOutTime).format("hh:mm A") : "--:--"}
                        </Text>
                      </View>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailLabel}>KM TRAVELED</Text>
                        <Text style={styles.detailVal}>
                          {record.startOdometer !== null && record.endOdometer !== null && record.startOdometer !== undefined && record.endOdometer !== undefined
                            ? `${Math.max(0, record.endOdometer - record.startOdometer).toFixed(1)} KM`
                            : "--"}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Expanded Section (Selfie, Odometer pictures, logs) */}
                  {isExpanded && !isAbsent && (
                    <View style={styles.expandedContent}>
                      {/* Image Galleries */}
                      <View style={styles.galleryGrid}>
                        {/* Check-In Section */}
                        <View style={styles.galleryBlock}>
                          <Text style={styles.blockTitle}>Check In Verification</Text>
                          <View style={styles.mediaContainer}>
                            <View style={styles.mediaItem}>
                              <Text style={styles.mediaLabel}>Selfie Photo</Text>
                              {record.checkInPhotoUrl ? (
                                <TouchableOpacity onPress={() => setZoomImage(record.checkInPhotoUrl.startsWith("http") ? record.checkInPhotoUrl : `${API_ORIGIN_URL}${record.checkInPhotoUrl}`)}>
                                  <Image source={{ uri: record.checkInPhotoUrl.startsWith("http") ? record.checkInPhotoUrl : `${API_ORIGIN_URL}${record.checkInPhotoUrl}` }} style={styles.mediaThumbnail} />
                                </TouchableOpacity>
                              ) : (
                                <View style={styles.noMedia}>
                                  <AppIcon name="close" size={20} color="#94A3B8" />
                                  <Text style={styles.noMediaText}>No photo</Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.mediaItem}>
                              <Text style={styles.mediaLabel}>Odometer Pic</Text>
                              {record.startOdometerPhotoUrl ? (
                                <TouchableOpacity onPress={() => setZoomImage(record.startOdometerPhotoUrl.startsWith("http") ? record.startOdometerPhotoUrl : `${API_ORIGIN_URL}${record.startOdometerPhotoUrl}`)}>
                                  <Image source={{ uri: record.startOdometerPhotoUrl.startsWith("http") ? record.startOdometerPhotoUrl : `${API_ORIGIN_URL}${record.startOdometerPhotoUrl}` }} style={styles.mediaThumbnail} />
                                </TouchableOpacity>
                              ) : (
                                <View style={styles.noMedia}>
                                  <AppIcon name="close" size={20} color="#94A3B8" />
                                  <Text style={styles.noMediaText}>No photo</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          {record.startOdometer !== null && record.startOdometer !== undefined && (
                            <Text style={styles.odometerValLabel}>Reading: {record.startOdometer} KM</Text>
                          )}
                        </View>

                        {/* Check-Out Section */}
                        <View style={styles.galleryBlock}>
                          <Text style={styles.blockTitle}>Check Out Verification</Text>
                          <View style={styles.mediaContainer}>
                            <View style={styles.mediaItem}>
                              <Text style={styles.mediaLabel}>Selfie Photo</Text>
                              {record.checkOutPhotoUrl ? (
                                <TouchableOpacity onPress={() => setZoomImage(record.checkOutPhotoUrl.startsWith("http") ? record.checkOutPhotoUrl : `${API_ORIGIN_URL}${record.checkOutPhotoUrl}`)}>
                                  <Image source={{ uri: record.checkOutPhotoUrl.startsWith("http") ? record.checkOutPhotoUrl : `${API_ORIGIN_URL}${record.checkOutPhotoUrl}` }} style={styles.mediaThumbnail} />
                                </TouchableOpacity>
                              ) : (
                                <View style={styles.noMedia}>
                                  <AppIcon name="close" size={20} color="#94A3B8" />
                                  <Text style={styles.noMediaText}>No photo</Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.mediaItem}>
                              <Text style={styles.mediaLabel}>Odometer Pic</Text>
                              {record.endOdometerPhotoUrl ? (
                                <TouchableOpacity onPress={() => setZoomImage(record.endOdometerPhotoUrl.startsWith("http") ? record.endOdometerPhotoUrl : `${API_ORIGIN_URL}${record.endOdometerPhotoUrl}`)}>
                                  <Image source={{ uri: record.endOdometerPhotoUrl.startsWith("http") ? record.endOdometerPhotoUrl : `${API_ORIGIN_URL}${record.endOdometerPhotoUrl}` }} style={styles.mediaThumbnail} />
                                </TouchableOpacity>
                              ) : (
                                <View style={styles.noMedia}>
                                  <AppIcon name="close" size={20} color="#94A3B8" />
                                  <Text style={styles.noMediaText}>No photo</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          {record.endOdometer !== null && record.endOdometer !== undefined && (
                            <Text style={styles.odometerValLabel}>Reading: {record.endOdometer} KM</Text>
                          )}
                        </View>
                      </View>

                      {/* View Complete GPS Logs Button */}
                      <TouchableOpacity 
                        style={styles.historyBtn}
                        onPress={() => handleViewHistory(userId, record.user?.name || "Staff Member")}
                      >
                        <AppIcon name="map-marker-distance" size={16} color="#FFFFFF" />
                        <Text style={styles.historyBtnText}>ALL LOCATION HISTORY</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Full screen Image Zoom Modal */}
      <Modal visible={Boolean(zoomImage)} transparent={true} animationType="fade">
        <View style={styles.zoomContainer}>
          <TouchableOpacity style={styles.closeZoomArea} onPress={() => setZoomImage(null)}>
            <IconButton icon={() => <AppIcon name="close" size={28} color="#FFFFFF" />} style={styles.closeZoomButton} />
          </TouchableOpacity>
          {zoomImage && (
            <Image source={{ uri: zoomImage }} style={styles.zoomImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Location History Modal */}
      <Modal visible={Boolean(historyUserId)} transparent={true} animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalCardTitle}>Location Log History</Text>
                <Text style={styles.modalCardSubtitle}>{historyUserName} • {dayjs(selectedDate).format("DD MMM YYYY")}</Text>
              </View>
              <IconButton 
                icon={() => <AppIcon name="close" size={24} color="#1A202C" />} 
                onPress={() => setHistoryUserId(null)} 
                style={{ margin: 0 }}
              />
            </View>
            
            <View style={styles.modalBody}>
              {isLoadingLogs ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator color="#10B981" size="large" />
                  <Text style={styles.loadingText}>Fetching GPS coordinates...</Text>
                </View>
              ) : locationLogs.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <AppIcon name="map-marker-off" size={40} color="#94A3B8" />
                  <Text style={styles.emptyLogsText}>No GPS coordinates recorded</Text>
                  <Text style={styles.emptyLogsSubtext}>No tracking data was registered for this day.</Text>
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.logsScroll}>
                  {locationLogs.map((log, idx) => {
                    const timeStr = dayjs(log.timestamp).format("hh:mm:ss A");
                    const accuracyStr = log.accuracy ? `${log.accuracy.toFixed(1)}m` : "N/A";
                    return (
                      <View key={idx} style={styles.logRow}>
                        <View style={styles.logInfo}>
                          <View style={styles.timeRow}>
                            <AppIcon name="clock-outline" size={12} color="#64748B" />
                            <Text style={styles.logTime}>{timeStr}</Text>
                          </View>
                          <Text style={styles.logCoords}>{log.lat.toFixed(6)}, {log.lng.toFixed(6)}</Text>
                          <Text style={styles.logAccuracy}>Accuracy: {accuracyStr}</Text>
                        </View>
                        <IconButton 
                          icon={() => <AppIcon name="google-maps" size={20} color="#10B981" />} 
                          mode="contained-tonal"
                          containerColor="#E6F4EA"
                          onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${log.lat},${log.lng}`)}
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 }
  },
  dateLabelContainer: {
    alignItems: "center"
  },
  dateText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1A202C"
  },
  dayText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase"
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
  recordCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  recordHeader: {
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center"
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10
  },
  statusText: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  directDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    marginTop: 12
  },
  detailCol: {
    flex: 1
  },
  detailLabel: {
    fontSize: 8,
    color: "#94A3B8",
    fontWeight: "800",
    letterSpacing: 0.5
  },
  detailVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    marginTop: 4
  },
  expandedContent: {
    borderTopWidth: 1,
    borderColor: "#EEF2F6",
    marginTop: 12,
    paddingTop: 12
  },
  galleryGrid: {
    flexDirection: "column"
  },
  galleryBlock: {
    marginBottom: 16
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#1A202C",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  mediaContainer: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  mediaItem: {
    width: "48%"
  },
  mediaLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 4
  },
  mediaThumbnail: {
    height: 100,
    borderRadius: 10,
    backgroundColor: "#E2E8F0"
  },
  noMedia: {
    height: 100,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed"
  },
  noMediaText: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "600"
  },
  odometerValLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
    marginTop: 6
  },
  zoomContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center"
  },
  closeZoomArea: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10
  },
  closeZoomButton: {
    backgroundColor: "rgba(0,0,0,0.5)"
  },
  zoomImage: {
    width: width,
    height: width * 1.5
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
    elevation: 1,
  },
  historyBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: "60%",
    maxHeight: "85%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderColor: "#EEF2F6",
  },
  modalCardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1A202C",
  },
  modalCardSubtitle: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  modalLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  modalEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyLogsText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#475569",
    marginTop: 12,
  },
  emptyLogsSubtext: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 6,
    textAlign: "center",
  },
  logsScroll: {
    paddingBottom: 20,
  },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  logInfo: {
    flex: 1,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  logTime: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  logCoords: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 4,
  },
  logAccuracy: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 2,
  }
});
