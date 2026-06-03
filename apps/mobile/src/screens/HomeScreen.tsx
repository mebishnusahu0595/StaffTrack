import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Avatar, Badge, Button, Card, Dialog, Icon, IconButton, Portal, Text, TouchableRipple } from "react-native-paper";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

import { fetchExpenses, fetchNotifications, markNotificationAsRead, fetchMonthlyPerformanceReport } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useTasks } from "../hooks/useTasks";
import type { MainDrawerParamList } from "../navigation/AppNavigator";
import { appIconSource, AppIcon } from "../components/AppIcon";
import { PersonalAttendancePanel } from "../components/PersonalAttendancePanel";

type HomeNavigation = DrawerNavigationProp<MainDrawerParamList, "Home">;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const { user } = useAuth();
  const { todaysTasks } = useTasks();
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  const monthlyReportQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["monthlyReportHome", user?.id],
    queryFn: () => fetchMonthlyPerformanceReport(user!.id, dayjs().month() + 1, dayjs().year())
  });

  const notificationsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["notifications", user?.id],
    queryFn: fetchNotifications,
    refetchInterval: 30_000
  });

  const expensesQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["expenses", user?.id, "home"],
    queryFn: () => fetchExpenses(user!.id)
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const expenses = expensesQuery.data ?? [];
  const pendingExpenseCount = expenses.filter((expense) => !expense.approved).length;
  const approvedExpenseTotal = expenses
    .filter((expense) => expense.approved)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.dateText}>{currentTime.format("dddd, MMM DD")}</Text>
          <Text style={styles.greeting} variant="headlineMedium">
            {getGreeting()}, {user?.name ?? "User"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
            <View style={{ backgroundColor: "#E0F2FE", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <AppIcon name="star" size={14} color="#0284C7" />
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#0284C7" }}>
                {monthlyReportQuery.data?.stats?.monthlyPoints ?? 0} PTS
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.notificationWrapper}>
          <IconButton
            icon={appIconSource(unreadCount > 0 ? "bell-badge" : "bell-outline")}
            iconColor={unreadCount > 0 ? "#A4262C" : "#4A6583"}
            size={28}
            onPress={() => setShowNotifications(true)}
          />
          {unreadCount > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Personal attendance: punch, odometer photos, KM, day-end report */}
      <PersonalAttendancePanel onNavigateDayEnd={() => navigation.navigate("DayEndReport")} />

      <View style={styles.summaryRow}>
        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("Tasks")}>
          <Card.Content>
            <View style={styles.summaryIconRow}>
              <AppIcon color="#24312D" name="check-circle-outline" size={20} />
              <Text style={styles.mutedSummaryLabel}>TASKS</Text>
            </View>
            <Text style={styles.summaryValue}>{todaysTasks.length}</Text>
          </Card.Content>
        </Card>

        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("LeaveRequest")}>
          <Card.Content>
            <View style={styles.summaryIconRow}>
              <AppIcon color="#24312D" name="calendar-clock" size={20} />
              <Text style={styles.mutedSummaryLabel}>LEAVE</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 14 }]}>Apply</Text>
          </Card.Content>
        </Card>

        <Card mode="contained" style={styles.summaryCard} onPress={() => navigation.navigate("MonthlyReport")}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <AppIcon color="#24312D" name="file-document-outline" size={20} />
              <Text style={styles.mutedSummaryLabel}>REPORTS</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 14 }]}>View</Text>
          </Card.Content>
        </Card>
      </View>

      <View style={styles.summaryRow}>
        <Card mode="contained" style={styles.summaryCardWide} onPress={() => navigation.navigate("Expenses")}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIconRow}>
              <AppIcon color="#24312D" name="file-document-outline" size={20} />
              <Text style={styles.mutedSummaryLabel}>EXPENSES</Text>
            </View>
            <Text style={[styles.summaryValue, { fontSize: 16 }]}>
              INR {approvedExpenseTotal.toFixed(0)}
            </Text>
            <Text style={styles.summarySubValue}>{pendingExpenseCount} pending approval</Text>
          </Card.Content>
        </Card>
      </View>

      {/* My Team Card */}
      {user?.group ? (
        <Card mode="contained" style={{ borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", marginTop: 16 }}>
          <Card.Content style={{ padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Icon source="account-group" size={24} color="#1E3A8A" />
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#1E3A8A", marginLeft: 8, letterSpacing: 0.5 }}>
                DEPARTMENT: {user.group.name.toUpperCase()}
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {user.group.members && user.group.members.length > 0 ? (
                user.group.members.map((member) => (
                  <View
                    key={member.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      backgroundColor: member.id === user.id ? "#EFF6FF" : "#F8FAFC",
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: member.id === user.id ? "#BFDBFE" : "#E2E8F0"
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Avatar.Text
                        size={32}
                        label={member.name ? member.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() : "?"}
                        style={{ backgroundColor: member.id === user.id ? "#3B82F6" : "#475569" }}
                        labelStyle={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}
                      />
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#1E293B" }}>
                          {member.name} {member.id === user.id ? "(You)" : ""}
                        </Text>
                        <Text style={{ fontSize: 11, color: "#64748B" }}>
                          {member.designation || (member.role === "MANAGER" ? "Manager" : "Staff")}
                        </Text>
                      </View>
                    </View>
                    <Badge
                      style={{
                        backgroundColor: member.role === "MANAGER" ? "#F59E0B" : "#E2E8F0",
                        color: member.role === "MANAGER" ? "#FFFFFF" : "#475569",
                        fontWeight: "700",
                        alignSelf: "center"
                      }}
                    >
                      {member.role}
                    </Badge>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 12, color: "#64748B", fontStyle: "italic" }}>No other members in this team</Text>
              )}
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {/* Notifications Modal */}
      <Portal>
        <Dialog visible={showNotifications} onDismiss={() => setShowNotifications(false)} style={styles.notificationDialog}>
          <Dialog.Title style={styles.dialogTitle}>Notifications</Dialog.Title>
          <Dialog.Content style={{ maxHeight: 400 }}>
            <ScrollView>
              {notifications.length === 0 ? (
                <Text style={styles.emptyText}>No notifications yet.</Text>
              ) : (
                notifications.map((n) => (
                  <TouchableRipple
                    key={n.id}
                    onPress={async () => {
                      if (!n.isRead) {
                        await markNotificationAsRead(n.id);
                        notificationsQuery.refetch();
                      }
                      setShowNotifications(false);
                      if (n.type && n.type.startsWith("TASK_")) {
                        navigation.navigate("Tasks");
                      } else if (n.type === "DAY_END_REPORT") {
                        navigation.navigate("DayEndReport");
                      } else {
                        navigation.navigate("Home");
                      }
                    }}
                    style={[styles.notificationItem, !n.isRead && styles.unreadItem]}
                  >
                    <View>
                      <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle}>{n.title}</Text>
                        {!n.isRead && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notificationMsg}>{n.message}</Text>
                      <Text style={styles.notificationTime}>{dayjs(n.createdAt).fromNow()}</Text>
                    </View>
                  </TouchableRipple>
                ))
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowNotifications(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

function getGreeting() {
  const hour = dayjs().hour();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9F8"
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 100
  },
  notificationWrapper: {
    position: "relative"
  },
  badgeCount: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#A4262C",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "bold"
  },
  notificationDialog: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginHorizontal: 20
  },
  dialogTitle: {
    fontWeight: "800",
    color: "#24312D"
  },
  notificationItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0"
  },
  unreadItem: {
    backgroundColor: "#F8F9FA"
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#24312D"
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#A4262C"
  },
  notificationMsg: {
    fontSize: 12,
    color: "#66736F",
    lineHeight: 18
  },
  notificationTime: {
    fontSize: 10,
    color: "#9BA3A1",
    marginTop: 6,
    fontWeight: "600"
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingTop: 12
  },
  headerCopy: {
    flex: 1
  },
  greeting: {
    color: "#24312D",
    fontWeight: "700"
  },
  dateText: {
    color: "#66736F",
    fontSize: 16,
    marginBottom: 4
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8
  },
  summaryCard: {
    borderRadius: 8,
    backgroundColor: "#EEEEEE",
    flex: 1
  },
  summaryCardWide: {
    borderRadius: 8,
    backgroundColor: "#EEEEEE",
    flex: 1
  },
  summaryContent: {
    padding: 12,
    paddingHorizontal: 8
  },
  summaryIconRow: {
    flexDirection: "column",
    gap: 4,
    marginBottom: 4
  },
  mutedSummaryLabel: {
    color: "#24312D",
    fontSize: 10,
    fontWeight: "600"
  },
  summaryValue: {
    color: "#24312D",
    fontSize: 20,
    fontWeight: "700"
  },
  summarySubValue: {
    color: "#66736F",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4
  },
  emptyText: {
    color: "#66736F",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center"
  }
});
