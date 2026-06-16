import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  type LatLng
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

  const checkInMutation = useMutation({
    mutationFn: (payload: { lat: number; lng: number; punchType: "OFFICE" | "FIELD"; photoUrl?: string; startOdometerPhotoUrl?: string; startOdometer?: number }) => checkInRequest(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: (payload: { lat: number; lng: number; photoUrl?: string; endOdometerPhotoUrl?: string; endOdometer?: number }) => checkOutRequest(payload),
    onSuccess: () => {
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

  const attendanceRows = attendanceQuery.data ?? [];
  const activeAttendance = attendanceRows.find(
    (record) =>
      Boolean(record.checkInTime) &&
      !record.checkOutTime &&
      record.status === "PRESENT"
  );

  const todaySessions = attendanceRows.filter((record) =>
    Boolean(record.checkInTime) &&
    (record.date.substring(0, 10) === dayjs().format("YYYY-MM-DD") || record.id === activeAttendance?.id)
  );
  
  const todayAttendance = activeAttendance || todaySessions[todaySessions.length - 1];
  const activeBreak = activeAttendance?.breaks?.find((b) => !b.endTime);

  return {
    ...attendanceQuery,
    attendance: attendanceQuery.data ?? [],
    holidays: holidayQuery.data ?? [],
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
    todaySessions
  };
}

export function findAttendanceForDay(records: Attendance[], date: dayjs.Dayjs) {
  return records.filter((record) => record.date.substring(0, 10) === date.format("YYYY-MM-DD"));
}
