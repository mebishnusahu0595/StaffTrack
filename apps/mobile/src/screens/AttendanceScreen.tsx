import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Card, IconButton, Text, Icon } from "react-native-paper";

import type { Attendance, AttendanceStatus, Holiday } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useAttendance } from "../hooks/useAttendance";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusMeta: Record<AttendanceStatus, { label: string; color: string; textColor: string }> = {
  PRESENT: { label: "Present", color: "#DFF3E6", textColor: "#17633A" },
  ABSENT: { label: "Absent", color: "#FDE7E9", textColor: "#A4262C" },
  HALF_DAY: { label: "Half-day", color: "#FFF4CE", textColor: "#7A4D00" },
  ON_LEAVE: { label: "Leave", color: "#E8F0FE", textColor: "#174EA6" }
};

type CalendarCell = {
  key: string;
  day?: number;
  record?: Attendance;
};

export function AttendanceScreen() {
  const [visibleMonth, setVisibleMonth] = useState(dayjs().startOf("month"));
  const { user } = useAuth();
  const { attendance, holidays, isFetching, refetch } = useAttendance(
    visibleMonth.month() + 1,
    visibleMonth.year()
  );

  const cells = useMemo(
    () => buildCalendarCells(visibleMonth, attendance, holidays),
    [attendance, holidays, visibleMonth]
  );

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let onLeave = 0;
    let holidayCount = holidays.length;

    attendance.forEach(record => {
      if (record.status === "PRESENT") present++;
      if (record.status === "ABSENT") absent++;
      if (record.status === "HALF_DAY") halfDay++;
      if (record.status === "ON_LEAVE") onLeave++;
    });

    return { present, absent, halfDay, onLeave, holidayCount };
  }, [attendance, holidays, visibleMonth]);

  const attendanceRows = useMemo(
    () => attendance.slice().sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf()),
    [attendance]
  );

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />}
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <IconButton
          icon="chevron-left"
          onPress={() => setVisibleMonth((current) => current.subtract(1, "month"))}
          size={28}
        />
        <View style={{ alignItems: "center" }}>
          <Text style={styles.monthTitle} variant="titleLarge">
            {visibleMonth.format("MMMM YYYY")}
          </Text>
          <Text style={{ fontSize: 12, color: "#66736F" }}>Monthly Overview</Text>
        </View>
        <IconButton
          icon="chevron-right"
          onPress={() => setVisibleMonth((current) => current.add(1, "month"))}
          size={28}
        />
      </View>

      <View style={styles.summaryGrid}>
        <Card mode="contained" style={[styles.summaryCard, { backgroundColor: "#DFF3E6" }]}>
          <Card.Content style={styles.summaryCardContent}>
            <Icon source="account-check" size={24} color="#17633A" />
            <Text style={[styles.summaryValue, { color: "#17633A" }]}>{stats.present}</Text>
            <Text style={[styles.summaryLabel, { color: "#17633A" }]}>PRESENT</Text>
          </Card.Content>
        </Card>
        <Card mode="contained" style={[styles.summaryCard, { backgroundColor: "#FDE7E9" }]}>
          <Card.Content style={styles.summaryCardContent}>
            <Icon source="account-cancel" size={24} color="#A4262C" />
            <Text style={[styles.summaryValue, { color: "#A4262C" }]}>{stats.absent}</Text>
            <Text style={[styles.summaryLabel, { color: "#A4262C" }]}>ABSENT</Text>
          </Card.Content>
        </Card>
        <Card mode="contained" style={[styles.summaryCard, { backgroundColor: "#FFF4CE" }]}>
          <Card.Content style={styles.summaryCardContent}>
            <Icon source="account-clock" size={24} color="#7A4D00" />
            <Text style={[styles.summaryValue, { color: "#7A4D00" }]}>{stats.halfDay}</Text>
            <Text style={[styles.summaryLabel, { color: "#7A4D00" }]}>HALF DAY</Text>
          </Card.Content>
        </Card>
        <Card mode="contained" style={[styles.summaryCard, { backgroundColor: "#E8F0FE" }]}>
          <Card.Content style={styles.summaryCardContent}>
            <Icon source="calendar-star" size={24} color="#174EA6" />
            <Text style={[styles.summaryValue, { color: "#174EA6" }]}>{stats.holidayCount}</Text>
            <Text style={[styles.summaryLabel, { color: "#174EA6" }]}>HOLIDAYS</Text>
          </Card.Content>
        </Card>
      </View>

      <Card mode="elevated" style={styles.calendarCard}>
        <Card.Content style={{ padding: 8 }}>
          <View style={styles.weekRow}>
            {weekDays.map((day) => (
              <Text key={day} style={styles.weekDay}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((cell) => {
              const meta = cell.record 
                ? statusMeta[cell.record.status] 
                : cell.isHoliday 
                  ? { label: "Holiday", color: "#FEF3C7", textColor: "#92400E" }
                  : undefined;

              return (
                <View
                  key={cell.key}
                  style={[
                    styles.dayCell,
                    cell.day ? styles.dayCellActive : undefined,
                    meta ? { backgroundColor: meta.color, borderColor: meta.textColor, borderWidth: 1 } : undefined
                  ]}
                >
                  {cell.day ? (
                    <>
                      <Text style={[styles.dayNumber, meta ? { color: meta.textColor } : undefined]}>
                        {cell.day}
                      </Text>
                      {meta ? (
                        <View style={[styles.statusDot, { backgroundColor: meta.textColor }]} />
                      ) : null}
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card.Content>
      </Card>

      <View style={styles.legend}>
        {(Object.keys(statusMeta) as AttendanceStatus[]).map((status) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: statusMeta[status].color, borderColor: statusMeta[status].textColor, borderWidth: 1 }]} />
            <Text style={styles.legendText}>{statusMeta[status].label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.recordsList}>
        <Text style={styles.sectionTitle}>Attendance Details</Text>
        {attendanceRows.length === 0 ? (
          <Card mode="contained" style={styles.recordCard}>
            <Card.Content>
              <Text style={styles.emptyText}>No attendance records for this month.</Text>
            </Card.Content>
          </Card>
        ) : (
          attendanceRows.map((record) => {
            const display = getAttendanceDisplay(record, user?.shiftStart, user?.shiftEnd);
            return (
              <Card key={record.id} mode="contained" style={styles.recordCard}>
                <Card.Content style={styles.recordContent}>
                  <View>
                    <Text style={styles.recordDate}>{dayjs(record.date).format("DD MMM, dddd")}</Text>
                    <Text style={styles.recordTimes}>
                      In: {formatMaybeTime(record.checkInTime)} | Out: {formatMaybeTime(record.checkOutTime)}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: display.bg }]}>
                    <Text style={[styles.statusPillText, { color: display.color }]}>{display.label}</Text>
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function buildCalendarCells(month: dayjs.Dayjs, records: Attendance[], holidays: Holiday[]): (CalendarCell & { isHoliday?: boolean })[] {
  const byDate = new Map(records.map((record) => [dayjs(record.date).format("YYYY-MM-DD"), record]));
  const holidayDates = new Set(holidays.map(h => dayjs(h.date).format("YYYY-MM-DD")));
  
  const cells: (CalendarCell & { isHoliday?: boolean })[] = [];
  const firstDayOffset = month.startOf("month").day();

  for (let index = 0; index < firstDayOffset; index += 1) {
    cells.push({ key: `blank-${index}` });
  }

  for (let day = 1; day <= month.daysInMonth(); day += 1) {
    const date = month.date(day);
    const dateStr = date.format("YYYY-MM-DD");
    cells.push({
      key: dateStr,
      day,
      record: byDate.get(dateStr),
      isHoliday: holidayDates.has(dateStr)
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}` });
  }

  return cells;
}

function formatMaybeTime(value?: string | null) {
  return value ? dayjs(value).format("hh:mm A") : "--";
}

function getAttendanceDisplay(record: Attendance, shiftStart = "09:00", shiftEnd = "18:00") {
  if (record.status !== "PRESENT") {
    const meta = statusMeta[record.status];
    return { label: meta.label, bg: meta.color, color: meta.textColor };
  }

  const [startHour, startMinute] = shiftStart.split(":").map(Number);
  const [endHour, endMinute] = shiftEnd.split(":").map(Number);
  const checkIn = record.checkInTime ? dayjs(record.checkInTime) : null;
  const checkOut = record.checkOutTime ? dayjs(record.checkOutTime) : null;
  const isLate =
    Boolean(checkIn) &&
    (checkIn!.hour() > startHour || (checkIn!.hour() === startHour && checkIn!.minute() > startMinute));
  const isEarly =
    Boolean(checkOut) &&
    (checkOut!.hour() < endHour || (checkOut!.hour() === endHour && checkOut!.minute() < endMinute));

  if (isLate && isEarly) return { label: "Late / Early Out", bg: "#FDE7E9", color: "#A4262C" };
  if (isLate) return { label: checkOut ? "Late Arrived" : "Late Active", bg: "#FFF4CE", color: "#7A4D00" };
  if (isEarly) return { label: "Early Out", bg: "#FDE7E9", color: "#A4262C" };
  if (!checkOut) return { label: "Active Now", bg: "#E8F0FE", color: "#174EA6" };

  return { label: "Completed", bg: "#DFF3E6", color: "#17633A" };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9F8"
  },
  content: {
    padding: 16
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  monthTitle: {
    color: "#24312D",
    fontWeight: "700"
  },
  calendarCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF"
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 12,
    paddingTop: 8
  },
  weekDay: {
    color: "#66736F",
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayCell: {
    alignItems: "center",
    aspectRatio: 1,
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    marginBottom: 6,
    width: `${100 / 7}%`
  },
  dayCellActive: {
    backgroundColor: "transparent"
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2
  },
  dayNumber: {
    color: "#24312D",
    fontWeight: "700"
  },
  statusText: {
    fontSize: 10,
    marginTop: 2
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  legendDot: {
    borderRadius: 5,
    height: 10,
    width: 10
  },
  legendText: {
    color: "#66736F"
  },
  recordsList: {
    gap: 10,
    marginTop: 18
  },
  sectionTitle: {
    color: "#24312D",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2
  },
  recordCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12
  },
  recordContent: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  recordDate: {
    color: "#24312D",
    fontSize: 13,
    fontWeight: "700"
  },
  recordTimes: {
    color: "#66736F",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  emptyText: {
    color: "#66736F",
    fontWeight: "600",
    textAlign: "center"
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 24
  },
  summaryCard: {
    width: "48%",
    borderRadius: 12,
    marginBottom: 12
  },
  summaryCardContent: {
    alignItems: "center",
    paddingVertical: 16
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600"
  }
});
