"use client";
 
import React, { Fragment, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  User as UserIcon, 
  Map as MapIcon, 
  Filter, 
  BarChart3, 
  Navigation,
  Download,
  PieChart as PieIcon,
  LayoutGrid,
  FileText,
  MousePointer2,
  Trophy,
  Target,
  Camera
} from "lucide-react";
import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Bar,
  BarChart
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchAllReports, fetchUsers } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

function PhotoViewer({ url, label, trigger }: { url: string; label: string; trigger: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none bg-transparent shadow-none">
        <div className="relative group">
          <div className="absolute top-4 left-4 z-10">
            <Badge className="bg-black/60 text-white border-none backdrop-blur-md px-3 py-1 font-black uppercase tracking-widest text-[10px]">
              {label} Photo
            </Badge>
          </div>
          <img 
            src={url} 
            className="w-full h-auto rounded-3xl shadow-2xl ring-1 ring-white/20" 
            alt={label} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
 
const COLORS = ["#3b82f6", "#f43f5e", "#10b981", "#f59e0b"];
 
export default function ReportsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [chartMetric, setChartMetric] = useState<"orders" | "distance">("orders");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const exportToCSV = () => {
    const headers = [
      "Agent Name",
      "Agent Email",
      "Cycle Date",
      "Orders Taken",
      "Orders Cancelled",
      "KM Travelled",
      "Submitted At",
      "Visits Summary",
      "Remarks"
    ];
    const rowsData = filteredRows.map(row => {
      const summaryClean = (row.visitsSummary || "").replace(/"/g, '""');
      const remarksClean = (row.remarks || "").replace(/"/g, '""');
      return [
        row.user?.name || "N/A",
        row.user?.email || "N/A",
        formatDate(row.date, "yyyy-MM-dd"),
        row.ordersTaken,
        row.ordersCancelled,
        row.kmTravelled,
        formatDateTime(row.submittedAt),
        `"${summaryClean}"`,
        `"${remarksClean}"`
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rowsData.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reports_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const usersQuery = useQuery({ 
    queryKey: ["users", "reports"], 
    queryFn: () => fetchUsers({ page: 1, pageSize: 100 }) 
  });
  const employees = useMemo(() => usersQuery.data?.items ?? [], [usersQuery.data?.items]);
 
  const reportsQuery = useQuery({
    queryKey: ["reports", "all"],
    queryFn: () => fetchAllReports()
  });
 
  const rows = useMemo(() => {
    return reportsQuery.data ?? [];
  }, [reportsQuery.data]);
 
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const dateValue = new Date(row.date).getTime();
      const matchesEmployee = employeeFilter === "all" || row.userId === employeeFilter;
      const matchesFrom = !fromDate || dateValue >= new Date(fromDate).getTime();
      const matchesTo = !toDate || dateValue <= new Date(toDate).getTime();
      return matchesEmployee && matchesFrom && matchesTo;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [employeeFilter, fromDate, rows, toDate]);
 
  // Graph Data
  const graphData = useMemo(() => {
    const daily: Record<string, { date: string; reports: number; orders: number; distance: number }> = {};
    filteredRows.forEach(row => {
      const d = formatDate(row.date, "MMM dd");
      if (!daily[d]) daily[d] = { date: d, reports: 0, orders: 0, distance: 0 };
      daily[d].reports += 1;
      daily[d].orders += row.ordersTaken;
      daily[d].distance += row.kmTravelled;
    });
    return Object.values(daily).slice(0, 10).reverse();
  }, [filteredRows]);
 
  const distributionData = useMemo(() => {
    const taken = filteredRows.reduce((sum, r) => sum + r.ordersTaken, 0);
    const cancelled = filteredRows.reduce((sum, r) => sum + r.ordersCancelled, 0);
    return [
      { name: "Orders Taken", value: taken },
      { name: "Cancelled", value: cancelled }
    ];
  }, [filteredRows]);
 
  const totalOrders = useMemo(() => filteredRows.reduce((sum, r) => sum + r.ordersTaken, 0), [filteredRows]);
  const totalCancelled = useMemo(() => filteredRows.reduce((sum, r) => sum + r.ordersCancelled, 0), [filteredRows]);
  const successRate = useMemo(() => {
    const totalDecisions = totalOrders + totalCancelled;
    return totalDecisions === 0 ? 0 : Math.round((totalOrders / totalDecisions) * 100);
  }, [totalCancelled, totalOrders]);
  const avgKm = useMemo(() => {
    if (filteredRows.length === 0) return 0;
    return filteredRows.reduce((sum, r) => sum + r.kmTravelled, 0) / filteredRows.length;
  }, [filteredRows]);
  const activeReporters = useMemo(() => {
    const byUser = new Map<string, { id: string; name: string; email: string }>();
    filteredRows.forEach((row) => {
      if (row.user) {
        byUser.set(row.user.id, row.user);
      }
    });
    return Array.from(byUser.values());
  }, [filteredRows]);
 
  const topPerformer = useMemo(() => {
    if (filteredRows.length === 0) return null;
    const scores: Record<string, number> = {};
    filteredRows.forEach(r => {
      scores[r.user?.name || ""] = (scores[r.user?.name || ""] || 0) + r.ordersTaken;
    });
    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return { name: winner[0], score: winner[1] };
  }, [filteredRows]);
 
  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Advanced Analytics</h1>
          <p className="mt-1 text-slate-500">Comprehensive field performance and efficiency tracking.</p>
        </div>
        <div className="flex items-center gap-3">
           <Button 
             variant="outline" 
             onClick={exportToCSV}
             className="h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-600 bg-white shadow-sm hover:shadow-md transition-all"
           >
              <Download className="h-4 w-4 mr-2 text-slate-400" />
              CSV
           </Button>
           <Button 
             onClick={handlePrint}
             className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 rounded-xl px-5 h-10 font-bold"
           >
              <FileText className="mr-2 h-4 w-4" />
              Full PDF Report
           </Button>
        </div>
      </div>

      {/* Printable Wrapper */}
      <div ref={printRef} className="space-y-8 print:p-8 bg-transparent">
        {/* Printable Header */}
        <div className="hidden print:flex items-center justify-between border-b pb-4 mb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Advanced Analytics Report</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">StaffTrack Performance Analytics</p>
          </div>
          <div className="text-right text-xs text-slate-400 font-bold">
            Printed on: {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Search & Intelligence Filters (now on top of graphs) */}
        <div className="flex flex-col md:flex-row gap-4 items-end print:hidden">
           <Card className="flex-1 border-none shadow-sm ring-1 ring-slate-200/50">
              <CardContent className="p-4 grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Target Employee</Label>
                  <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                    <SelectTrigger className="h-11 bg-slate-50/50 border-slate-100 rounded-xl focus:ring-blue-500 shadow-none text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                        <SelectValue placeholder="Global Search" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Global (All Employees)</SelectItem>
                      {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Date Range From</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-3.5 h-3.5 w-3.5 text-slate-400" />
                    <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-11 pl-10 bg-slate-50/50 border-slate-100 rounded-xl text-xs font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Date Range To</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-3.5 h-3.5 w-3.5 text-slate-400" />
                    <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-11 pl-10 bg-slate-50/50 border-slate-100 rounded-xl text-xs font-bold" />
                  </div>
                </div>
              </CardContent>
           </Card>
           <Button variant="outline" className="h-14 w-14 rounded-2xl border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
              <Filter className="h-6 w-6" />
           </Button>
        </div>
 
      {/* Top Level Intelligence Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-none shadow-sm ring-1 ring-slate-200/50 transition-all hover:ring-blue-200">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Success Rate</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-900">{successRate}%</p>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold text-[9px]">{totalOrders} WON</Badge>
            </div>
            <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${successRate}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200/50 transition-all hover:ring-blue-200">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Coverage</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-900">{avgKm.toFixed(1)} <span className="text-xs text-slate-400 uppercase">km</span></p>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <Navigation className="h-3 w-3 text-blue-500" />
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{filteredRows.length} reports</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200/50 transition-all hover:ring-blue-200">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Performer</p>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
                 <Trophy className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 leading-tight">{topPerformer?.name || "N/A"}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{topPerformer?.score || 0} orders in filter</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200/50 transition-all hover:ring-blue-200">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Report Density</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-900">{filteredRows.length}</p>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Entries</span>
            </div>
            <div className="mt-4 flex -space-x-2">
               {activeReporters.slice(0, 4).map((employee) => (
                 <Avatar key={employee.id} className="h-6 w-6 border-2 border-white ring-1 ring-slate-100">
                    <AvatarFallback className="text-[8px] font-black">{employee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                 </Avatar>
               ))}
               <div className="h-6 w-6 rounded-full bg-slate-50 border-2 border-white ring-1 ring-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">+{Math.max(activeReporters.length - 4, 0)}</div>
            </div>
          </CardContent>
        </Card>
      </div>
 
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Main Performance Chart */}
        <Card className="lg:col-span-8 border-none shadow-sm ring-1 ring-slate-200/50 overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-white/50 py-5 px-8">
            <div className="flex items-center justify-between">
               <div className="space-y-1">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                    Trend Analysis
                 </CardTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Daily output comparison</p>
               </div>
               <Tabs defaultValue="orders" className="w-[200px]" onValueChange={(v) => setChartMetric(v as any)}>
                  <TabsList className="bg-slate-100 p-1 rounded-xl h-9">
                    <TabsTrigger value="orders" className="rounded-lg font-bold text-[9px] uppercase px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">Orders</TabsTrigger>
                    <TabsTrigger value="distance" className="rounded-lg font-bold text-[9px] uppercase px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">Distance</TabsTrigger>
                  </TabsList>
               </Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="min-h-[340px] w-full">
              <ResponsiveContainer width="100%" height={320} minWidth={0}>
                <AreaChart data={graphData}>
                  <defs>
                    <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartMetric === "orders" ? "#3b82f6" : "#8b5cf6"} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={chartMetric === "orders" ? "#3b82f6" : "#8b5cf6"} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} 
                    dy={12}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} 
                  />
                  <Tooltip 
                    cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                    contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
                    itemStyle={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={chartMetric} 
                    stroke={chartMetric === "orders" ? "#3b82f6" : "#8b5cf6"} 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorPrimary)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
 
        {/* Visit Distribution Chart */}
        <Card className="lg:col-span-4 border-none shadow-sm ring-1 ring-slate-200/50 overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-white/50 py-5 px-8">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
               <PieIcon className="h-4 w-4 text-rose-500" />
               Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="min-h-[240px] w-full">
              <ResponsiveContainer width="100%" height={220} minWidth={0}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px', fontWeight: 700 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-6">
               {distributionData.map((item, idx) => (
                 <div key={item.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                    <div className="flex items-center gap-2">
                       <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                       <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{item.name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-900">{item.value}</span>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </div>
 
      {/* Search & Intelligence Filters removed from bottom */}
 
      {/* Intelligent Data Table */}
      <Card className="border-none shadow-sm ring-1 ring-slate-200/50 overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50/30">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="w-[70px]" />
              <TableHead className="py-5 text-[10px] font-black tracking-widest text-slate-400 uppercase">Agent Identity</TableHead>
              <TableHead className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Cycle Date</TableHead>
              <TableHead className="text-[10px] font-black tracking-widest text-slate-400 uppercase text-center">Outcome</TableHead>
              <TableHead className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Mobility</TableHead>
              <TableHead className="text-right px-10 text-[10px] font-black tracking-widest text-slate-400 uppercase">Submission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length > 0 ? (
              filteredRows.map((row) => {
                const isExpanded = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <TableRow className={cn(
                      "border-slate-50 hover:bg-slate-50/30 transition-all duration-300", 
                      isExpanded && "bg-blue-50/30 border-blue-100"
                    )}>
                      <TableCell className="px-6">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn(
                            "h-10 w-10 rounded-xl transition-all",
                            isExpanded ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "text-slate-300 hover:bg-white hover:shadow-sm"
                          )}
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-11 w-11 border-2 border-white shadow-sm ring-1 ring-slate-100">
                            <AvatarFallback>{row.user?.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                             <span className="font-black text-slate-900 text-sm tracking-tight">{row.user?.name}</span>
                             <span className="text-[10px] font-bold text-slate-400 tracking-tighter mt-0.5">{row.user?.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-slate-600 text-xs">{formatDate(row.date, "MMM dd, yyyy")}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-2">
                           <div className="flex items-center gap-1.5">
                              <span className="font-black text-slate-900 text-base">{row.ordersTaken}</span>
                              <div className="h-5 w-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                 <Target className="h-3 w-3" />
                              </div>
                           </div>
                           <Badge variant="outline" className="h-5 px-2 text-[8px] font-black uppercase bg-slate-50 text-slate-400 border-slate-100">
                             {row.ordersCancelled} CANCELLED
                           </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <div className="p-2 rounded-lg bg-blue-50">
                              <MapIcon className="h-3.5 w-3.5 text-blue-600" />
                           </div>
                           <div className="flex flex-col">
                              <span className="font-black text-slate-900 text-sm">{row.kmTravelled.toFixed(1)} km</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Coverage</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-10">
                        <div className="flex flex-col items-end">
                           <span className="text-xs font-black text-slate-800">{formatDateTime(row.submittedAt, "hh:mm a")}</span>
                           <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{formatDate(row.submittedAt)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-slate-50/20 border-none">
                        <TableCell colSpan={6} className="p-0 border-none">
                          <div className="px-24 py-12 grid gap-12 md:grid-cols-2 animate-in fade-in zoom-in-95 duration-500">
                            <div className="relative">
                               <div className="absolute -left-6 top-0 bottom-0 w-1 bg-blue-600/20 rounded-full" />
                               <div className="space-y-4">
                                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 flex items-center gap-3">
                                     Cycle Summary & Logs
                                     <div className="h-px flex-1 bg-blue-100" />
                                  </div>
                                  <div className="p-6 rounded-[2rem] bg-white ring-1 ring-slate-100 shadow-xl shadow-slate-200/20 text-sm text-slate-600 leading-relaxed font-semibold italic border-l-4 border-blue-500">
                                    {row.visitsSummary}
                                  </div>
                                  
                                  {row.kmPhotoUrl && (
                                    <div className="mt-6 space-y-4">
                                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-3">
                                         Odometer Verification
                                         <div className="h-px flex-1 bg-emerald-100" />
                                      </div>
                                      <div className={cn(
                                        "flex items-center justify-center gap-2 px-3 py-1 rounded-full border w-fit mx-auto",
                                        row.user?.workMode === "FIELD" 
                                          ? "bg-blue-50 text-blue-600 border-blue-100" 
                                          : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                      )}>
                                        <PhotoViewer 
                                          url={row.kmPhotoUrl} 
                                          label="Odometer" 
                                          trigger={
                                            <div className="relative group w-48 h-32 rounded-2xl overflow-hidden border-2 border-emerald-100 cursor-pointer shadow-lg hover:ring-4 hover:ring-emerald-500/20 transition-all">
                                              <img src={row.kmPhotoUrl} className="w-full h-full object-cover" alt="Odometer" />
                                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Camera className="h-6 w-6 text-white" />
                                              </div>
                                            </div>
                                          }
                                        />
                                      </div>
                                    </div>
                                  )}
                               </div>
                            </div>
                            <div className="space-y-4">
                               <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-3">
                                  Management Directives
                                  <div className="h-px flex-1 bg-indigo-100" />
                               </div>
                               <div className="p-8 rounded-[2rem] bg-white ring-1 ring-slate-100 shadow-xl shadow-slate-200/20">
                                  <div className="text-sm text-slate-600 leading-relaxed font-semibold mb-6">
                                    {row.remarks || "No management directives recorded for this reporting cycle."}
                                  </div>
                                  <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                                     <div className="flex items-center gap-2">
                                        <MousePointer2 className="h-3.5 w-3.5 text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Audit Verified</span>
                                     </div>
                                     <Button variant="ghost" size="sm" className="h-8 rounded-lg text-blue-600 font-bold text-[10px] uppercase">
                                        Add Feedback
                                     </Button>
                                  </div>
                               </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-64">
                   <div className="flex flex-col items-center justify-center text-center p-12">
                      <div className="h-16 w-16 rounded-3xl bg-slate-50 flex items-center justify-center mb-4 ring-1 ring-slate-100">
                         <LayoutGrid className="h-8 w-8 text-slate-300" />
                      </div>
                      <h3 className="text-lg font-black text-slate-900">No Intelligence Available</h3>
                      <p className="text-xs text-slate-400 font-bold mt-1 max-w-[240px]">No reports match your current filter criteria.</p>
                      <Button variant="outline" className="mt-6 h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-600" onClick={() => { setEmployeeFilter("all"); setFromDate(""); setToDate(""); }}>
                         Reset All Filters
                      </Button>
                   </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      </div>
    </div>
  );
}
 
function Label({ children, className }: { children: React.ReactNode, className?: string }) {
  return <label className={cn("block text-sm font-medium leading-none", className)}>{children}</label>;
}
