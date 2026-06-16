import { useMemo } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import type { Attendance } from "../api";

dayjs.extend(utc);

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatFriendlyDuration(ms: number) {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || (hours === 0 && minutes === 0)) parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function useTimeTracker(todaySessions: Attendance[], currentTime: dayjs.Dayjs) {
  return useMemo(() => {
    let officeTimeMs = 0;
    let fieldTimeMs = 0;
    let breakTimeMs = 0;

    todaySessions.forEach((session) => {
      if (!session.checkInTime) return;
      // A late check-in that is still awaiting approval must NOT accrue work time.
      // The timer only starts once a manager/admin approves it.
      if (session.isCheckInPending) return;
      const start = dayjs.utc(session.checkInTime).local();
      const end = session.checkOutTime ? dayjs.utc(session.checkOutTime).local() : currentTime;
      const sessionDurationMs = end.diff(start, "millisecond");

      let sessionBreakMs = 0;
      session.breaks?.forEach((b) => {
        if (!b.startTime) return;
        const bStart = dayjs.utc(b.startTime).local();
        const bEnd = b.endTime ? dayjs.utc(b.endTime).local() : currentTime;
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
      friendlyBreakTime: formatFriendlyDuration(breakTimeMs),
      raw: { officeTimeMs, fieldTimeMs, breakTimeMs }
    };
  }, [todaySessions, currentTime]);
}

