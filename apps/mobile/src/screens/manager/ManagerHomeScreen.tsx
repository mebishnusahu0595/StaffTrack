import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, Dimensions } from "react-native";
import { Text, Card, Avatar, ActivityIndicator } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import dayjs from "dayjs";
import { useAuth } from "../../auth/AuthContext";
import { fetchAttendanceByDate, fetchMonthlyPerformanceReport } from "../../api";
import { AppIcon } from "../../components/AppIcon";
import { PersonalAttendancePanel } from "../../components/PersonalAttendancePanel";
import type { ManagerDrawerParamList } from "../../navigation/AppNavigator";

const { width } = Dimensions.get("window");

export function ManagerHomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<DrawerNavigationProp<ManagerDrawerParamList, "ManagerHome">>();
  const [refreshing, setRefreshing] = useState(false);
  const todayStr = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  const todayAttendanceQuery = useQuery({
    queryKey: ["managerTodayAttendance", todayStr],
    queryFn: () => fetchAttendanceByDate(todayStr),
    refetchInterval: 15000 // Automatically refresh every 15s to be real-time
  });

  const monthlyReportQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["monthlyReportHome", user?.id],
    queryFn: () => fetchMonthlyPerformanceReport(user!.id, dayjs().month() + 1, dayjs().year())
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await todayAttendanceQuery.refetch();
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    const list = todayAttendanceQuery.data || [];
    const total = list.length;
    let checkedIn = 0;
    let checkedOut = 0;
    let absent = 0;
    let totalKm = 0;

    list.forEach((item: any) => {
      if (item.status === "ABSENT") {
        absent++;
      } else if (item.checkOutTime) {
        checkedOut++;
        checkedIn++; // still count as was present today
        if (item.endOdometer && item.startOdometer) {
          totalKm += Math.max(0, item.endOdometer - item.startOdometer);
        }
      } else if (item.checkInTime) {
        checkedIn++;
        // If field-mode checkin has some live km reading so far
        if (item.startOdometer) {
          // just start reading
        }
      } else {
        absent++;
      }
    });

    return { total, checkedIn, absent, checkedOut, totalKm };
  }, [todayAttendanceQuery.data]);

  const roster = todayAttendanceQuery.data || [];

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10B981"]} />
      }
    >
      {/* Header Profile Section */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.welcomeText}>Welcome Back,</Text>
          <Text style={styles.managerName}>{user?.name || "Manager"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Text style={styles.roleLabel}>Team Manager Dashboard</Text>
            <View style={{ backgroundColor: "#E0F2FE", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <AppIcon name="star" size={12} color="#0284C7" />
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#0284C7" }}>
                {monthlyReportQuery.data?.stats?.monthlyPoints ?? 0} PTS
              </Text>
            </View>
          </View>
        </View>
        <Avatar.Text 
          size={50} 
          label={user?.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "M"} 
          style={styles.avatar} 
          labelStyle={styles.avatarLabel}
        />
      </View>

      {/* Manager's own attendance / odometer / KM (same as staff app) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Attendance</Text>
        <Text style={styles.dateLabel}>{dayjs().format("ddd, MMM D, YYYY")}</Text>
      </View>
      <View style={{ marginBottom: 20 }}>
        <PersonalAttendancePanel onNavigateDayEnd={() => navigation.navigate("DayEndReport")} />
      </View>

      {/* Team header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Team Snapshot</Text>
      </View>

      {/* Statistics Row */}
      <View style={styles.statsContainer}>
        {/* Metric 1 */}
        <View style={[styles.statCard, { backgroundColor: "#EEF2F6" }]}>
          <AppIcon name="account" size={24} color="#3B82F6" style={styles.statIcon} />
          <Text style={styles.statVal}>{stats.total}</Text>
          <Text style={styles.statLabel}>Team Size</Text>
        </View>

        {/* Metric 2 */}
        <View style={[styles.statCard, { backgroundColor: "#EAFAF1" }]}>
          <AppIcon name="calendar-check" size={24} color="#10B981" style={styles.statIcon} />
          <Text style={[styles.statVal, { color: "#10B981" }]}>{stats.checkedIn}</Text>
          <Text style={styles.statLabel}>Active Today</Text>
        </View>

        {/* Metric 3 */}
        <View style={[styles.statCard, { backgroundColor: "#FEF2F2" }]}>
          <AppIcon name="close" size={24} color="#EF4444" style={styles.statIcon} />
          <Text style={[styles.statVal, { color: "#EF4444" }]}>{stats.absent}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
      </View>

      {/* KM Card */}
      <Card style={styles.kmCard} elevation={0}>
        <Card.Content style={styles.kmContent}>
          <View style={styles.kmDetails}>
            <Text style={styles.kmTitle}>Today's Distance Covered</Text>
            <Text style={styles.kmVal}>{stats.totalKm.toFixed(1)} <Text style={styles.kmSub}>KM Total</Text></Text>
          </View>
          <View style={styles.kmIconCircle}>
            <AppIcon name="map-marker-distance" size={32} color="#FFFFFF" />
          </View>
        </Card.Content>
      </Card>

      {/* Team Roster Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Real-time Team Roster</Text>
        <Text style={styles.dateLabel}>{dayjs().format("ddd, MMM D, YYYY")}</Text>
      </View>

      {todayAttendanceQuery.isLoading ? (
        <ActivityIndicator color="#1A202C" style={{ marginTop: 40 }} />
      ) : roster.length === 0 ? (
        <Card style={styles.emptyCard} elevation={0}>
          <Card.Content style={styles.emptyContent}>
            <AppIcon name="account" size={48} color="#94A3B8" />
            <Text style={styles.emptyText}>No assigned staff members found.</Text>
            <Text style={styles.emptySubtext}>Contact administrator to assign employees to your team.</Text>
          </Card.Content>
        </Card>
      ) : (
        roster.map((member: any) => {
          const isAbsent = member.status === "ABSENT" || (!member.checkInTime && member.status !== "ON_LEAVE");
          const isCheckedOut = Boolean(member.checkOutTime);
          const isField = member.punchType === "FIELD";

          let statusText = "Absent";
          let statusColor = "#EF4444";
          let statusBg = "#FEF2F2";

          if (isCheckedOut) {
            statusText = "Completed";
            statusColor = "#3B82F6";
            statusBg = "#EFF6FF";
          } else if (member.checkInTime) {
            statusText = "Checked In";
            statusColor = "#10B981";
            statusBg = "#EAFAF1";
          }

          // Total KM calculation for this user
          let userKmText = "";
          if (member.startOdometer !== null && member.startOdometer !== undefined) {
            if (member.endOdometer !== null && member.endOdometer !== undefined) {
              const km = Math.max(0, member.endOdometer - member.startOdometer);
              userKmText = `${km.toFixed(1)} KM`;
            } else {
              userKmText = `Started Odo: ${member.startOdometer} KM`;
            }
          }

          return (
            <Card key={member.id} style={styles.userCard} elevation={1}>
              <Card.Content style={styles.userCardContent}>
                {/* User Header */}
                <View style={styles.userRow}>
                  <Avatar.Text 
                    size={36} 
                    label={member.user?.name ? member.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "S"} 
                    style={styles.userAvatar}
                    labelStyle={styles.userAvatarLabel}
                  />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{member.user?.name || "Staff Member"}</Text>
                    <Text style={styles.userEmail}>{member.user?.email || "No Email"}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                  </View>
                </View>

                {/* Details Section */}
                {!isAbsent && (
                  <View style={styles.timeDetails}>
                    <View style={styles.timeCol}>
                      <Text style={styles.timeLabel}>CHECK IN</Text>
                      <Text style={styles.timeVal}>{dayjs(member.checkInTime).format("hh:mm A")}</Text>
                    </View>
                    <View style={styles.timeCol}>
                      <Text style={styles.timeLabel}>CHECK OUT</Text>
                      <Text style={styles.timeVal}>
                        {isCheckedOut ? dayjs(member.checkOutTime).format("hh:mm A") : "--:--"}
                      </Text>
                    </View>
                    <View style={styles.timeCol}>
                      <Text style={styles.timeLabel}>MODE</Text>
                      <View style={styles.modeBadge}>
                        <AppIcon name={isField ? "map-marker-outline" : "office-building"} size={14} color="#64748B" />
                        <Text style={styles.modeText}>{isField ? "Field" : "Office"}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {userKmText ? (
                  <View style={styles.kmRow}>
                    <AppIcon name="map-marker-distance" size={16} color="#64748B" />
                    <Text style={styles.kmReading}>{userKmText}</Text>
                  </View>
                ) : null}
              </Card.Content>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  managerName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1A202C",
    marginTop: 2,
  },
  roleLabel: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "700",
    marginTop: 4,
    textTransform: "uppercase",
  },
  avatar: {
    backgroundColor: "#1A202C",
    borderRadius: 12,
  },
  avatarLabel: {
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statCard: {
    width: (width - 48) / 3,
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statIcon: {
    marginBottom: 6,
  },
  statVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1A202C",
  },
  statLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  kmCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    marginBottom: 24,
  },
  kmContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  kmDetails: {
    flex: 1,
  },
  kmTitle: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kmVal: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  kmSub: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "800",
  },
  kmIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1A202C",
  },
  dateLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#475569",
    marginTop: 12,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
  },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  userCardContent: {
    paddingVertical: 12,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userAvatar: {
    backgroundColor: "#EEF2F6",
  },
  userAvatarLabel: {
    color: "#475569",
    fontWeight: "700",
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A202C",
  },
  userEmail: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  timeDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#EEF2F6",
    paddingTop: 10,
    marginTop: 12,
  },
  timeCol: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 9,
    color: "#94A3B8",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  timeVal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginTop: 4,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  modeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    marginLeft: 4,
  },
  kmRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  kmReading: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginLeft: 6,
  }
});
