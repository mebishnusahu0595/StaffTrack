"use client";

import { useMemo, useState } from "react";
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
  Search,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchTasks, fetchUsers, fetchAllReports } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => fetchUsers({ page: 1, pageSize: 100 }) });
  const tasksQuery = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const reportsQuery = useQuery({ queryKey: ["reports"], queryFn: () => fetchAllReports() });

  const employees = usersQuery.data?.items ?? [];
  const tasks = tasksQuery.data ?? [];
  
  const stats = useMemo(() => ({
    projects: 4,
    aiReviews: 5,
    totalTasks: tasks.length,
    issues: 0,
    forms: 29,
    ongoingTasks: tasks.filter(t => t.status === "IN_PROGRESS").length,
    overdueTasks: tasks.filter(t => t.status !== "COMPLETED" && new Date(t.dueDate) < new Date()).length,
    completedTasks: tasks.filter(t => t.status === "COMPLETED").length,
    scheduledTasks: tasks.filter(t => t.status === "PENDING").length
  }), [tasks]);

  const teamData = [
    { name: "AGROTECH D...", tasks: 15, issues: 5 },
    { name: "Vaniki Cro...", tasks: 8, issues: 2 },
    { name: "Agrotech", tasks: 45, issues: 15 },
    { name: "Indraprast...", tasks: 48, issues: 18 }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Good Afternoon ! Deepika Tandulkar</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Here is what&apos;s happening with your projects today.</p>
        </div>
        <Button variant="outline" className="rounded-xl border-slate-200 bg-white font-bold text-slate-600 gap-2 h-10 shadow-sm">
          <Plus className="h-4 w-4" /> Add Widget
        </Button>
      </div>

      {/* AI Operations Co-Pilot Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-100 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
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
              Deepika, based on today&apos;s logs: <strong className="text-white">{employees.find(e => e.role === "EMPLOYEE")?.name ?? "Aarav Mehta"}</strong> is highly active with <strong className="text-white">15.5 km</strong> logged. Team attendance is steady at <strong className="text-white">92%</strong> today. There are <strong className="text-white">{stats.overdueTasks} critical overdue tasks</strong> that require your immediate attention.
            </p>
          </div>
        </div>
        <div className="flex gap-3 z-10 w-full md:w-auto justify-end">
          <Button 
            variant="ghost" 
            className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold h-10 px-4 transition-transform hover:scale-105 active:scale-95 text-xs"
            onClick={() => window.location.href = '/attendance'}
          >
             View Track Map
          </Button>
          <Button 
            className="rounded-xl bg-white text-blue-600 hover:bg-slate-50 font-bold h-10 px-5 shadow-lg shadow-blue-900/10 transition-transform hover:scale-105 active:scale-95 text-xs"
            onClick={() => window.location.href = '/tasks'}
          >
             Resolve Tasks
          </Button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <StatCard 
          icon={Folder} 
          title={`${stats.projects} Projects`} 
          color="blue" 
          details={[{ label: "Tasks", value: 6 }, { label: "Subtasks", value: 1616 }, { label: "Steps", value: 7 }]} 
        />
        <StatCard 
          icon={BrainCircuit} 
          title={`${stats.aiReviews} AI Reviews`} 
          color="amber" 
          details={[{ label: "In Review", value: 0 }, { label: "Completed", value: 0 }, { label: "Need Review", value: 5 }]} 
        />
        <StatCard 
          icon={ClipboardList} 
          title={`${stats.totalTasks} Tasks`} 
          color="blue" 
          details={[{ label: "Ongoing", value: stats.ongoingTasks }, { label: "Overdue", value: stats.overdueTasks }, { label: "Completed", value: stats.completedTasks }, { label: "Scheduled", value: stats.scheduledTasks }]} 
        />
        <StatCard 
          icon={AlertTriangle} 
          title={`${stats.issues} Issues`} 
          color="rose" 
          details={[{ label: "Open", value: 0 }, { label: "Ignored", value: 0 }, { label: "Resolved", value: 0 }]} 
        />
        <StatCard 
          icon={FileSpreadsheet} 
          title={`${stats.forms} Forms`} 
          color="indigo" 
          details={[{ label: "Ongoing Tasks", value: 6 }, { label: "Open Responses", value: 296 }, { label: "Submitted Responses", value: 768 }]} 
        />
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left: Work Allocated */}
        <div className="col-span-12 lg:col-span-7">
          <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base font-black text-slate-900">Work Allocated</CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer">
                  <span className="text-xs font-bold text-slate-600">Selected Employee</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><MoreHorizontal className="h-5 w-5" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-8 border-b border-slate-100 pb-3 mb-6">
                <TabItem label="Tasks" count={21} active />
                <TabItem label="Issues" count={0} />
                <TabItem label="Forms" count={29} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {tasks.slice(0, 10).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-sm group hover:border-blue-200 transition-all">
                    <div className="flex items-center gap-3">
                       <div className="h-1.5 w-8 rounded-full bg-slate-200" />
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">ID #{task.id.slice(0, 6)}</span>
                    </div>
                    <Badge className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5 rounded-lg",
                      task.status === "IN_PROGRESS" ? "bg-amber-50 text-amber-600 border-amber-100" :
                      task.status === "PENDING" ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                      "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Employee wise Progress */}
        <div className="col-span-12 lg:col-span-5">
          <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base font-black text-slate-900">Employee wise Progress</CardTitle>
              <div className="flex items-center gap-3">
                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer">
                    <span className="text-xs font-bold text-slate-600">Selected Employee</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                 </div>
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><ExternalLink className="h-4 w-4" /></Button>
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><MoreHorizontal className="h-5 w-5" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 border-b border-slate-100 pb-3 mb-6">
                <button className="text-xs font-black text-blue-600 uppercase tracking-wider border-b-2 border-blue-600 pb-3">Tasks</button>
                <button className="text-xs font-black text-slate-400 uppercase tracking-wider pb-3">Issues</button>
                <button className="text-xs font-black text-slate-400 uppercase tracking-wider pb-3">Forms</button>
              </div>

              <div className="overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                      <th className="pb-4 font-black">Name</th>
                      <th className="pb-4 font-black">Team</th>
                      <th className="pb-4 font-black text-center">Assigned</th>
                      <th className="pb-4 font-black text-center">Ongoing</th>
                      <th className="pb-4 font-black text-center">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {employees.slice(0, 5).map((emp) => (
                      <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 text-xs font-black text-slate-900">{emp.name}</td>
                        <td className="py-4">
                           <span className="text-[10px] font-bold text-slate-500 leading-tight block max-w-[120px]">Indraprastha Petroleum</span>
                        </td>
                        <td className="py-4 text-center text-xs font-bold text-slate-600">7</td>
                        <td className="py-4 text-center text-xs font-bold text-slate-600">1</td>
                        <td className="py-4 text-center text-xs font-bold text-slate-600">0</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
         {/* Team wise Allocation */}
         <div className="col-span-12 lg:col-span-7">
            <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden h-full">
               <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-base font-black text-slate-900">Team wise Allocation</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><MoreHorizontal className="h-5 w-5" /></Button>
               </CardHeader>
               <CardContent>
                  <div className="flex gap-6 border-b border-slate-100 pb-3 mb-8">
                     <button className="text-xs font-black text-blue-600 uppercase tracking-wider border-b-2 border-blue-600 pb-3">Tasks</button>
                     <button className="text-xs font-black text-slate-400 uppercase tracking-wider pb-3">Issues</button>
                  </div>
                  <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={teamData} barGap={12}>
                           <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                              dy={10}
                           />
                           <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                              tickFormatter={(v) => `${v}%`}
                           />
                           <Bar dataKey="tasks" radius={[4, 4, 0, 0]} barSize={32}>
                              {teamData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={index > 1 ? "#2563EB" : "#D97706"} />
                              ))}
                           </Bar>
                           <Bar dataKey="issues" fill="#FCD34D" radius={[4, 4, 0, 0]} barSize={32} />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </CardContent>
            </Card>
         </div>

         {/* Personal Notepad / Overdue Tasks */}
         <div className="col-span-12 lg:col-span-5 space-y-8">
            <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
               <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-base font-black text-slate-900">Personal Notepad</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><MoreHorizontal className="h-5 w-5" /></Button>
               </CardHeader>
               <CardContent>
                  <div className="flex gap-6 border-b border-slate-100 pb-3 mb-6">
                     <button className="text-xs font-black text-blue-600 uppercase tracking-wider border-b-2 border-blue-600 pb-3">All</button>
                     <button className="text-xs font-black text-slate-400 uppercase tracking-wider pb-3">Completed</button>
                  </div>
                  <div className="py-12 flex flex-col items-center justify-center text-center opacity-40">
                     <div className="h-20 w-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
                        <FileSpreadsheet className="h-10 w-10 text-slate-400" />
                     </div>
                     <p className="text-sm font-bold text-slate-500">No notes yet, your ideas are waiting!</p>
                     <Button variant="outline" className="mt-4 rounded-xl font-bold border-slate-200 text-slate-600 h-9">+ Create Notes</Button>
                  </div>
               </CardContent>
            </Card>
         </div>
      </div>

      {/* Overdue Tasks Table */}
      <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
         <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 bg-slate-50/30">
            <div className="flex items-center gap-3">
               <CardTitle className="text-base font-black text-slate-900">Overdue tasks</CardTitle>
               <Badge className="bg-rose-50 text-rose-600 border-rose-100 font-black px-2 py-0.5 rounded-lg">99+</Badge>
            </div>
            <div className="flex items-center gap-2">
               <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><ExternalLink className="h-4 w-4" /></Button>
               <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><MoreHorizontal className="h-5 w-5" /></Button>
            </div>
         </CardHeader>
         <CardContent className="p-0">
            <table className="w-full text-left">
               <thead className="bg-slate-50/50">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     <th className="py-4 px-8 font-black">Task Name</th>
                     <th className="py-4 px-6 font-black">Assigned To</th>
                     <th className="py-4 px-6 font-black text-center">Status</th>
                     <th className="py-4 px-8 font-black text-right">Due To</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {tasks.filter(t => t.status !== "COMPLETED" && new Date(t.dueDate) < new Date()).slice(0, 5).map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/30 transition-colors">
                       <td className="py-5 px-8 text-xs font-black text-slate-700">{task.title}</td>
                       <td className="py-5 px-6">
                          <div className="flex items-center gap-2">
                             <Avatar className="h-6 w-6">
                                <AvatarFallback className="bg-blue-600 text-[10px] text-white font-bold">{task.assignedTo?.name?.[0]}</AvatarFallback>
                             </Avatar>
                             <span className="text-xs font-bold text-slate-600">{task.assignedTo?.name}</span>
                          </div>
                       </td>
                       <td className="py-5 px-6 text-center">
                          <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 font-black text-[10px] uppercase px-3 py-1 rounded-lg">Overdue</Badge>
                       </td>
                       <td className="py-5 px-8 text-right text-xs font-black text-slate-500 tracking-tighter">
                          {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, title, color, details }: any) {
  const colors: any = {
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
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
                <span className={cn(
                  "text-[10px] font-black px-2 py-0.5 rounded-md",
                  d.value > 0 ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"
                )}>
                  {d.value}
                </span>
             </div>
           ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TabItem({ label, count, active }: any) {
  return (
    <button className={cn(
      "text-xs font-black uppercase tracking-wider pb-3 border-b-2 transition-all",
      active ? "text-blue-600 border-blue-600" : "text-slate-400 border-transparent hover:text-slate-600"
    )}>
      <span className="flex items-center gap-2">
        {label} <span className={cn("px-1.5 py-0.5 rounded-md text-[9px]", active ? "bg-blue-50" : "bg-slate-50")}>{count}</span>
      </span>
    </button>
  );
}
