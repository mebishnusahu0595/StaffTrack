"use client";

import React, { useMemo, useState } from "react";
import {
  Users,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  CheckCircle,
  Clock,
  Receipt,
  MapPin,
  Award,
  Calendar,
  X,
  Building2,
  CircleSlash
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchTeamOverview, superFetchManagers } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type TeamMember = any;

const inr = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function TeamOverviewPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const [cursor, setCursor] = useState(dayjs());
  const [search, setSearch] = useState("");
  const [managerId, setManagerId] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<TeamMember | null>(null);

  const month = cursor.month() + 1;
  const year = cursor.year();

  const managersQuery = useQuery({
    queryKey: ["team-managers"],
    queryFn: superFetchManagers,
    enabled: isAdmin
  });

  const overviewQuery = useQuery({
    queryKey: ["team-overview", month, year, managerId ?? "all"],
    queryFn: () => fetchTeamOverview({ month, year, managerId })
  });

  const members: TeamMember[] = overviewQuery.data?.members ?? [];

  const filtered = useMemo(
    () =>
      members.filter((m) =>
        (m.user?.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (m.user?.department || "").toLowerCase().includes(search.toLowerCase())
      ),
    [members, search]
  );

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, m) => {
        acc.expense += m.stats?.monthExpense ?? 0;
        acc.km += m.stats?.totalKm ?? 0;
        acc.points += m.stats?.monthlyPoints ?? 0;
        acc.pending += m.stats?.pendingTasks ?? 0;
        acc.completed += m.stats?.completedTasks ?? 0;
        return acc;
      },
      { expense: 0, km: 0, points: 0, pending: 0, completed: 0 }
    );
  }, [filtered]);

  const exportExcel = () => {
    if (filtered.length === 0) return;
    const headers = [
      "Name",
      "Department",
      "Designation",
      "Manager",
      "Present Days",
      "Half Days",
      "Absent Days",
      "On Leave",
      "Paid Holidays",
      "Completed Tasks",
      "Pending Tasks",
      "Points",
      "Total KM",
      "Today Expense",
      "Month Expense",
      "Leaves Pending",
      "Leaves Approved"
    ];
    const rows = filtered.map((m) => [
      m.user?.name ?? "",
      m.user?.department ?? "",
      m.user?.designation ?? "",
      m.user?.managerName ?? "",
      m.stats?.presentDays ?? 0,
      m.stats?.halfDays ?? 0,
      m.stats?.absentDays ?? 0,
      m.stats?.onLeave ?? 0,
      m.stats?.paidHolidays ?? 0,
      m.stats?.completedTasks ?? 0,
      m.stats?.pendingTasks ?? 0,
      m.stats?.monthlyPoints ?? 0,
      m.stats?.totalKm ?? 0,
      m.stats?.todayExpense ?? 0,
      m.stats?.monthExpense ?? 0,
      m.stats?.leavesPending ?? 0,
      m.stats?.leavesApproved ?? 0
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Team_Report_${cursor.format("MMM_YYYY")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Users className="h-3 w-3 text-blue-500" />
            <span>Management / Team Overview</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
            Team Performance Center
          </h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm px-2 h-12">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setCursor(cursor.subtract(1, "month"))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-xs font-black text-slate-700 min-w-[110px] text-center uppercase tracking-wider">
              {cursor.format("MMMM YYYY")}
            </span>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setCursor(cursor.add(1, "month"))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <Button
            variant="outline"
            className="h-12 rounded-2xl border-slate-200 bg-white font-bold text-slate-700 gap-2 px-5 shadow-sm text-xs"
            onClick={exportExcel}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 text-emerald-600" /> Excel Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-5 rounded-[28px] border border-slate-200/60 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or department..."
            className="h-12 pl-12 rounded-2xl bg-slate-50 border-none focus:bg-white transition-all font-bold text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isAdmin && (
          <select
            value={managerId ?? ""}
            onChange={(e) => setManagerId(e.target.value || undefined)}
            className="h-12 rounded-2xl bg-slate-50 border border-slate-200/60 px-4 font-bold text-xs text-slate-700 focus:bg-white outline-none w-full md:w-72"
          >
            <option value="">All Teams</option>
            {(managersQuery.data ?? []).map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.name}&apos;s Team
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Team Members", value: filtered.length, icon: Users, color: "text-blue-600 bg-blue-50" },
          { label: "Completed Tasks", value: totals.completed, icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
          { label: "Pending Tasks", value: totals.pending, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Total KM", value: `${totals.km.toFixed(0)} km`, icon: MapPin, color: "text-indigo-600 bg-indigo-50" },
          { label: "Total Expense", value: inr(totals.expense), icon: Receipt, color: "text-rose-600 bg-rose-50" }
        ].map((t) => (
          <Card key={t.label} className="rounded-[24px] border-none shadow-sm ring-1 ring-slate-200/60 bg-white">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center", t.color)}>
                <t.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{t.label}</p>
                <p className="text-xl font-black text-slate-900">{t.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Members grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {overviewQuery.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 bg-white rounded-[32px] animate-pulse border border-slate-100" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-24 text-center space-y-4 bg-white rounded-[40px] shadow-sm ring-1 ring-slate-200/60">
            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
              <Users className="h-10 w-10" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900">No Team Members Found</p>
              <p className="text-slate-400 font-bold text-sm">There are no staff matching the current filters.</p>
            </div>
          </div>
        ) : (
          filtered.map((m) => (
            <Card
              key={m.user.id}
              onClick={() => setSelected(m)}
              className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 hover:ring-blue-400 hover:shadow-xl transition-all duration-300 bg-white overflow-hidden cursor-pointer text-left"
            >
              <CardHeader className="p-6 border-b border-slate-50">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 rounded-2xl border-2 border-white shadow-md">
                      <AvatarImage src={m.user?.avatarUrl} />
                      <AvatarFallback className="bg-slate-50 text-slate-400 font-bold">
                        {m.user?.name?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-black text-slate-900 leading-none">{m.user?.name}</h3>
                      <p className="text-[10px] font-black uppercase text-slate-400 mt-1">
                        {m.user?.designation || "Staff"}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] font-black uppercase rounded-md gap-1">
                    <Award className="h-3 w-3" /> {m.stats?.monthlyPoints ?? 0}
                  </Badge>
                </div>
                {m.user?.department && (
                  <div className="flex items-center gap-1.5 mt-3 text-[10px] font-bold text-slate-400">
                    <Building2 className="h-3 w-3" /> {m.user.department}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Present" value={m.stats?.presentDays ?? 0} tone="emerald" />
                  <Stat label="Absent" value={m.stats?.absentDays ?? 0} tone="rose" />
                  <Stat label="Leave" value={m.stats?.onLeave ?? 0} tone="amber" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Done" value={m.stats?.completedTasks ?? 0} tone="emerald" />
                  <Stat label="Pending" value={m.stats?.pendingTasks ?? 0} tone="amber" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Total KM" value={`${(m.stats?.totalKm ?? 0).toFixed(0)}`} tone="indigo" />
                  <Stat label="Month Exp." value={inr(m.stats?.monthExpense ?? 0)} tone="blue" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <MemberDetailSheet member={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50/60 border-emerald-100 text-emerald-700",
    rose: "bg-rose-50/60 border-rose-100 text-rose-700",
    amber: "bg-amber-50/60 border-amber-100 text-amber-700",
    indigo: "bg-indigo-50/60 border-indigo-100 text-indigo-700",
    blue: "bg-blue-50/60 border-blue-100 text-blue-700"
  };
  return (
    <div className={cn("p-2.5 rounded-2xl border text-center", tones[tone])}>
      <p className="text-[8px] font-black uppercase opacity-70 tracking-wider">{label}</p>
      <p className="text-sm font-black mt-0.5">{value}</p>
    </div>
  );
}

function MemberDetailSheet({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  return (
    <Sheet open={!!member} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl p-0 overflow-y-auto bg-slate-50 border-none">
        {member && (
          <div>
            <SheetHeader className="p-6 bg-white border-b border-slate-100 text-left sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 rounded-2xl border-2 border-white shadow-md">
                    <AvatarImage src={member.user?.avatarUrl} />
                    <AvatarFallback className="bg-slate-50 text-slate-400 font-bold text-lg">
                      {member.user?.name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-xl font-black text-slate-900">{member.user?.name}</SheetTitle>
                    <p className="text-[10px] font-black uppercase text-slate-400 mt-0.5">
                      {member.user?.designation || "Staff"} · {member.user?.department || "No Dept"}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </SheetHeader>

            <div className="p-6 space-y-6">
              {/* Attendance + payroll */}
              <Section title="Attendance & Payroll">
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Present" value={member.stats?.presentDays ?? 0} tone="emerald" />
                  <Stat label="Half Day" value={member.stats?.halfDays ?? 0} tone="amber" />
                  <Stat label="Absent" value={member.stats?.absentDays ?? 0} tone="rose" />
                  <Stat label="On Leave" value={member.stats?.onLeave ?? 0} tone="amber" />
                  <Stat label="Holidays" value={member.stats?.paidHolidays ?? 0} tone="indigo" />
                  <Stat label="Points" value={member.stats?.monthlyPoints ?? 0} tone="blue" />
                </div>
                {member.payroll && (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <Stat label="Base" value={inr(member.payroll.baseSalary)} tone="indigo" />
                    <Stat label="Deduction" value={inr(member.payroll.deductions)} tone="rose" />
                    <Stat label="Net" value={inr(member.payroll.finalSalary)} tone="emerald" />
                  </div>
                )}
              </Section>

              {/* Travel + expense */}
              <Section title="Travel & Expenses">
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Total KM" value={`${(member.stats?.totalKm ?? 0).toFixed(0)}`} tone="indigo" />
                  <Stat label="Today Exp." value={inr(member.stats?.todayExpense ?? 0)} tone="blue" />
                  <Stat label="Month Exp." value={inr(member.stats?.monthExpense ?? 0)} tone="rose" />
                </div>
                {(member.expenses?.items?.length ?? 0) > 0 && (
                  <div className="mt-3 space-y-2">
                    {member.expenses.items.slice(0, 8).map((e: any) => (
                      <div key={e.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-xs font-black text-slate-800">{e.category}</p>
                          <p className="text-[10px] font-bold text-slate-400">{dayjs(e.date).format("MMM DD")} · {e.description || "—"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">{inr(e.amount)}</span>
                          <Badge className={cn("text-[8px] font-black uppercase rounded", e.approved ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                            {e.approved ? "OK" : "Pending"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Tasks */}
              <Section title={`Tasks (${(member.tasks?.pending?.length ?? 0) + (member.tasks?.completed?.length ?? 0)})`}>
                <div className="space-y-2">
                  {[...(member.tasks?.pending ?? []), ...(member.tasks?.completed ?? [])].slice(0, 12).map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 min-w-0">
                        {t.status === "COMPLETED" ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 truncate">{t.title}{t.isSubtask ? " (subtask)" : ""}</p>
                          <p className="text-[10px] font-bold text-slate-400">Due {dayjs(t.dueDate).format("MMM DD")} · {t.points} pts</p>
                        </div>
                      </div>
                      <Badge className={cn(
                        "text-[8px] font-black uppercase rounded flex-shrink-0",
                        t.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" :
                        t.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {t.status}
                      </Badge>
                    </div>
                  ))}
                  {((member.tasks?.pending?.length ?? 0) + (member.tasks?.completed?.length ?? 0)) === 0 && (
                    <Empty label="No tasks this month" />
                  )}
                </div>
              </Section>

              {/* Leaves */}
              <Section title={`Leaves (${member.leaves?.length ?? 0})`}>
                <div className="space-y-2">
                  {(member.leaves ?? []).map((l: any) => (
                    <div key={l.id} className="bg-white p-4 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">
                          {dayjs(l.startDate).format("MMM DD")} – {dayjs(l.endDate).format("MMM DD")}
                        </span>
                        <Badge className={cn(
                          "text-[8px] font-black uppercase rounded",
                          l.status === "APPROVED" ? "bg-emerald-50 text-emerald-600" :
                          l.status === "REJECTED" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                        )}>
                          {l.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600">{l.reason || "No reason provided"}</p>
                      {l.approvedByName && (
                        <p className="text-[9px] font-bold text-slate-400 italic">{l.status.toLowerCase()} by {l.approvedByName}</p>
                      )}
                    </div>
                  ))}
                  {(member.leaves?.length ?? 0) === 0 && <Empty label="No leave requests" />}
                </div>
              </Section>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
        <Calendar className="h-3 w-3 text-blue-500" /> {title}
      </h3>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-400 bg-white p-4 rounded-2xl border border-slate-100">
      <CircleSlash className="h-4 w-4" />
      <span className="text-xs font-bold italic">{label}</span>
    </div>
  );
}
