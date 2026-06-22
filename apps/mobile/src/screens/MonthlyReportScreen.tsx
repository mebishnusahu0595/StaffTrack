import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Text, Divider, IconButton, ActivityIndicator } from "react-native-paper";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { fetchHolidays, fetchMonthlyAttendance, fetchMonthlyPerformanceReport, type Attendance } from "../api";
import { useAuth } from "../auth/AuthContext";
import { appIconSource } from "../components/AppIcon";

export function MonthlyReportScreen() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(dayjs());
  
  const reportQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["monthlyReport", user?.id, selectedDate.month() + 1, selectedDate.year()],
    queryFn: () => fetchMonthlyPerformanceReport(user!.id, selectedDate.month() + 1, selectedDate.year())
  });

  const attendanceQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["attendance", user?.id, selectedDate.month() + 1, selectedDate.year(), "monthly-report"],
    queryFn: () => fetchMonthlyAttendance(user!.id, selectedDate.month() + 1, selectedDate.year())
  });

  const holidaysQuery = useQuery({
    queryKey: ["holidays", selectedDate.month() + 1, selectedDate.year(), "monthly-report"],
    queryFn: () => fetchHolidays(selectedDate.month() + 1, selectedDate.year())
  });

  const report = normalizeMonthlyReport(reportQuery.data, attendanceQuery.data ?? [], holidaysQuery.data ?? []);
  const [isExporting, setIsExporting] = useState(false);

  function changeMonth(delta: number) {
    setSelectedDate(prev => prev.add(delta, 'month'));
  }

  async function handleExportPDF() {
    setIsExporting(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      const monthLabel = selectedDate.format("MMMM YYYY");
      const s = report.stats;
      const p = report.payroll;

      const completedRows = (report.tasks.completed || []).map((t: any) =>
        `<tr><td>${t.title}</td><td style="text-align:right">${t.points} pts</td></tr>`).join("");
      const pendingRows = (report.tasks.pending || []).map((t: any) =>
        `<tr><td>${t.title}</td><td style="text-align:right">${t.points} pts</td></tr>`).join("");
      const leaveRows = (report.leaves || []).map((l: any) =>
        `<tr><td>${dayjs(l.startDate).format("DD MMM")} – ${dayjs(l.endDate).format("DD MMM")}</td><td>${l.days} day(s)</td><td>${l.status}</td><td>${l.reason || "—"}</td></tr>`).join("");
      const holidayRows = (report.holidays || []).map((h: any) =>
        `<tr><td>${dayjs(h.date).format("DD MMM YYYY (ddd)")}</td><td>${h.name}</td></tr>`).join("");
      const musterRows = (report.dailyLogs || []).map((log: any) =>
        `<tr><td>${dayjs(log.date).format("DD MMM (ddd)")}</td><td>${log.status}</td><td style="text-align:right">${log.points ?? 0}</td></tr>`).join("");

      const html = `
        <!DOCTYPE html><html><head><meta charset="utf-8"/>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px; color: #1E293B; }
          h1 { color:#1A365D; font-size:22px; margin:0; text-align:center; }
          .sub { text-align:center; color:#64748B; font-size:12px; margin:4px 0 18px; }
          h3 { color:#0F172A; font-size:14px; border-bottom:2px solid #E2E8F0; padding-bottom:6px; margin-top:24px; }
          .grid { display:flex; flex-wrap:wrap; gap:10px; margin:14px 0; }
          .stat { flex:1; min-width:90px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px; text-align:center; }
          .stat .n { font-size:17px; font-weight:800; color:#1D4ED8; }
          .stat .l { font-size:8px; text-transform:uppercase; color:#64748B; font-weight:700; margin-top:4px; }
          table { width:100%; border-collapse:collapse; margin-top:8px; }
          td, th { padding:6px 8px; border-bottom:1px solid #F1F5F9; font-size:12px; text-align:left; }
          th { background:#F8FAFC; color:#475569; text-transform:uppercase; font-size:9px; }
          .salary td { font-size:13px; }
          .net { font-weight:800; color:#16A34A; }
          .footer { text-align:center; margin-top:30px; font-size:10px; color:#94A3B8; }
        </style></head><body>
          <h1>STAFFTRACK MONTHLY REPORT</h1>
          <div class="sub">${report.user?.name || user?.name || "Employee"} • ${monthLabel}</div>

          <h3>Attendance</h3>
          <div class="grid">
            <div class="stat"><div class="n">${s.presentDays}</div><div class="l">Present</div></div>
            <div class="stat"><div class="n">${s.absentDays}</div><div class="l">Absent</div></div>
            <div class="stat"><div class="n">${s.halfDays}</div><div class="l">Half Day</div></div>
            <div class="stat"><div class="n">${s.onLeave}</div><div class="l">On Leave</div></div>
            <div class="stat"><div class="n">${(report.holidays || []).length}</div><div class="l">Holidays</div></div>
          </div>

          <h3>Performance</h3>
          <div class="grid">
            <div class="stat"><div class="n">${s.totalKm.toFixed(1)}</div><div class="l">KM</div></div>
            <div class="stat"><div class="n">${report.tasks.completedCount ?? 0}</div><div class="l">Tasks Done</div></div>
            <div class="stat"><div class="n">${report.tasks.pendingCount ?? 0}</div><div class="l">Tasks Pending</div></div>
            <div class="stat"><div class="n">${s.monthlyPoints}</div><div class="l">Points</div></div>
            <div class="stat"><div class="n">${s.totalExpenses.toFixed(0)}</div><div class="l">Expenses</div></div>
          </div>

          ${completedRows ? `<h3>Completed Tasks (${report.tasks.completedCount})</h3><table>${completedRows}</table>` : ""}
          ${pendingRows ? `<h3>Pending Tasks (${report.tasks.pendingCount})</h3><table>${pendingRows}</table>` : ""}
          ${leaveRows ? `<h3>Leaves</h3><table><tr><th>Period</th><th>Days</th><th>Status</th><th>Reason</th></tr>${leaveRows}</table>` : ""}
          ${holidayRows ? `<h3>Holidays</h3><table><tr><th>Date</th><th>Occasion</th></tr>${holidayRows}</table>` : ""}

          <h3>Payroll Estimate</h3>
          <table class="salary">
            <tr><td>Base Salary</td><td style="text-align:right">INR ${p.baseSalary.toFixed(2)}</td></tr>
            <tr><td>Deductions</td><td style="text-align:right">- INR ${p.deductions.toFixed(2)}</td></tr>
            <tr><td class="net">Net Salary</td><td style="text-align:right" class="net">INR ${p.finalSalary.toFixed(2)}</td></tr>
          </table>

          ${musterRows ? `<h3>Attendance Muster Log</h3><table><tr><th>Date</th><th>Status</th><th style="text-align:right">Pts</th></tr>${musterRows}</table>` : ""}

          <div class="footer">Automated estimate • subject to management approval • StaffTrack &copy; ${dayjs().year()}</div>
        </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (isAvailable) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Monthly Report - ${monthLabel}`, UTI: "com.adobe.pdf" });
      } else {
        Alert.alert("PDF created", "Saved to: " + uri);
      }
    } catch (error) {
      Alert.alert("Export failed", "Could not generate the monthly report PDF.");
    } finally {
      setIsExporting(false);
    }
  }

  if (reportQuery.isLoading || attendanceQuery.isLoading || holidaysQuery.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1A202C" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.monthSelector}>
        <IconButton icon={appIconSource("chevron-left")} onPress={() => changeMonth(-1)} />
        <Text variant="titleMedium" style={styles.monthLabel}>
          {selectedDate.format("MMMM YYYY")}
        </Text>
        <IconButton icon={appIconSource("chevron-right")} onPress={() => changeMonth(1)} />
      </View>

      <Button
        mode="contained"
        icon="file-pdf-box"
        loading={isExporting}
        disabled={isExporting}
        onPress={handleExportPDF}
        style={{ marginBottom: 16, borderRadius: 12 }}
      >
        Export as PDF
      </Button>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Attendance Overview</Text>
          <View style={styles.statsGrid}>
            <StatBox label="Present" value={report.stats.presentDays} color="#16A34A" />
            <StatBox label="Absent" value={report.stats.absentDays} color="#DC2626" />
            <StatBox label="Half Day" value={report.stats.halfDays} color="#EA580C" />
            <StatBox label="On Leave" value={report.stats.onLeave} color="#2563EB" />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Performance Summary</Text>
          <View style={styles.summaryRow}>
             <Text variant="bodyMedium" style={styles.summaryLabel}>Total Distance Covered</Text>
             <Text variant="titleMedium" style={styles.summaryValue}>{report.stats.totalKm.toFixed(1)} KM</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.summaryRow}>
             <Text variant="bodyMedium" style={styles.summaryLabel}>Approved Expenses</Text>
             <Text variant="titleMedium" style={styles.summaryValue}>INR {report.stats.totalExpenses.toFixed(2)}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.summaryRow}>
             <Text variant="bodyMedium" style={styles.summaryLabel}>Monthly Performance Points</Text>
             <Text variant="titleMedium" style={styles.summaryValue}>{report.stats.monthlyPoints}</Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.salaryCard} mode="contained">
        <Card.Content>
          <Text variant="titleMedium" style={styles.salaryTitle}>Monthly Payroll Estimate</Text>
          <View style={styles.salaryRow}>
             <Text style={styles.salaryLabel}>Base Salary</Text>
             <Text style={styles.salaryValue}>INR {report.payroll.baseSalary.toFixed(2)}</Text>
          </View>
          <View style={styles.salaryRow}>
             <Text style={[styles.salaryLabel, { color: '#DC2626' }]}>Deductions (Absences)</Text>
             <Text style={[styles.salaryValue, { color: '#DC2626' }]}>- INR {report.payroll.deductions.toFixed(2)}</Text>
          </View>
          {report.payroll.travelAllowance > 0 && (
            <View style={styles.salaryRow}>
               <Text style={[styles.salaryLabel, { color: '#4ADE80' }]}>Travel Allowance</Text>
               <Text style={[styles.salaryValue, { color: '#4ADE80' }]}>+ INR {report.payroll.travelAllowance.toFixed(2)}</Text>
            </View>
          )}
          <Divider style={[styles.divider, { backgroundColor: 'white', opacity: 0.2 }]} />
          <View style={styles.salaryRow}>
             <Text style={styles.finalSalaryLabel}>Net Salary</Text>
             <Text style={styles.finalSalaryValue}>INR {report.payroll.finalSalary.toFixed(2)}</Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={[styles.card, { marginTop: 16 }]} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Tasks This Month</Text>
          <View style={styles.statsGrid}>
            <StatBox label="Completed" value={report.tasks.completedCount ?? 0} color="#16A34A" />
            <StatBox label="Pending" value={report.tasks.pendingCount ?? 0} color="#EA580C" />
            <StatBox label="Task Points" value={report.tasks.completedPoints ?? 0} color="#2563EB" />
          </View>
          {(report.tasks.completed || []).length > 0 && (
            <View style={{ marginTop: 12 }}>
              {(report.tasks.completed as any[]).slice(0, 30).map((t) => (
                <View key={t.id} style={styles.listRow}>
                  <Text style={styles.listText}>✅ {t.title}</Text>
                  <Text style={styles.listMeta}>{t.points} pts</Text>
                </View>
              ))}
            </View>
          )}
          {(report.tasks.pending || []).length > 0 && (
            <View style={{ marginTop: 8 }}>
              {(report.tasks.pending as any[]).slice(0, 30).map((t) => (
                <View key={t.id} style={styles.listRow}>
                  <Text style={styles.listText}>⏳ {t.title}</Text>
                  <Text style={styles.listMeta}>{t.points} pts</Text>
                </View>
              ))}
            </View>
          )}
          {(report.tasks.completed || []).length === 0 && (report.tasks.pending || []).length === 0 && (
            <Text style={styles.emptyText}>No tasks for this month.</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Leaves</Text>
          {(report.leaves || []).length > 0 ? (
            (report.leaves as any[]).map((l) => (
              <View key={l.id} style={styles.listRowColumn}>
                <View style={styles.listRow}>
                  <Text style={styles.listText}>{dayjs(l.startDate).format("DD MMM")} – {dayjs(l.endDate).format("DD MMM")}</Text>
                  <Text style={[styles.listMeta, { color: leaveStatusColor(l.status) }]}>{l.status} • {l.days}d</Text>
                </View>
                {l.reason ? <Text style={styles.listSub}>{l.reason}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No leaves this month.</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Holidays</Text>
          {(report.holidays || []).length > 0 ? (
            (report.holidays as any[]).map((h) => (
              <View key={h.id} style={styles.listRow}>
                <Text style={styles.listText}>🎉 {h.name}</Text>
                <Text style={styles.listMeta}>{dayjs(h.date).format("DD MMM (ddd)")}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No holidays this month.</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated">
         <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Attendance Muster Log</Text>
            <View style={styles.musterGrid}>
               {report.dailyLogs.length > 0 ? report.dailyLogs.map((log: any) => (
                  <View key={log.date} style={styles.musterDay}>
                     <View style={[styles.musterDot, { backgroundColor: getStatusColor(log.status) }]} />
                     <View style={{ flex: 1 }}>
                        <Text style={styles.musterDate}>{dayjs(log.date).format("DD MMM (ddd)")}</Text>
                        <Text style={styles.musterStatus}>{log.status} • {log.points ?? 0} pts</Text>
                     </View>
                  </View>
               )) : (
                  <Text style={styles.emptyText}>No logs found for this period.</Text>
               )}
            </View>
         </Card.Content>
      </Card>
      
      <Text style={styles.disclaimer}>
        * This is an automated estimate based on your logged attendance. Final salary is subject to management approval.
      </Text>
    </ScrollView>
  );
}

function StatBox({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function normalizeMonthlyReport(raw: any, attendanceRows: Attendance[], holidays: Array<{ date: string; type?: string }>) {
  const root = raw ?? {};
  const statsSource = root.stats ?? root.summary ?? root;
  const payrollSource = root.payroll ?? root.salary ?? {};
  const localAttendance = buildLocalAttendanceSummary(attendanceRows, holidays);

  return {
    user: root.user ?? null,
    stats: {
      presentDays: localAttendance.presentDays,
      absentDays: localAttendance.absentDays,
      halfDays: localAttendance.halfDays,
      onLeave: localAttendance.onLeave,
      totalKm: toNumber(statsSource.totalKm ?? statsSource.totalKmTravelled ?? statsSource.kmTravelled ?? statsSource.distance),
      totalExpenses: toNumber(statsSource.totalExpenses ?? statsSource.approvedExpenses ?? statsSource.expensesTotal ?? root.totalExpenses),
      monthlyPoints: toNumber(statsSource.monthlyPoints ?? root.monthlyPoints)
    },
    payroll: {
      baseSalary: toNumber(payrollSource.baseSalary ?? payrollSource.grossSalary),
      deductions: toNumber(payrollSource.deductions ?? payrollSource.absenceDeductions),
      finalSalary: toNumber(payrollSource.finalSalary ?? payrollSource.netSalary),
      travelAllowance: toNumber(payrollSource.travelAllowance ?? payrollSource.travelAllowanceTotal ?? 0)
    },
    tasks: root.tasks ?? { completed: [], pending: [], completedCount: 0, pendingCount: 0, completedPoints: 0, possiblePoints: 0 },
    leaves: Array.isArray(root.leaves) ? root.leaves : [],
    holidays: Array.isArray(root.holidays)
      ? root.holidays
      : holidays.filter((h) => (h.type ?? "HOLIDAY") === "HOLIDAY").map((h, i) => ({ id: `h-${i}`, date: h.date, name: (h as any).name || "Holiday" })),
    dailyLogs: Array.isArray(root.dailyLogs) && root.dailyLogs.length > 0
      ? root.dailyLogs.map((log: any) => ({
          date: log.date,
          status: log.status,
          sessionCount: toNumber(log.sessionCount),
          points: toNumber(log.points)
        }))
      : localAttendance.dailyLogs
  };
}

function buildLocalAttendanceSummary(attendanceRows: Attendance[], holidays: Array<{ date: string; type?: string }>) {
  const byDate = new Map<string, Attendance[]>();

  attendanceRows.forEach((record) => {
    const dateKey = toDateKey(record.date);
    const records = byDate.get(dateKey) ?? [];
    records.push(record);
    byDate.set(dateKey, records);
  });

  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let onLeave = 0;

  const dailyLogs: Array<{ date: string; status: string; sessionCount: number; points: number }> = Array.from(byDate.entries()).map(([date, records]) => {
    const status = resolveDayStatus(records);

    if (status === "PRESENT") presentDays++;
    if (status === "ABSENT") absentDays++;
    if (status === "HALF_DAY") halfDays++;
    if (status === "ON_LEAVE") onLeave++;

    return {
      date,
      status,
      sessionCount: records.filter((record) => record.checkInTime).length,
      points: 0
    };
  });

  holidays
    .filter((holiday) => holiday.type === "HOLIDAY")
    .forEach((holiday) => {
      const date = toDateKey(holiday.date);
      if (!byDate.has(date)) {
        dailyLogs.push({ date, status: "HOLIDAY", sessionCount: 0, points: 0 });
      }
    });

  return {
    presentDays,
    absentDays,
    halfDays,
    onLeave,
    dailyLogs: dailyLogs.sort((a, b) => a.date.localeCompare(b.date))
  };
}

function resolveDayStatus(records: Attendance[]) {
  if (records.some((record) => record.status === "PRESENT")) return "PRESENT";
  if (records.some((record) => record.status === "HALF_DAY")) return "HALF_DAY";
  if (records.some((record) => record.status === "ON_LEAVE")) return "ON_LEAVE";
  if (records.some((record) => record.status === "ABSENT")) return "ABSENT";
  return records[0]?.status ?? "ABSENT";
}

function toDateKey(value: string) {
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : dayjs(value).format("YYYY-MM-DD");
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function leaveStatusColor(status: string) {
  switch (status) {
    case "APPROVED": return "#16A34A";
    case "REJECTED": return "#DC2626";
    default: return "#CA8A04";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "PRESENT": return "#16A34A";
    case "HALF_DAY": return "#EA580C";
    case "ABSENT": return "#DC2626";
    case "ON_LEAVE": return "#2563EB";
    case "WEEKEND": return "#94A3B8";
    case "HOLIDAY": return "#CA8A04";
    default: return "#E2E8F0";
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9F8"
  },
  content: {
    padding: 16,
    paddingBottom: 32
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 2
  },
  monthLabel: {
    fontWeight: '900',
    color: '#1A201E',
    minWidth: 150,
    textAlign: 'center'
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: 'white'
  },
  sectionTitle: {
    fontWeight: '900',
    marginBottom: 16,
    color: '#475569',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900'
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 4,
    lineHeight: 13,
    textAlign: 'center'
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  summaryLabel: {
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
    marginRight: 12
  },
  summaryValue: {
    fontWeight: '800',
    color: '#1E293B',
    maxWidth: 130,
    textAlign: 'right'
  },
  divider: {
    marginVertical: 12
  },
  salaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginTop: 8
  },
  salaryTitle: {
    color: 'white',
    fontWeight: '900',
    marginBottom: 16,
    fontSize: 14
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  salaryLabel: {
    color: '#94A3B8',
    flex: 1,
    fontWeight: '600',
    lineHeight: 18,
    marginRight: 12
  },
  salaryValue: {
    color: 'white',
    fontWeight: '700',
    maxWidth: 140,
    textAlign: 'right'
  },
  finalSalaryLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900'
  },
  finalSalaryValue: {
    color: '#4ADE80',
    fontSize: 20,
    fontWeight: '900'
  },
  disclaimer: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
    paddingHorizontal: 20
  },
  musterGrid: {
    gap: 8
  },
  musterDay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12
  },
  musterDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  musterDate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B'
  },
  musterStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 2,
    lineHeight: 13
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12
  },
  listRowColumn: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  listText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1
  },
  listMeta: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B'
  },
  listSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  }
});
