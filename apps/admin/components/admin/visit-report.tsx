"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { Calendar, CheckCircle2, ClipboardList, Clock, ExternalLink, HelpCircle, MapPin, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Report for one dealer/farmer, from GET /dealers/:id/visits or /farmers/:id/visits. */
export function VisitReport({ data, isLoading }: { data?: any; isLoading?: boolean }) {
  const [staffFilter, setStaffFilter] = useState<string | null>(null);

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
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Completed Visits", summary?.completedVisits ?? 0],
          ["Staff Visited", summary?.staffCount ?? 0],
          ["First Visit", fmt(summary?.firstVisit)],
          ["Last Visit", fmt(summary?.lastVisit)]
        ].map(([label, value]) => (
          <div key={label as string} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
            <p className="text-base font-black text-slate-800 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* What this dealer/farmer does — latest answer to each question */}
      {profile.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-500" /> Latest Details (from staff answers)
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {profile.map((p, i) => (
              <div key={i} className="p-2.5 bg-amber-50/40 rounded-xl border border-amber-200/70">
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
      <div className="space-y-2">
        <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Users className="h-4 w-4 text-blue-600" /> Staff-wise Visits
          <span className="normal-case font-semibold text-slate-400 tracking-normal">(click a row to filter)</span>
        </span>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
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
                  className={`border-t border-slate-100 cursor-pointer hover:bg-blue-50/50 ${staffFilter === s.id ? "bg-blue-50" : ""}`}
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
          <Clock className="h-4 w-4 text-blue-600" /> Visit Timeline ({shown.length})
        </span>
        {shown.map((t) => {
          const done = t.status === "COMPLETED";
          return (
            <div key={t.id} className={`p-4 rounded-2xl border ${done ? "bg-blue-50/30 border-blue-200" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-slate-800 text-sm">{t.assignedTo?.name || "Staff"}</h4>
                    <Badge className={done ? "bg-emerald-600 text-white text-[10px]" : "bg-amber-500 text-white text-[10px]"}>{t.status}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t.title}</p>
                  <p className="text-[11px] text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Due {fmt(t.dueDate)}</span>
                    {t.startedAt && <span>Started {fmt(t.startedAt, "DD MMM, hh:mm A")}</span>}
                    {t.completedAt && <span className="text-emerald-700 font-bold">Completed {fmt(t.completedAt, "DD MMM, hh:mm A")}</span>}
                    {t.durationMin != null && <span className="font-bold">Time spent: {mins(t.durationMin)}</span>}
                  </p>
                </div>
                {t.completionLat && (
                  <a
                    href={`https://maps.google.com/?q=${t.completionLat},${t.completionLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline shrink-0"
                  >
                    <MapPin className="h-3 w-3" /> Map
                  </a>
                )}
              </div>

              {(t.completionPhotoUrl || t.completionRemarks) && (
                <div className="mt-2.5 flex gap-3 items-start">
                  {t.completionPhotoUrl && (
                    <a href={t.completionPhotoUrl} target="_blank" rel="noreferrer" className="shrink-0">
                      <img src={t.completionPhotoUrl} alt="Visit proof" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                    </a>
                  )}
                  <p className="text-xs font-semibold text-slate-700 whitespace-pre-wrap">{t.completionRemarks || ""}</p>
                </div>
              )}

              {t.qa?.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> Questions & Answers
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {t.qa.map((q: any, i: number) => (
                      <div key={i} className="p-2.5 bg-white rounded-xl border border-slate-200">
                        <div className="flex items-start gap-1.5">
                          <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="text-xs font-bold text-slate-600 leading-snug">{q.question}</span>
                        </div>
                        <div className="pl-5"><Answer q={q} /></div>
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
  );
}

function Answer({ q }: { q: any }) {
  if (q.fileUrl) {
    return q.type === "IMAGE" ? (
      <a href={q.fileUrl} target="_blank" rel="noreferrer" className="block mt-1">
        <img src={q.fileUrl} alt={q.question} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
      </a>
    ) : (
      <a href={q.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1">
        <ExternalLink className="h-3 w-3" /> Open {q.type?.toLowerCase() || "file"}
      </a>
    );
  }
  if (q.type === "GEOTAG" && q.value) {
    return (
      <a href={`https://maps.google.com/?q=${q.value}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline">
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
