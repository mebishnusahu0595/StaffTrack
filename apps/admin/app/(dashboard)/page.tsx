"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Cell
} from "recharts";
import {
  Users,
  ClipboardList,
  Folder,
  AlertTriangle,
  FileSpreadsheet,
  BrainCircuit,
  Plus,
  MoreHorizontal,
  ChevronDown,
  ExternalLink,
  Check,
  X,
  Trash2,
  Eye,
  EyeOff,
  StickyNote,
  CheckCircle2,
  Circle,
  PenLine
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";
import { fetchTasks, fetchUsers, fetchAllReports, fetchProjects, fetchIssues, fetchForms } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Note {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  color: string;
}

const NOTE_COLORS = [
  { id: "yellow",  bg: "bg-yellow-100",  border: "border-yellow-300",  dot: "bg-yellow-400",  ring: "ring-yellow-400" },
  { id: "pink",    bg: "bg-pink-100",    border: "border-pink-300",    dot: "bg-pink-400",    ring: "ring-pink-400" },
  { id: "blue",    bg: "bg-blue-100",    border: "border-blue-300",    dot: "bg-blue-400",    ring: "ring-blue-400" },
  { id: "green",   bg: "bg-emerald-100", border: "border-emerald-300", dot: "bg-emerald-400", ring: "ring-emerald-400" },
  { id: "purple",  bg: "bg-purple-100",  border: "border-purple-300",  dot: "bg-purple-400",  ring: "ring-purple-400" },
  { id: "orange",  bg: "bg-orange-100",  border: "border-orange-300",  dot: "bg-orange-400",  ring: "ring-orange-400" },
  { id: "cyan",    bg: "bg-cyan-100",    border: "border-cyan-300",    dot: "bg-cyan-400",    ring: "ring-cyan-400" },
  { id: "white",   bg: "bg-white",       border: "border-slate-200",   dot: "bg-slate-300",   ring: "ring-slate-400" },
];

const WIDGET_KEYS = ["workAllocated", "employeeProgress", "teamAllocation", "personalNotepad", "overdueTasks"] as const;
type WidgetKey = typeof WIDGET_KEYS[number];

const WIDGET_LABELS: Record<WidgetKey, string> = {
  workAllocated: "Work Allocated",
  employeeProgress: "Employee wise Progress",
  teamAllocation: "Team wise Allocation",
  personalNotepad: "Personal Notepad",
  overdueTasks: "Overdue Tasks",
};

// ─── Dropdown helpers ─────────────────────────────────────────────────────────
function useOutsideClick(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, cb]);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const { user } = useAuth();
  const router = useRouter();

  const usersQuery  = useQuery({ queryKey: ["users"],    queryFn: () => fetchUsers({ page: 1, pageSize: 100 }) });
  const tasksQuery  = useQuery({ queryKey: ["tasks"],    queryFn: fetchTasks });
  const reportsQuery= useQuery({ queryKey: ["reports"],  queryFn: () => fetchAllReports() });
  const projectsQuery=useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects() });
  const issuesQuery = useQuery({ queryKey: ["issues"],   queryFn: () => fetchIssues() });
  const formsQuery  = useQuery({ queryKey: ["forms"],    queryFn: () => fetchForms() });

  const employees = useMemo(() => usersQuery.data?.items  ?? [], [usersQuery.data]);
  const tasks     = useMemo(() => tasksQuery.data         ?? [], [tasksQuery.data]);
  const reports   = useMemo(() => reportsQuery.data       ?? [], [reportsQuery.data]);
  const projects  = useMemo(() => projectsQuery.data      ?? [], [projectsQuery.data]);
  const issues    = useMemo(() => issuesQuery.data        ?? [], [issuesQuery.data]);
  const forms     = useMemo(() => formsQuery.data         ?? [], [formsQuery.data]);

  // ── Widget visibility ──
  const [visibleWidgets, setVisibleWidgets] = useState<Record<WidgetKey, boolean>>({
    workAllocated: true,
    employeeProgress: true,
    teamAllocation: true,
    personalNotepad: true,
    overdueTasks: true,
  });
  const [showWidgetModal, setShowWidgetModal] = useState(false);

  // ── Tab state ──
  const [allocatedTab,  setAllocatedTab]  = useState("Tasks");
  const [progressTab,   setProgressTab]   = useState("Tasks");
  const [teamChartTab,  setTeamChartTab]  = useState("Tasks");
  const [notepadTab,    setNotepadTab]    = useState<"all" | "completed">("all");

  // ── Employee filter ──
  const [allocatedEmp,  setAllocatedEmp]  = useState<string | null>(null);
  const [progressEmp,   setProgressEmp]   = useState<string | null>(null);
  const [showAllocDrop, setShowAllocDrop] = useState(false);
  const [showProgDrop,  setShowProgDrop]  = useState(false);
  const allocDropRef = useRef<HTMLDivElement>(null!);
  const progDropRef  = useRef<HTMLDivElement>(null!);
  useOutsideClick(allocDropRef, () => setShowAllocDrop(false));
  useOutsideClick(progDropRef,  () => setShowProgDrop(false));

  // ── Three-dot menus ──
  const [openDot, setOpenDot] = useState<string | null>(null);
  const dotRef = useRef<HTMLDivElement>(null!);
  useOutsideClick(dotRef, () => setOpenDot(null));

  // ── Personal Notepad ──
  const [notes,         setNotes]         = useState<Note[]>([]);
  const [noteInput,     setNoteInput]     = useState("");
  const [noteColor,     setNoteColor]     = useState("yellow");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const noteInputRef = useRef<HTMLInputElement>(null);

  function addNote() {
    const txt = noteInput.trim();
    if (!txt) return;
    setNotes(prev => [{
      id: crypto.randomUUID(),
      text: txt,
      completed: false,
      createdAt: new Date().toISOString(),
      color: noteColor
    }, ...prev]);
    setNoteInput("");
    setNoteColor("yellow");
    setShowNoteInput(false);
  }

  function toggleNote(id: string) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, completed: !n.completed } : n));
  }

  function deleteNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  // ── Stats ──
  const stats = useMemo(() => ({
    projects:       projects.length,
    reports:        reports.length,
    totalTasks:     tasks.length,
    issues:         issues.length,
    forms:          forms.length,
    ongoingTasks:   tasks.filter(t => t.status === "IN_PROGRESS").length,
    overdueTasks:   tasks.filter(t => t.status !== "COMPLETED" && new Date(t.dueDate) < new Date()).length,
    completedTasks: tasks.filter(t => t.status === "COMPLETED").length,
    scheduledTasks: tasks.filter(t => t.status === "PENDING").length,
  }), [forms, issues, projects, reports, tasks]);

  // ── Team chart data ──
  const teamData = useMemo(() => {
    const byWorkMode = employees.reduce<Record<string, { name: string; tasks: number; issues: number }>>((acc, emp) => {
      const key = emp.workMode || "UNASSIGNED";
      acc[key] ??= { name: key.replace("_", " "), tasks: 0, issues: 0 };
      acc[key].tasks  += tasks.filter(t => t.assignedToId === emp.id).length;
      acc[key].issues += issues.filter(i => i.assigneeId  === emp.id).length;
      return acc;
    }, {});
    return Object.values(byWorkMode).length > 0
      ? Object.values(byWorkMode)
      : [{ name: "No data", tasks: 0, issues: 0 }];
  }, [employees, tasks, issues]);

  // ── Filtered tasks / issues for Work Allocated ──
  const filteredTasks  = allocatedEmp ? tasks.filter(t  => t.assignedToId === allocatedEmp) : tasks;
  const filteredIssues = allocatedEmp ? issues.filter(i => i.assigneeId   === allocatedEmp) : issues;
  const filteredForms  = forms; // forms have no per-employee filter in current schema

  // ── Filtered employees for Employee Progress ──
  const progressEmployees = progressEmp
    ? employees.filter(e => e.id === progressEmp)
    : employees.slice(0, 7);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const visibleNotes = notepadTab === "all" ? notes : notes.filter(n => n.completed);

  // ─── Dot-menu options per widget ──────────────────────────────────────────
  function DotMenu({ id, options }: { id: string; options: { label: string; icon: any; action: () => void; danger?: boolean }[] }) {
    const isOpen = openDot === id;
    return (
      <div className="relative" ref={isOpen ? dotRef : undefined}>
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-slate-400 hover:text-slate-700"
          onClick={() => setOpenDot(isOpen ? null : id)}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
        {isOpen && (
          <div className="absolute right-0 top-9 z-50 min-w-[170px] rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/60 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
            {options.map(opt => (
              <button
                key={opt.label}
                onClick={() => { opt.action(); setOpenDot(null); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors hover:bg-slate-50 text-left",
                  opt.danger ? "text-rose-600" : "text-slate-700"
                )}
              >
                <opt.icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Employee dropdown ─────────────────────────────────────────────────────
  function EmpDropdown({
    selected, onSelect, show, setShow, dropRef
  }: {
    selected: string | null;
    onSelect: (id: string | null) => void;
    show: boolean;
    setShow: (v: boolean) => void;
    dropRef: React.RefObject<HTMLDivElement>;
  }) {
    const emp = employees.find(e => e.id === selected);
    return (
      <div className="relative" ref={dropRef}>
        <button
          onClick={() => setShow(!show)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors"
        >
          <span className="text-xs font-bold text-slate-600">{emp?.name ?? "All Employees"}</span>
          <ChevronDown className={cn("h-3 w-3 text-slate-400 transition-transform", show && "rotate-180")} />
        </button>
        {show && (
          <div className="absolute right-0 top-9 z-50 min-w-[200px] max-h-60 overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/60 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
            <button
              onClick={() => { onSelect(null); setShow(false); }}
              className={cn("w-full text-left px-4 py-2.5 text-xs font-bold transition-colors hover:bg-slate-50",
                !selected ? "text-blue-600" : "text-slate-700")}
            >
              All Employees
            </button>
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => { onSelect(emp.id); setShow(false); }}
                className={cn("w-full text-left px-4 py-2.5 text-xs font-bold transition-colors hover:bg-slate-50",
                  selected === emp.id ? "text-blue-600" : "text-slate-700")}
              >
                {emp.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{greeting}{user?.name ? `, ${user.name}` : ""}</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Here is what&apos;s happening with your projects today.</p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl border-slate-200 bg-white font-bold text-slate-600 gap-2 h-10 shadow-sm hover:bg-slate-50"
          onClick={() => setShowWidgetModal(true)}
        >
          <Plus className="h-4 w-4" /> Add Widget
        </Button>
      </div>

      {/* ── Widget Modal ────────────────────────────────────────────────────── */}
      {showWidgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowWidgetModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-black text-slate-900 mb-1">Manage Widgets</h2>
            <p className="text-xs text-slate-500 font-medium mb-6">Toggle which sections appear on your dashboard.</p>
            <div className="space-y-3">
              {WIDGET_KEYS.map(key => (
                <div key={key} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <span className="text-sm font-bold text-slate-800">{WIDGET_LABELS[key]}</span>
                  <button
                    onClick={() => setVisibleWidgets(v => ({ ...v, [key]: !v[key] }))}
                    className={cn(
                      "h-7 w-12 rounded-full transition-all duration-300 relative",
                      visibleWidgets[key] ? "bg-blue-600" : "bg-slate-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-300",
                      visibleWidgets[key] ? "left-6" : "left-1"
                    )} />
                  </button>
                </div>
              ))}
            </div>
            <Button className="w-full mt-6 rounded-xl h-11 font-bold bg-blue-600 hover:bg-blue-700" onClick={() => setShowWidgetModal(false)}>
              Done
            </Button>
          </div>
        </div>
      )}

      {/* ── AI Banner ───────────────────────────────────────────────────────── */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-100 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
        <div className="flex items-start gap-4 z-10">
          <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
            <BrainCircuit className="h-6 w-6 text-blue-200 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest bg-blue-500/30 px-2 py-0.5 rounded-full border border-blue-400/20">AI Operations Co-Pilot</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h2 className="text-lg font-black mt-1">Smart Operational Insights</h2>
            <p className="text-xs text-blue-100 max-w-xl font-medium leading-relaxed mt-1">
              Live: <strong className="text-white">{employees.length}</strong> users, <strong className="text-white">{stats.totalTasks}</strong> tasks, <strong className="text-white">{stats.issues}</strong> issues — <strong className="text-white">{stats.overdueTasks}</strong> overdue tasks need attention.
            </p>
          </div>
        </div>
        <div className="flex gap-3 z-10 w-full md:w-auto justify-end">
          <Button variant="ghost" className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold h-10 px-4 text-xs" onClick={() => router.push("/attendance")}>
            View Track Map
          </Button>
          <Button className="rounded-xl bg-white text-blue-600 hover:bg-slate-50 font-bold h-10 px-5 shadow-lg text-xs" onClick={() => router.push("/tasks")}>
            Resolve Tasks
          </Button>
        </div>
      </div>

      {/* ── Stat Cards (all live data) ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <StatCard icon={Folder}        title={`${stats.projects} Projects`}  color="blue"   details={[
          { label: "Ongoing",   value: projects.filter(p => p.status === "Ongoing").length },
          { label: "Scheduled", value: projects.filter(p => p.status === "Scheduled").length },
          { label: "Completed", value: projects.filter(p => p.status === "Completed").length }
        ]} />
        <StatCard icon={BrainCircuit}  title={`${stats.reports} Reports`}    color="amber"  details={[
          { label: "Submitted",     value: stats.reports },
          { label: "Orders Taken",  value: reports.reduce((s, r) => s + (r.ordersTaken ?? 0), 0) },
          { label: "Km Travelled",  value: Math.round(reports.reduce((s, r) => s + (r.kmTravelled ?? 0), 0)) }
        ]} />
        <StatCard icon={ClipboardList} title={`${stats.totalTasks} Tasks`}   color="blue"   details={[
          { label: "Ongoing",   value: stats.ongoingTasks },
          { label: "Overdue",   value: stats.overdueTasks },
          { label: "Completed", value: stats.completedTasks },
          { label: "Scheduled", value: stats.scheduledTasks }
        ]} />
        <StatCard icon={AlertTriangle} title={`${stats.issues} Issues`}      color="rose"   details={[
          { label: "Open",       value: issues.filter(i => i.status?.toLowerCase() === "open").length },
          { label: "In Progress",value: issues.filter(i => ["in progress","in_progress"].includes(i.status?.toLowerCase())).length },
          { label: "Resolved",   value: issues.filter(i => ["resolved","closed"].includes(i.status?.toLowerCase())).length }
        ]} />
        <StatCard icon={FileSpreadsheet} title={`${stats.forms} Forms`}      color="indigo" details={[
          { label: "Total",     value: stats.forms },
          { label: "Published", value: forms.filter(f => f.status?.toLowerCase() === "published").length },
          { label: "Responses", value: forms.reduce((s, f) => s + (f._count?.responses ?? 0), 0) }
        ]} />
      </div>

      {/* ── Work Allocated + Employee Progress ─────────────────────────────── */}
      <div className="grid grid-cols-12 gap-8">

        {/* Work Allocated */}
        {visibleWidgets.workAllocated && (
          <div className="col-span-12 lg:col-span-7">
            <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-base font-black text-slate-900">Work Allocated</CardTitle>
                <div className="flex items-center gap-3">
                  <EmpDropdown
                    selected={allocatedEmp}
                    onSelect={setAllocatedEmp}
                    show={showAllocDrop}
                    setShow={setShowAllocDrop}
                    dropRef={allocDropRef}
                  />
                  <DotMenu id="workAllocated" options={[
                    { label: "View All Tasks",    icon: ExternalLink, action: () => router.push("/tasks") },
                    { label: "Hide Widget",       icon: EyeOff,       action: () => setVisibleWidgets(v => ({ ...v, workAllocated: false })) },
                  ]} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-8 border-b border-slate-100 pb-3 mb-6">
                  <TabItem label="Tasks"  count={filteredTasks.length}  active={allocatedTab === "Tasks"}  onClick={() => setAllocatedTab("Tasks")} />
                  <TabItem label="Issues" count={filteredIssues.length} active={allocatedTab === "Issues"} onClick={() => setAllocatedTab("Issues")} />
                  <TabItem label="Forms"  count={filteredForms.length}  active={allocatedTab === "Forms"}  onClick={() => setAllocatedTab("Forms")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {allocatedTab === "Tasks" && (
                    filteredTasks.length === 0
                      ? <div className="col-span-2 text-center py-12 text-slate-400 text-xs font-bold">No tasks allocated</div>
                      : filteredTasks.slice(0, 10).map(task => (
                        <div key={task.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-blue-200 transition-all">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID #{task.id.slice(-6)}</span>
                            <span className="text-xs font-black text-slate-800 line-clamp-1">{task.title}</span>
                          </div>
                          <Badge className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-lg",
                            task.status === "IN_PROGRESS" ? "bg-amber-50 text-amber-600 border-amber-100" :
                            task.status === "PENDING"     ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                            "bg-emerald-50 text-emerald-600 border-emerald-100"
                          )}>
                            {task.status.replace("_", " ")}
                          </Badge>
                        </div>
                      ))
                  )}
                  {allocatedTab === "Issues" && (
                    filteredIssues.length === 0
                      ? <div className="col-span-2 text-center py-12 text-slate-400 text-xs font-bold">No issues reported</div>
                      : filteredIssues.slice(0, 10).map(issue => (
                        <div key={issue.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-blue-200 transition-all">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID #{issue.id.slice(-6)}</span>
                            <span className="text-xs font-black text-slate-800 line-clamp-1">{issue.title}</span>
                          </div>
                          <Badge className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-lg",
                            issue.status?.toLowerCase() === "open"                     ? "bg-rose-50 text-rose-600 border-rose-100" :
                            ["in progress","in_progress"].includes(issue.status?.toLowerCase()) ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-emerald-50 text-emerald-600 border-emerald-100"
                          )}>
                            {issue.status?.replace("_", " ")}
                          </Badge>
                        </div>
                      ))
                  )}
                  {allocatedTab === "Forms" && (
                    filteredForms.length === 0
                      ? <div className="col-span-2 text-center py-12 text-slate-400 text-xs font-bold">No forms published</div>
                      : filteredForms.slice(0, 10).map(form => (
                        <div key={form.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-blue-200 transition-all">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID #{form.id.slice(-6)}</span>
                            <span className="text-xs font-black text-slate-800 line-clamp-1">{form.name}</span>
                          </div>
                          <Badge className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-lg",
                            form.status?.toLowerCase() === "published" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            {form.status}
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Employee wise Progress */}
        {visibleWidgets.employeeProgress && (
          <div className="col-span-12 lg:col-span-5">
            <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-base font-black text-slate-900">Employee wise Progress</CardTitle>
                <div className="flex items-center gap-2">
                  <EmpDropdown
                    selected={progressEmp}
                    onSelect={setProgressEmp}
                    show={showProgDrop}
                    setShow={setShowProgDrop}
                    dropRef={progDropRef}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" onClick={() => router.push("/employees")}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <DotMenu id="employeeProgress" options={[
                    { label: "View All Employees", icon: ExternalLink, action: () => router.push("/employees") },
                    { label: "Hide Widget",        icon: EyeOff,       action: () => setVisibleWidgets(v => ({ ...v, employeeProgress: false })) },
                  ]} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 border-b border-slate-100 pb-3 mb-6">
                  {["Tasks","Issues","Forms"].map(tab => (
                    <button key={tab} onClick={() => setProgressTab(tab)}
                      className={cn("text-xs font-black uppercase tracking-wider pb-3 transition-all",
                        progressTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600")}
                    >{tab}</button>
                  ))}
                </div>
                <div className="overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                        <th className="pb-4">Name</th>
                        <th className="pb-4">Team</th>
                        {progressTab === "Tasks"  && <><th className="pb-4 text-center">Assigned</th><th className="pb-4 text-center">Ongoing</th><th className="pb-4 text-center">Done</th></>}
                        {progressTab === "Issues" && <><th className="pb-4 text-center">Assigned</th><th className="pb-4 text-center">Open</th><th className="pb-4 text-center">Resolved</th></>}
                        {progressTab === "Forms"  && <th className="pb-4 text-center" colSpan={3}>Reports</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {progressEmployees.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-xs text-slate-400 font-bold">No employees found</td></tr>
                      )}
                      {progressTab === "Tasks" && progressEmployees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 text-xs font-black text-slate-900">{emp.name}</td>
                          <td className="py-4"><span className="text-[10px] font-bold text-slate-500">{emp.workMode || "N/A"}</span></td>
                          <td className="py-4 text-center text-xs font-bold text-slate-600">{tasks.filter(t => t.assignedToId === emp.id).length}</td>
                          <td className="py-4 text-center text-xs font-bold text-slate-600">{tasks.filter(t => t.assignedToId === emp.id && t.status === "IN_PROGRESS").length}</td>
                          <td className="py-4 text-center text-xs font-bold text-slate-600">{tasks.filter(t => t.assignedToId === emp.id && t.status === "COMPLETED").length}</td>
                        </tr>
                      ))}
                      {progressTab === "Issues" && progressEmployees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 text-xs font-black text-slate-900">{emp.name}</td>
                          <td className="py-4"><span className="text-[10px] font-bold text-slate-500">{emp.workMode || "N/A"}</span></td>
                          <td className="py-4 text-center text-xs font-bold text-slate-600">{issues.filter(i => i.assigneeId === emp.id).length}</td>
                          <td className="py-4 text-center text-xs font-bold text-slate-600">{issues.filter(i => i.assigneeId === emp.id && i.status?.toLowerCase() === "open").length}</td>
                          <td className="py-4 text-center text-xs font-bold text-slate-600">{issues.filter(i => i.assigneeId === emp.id && ["resolved","closed"].includes(i.status?.toLowerCase())).length}</td>
                        </tr>
                      ))}
                      {progressTab === "Forms" && progressEmployees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 text-xs font-black text-slate-900">{emp.name}</td>
                          <td className="py-4"><span className="text-[10px] font-bold text-slate-500">{emp.workMode || "N/A"}</span></td>
                          <td className="py-4 text-center text-xs font-bold text-slate-600" colSpan={3}>{reports.filter(r => r.userId === emp.id).length} Reports</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Team Allocation + Personal Notepad ─────────────────────────────── */}
      <div className="grid grid-cols-12 gap-8">

        {/* Team wise Allocation */}
        {visibleWidgets.teamAllocation && (
          <div className="col-span-12 lg:col-span-7">
            <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-base font-black text-slate-900">Team wise Allocation</CardTitle>
                <DotMenu id="teamAllocation" options={[
                  { label: "View Tasks",   icon: ExternalLink, action: () => router.push("/tasks") },
                  { label: "View Issues",  icon: ExternalLink, action: () => router.push("/issues") },
                  { label: "Hide Widget",  icon: EyeOff,       action: () => setVisibleWidgets(v => ({ ...v, teamAllocation: false })) },
                ]} />
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 border-b border-slate-100 pb-3 mb-8">
                  {["Tasks","Issues"].map(tab => (
                    <button key={tab} onClick={() => setTeamChartTab(tab)}
                      className={cn("text-xs font-black uppercase tracking-wider pb-3 transition-all",
                        teamChartTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600")}
                    >{tab}</button>
                  ))}
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamData} barGap={12}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }} allowDecimals={false} />
                      {teamChartTab === "Tasks" ? (
                        <Bar dataKey="tasks" radius={[4,4,0,0]} barSize={32}>
                          {teamData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? "#2563EB" : "#D97706"} />)}
                        </Bar>
                      ) : (
                        <Bar dataKey="issues" radius={[4,4,0,0]} barSize={32}>
                          {teamData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? "#EF4444" : "#F59E0B"} />)}
                        </Bar>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Personal Notepad */}
        {visibleWidgets.personalNotepad && (
          <div className="col-span-12 lg:col-span-5 space-y-8">
            <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-base font-black text-slate-900">Personal Notepad</CardTitle>
                <DotMenu id="personalNotepad" options={[
                  { label: "New Note",    icon: PenLine,  action: () => { setShowNoteInput(true); setTimeout(() => noteInputRef.current?.focus(), 50); } },
                  { label: "Clear All",  icon: Trash2,   action: () => setNotes([]), danger: true },
                  { label: "Hide Widget",icon: EyeOff,   action: () => setVisibleWidgets(v => ({ ...v, personalNotepad: false })) },
                ]} />
              </CardHeader>
              <CardContent>
                {/* Tabs */}
                <div className="flex gap-6 border-b border-slate-100 pb-3 mb-5">
                  <button
                    onClick={() => setNotepadTab("all")}
                    className={cn("text-xs font-black uppercase tracking-wider pb-3 transition-all",
                      notepadTab === "all" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600")}
                  >All <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-slate-100">{notes.length}</span></button>
                  <button
                    onClick={() => setNotepadTab("completed")}
                    className={cn("text-xs font-black uppercase tracking-wider pb-3 transition-all",
                      notepadTab === "completed" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600")}
                  >Completed <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-slate-100">{notes.filter(n => n.completed).length}</span></button>
                </div>

                {/* Inline note input */}
                {showNoteInput && (() => {
                  const activeColor = NOTE_COLORS.find(c => c.id === noteColor) ?? NOTE_COLORS[0];
                  return (
                    <div className={cn(
                      "mb-4 rounded-2xl border p-3 animate-in fade-in slide-in-from-top-1 duration-150 transition-colors",
                      activeColor.bg, activeColor.border
                    )}>
                      {/* Color swatches */}
                      <div className="flex items-center gap-1.5 mb-3">
                        {NOTE_COLORS.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setNoteColor(c.id)}
                            className={cn(
                              "h-5 w-5 rounded-full transition-all duration-150",
                              c.dot,
                              noteColor === c.id
                                ? cn("ring-2 ring-offset-1 scale-125", c.ring)
                                : "hover:scale-110"
                            )}
                          />
                        ))}
                      </div>
                      {/* Text input row */}
                      <div className="flex items-center gap-2">
                        <input
                          ref={noteInputRef}
                          value={noteInput}
                          onChange={e => setNoteInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") addNote(); if (e.key === "Escape") setShowNoteInput(false); }}
                          placeholder="Write your note..."
                          className="flex-1 bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-500 outline-none"
                        />
                        <button onClick={addNote} className="h-7 w-7 rounded-xl bg-slate-700 flex items-center justify-center text-white hover:bg-slate-900 transition-colors">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setShowNoteInput(false)} className="h-7 w-7 rounded-xl bg-white/60 flex items-center justify-center text-slate-600 hover:bg-white transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Notes list */}
                {visibleNotes.length === 0 ? (
                  <div className="py-10 flex flex-col items-center justify-center text-center opacity-50">
                    <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
                      <StickyNote className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 mb-4">
                      {notepadTab === "completed" ? "No completed notes yet" : "No notes yet, your ideas are waiting!"}
                    </p>
                    {notepadTab === "all" && (
                      <button
                        onClick={() => { setShowNoteInput(true); setTimeout(() => noteInputRef.current?.focus(), 50); }}
                        className="relative inline-flex items-center gap-2 px-5 py-2 rounded-2xl font-black text-sm text-white overflow-hidden group transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                        style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444, #ec4899, #8b5cf6, #3b82f6)" }}
                      >
                        {/* Animated shimmer overlay */}
                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                        <span className="relative flex items-center gap-1.5">
                          <span className="text-lg leading-none">✦</span>
                          Create Notes
                        </span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {visibleNotes.map(note => {
                      const nc = NOTE_COLORS.find(c => c.id === note.color) ?? NOTE_COLORS[7];
                      return (
                        <div
                          key={note.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-2xl group transition-all border",
                            note.completed ? "bg-slate-50 border-slate-100 opacity-60" : cn(nc.bg, nc.border)
                          )}
                        >
                          <button onClick={() => toggleNote(note.id)} className="mt-0.5 flex-shrink-0 text-slate-500 hover:text-emerald-600 transition-colors">
                            {note.completed
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              : <Circle className="h-4 w-4" />
                            }
                          </button>
                          <span className={cn("flex-1 text-xs font-bold text-slate-700 leading-relaxed",
                            note.completed && "line-through text-slate-400"
                          )}>{note.text}</span>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add note button at bottom */}
                {notes.length > 0 && !showNoteInput && (
                  <button
                    onClick={() => { setShowNoteInput(true); setTimeout(() => noteInputRef.current?.focus(), 50); }}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-slate-200 text-xs font-bold text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Note
                  </button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Overdue Tasks Table ─────────────────────────────────────────────── */}
      {visibleWidgets.overdueTasks && (
        <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 bg-slate-50/30">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base font-black text-slate-900">Overdue tasks</CardTitle>
              <Badge className="bg-rose-50 text-rose-600 border-rose-100 font-black px-2 py-0.5 rounded-lg">{stats.overdueTasks}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" onClick={() => router.push("/tasks")}>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <DotMenu id="overdueTasks" options={[
                { label: "View All Tasks", icon: ExternalLink, action: () => router.push("/tasks") },
                { label: "Hide Widget",    icon: EyeOff,       action: () => setVisibleWidgets(v => ({ ...v, overdueTasks: false })) },
              ]} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {tasks.filter(t => t.status !== "COMPLETED" && new Date(t.dueDate) < new Date()).length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-bold">🎉 No overdue tasks! Great work.</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-4 px-8">Task Name</th>
                    <th className="py-4 px-6">Assigned To</th>
                    <th className="py-4 px-6 text-center">Status</th>
                    <th className="py-4 px-8 text-right">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tasks.filter(t => t.status !== "COMPLETED" && new Date(t.dueDate) < new Date()).slice(0, 5).map(task => (
                    <tr key={task.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-5 px-8 text-xs font-black text-slate-700">{task.title}</td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-blue-600 text-[10px] text-white font-bold">{task.assignedTo?.name?.[0] ?? "?"}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-bold text-slate-600">{task.assignedTo?.name ?? "Unassigned"}</span>
                        </div>
                      </td>
                      <td className="py-5 px-6 text-center">
                        <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 font-black text-[10px] uppercase px-3 py-1 rounded-lg">Overdue</Badge>
                      </td>
                      <td className="py-5 px-8 text-right text-xs font-black text-slate-500 tracking-tighter">
                        {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, title, color, details }: any) {
  const colors: any = {
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber:   "bg-amber-50 text-amber-600 ring-amber-100",
    blue:    "bg-blue-50 text-blue-600 ring-blue-100",
    rose:    "bg-rose-50 text-rose-600 ring-rose-100",
    indigo:  "bg-indigo-50 text-indigo-600 ring-indigo-100",
  };
  return (
    <Card className="border-none shadow-sm ring-1 ring-slate-200/50 hover:ring-slate-300 transition-all cursor-pointer">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center ring-1", colors[color])}>
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-sm font-black text-slate-900">{title}</p>
        </div>
        <div className="space-y-2.5">
          {details.map((d: any) => (
            <div key={d.label} className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d.label}</span>
              <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-md",
                d.value > 0 ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"
              )}>{d.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── TabItem ──────────────────────────────────────────────────────────────────
function TabItem({ label, count, active, onClick }: any) {
  return (
    <button onClick={onClick}
      className={cn("text-xs font-black uppercase tracking-wider pb-3 border-b-2 transition-all",
        active ? "text-blue-600 border-blue-600" : "text-slate-400 border-transparent hover:text-slate-600")}
    >
      <span className="flex items-center gap-2">
        {label}
        <span className={cn("px-1.5 py-0.5 rounded-md text-[9px]", active ? "bg-blue-50" : "bg-slate-50")}>{count}</span>
      </span>
    </button>
  );
}
