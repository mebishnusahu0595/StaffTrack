import type { AttendanceRecord } from "./types";

export function calculateDurations(records: AttendanceRecord[]) {
  let officeTimeMs = 0;
  let fieldTimeMs = 0;
  let breakTimeMs = 0;
  
  const now = new Date().getTime();

  records.forEach((session) => {
    if (!session.checkInTime) return;
    const start = new Date(session.checkInTime).getTime();
    const end = session.checkOutTime ? new Date(session.checkOutTime).getTime() : now;
    const sessionDurationMs = end - start;

    let sessionBreakMs = 0;
    session.breaks?.forEach((b) => {
      if (!b.startTime) return;
      const bStart = new Date(b.startTime).getTime();
      const bEnd = b.endTime ? new Date(b.endTime).getTime() : now;
      sessionBreakMs += bEnd - bStart;
    });

    breakTimeMs += sessionBreakMs;

    const netDurationMs = sessionDurationMs - sessionBreakMs;

    if (session.punchType === "OFFICE") {
      officeTimeMs += netDurationMs;
    } else if (session.punchType === "FIELD") {
      fieldTimeMs += netDurationMs;
    }
  });

  return { officeTimeMs, fieldTimeMs, breakTimeMs };
}

export function formatDurationLabel(ms: number) {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
