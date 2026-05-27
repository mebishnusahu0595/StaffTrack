"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Briefcase, 
  Clock, 
  Coffee, 
  Calendar, 
  Fingerprint, 
  Laptop, 
  Wifi, 
  WifiOff, 
  Check, 
  X, 
  Search, 
  SlidersHorizontal,
  ArrowRight,
  TrendingUp,
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fetchAttendanceDashboardSummary, approveAttendanceRequest, rejectAttendanceRequest } from "@/lib/api";

export default function AttendanceDashboardPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeShiftTab, setActiveShiftTab] = useState("All");
  
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [showFilters, setShowFilters] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["attendanceDashboard", selectedDate],
    queryFn: () => fetchAttendanceDashboardSummary(selectedDate),
    refetchInterval: 15000 // auto refresh every 15s to keep sync status live!
  });

  const approveMutation = useMutation({
    mutationFn: approveAttendanceRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendanceDashboard"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to approve adjustment request.");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: rejectAttendanceRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendanceDashboard"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to reject adjustment request.");
    }
  });

  const stats = data?.stats || {
    totalEmployees: 0,
    currentlyWorking: 0,
    onBreak: 0,
    timeOff: 0,
    pendingBiometrics: 0
  };

  const quickSummary = data?.quickSummary || [];
  const shiftWise = data?.shiftWise || [];
  const departmentWise = data?.departmentWise || [];
  const devices = data?.devices || [];
  const pendingApprovals = data?.pendingApprovals || [];

  // Extract unique departments from the summary data
  const departments = Array.from(
    new Set(quickSummary.map((row: any) => row.department).filter(Boolean))
  ) as string[];

  // Filtering quickSummary
  const filteredSummary = quickSummary.filter((row: any) => {
    // Search filter
    const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          row.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          row.designation.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Shift tab filter
    const matchesShift = activeShiftTab === "All" || row.shift === activeShiftTab;

    // Department filter
    const matchesDept = selectedDepartment === "All" || row.department === selectedDepartment;

    // Status filter
    let matchesStatus = true;
    if (selectedStatus === "Checked In") {
      matchesStatus = row.firstPunch !== "-";
    } else if (selectedStatus === "Not In Yet") {
      matchesStatus = row.firstPunch === "-";
    }

    return matchesSearch && matchesShift && matchesDept && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
            Attendance Dashboard
          </h1>
          <p className="text-slate-500 text-sm">
            Live overview of employees working status, biometric device synchronizations, and approval requests.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm ring-1 ring-slate-200/50">
            <Calendar className="h-4 w-4 text-blue-600" />
            <Input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-none p-0 h-auto focus-visible:ring-0 text-sm font-bold text-slate-700 bg-transparent w-36"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { title: "Total Employees", value: stats.totalEmployees, desc: "Registered workforce", icon: Users, color: "from-blue-500 to-indigo-600", bg: "bg-blue-50/50" },
          { title: "Currently Working", value: stats.currentlyWorking, desc: "On site checking-ins", icon: Briefcase, color: "from-emerald-500 to-teal-600", bg: "bg-emerald-50/50" },
          { title: "On Break", value: stats.onBreak, desc: "Currently out on break", icon: Coffee, color: "from-amber-500 to-orange-600", bg: "bg-amber-50/50" },
          { title: "Time Off", value: stats.timeOff, desc: "Approved leave days", icon: Clock, color: "from-rose-500 to-pink-600", bg: "bg-rose-50/50" },
          { title: "Pending Biometrics", value: stats.pendingBiometrics, desc: "Needs biometric verification", icon: Fingerprint, color: "from-violet-500 to-purple-600", bg: "bg-violet-50/50" }
        ].map((kpi, idx) => (
          <Card key={idx} className="border-none shadow-sm shadow-slate-100 ring-1 ring-slate-100 overflow-hidden hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex flex-col justify-between h-full relative">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {kpi.title}
                </span>
                <div className={`p-2.5 rounded-xl ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 bg-gradient-to-r ${kpi.color} bg-clip-text text-transparent`} />
                </div>
              </div>
              <div className="mt-4">
                <span className={`text-3xl font-black bg-gradient-to-r ${kpi.color} bg-clip-text text-transparent tracking-tight`}>
                  {isLoading ? "..." : kpi.value}
                </span>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                  {kpi.desc}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Attendance Summary Table */}
      <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden bg-white">
        <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                Quick Attendance Summary
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time check-in and shift metrics for the selected date.
              </CardDescription>
            </div>
            
            {/* Shift Sub-Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-fit">
              {["All", "Open Shift", "Default Shift", "NIGHT"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveShiftTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeShiftTab === tab 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search by Employee ID, Name or Designation..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl border-slate-200 text-xs shadow-sm bg-white focus-visible:ring-blue-600"
              />
            </div>
            <Button 
              variant={showFilters ? "default" : "outline"} 
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 rounded-xl border border-slate-200 font-bold text-xs gap-2 ${showFilters ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100/80 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Department</Label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="All">All Departments</option>
                  {departments.map((dept: any) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</Label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Checked In">Checked In</option>
                  <option value="Not In Yet">Not In Yet</option>
                </select>
              </div>
            </div>
          )}
        </CardHeader>

        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="border-slate-100">
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 w-[120px]">Employee ID</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Employee Name</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Department</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Designation</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">First Punch</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Last Punch</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Total Working Hours</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Total Break Hours</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Overtime Hour</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading dynamic logs...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredSummary.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                    <Users className="h-10 w-10 opacity-20" />
                    <span className="text-xs font-bold uppercase tracking-widest">No attendance records found</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredSummary.map((row: any) => (
                <TableRow key={row.id} className="hover:bg-slate-50/50 border-slate-50 transition-colors">
                  <TableCell className="py-4 px-6">
                    <Badge variant="outline" className="font-mono text-slate-600 rounded-md bg-slate-50 border-slate-200 text-xs px-2.5">
                      #{row.employeeId}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 border border-slate-100 shadow-sm ring-1 ring-white">
                        <AvatarFallback className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 font-bold text-[10px]">
                          {row.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-bold text-slate-900 text-sm">{row.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-6 text-slate-600 text-xs font-medium">{row.department}</TableCell>
                  <TableCell className="py-4 px-6 text-slate-500 text-xs">{row.designation}</TableCell>
                  <TableCell className="py-4 px-6">
                    <span className={`text-xs font-bold ${row.firstPunch !== "-" ? "text-emerald-600" : "text-slate-400"}`}>
                      {row.firstPunch !== "-" ? new Date(row.firstPunch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <span className={`text-xs font-bold ${row.lastPunch !== "-" ? "text-rose-600" : "text-slate-400"}`}>
                      {row.lastPunch !== "-" ? new Date(row.lastPunch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="py-4 px-6 text-center text-slate-700 text-xs font-bold">{row.workingHours}</TableCell>
                  <TableCell className="py-4 px-6 text-center text-slate-500 text-xs">{row.breakHours}</TableCell>
                  <TableCell className="py-4 px-6 text-center text-slate-500 text-xs">
                    {row.overtime !== "-" ? (
                      <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-50 border-none font-bold text-[10px] px-2 py-0.5">
                        {row.overtime}
                      </Badge>
                    ) : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Bottom Grid for Shiftwise Summary, Departmentwise Summary, Sync Device Status, and Pending Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Summaries Stack */}
        <div className="space-y-8">
          
          {/* Today's Shift Wise Attendance Summary */}
          <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden bg-white">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Today&apos;s Shift Wise Attendance Summary
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="py-3 px-5 text-[10px] font-black uppercase text-slate-400">Shift</TableHead>
                  <TableHead className="py-3 px-5 text-[10px] font-black uppercase text-slate-400 text-center">On Time</TableHead>
                  <TableHead className="py-3 px-5 text-[10px] font-black uppercase text-slate-400 text-center">Late</TableHead>
                  <TableHead className="py-3 px-5 text-[10px] font-black uppercase text-slate-400 text-center">Not In Yet</TableHead>
                  <TableHead className="py-3 px-5 text-[10px] font-black uppercase text-slate-400 text-center">Time Off</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-xs font-semibold text-slate-400">Loading shifts...</TableCell>
                  </TableRow>
                ) : shiftWise.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-xs font-semibold text-slate-300">No shift data found</TableCell>
                  </TableRow>
                ) : (
                  shiftWise.map((shiftRow: any, idx: number) => (
                    <TableRow key={idx} className="hover:bg-slate-50/30 border-slate-100">
                      <TableCell className="py-3 px-5 text-slate-800 text-xs font-bold">{shiftRow.shift}</TableCell>
                      <TableCell className="py-3 px-5 text-center text-xs font-bold text-emerald-600">{shiftRow.onTime}</TableCell>
                      <TableCell className="py-3 px-5 text-center text-xs font-bold text-amber-500">{shiftRow.late}</TableCell>
                      <TableCell className="py-3 px-5 text-center text-xs font-bold text-slate-400">{shiftRow.notInYet}</TableCell>
                      <TableCell className="py-3 px-5 text-center text-xs font-bold text-rose-500">{shiftRow.timeOff}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Today's Department Wise Attendance Summary */}
          <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden bg-white">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Today&apos;s Department Wise Attendance Summary
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="py-3 px-5 text-[10px] font-black uppercase text-slate-400">Department</TableHead>
                  <TableHead className="py-3 px-5 text-[10px] font-black uppercase text-slate-400 text-center">Checked In</TableHead>
                  <TableHead className="py-3 px-5 text-[10px] font-black uppercase text-slate-400 text-center">Not In Yet</TableHead>
                  <TableHead className="py-3 px-5 text-[10px] font-black uppercase text-slate-400 text-center">Time Off</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-xs font-semibold text-slate-400">Loading departments...</TableCell>
                  </TableRow>
                ) : departmentWise.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-xs font-semibold text-slate-300">No department data found</TableCell>
                  </TableRow>
                ) : (
                  departmentWise.map((deptRow: any, idx: number) => (
                    <TableRow key={idx} className="hover:bg-slate-50/30 border-slate-100">
                      <TableCell className="py-3 px-5 text-slate-800 text-xs font-bold">{deptRow.department}</TableCell>
                      <TableCell className="py-3 px-5 text-center text-xs font-bold text-emerald-600">{deptRow.checkedIn}</TableCell>
                      <TableCell className="py-3 px-5 text-center text-xs font-bold text-slate-400">{deptRow.notInYet}</TableCell>
                      <TableCell className="py-3 px-5 text-center text-xs font-bold text-rose-500">{deptRow.timeOff}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Biometrics Device Sync & Approvals Stack */}
        <div className="space-y-8">
          
          {/* Device Sync Status */}
          <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden bg-white">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Device Sync Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {devices.map((device: any, idx: number) => (
                <div key={device.id || idx} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl ring-1 ring-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${device.status === "Online" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                      {device.status === "Online" ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 text-sm">{device.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-0.5">ID: {device.macAddress}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <Badge className={device.status === "Online" ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-none" : "bg-slate-200 text-slate-600 hover:bg-slate-200 border-none"}>
                      {device.status}
                    </Badge>
                    <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                      Sync: {new Date(device.lastSync).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Pending Approvals
                </CardTitle>
              </div>
              <Badge className="bg-blue-600 text-white font-bold rounded-full">
                {pendingApprovals.length}
              </Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {isLoading ? (
                <div className="text-center py-10 text-xs font-semibold text-slate-400">Loading pending requests...</div>
              ) : pendingApprovals.length === 0 ? (
                <div className="text-center py-10 text-xs font-bold text-slate-300 uppercase tracking-widest">No pending adjustment approvals</div>
              ) : (
                pendingApprovals.map((req: any) => (
                  <div key={req.id} className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl ring-1 ring-slate-100 flex flex-col gap-3.5 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 ring-2 ring-white">
                          <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-bold">
                            {req.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm leading-none">{req.name}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">#{req.employeeId} / {req.designation}</span>
                        </div>
                      </div>
                      <Badge className="bg-amber-50 text-amber-600 hover:bg-amber-50 border-none font-bold text-[9px] uppercase tracking-wide">
                        Pending Approval
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 py-2.5 my-0.5">
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Request Date</span>
                        <p className="font-bold text-slate-700 mt-0.5">
                          {new Date(req.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">New Punch Time</span>
                        <p className="font-bold text-blue-600 mt-0.5">{req.newPunch}</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Reason</span>
                      <p className="text-xs text-slate-600 mt-1 italic">&quot;{req.reason}&quot;</p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rejectMutation.mutate(req.id)}
                        disabled={rejectMutation.isPending || approveMutation.isPending}
                        className="h-8 rounded-xl font-extrabold text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3.5"
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(req.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="h-8 rounded-xl bg-blue-600 font-extrabold text-xs text-white hover:bg-blue-700 px-3.5 shadow-md shadow-blue-100"
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}
