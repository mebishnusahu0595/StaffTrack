"use client";

import { useRef, useState } from "react";
import dayjs from "dayjs";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  HelpCircle,
  MapPin,
  Printer,
  Sparkles,
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useReactToPrint } from "react-to-print";

interface VisitReportProps {
  data?: any;
  isLoading?: boolean;
  title?: string;
  subtitle?: string;
  type?: "Dealer" | "Farmer" | "Report";
}

/** Report for one dealer/farmer, from GET /dealers/:id/visits or /farmers/:id/visits. */
export function VisitReport({ data, isLoading, title, subtitle, type = "Report" }: VisitReportProps) {
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${title || type}_Visit_Report_${dayjs().format("YYYY-MM-DD")}`,
  });

  if (isLoading) {
    return <p className="text-xs font-semibold text-slate-500 text-center py-10">Loading visit report…</p>;
  }

  const summary = data?.summary;
  const tasks: any[] = data?.tasks || [];
  const profile: any[] = data?.profile || [];
  const staff: any[] = summary?.staff || [];
  const shown = staffFilter ? tasks.filter((t) => t.assignedTo?.id === staffFilter) : tasks;
  const fmt = (d?: string | null, f = "DD MMM YYYY") => (d ? dayjs(d).format(f) : "—");
  const mins = (m?: number | null) => (m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

  if (!tasks.length) {
    return (
      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100">
        <ClipboardList className="h-6 w-6 text-slate-300 mx-auto" />
        <p className="text-xs text-slate-500 font-semibold mt-2">No staff visits recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Action Bar: Staff Filter & PDF Download */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-150">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 text-blue-600" /> Visit Summary & Field Audit
          </span>
          {staffFilter && (
            <Badge
              variant="secondary"
              className="cursor-pointer text-[10px] bg-blue-100 text-blue-800 hover:bg-blue-200"
              onClick={() => setStaffFilter(null)}
              title="Click to clear filter"
            >
              Filtered by: {staff.find((s) => s.id === staffFilter)?.name || "Staff"} (✕ clear)
            </Badge>
          )}
        </div>

        <Button
          type="button"
          onClick={() => handlePrint()}
          size="sm"
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-8 px-3 rounded-xl flex items-center gap-1.5 shadow-sm transition-all shrink-0"
        >
          <Printer className="h-3.5 w-3.5 text-slate-300" />
          <span>Download PDF / Print</span>
        </Button>
      </div>

      {/* Printable Area */}
      <div ref={printRef} className="space-y-5 print:p-6 print:space-y-4 print:text-black">
        {/* Printable Document Header (shown nicely on screen and in print) */}
        {(title || subtitle) && (
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:bg-white print:border-slate-300">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md print:border-slate-400 print:text-slate-800">
                  {type} Visit Report
                </span>
                <span className="text-[11px] text-slate-400 font-medium">StaffTrack Enterprise</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 mt-1">{title}</h2>
              {subtitle && <p className="text-xs font-semibold text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            <div className="text-right sm:text-right text-[11px] font-medium text-slate-400 shrink-0">
              <span className="block text-[10px] uppercase font-bold text-slate-500">Report Generated</span>
              <span className="font-bold text-slate-700">{dayjs().format("DD MMM YYYY, hh:mm A")}</span>
            </div>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
          {[
            ["Completed Visits", summary?.completedVisits ?? 0, "emerald"],
            ["Staff Visited", summary?.staffCount ?? 0, "blue"],
            ["First Visit", fmt(summary?.firstVisit), "slate"],
            ["Last Visit", fmt(summary?.lastVisit), "amber"]
          ].map(([label, value, color]) => (
            <div key={label as string} className="bg-slate-50 p-3 rounded-xl border border-slate-200 print:bg-white print:border-slate-300">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
              <p className="text-base font-black text-slate-800 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* What this dealer/farmer does — latest answer to each question */}
        {profile.length > 0 && (
          <div className="space-y-2 print:break-inside-avoid">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500 print:hidden" /> Latest Details (from staff answers)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 print:grid-cols-2">
              {profile.map((p, i) => (
                <div key={i} className="p-2.5 bg-amber-50/40 rounded-xl border border-amber-200/70 print:bg-white print:border-slate-300">
                  <span className="text-[11px] font-bold text-slate-500">{p.question}</span>
                  <Answer q={p} />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    by {p.answeredBy} • {fmt(p.answeredAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff-wise summary */}
        <div className="space-y-2 print:break-inside-avoid">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Users className="h-4 w-4 text-blue-600 print:hidden" /> Staff-wise Visits
            <span className="normal-case font-semibold text-slate-400 tracking-normal print:hidden">(click a row to filter)</span>
          </span>
          <div className="overflow-x-auto rounded-xl border border-slate-200 print:border-slate-300">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase print:bg-slate-100">
                <tr>
                  <th className="text-left p-2">Staff</th>
                  <th className="text-center p-2">Visits Done</th>
                  <th className="text-center p-2">Assigned</th>
                  <th className="text-center p-2">Total Time</th>
                  <th className="text-left p-2">Visit Dates</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setStaffFilter(staffFilter === s.id ? null : s.id)}
                    className={`border-t border-slate-100 cursor-pointer hover:bg-blue-50/50 print:cursor-default ${staffFilter === s.id ? "bg-blue-50" : ""}`}
                  >
                    <td className="p-2 font-bold text-slate-800">
                      {s.name}
                      {s.phone && <span className="block text-[10px] font-medium text-slate-400">{s.phone}</span>}
                    </td>
                    <td className="p-2 text-center font-black text-emerald-700">{s.completed}</td>
                    <td className="p-2 text-center font-bold text-slate-600">{s.assigned}</td>
                    <td className="p-2 text-center font-bold text-slate-600">{mins(s.totalMinutes)}</td>
                    <td className="p-2 text-slate-600">
                      {s.visitDates.length ? s.visitDates.map((d: string) => fmt(d, "DD MMM, hh:mm A")).join(" • ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Every visit with the admin's questions and the staff's answers */}
        <div className="space-y-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-blue-600 print:hidden" /> Visit Timeline ({shown.length})
          </span>
          {shown.map((t) => {
            const done = t.status === "COMPLETED";
            return (
              <div
                key={t.id}
                className={`p-4 rounded-2xl border print:break-inside-avoid print:bg-white print:border-slate-300 ${
                  done ? "bg-blue-50/30 border-blue-200" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-slate-800 text-sm">{t.assignedTo?.name || "Staff"}</h4>
                      <Badge className={done ? "bg-emerald-600 text-white text-[10px]" : "bg-amber-500 text-white text-[10px]"}>
                        {t.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{t.title}</p>
                    <p className="text-[11px] text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 print:hidden" /> Due {fmt(t.dueDate)}
                      </span>
                      {t.startedAt && <span>Started: {fmt(t.startedAt, "DD MMM, hh:mm A")}</span>}
                      {t.completedAt && (
                        <span className="text-emerald-700 font-bold">
                          Completed: {fmt(t.completedAt, "DD MMM, hh:mm A")}
                        </span>
                      )}
                      {t.durationMin != null && <span className="font-bold">Time spent: {mins(t.durationMin)}</span>}
                    </p>
                  </div>
                  {t.completionLat && (
                    <a
                      href={`https://maps.google.com/?q=${t.completionLat},${t.completionLng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline shrink-0 print:hidden"
                    >
                      <MapPin className="h-3 w-3" /> Map
                    </a>
                  )}
                </div>

                {(t.completionPhotoUrl || t.completionRemarks) && (
                  <div className="mt-2.5 flex gap-3 items-start">
                    {t.completionPhotoUrl && (
                      <a href={t.completionPhotoUrl} target="_blank" rel="noreferrer" className="shrink-0">
                        <img
                          src={t.completionPhotoUrl}
                          alt="Visit proof"
                          className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                        />
                      </a>
                    )}
                    <p className="text-xs font-semibold text-slate-700 whitespace-pre-wrap">{t.completionRemarks || ""}</p>
                  </div>
                )}

                {t.qa?.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 print:hidden" /> Questions & Answers
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 print:grid-cols-2">
                      {t.qa.map((q: any, i: number) => (
                        <div key={i} className="p-2.5 bg-white rounded-xl border border-slate-200 print:border-slate-300">
                          <div className="flex items-start gap-1.5">
                            <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5 print:hidden" />
                            <span className="text-xs font-bold text-slate-600 leading-snug">{q.question}</span>
                          </div>
                          <div className="pl-5">
                            <Answer q={q} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Answer({ q }: { q: any }) {
  if (q.fileUrl) {
    return q.type === "IMAGE" ? (
      <a href={q.fileUrl} target="_blank" rel="noreferrer" className="block mt-1">
        <img src={q.fileUrl} alt={q.question} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
      </a>
    ) : (
      <a
        href={q.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
      >
        <ExternalLink className="h-3 w-3 print:hidden" /> Open {q.type?.toLowerCase() || "file"}
      </a>
    );
  }
  if (q.type === "GEOTAG" && q.value) {
    return (
      <a
        href={`https://maps.google.com/?q=${q.value}`}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-bold text-blue-600 hover:underline"
      >
        {q.value}
      </a>
    );
  }
  return q.value ? (
    <p className="text-xs font-black text-slate-900">{String(q.value)}</p>
  ) : (
    <p className="text-xs text-slate-400 italic">No response</p>
  );
}
