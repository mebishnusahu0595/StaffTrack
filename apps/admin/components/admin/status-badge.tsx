import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AttendanceStatus, TaskStatus } from "@/lib/types";
 
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const variants: Record<TaskStatus, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-50" },
    IN_PROGRESS: { label: "In Progress", className: "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50" },
    COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50" },
    CANCELLED: { label: "Cancelled", className: "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-50" }
  };
 
  const item = variants[status];
  return <Badge variant="outline" className={cn("px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider", item.className)}>{item.label}</Badge>;
}
 
export function AttendanceStatusBadge({
  status,
  hasCheckOut,
  checkInTime,
  checkOutTime,
  shiftStart = "09:00",
  shiftEnd = "18:00"
}: {
  status: AttendanceStatus;
  hasCheckOut?: boolean;
  checkInTime?: string;
  checkOutTime?: string | null;
  shiftStart?: string;
  shiftEnd?: string;
}) {
  let label = status.replace("_", " ");
  let className = "bg-slate-50 text-slate-500 border-slate-100";
 
  if (status === "PRESENT") {
    if (checkInTime) {
      const punchIn = new Date(checkInTime);
      const [sHours, sMinutes] = shiftStart.split(":").map(Number);
      
      const isLate = punchIn.getHours() > sHours || (punchIn.getHours() === sHours && punchIn.getMinutes() > sMinutes);
      
      if (isLate) {
        label = "Late";
        className = "bg-amber-50 text-amber-600 border-amber-100";
      } else if (!hasCheckOut) {
        label = "On Time";
        className = "bg-emerald-50 text-emerald-600 border-emerald-100";
      }

      if (hasCheckOut && checkOutTime) {
        const punchOut = new Date(checkOutTime);
        const [eHours, eMinutes] = shiftEnd.split(":").map(Number);
        const isEarly = punchOut.getHours() < eHours || (punchOut.getHours() === eHours && punchOut.getMinutes() < eMinutes);
        
        if (isEarly) {
          label = isLate ? "Late / Early Out" : "Early Out";
          className = "bg-rose-50 text-rose-600 border-rose-100";
        } else if (!isLate) {
          label = "Completed";
          className = "bg-emerald-50 text-emerald-600 border-emerald-100";
        }
      } else if (!hasCheckOut) {
        label = isLate ? "Late (Active)" : "Active Now";
        className = isLate ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-blue-50 text-blue-600 border-blue-100";
      }
    }
  } else if (status === "ABSENT") {
    className = "bg-rose-50 text-rose-600 border-rose-100";
  } else if (status === "HALF_DAY") {
    className = "bg-amber-50 text-amber-600 border-amber-100";
  } else if (status === "ON_LEAVE") {
    className = "bg-indigo-50 text-indigo-600 border-indigo-100";
  }
 
  return (
    <Badge 
      variant="outline" 
      className={cn("px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider", className)}
    >
      {label}
    </Badge>
  );
}
