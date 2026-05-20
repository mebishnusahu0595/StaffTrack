import { useMemo } from "react";
import dayjs from "dayjs";
import type { Attendance } from "../api";

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function useTimeTracker(todaySessions: Attendance[], currentTime: dayjs.Dayjs) {
  return useMemo(() => {
    let officeTimeMs = 0;
    let fieldTimeMs = 0;
    let breakTimeMs = 0;

    todaySessions.forEach((session) => {
      if (!session.checkInTime) return;
      const start = dayjs(session.checkInTime);
      const end = session.checkOutTime ? dayjs(session.checkOutTime) : currentTime;
      const sessionDurationMs = end.diff(start, "millisecond");

      let sessionBreakMs = 0;
      session.breaks?.forEach((b) => {
        if (!b.startTime) return;
        const bStart = dayjs(b.startTime);
        const bEnd = b.endTime ? dayjs(b.endTime) : currentTime;
        sessionBreakMs += bEnd.diff(bStart, "millisecond");
      });

      breakTimeMs += sessionBreakMs;

      const netDurationMs = sessionDurationMs - sessionBreakMs;

      if (session.punchType === "OFFICE") {
        officeTimeMs += netDurationMs;
      } else if (session.punchType === "FIELD") {
        fieldTimeMs += netDurationMs;
      }
    });

    return {
      officeTime: formatDuration(officeTimeMs),
      fieldTime: formatDuration(fieldTimeMs),
      breakTime: formatDuration(breakTimeMs),
      raw: { officeTimeMs, fieldTimeMs, breakTimeMs }
    };
  }, [todaySessions, currentTime]);
}
