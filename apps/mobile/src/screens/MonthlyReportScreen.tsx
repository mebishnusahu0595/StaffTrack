import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Card, Text, Divider, IconButton, ActivityIndicator } from "react-native-paper";

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

  function changeMonth(delta: number) {
    setSelectedDate(prev => prev.add(delta, 'month'));
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
          <Divider style={[styles.divider, { backgroundColor: 'white', opacity: 0.2 }]} />
          <View style={styles.salaryRow}>
             <Text style={styles.finalSalaryLabel}>Net Salary</Text>
             <Text style={styles.finalSalaryValue}>INR {report.payroll.finalSalary.toFixed(2)}</Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={[styles.card, { marginTop: 16 }]} mode="elevated">
         <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Attendance Muster Log</Text>
            <View style={styles.musterGrid}>
               {report.dailyLogs.length > 0 ? report.dailyLogs.map((log: any) => (
                  <View key={log.date} style={styles.musterDay}>
                     <View style={[styles.musterDot, { backgroundColor: getStatusColor(log.status) }]} />
                     <View style={{ flex: 1 }}>
                        <Text style={styles.musterDate}>{dayjs(log.date).format("DD MMM (ddd)")}</Text>
                        <Text style={styles.musterStatus}>{log.status}</Text>
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
    stats: {
      presentDays: localAttendance.presentDays,
      absentDays: localAttendance.absentDays,
      halfDays: localAttendance.halfDays,
      onLeave: localAttendance.onLeave,
      totalKm: toNumber(statsSource.totalKm ?? statsSource.totalKmTravelled ?? statsSource.kmTravelled ?? statsSource.distance),
      totalExpenses: toNumber(statsSource.totalExpenses ?? statsSource.approvedExpenses ?? statsSource.expensesTotal ?? root.totalExpenses)
    },
    payroll: {
      baseSalary: toNumber(payrollSource.baseSalary ?? payrollSource.grossSalary),
      deductions: toNumber(payrollSource.deductions ?? payrollSource.absenceDeductions),
      finalSalary: toNumber(payrollSource.finalSalary ?? payrollSource.netSalary)
    },
    dailyLogs: localAttendance.dailyLogs
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

  const dailyLogs: Array<{ date: string; status: string; sessionCount: number }> = Array.from(byDate.entries()).map(([date, records]) => {
    const status = resolveDayStatus(records);

    if (status === "PRESENT") presentDays++;
    if (status === "ABSENT") absentDays++;
    if (status === "HALF_DAY") halfDays++;
    if (status === "ON_LEAVE") onLeave++;

    return {
      date,
      status,
      sessionCount: records.filter((record) => record.checkInTime).length
    };
  });

  holidays
    .filter((holiday) => holiday.type === "HOLIDAY")
    .forEach((holiday) => {
      const date = toDateKey(holiday.date);
      if (!byDate.has(date)) {
        dailyLogs.push({ date, status: "HOLIDAY", sessionCount: 0 });
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
  }
});
