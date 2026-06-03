import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, RefreshControl } from "react-native";
import { Text, Card, Avatar, ActivityIndicator, IconButton, Portal, Modal, Chip, Searchbar } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchTeamOverview } from "../../api";
import { AppIcon } from "../../components/AppIcon";

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function ManagerTeamScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState(dayjs());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const month = cursor.month() + 1;
  const year = cursor.year();

  const overviewQuery = useQuery({
    queryKey: ["managerTeamOverview", month, year],
    queryFn: () => fetchTeamOverview({ month, year })
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await overviewQuery.refetch();
    setRefreshing(false);
  };

  const members: any[] = overviewQuery.data?.members ?? [];
  const filtered = useMemo(
    () =>
      members.filter((m) =>
        (m.user?.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (m.user?.department || "").toLowerCase().includes(search.toLowerCase())
      ),
    [members, search]
  );

  return (
    <View style={styles.container}>
      {/* Month switcher */}
      <View style={styles.monthBar}>
        <IconButton icon={() => <AppIcon name="chevron-left" size={22} color="#1A202C" />} onPress={() => setCursor(cursor.subtract(1, "month"))} />
        <Text style={styles.monthLabel}>{cursor.format("MMMM YYYY")}</Text>
        <IconButton icon={() => <AppIcon name="chevron-right" size={22} color="#1A202C" />} onPress={() => setCursor(cursor.add(1, "month"))} />
      </View>

      <Searchbar
        placeholder="Search team members..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
        inputStyle={{ fontSize: 13 }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10B981"]} />}
      >
        {overviewQuery.isLoading ? (
          <ActivityIndicator color="#1A202C" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Card style={styles.emptyCard} elevation={0}>
            <Card.Content style={styles.emptyContent}>
              <AppIcon name="account" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>No team members found.</Text>
              <Text style={styles.emptySubtext}>You have no staff assigned to your team yet.</Text>
            </Card.Content>
          </Card>
        ) : (
          filtered.map((m: any) => (
            <Card key={m.user.id} style={styles.card} elevation={1} onPress={() => setSelected(m)}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Avatar.Text
                    size={40}
                    label={m.user?.name ? m.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "S"}
                    style={styles.avatar}
                    labelStyle={styles.avatarLabel}
                  />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{m.user?.name}</Text>
                    <Text style={styles.userSub}>{m.user?.designation || "Staff"}{m.user?.department ? ` · ${m.user.department}` : ""}</Text>
                  </View>
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsVal}>{m.stats?.monthlyPoints ?? 0}</Text>
                    <Text style={styles.pointsLabel}>PTS</Text>
                  </View>
                </View>

                <View style={styles.statGrid}>
                  <Stat label="Present" value={m.stats?.presentDays ?? 0} color="#10B981" />
                  <Stat label="Absent" value={m.stats?.absentDays ?? 0} color="#EF4444" />
                  <Stat label="Leave" value={m.stats?.onLeave ?? 0} color="#F59E0B" />
                </View>
                <View style={styles.statGrid}>
                  <Stat label="Done" value={m.stats?.completedTasks ?? 0} color="#10B981" />
                  <Stat label="Pending" value={m.stats?.pendingTasks ?? 0} color="#F59E0B" />
                  <Stat label="KM" value={(m.stats?.totalKm ?? 0).toFixed(0)} color="#6366F1" />
                </View>

                <View style={styles.chipRow}>
                  <Chip textStyle={styles.chipText} style={styles.chip}>{inr(m.stats?.monthExpense ?? 0)} this month</Chip>
                  <AppIcon name="chevron-right" size={18} color="#3B82F6" />
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <Portal>
        <Modal visible={Boolean(selected)} onDismiss={() => setSelected(null)} contentContainerStyle={styles.modalContainer}>
          {selected && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalUserRow}>
                  <Avatar.Text
                    size={44}
                    label={selected.user?.name ? selected.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "S"}
                    style={styles.avatar}
                    labelStyle={styles.avatarLabel}
                  />
                  <View style={styles.userInfo}>
                    <Text style={styles.modalUserName}>{selected.user?.name}</Text>
                    <Text style={styles.userSub}>{selected.user?.designation || "Staff"}{selected.user?.department ? ` · ${selected.user.department}` : ""}</Text>
                  </View>
                </View>
                <IconButton icon={() => <AppIcon name="close" size={24} color="#1A202C" />} onPress={() => setSelected(null)} style={{ margin: 0 }} />
              </View>

              <Text style={styles.sectionTitle}>Attendance & Points</Text>
              <View style={styles.miniGrid}>
                <Mini label="Present" value={selected.stats?.presentDays ?? 0} />
                <Mini label="Half" value={selected.stats?.halfDays ?? 0} />
                <Mini label="Absent" value={selected.stats?.absentDays ?? 0} />
                <Mini label="Leave" value={selected.stats?.onLeave ?? 0} />
                <Mini label="Holidays" value={selected.stats?.paidHolidays ?? 0} />
                <Mini label="Points" value={selected.stats?.monthlyPoints ?? 0} />
              </View>

              {selected.payroll && (
                <>
                  <Text style={styles.sectionTitle}>Salary (estimated)</Text>
                  <View style={styles.miniGrid}>
                    <Mini label="Base" value={inr(selected.payroll.baseSalary)} />
                    <Mini label="Deduction" value={inr(selected.payroll.deductions)} />
                    <Mini label="Net" value={inr(selected.payroll.finalSalary)} />
                  </View>
                </>
              )}

              <Text style={styles.sectionTitle}>Travel & Expenses</Text>
              <View style={styles.miniGrid}>
                <Mini label="Total KM" value={(selected.stats?.totalKm ?? 0).toFixed(0)} />
                <Mini label="Today" value={inr(selected.stats?.todayExpense ?? 0)} />
                <Mini label="Month" value={inr(selected.stats?.monthExpense ?? 0)} />
              </View>

              <Text style={styles.sectionTitle}>Tasks</Text>
              {[...(selected.tasks?.pending ?? []), ...(selected.tasks?.completed ?? [])].slice(0, 15).map((t: any) => (
                <View key={t.id} style={styles.rowItem}>
                  <AppIcon name={t.status === "COMPLETED" ? "check-circle-outline" : "calendar-clock"} size={16} color={t.status === "COMPLETED" ? "#10B981" : "#F59E0B"} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.rowTitle}>{t.title}{t.isSubtask ? " (subtask)" : ""}</Text>
                    <Text style={styles.rowSub}>Due {dayjs(t.dueDate).format("MMM DD")} · {t.points} pts · {t.status}</Text>
                  </View>
                </View>
              ))}
              {(((selected.tasks?.pending?.length ?? 0) + (selected.tasks?.completed?.length ?? 0)) === 0) && (
                <Text style={styles.emptyInline}>No tasks this month.</Text>
              )}

              <Text style={styles.sectionTitle}>Leaves</Text>
              {(selected.leaves ?? []).map((l: any) => (
                <View key={l.id} style={styles.leaveItem}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.rowTitle}>{dayjs(l.startDate).format("MMM DD")} - {dayjs(l.endDate).format("MMM DD")}</Text>
                    <Chip textStyle={styles.statusChipText} style={[styles.statusChip, { backgroundColor: l.status === "APPROVED" ? "#DCFCE7" : l.status === "REJECTED" ? "#FEE2E2" : "#FEF3C7" }]}>{l.status}</Chip>
                  </View>
                  <Text style={styles.rowSub}>{l.reason || "No reason provided"}</Text>
                  {l.approvedByName ? <Text style={styles.rowSubItalic}>{l.status.toLowerCase()} by {l.approvedByName}</Text> : null}
                </View>
              ))}
              {((selected.leaves?.length ?? 0) === 0) && <Text style={styles.emptyInline}>No leave requests.</Text>}
            </ScrollView>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
    </View>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.miniItem}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  monthBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", paddingHorizontal: 8 },
  monthLabel: { fontSize: 15, fontWeight: "900", color: "#1A202C" },
  search: { marginHorizontal: 16, marginTop: 8, marginBottom: 4, backgroundColor: "#FFFFFF", borderRadius: 12, elevation: 0, borderWidth: 1, borderColor: "#E2E8F0" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  emptyCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", marginTop: 20 },
  emptyContent: { alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15, fontWeight: "800", color: "#475569", marginTop: 12, textAlign: "center" },
  emptySubtext: { fontSize: 12, color: "#94A3B8", marginTop: 6, textAlign: "center" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "#EEF2F6" },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  avatar: { backgroundColor: "#EEF2F6" },
  avatarLabel: { color: "#475569", fontWeight: "700" },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: "800", color: "#1A202C" },
  userSub: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "500" },
  pointsBadge: { alignItems: "center", backgroundColor: "#EEF2FF", borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10 },
  pointsVal: { fontSize: 15, fontWeight: "900", color: "#4F46E5" },
  pointsLabel: { fontSize: 8, fontWeight: "800", color: "#6366F1" },
  statGrid: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F8FAFC", padding: 10, borderRadius: 12, marginTop: 10 },
  statItem: { alignItems: "center", flex: 1 },
  statLabel: { fontSize: 8, color: "#94A3B8", fontWeight: "800", letterSpacing: 0.5 },
  statVal: { fontSize: 14, fontWeight: "900", marginTop: 4 },
  chipRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, borderTopWidth: 1, borderColor: "#EEF2F6", paddingTop: 10 },
  chip: { height: 28, justifyContent: "center", borderRadius: 8, backgroundColor: "#F1F5F9" },
  chipText: { fontSize: 10, fontWeight: "700", color: "#475569" },
  modalContainer: { backgroundColor: "#FFFFFF", margin: 16, borderRadius: 20, maxHeight: "88%", elevation: 5 },
  modalContent: { padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalUserRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  modalUserName: { fontSize: 16, fontWeight: "900", color: "#1A202C" },
  sectionTitle: { fontSize: 11, fontWeight: "900", color: "#1A202C", marginTop: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  miniGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  miniItem: { backgroundColor: "#F8FAFC", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: "#EEF2F6", minWidth: "30%", flexGrow: 1 },
  miniLabel: { fontSize: 8, color: "#94A3B8", fontWeight: "800", letterSpacing: 0.4 },
  miniVal: { fontSize: 14, fontWeight: "900", color: "#1A202C", marginTop: 2 },
  rowItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: "#EEF2F6" },
  rowTitle: { fontSize: 13, fontWeight: "800", color: "#1A202C" },
  rowSub: { fontSize: 10, color: "#64748B", marginTop: 2, fontWeight: "600" },
  rowSubItalic: { fontSize: 10, color: "#94A3B8", marginTop: 2, fontStyle: "italic" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  leaveItem: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: "#EEF2F6" },
  statusChip: { height: 22, justifyContent: "center", borderRadius: 6 },
  statusChipText: { fontSize: 8, fontWeight: "900" },
  emptyInline: { fontSize: 12, color: "#94A3B8", fontStyle: "italic", paddingVertical: 6 }
});
