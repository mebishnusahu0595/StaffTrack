import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";

import {
  checkIn as checkInRequest,
  checkOut as checkOutRequest,
  startBreak as startBreakRequest,
  endBreak as endBreakRequest,
  fetchMonthlyAttendance,
  fetchHolidays,
  type Attendance,
  type Break,
  type Holiday,
  type LatLng,
  type CheckInPayload,
  type CheckOutPayload
} from "../api";
import { useAuth } from "../auth/AuthContext";

export function useAttendance(month = dayjs().month() + 1, year = dayjs().year()) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const attendanceQueryKey = ["attendance", user?.id, month, year];
  const holidayQueryKey = ["holidays", month, year];

  const attendanceQuery = useQuery({
    queryKey: attendanceQueryKey,
    enabled: Boolean(user?.id),
    queryFn: () => fetchMonthlyAttendance(user!.id, month, year),
    // Fallback so a late check-in approval reflects (timer starts) without manual
    // refresh even if the websocket message is missed.
    refetchInterval: 30_000
  });

  const holidayQuery = useQuery({
    queryKey: holidayQueryKey,
    queryFn: () => fetchHolidays(month, year)
  });

  const attendanceStorageKey = `@stafftrack:attendance:${user?.id || "guest"}:${month}:${year}`;
  const holidayStorageKey = `@stafftrack:holidays:${month}:${year}`;

  const [cachedAttendance, setCachedAttendance] = useState<Attendance[]>([]);
  const [cachedHolidays, setCachedHolidays] = useState<Holiday[]>([]);

  // Load from local AsyncStorage cache on mount/user change
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [rawAtt, rawHol] = await Promise.all([
          AsyncStorage.getItem(attendanceStorageKey),
          AsyncStorage.getItem(holidayStorageKey)
        ]);
        if (active) {
          if (rawAtt) {
            const parsed = JSON.parse(rawAtt);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCachedAttendance(parsed);
            }
          }
          if (rawHol) {
            const parsed = JSON.parse(rawHol);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCachedHolidays(parsed);
            }
          }
        }
      } catch (err) {
        console.warn("[useAttendance] Error loading cached attendance:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [attendanceStorageKey, holidayStorageKey]);

  // Persist fresh attendance whenever network query succeeds
  useEffect(() => {
    if (Array.isArray(attendanceQuery.data) && attendanceQuery.data.length > 0) {
      setCachedAttendance(attendanceQuery.data);
      void AsyncStorage.setItem(attendanceStorageKey, JSON.stringify(attendanceQuery.data));
    }
  }, [attendanceQuery.data, attendanceStorageKey]);

  useEffect(() => {
    if (Array.isArray(holidayQuery.data) && holidayQuery.data.length > 0) {
      setCachedHolidays(holidayQuery.data);
      void AsyncStorage.setItem(holidayStorageKey, JSON.stringify(holidayQuery.data));
    }
  }, [holidayQuery.data, holidayStorageKey]);

  const checkInMutation = useMutation({
    mutationFn: (payload: CheckInPayload) => checkInRequest(payload),
    onSuccess: (newRecord) => {
      if (newRecord) {
        setCachedAttendance((prev) => {
          const next = [newRecord, ...prev.filter((r) => r.id !== newRecord.id)];
          void AsyncStorage.setItem(attendanceStorageKey, JSON.stringify(next));
          return next;
        });
      }
      void queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: (payload: CheckOutPayload) => checkOutRequest(payload),
    onSuccess: (updatedRecord) => {
      if (updatedRecord) {
        setCachedAttendance((prev) => {
          const next = prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r));
          void AsyncStorage.setItem(attendanceStorageKey, JSON.stringify(next));
          return next;
        });
      }
      void queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
    }
  });

  const startBreakMutation = useMutation({
    mutationFn: startBreakRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
    }
  });

  const endBreakMutation = useMutation({
    mutationFn: endBreakRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
    }
  });

  const attendanceRows =
    Array.isArray(attendanceQuery.data) && attendanceQuery.data.length > 0
      ? attendanceQuery.data
      : cachedAttendance;

  const holidaysList =
    Array.isArray(holidayQuery.data) && holidayQuery.data.length > 0
      ? holidayQuery.data
      : cachedHolidays;
  const activeAttendance = attendanceRows.find(
    (record) =>
      Boolean(record.checkInTime) &&
      !record.checkOutTime &&
      record.status === "PRESENT"
  );

  const todaySessions = attendanceRows.filter((record) => {
    if (!record.checkInTime) return false;
    const isToday =
      dayjs(record.checkInTime).isSame(dayjs(), "day") ||
      dayjs(record.date).isSame(dayjs(), "day");
    return isToday || record.id === activeAttendance?.id;
  });
  
  const todayAttendance = activeAttendance || todaySessions[todaySessions.length - 1];
  const activeBreak = activeAttendance?.breaks?.find((b) => !b.endTime);

  const todayRecord = attendanceRows.find((record) =>
    dayjs(record.date).isSame(dayjs(), "day") ||
    (record.checkInTime && dayjs(record.checkInTime).isSame(dayjs(), "day"))
  );
  const isOnLeave = todayRecord?.status === "ON_LEAVE";
  const isCheckedIn = Boolean(activeAttendance) || todaySessions.length > 0;

  return {
    ...attendanceQuery,
    attendance: attendanceRows,
    holidays: holidaysList,
    isFetchingHolidays: holidayQuery.isFetching,
    checkIn: checkInMutation.mutateAsync,
    checkOut: checkOutMutation.mutateAsync,
    startBreak: startBreakMutation.mutateAsync,
    endBreak: endBreakMutation.mutateAsync,
    isCheckingIn: checkInMutation.isPending,
    isCheckingOut: checkOutMutation.isPending,
    isStartingBreak: startBreakMutation.isPending,
    isEndingBreak: endBreakMutation.isPending,
    todayAttendance,
    activeAttendance,
    activeBreak,
    todaySessions,
    isOnLeave,
    isCheckedIn
  };
}

export function findAttendanceForDay(records: Attendance[], date: dayjs.Dayjs) {
  return records.filter((record) => record.date.substring(0, 10) === date.format("YYYY-MM-DD"));
}
