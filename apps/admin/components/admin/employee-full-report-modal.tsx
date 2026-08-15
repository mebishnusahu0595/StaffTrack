"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Award, 
  Navigation, 
  Phone, 
  Mail, 
  Battery, 
  FileText, 
  Eye, 
  Download, 
  ExternalLink,
  Coins,
  Gauge,
  Camera,
  Activity,
  Layers,
  Sparkles,
  Search
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FreeOsmMap, LocationPing } from "./free-osm-map";
import { 
  fetchTodayLocation, 
  fetchAttendance, 
  fetchAllAttendance, 
  fetchTasks, 
  fetchDerHistory 
} from "@/lib/api";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/auth";

interface EmployeeFullReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any | null;
  initialDate?: string;
}

export function EmployeeFullReportModal({
  isOpen,
  onClose,
  employee,
  initialDate
}: EmployeeFullReportModalProps) {
  const queryClient = useQueryClient();

  // Selected single date for day-by-day exploration
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || dayjs().format("YYYY-MM-DD")
  );

  // Active sub-tab inside the modal
  const [activeTab, setActiveTab] = useState<"gps" | "attendance" | "tasks" | "der">("gps");

  // Inspection modal for Form / Checklist responses on completed tasks
  const [inspectingTask, setInspectingTask] = useState<any | null>(null);

  // Photo viewer dialog
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; label: string } | null>(null);

  // Local search filter for tasks tab
  const [taskSearchQuery, setTaskSearchQuery] = useState("");

  // Targeted WebSocket live location state for ONLY this employee while modal is open
  const [liveLocationLogs, setLiveLocationLogs] = useState<LocationPing[]>([]);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  // Step 1 Day Backward
  const handlePrevDay = () => {
    setSelectedDate((prev) => dayjs(prev).subtract(1, "day").format("YYYY-MM-DD"));
  };

  // Step 1 Day Forward
  const handleNextDay = () => {
    setSelectedDate((prev) => dayjs(prev).add(1, "day").format("YYYY-MM-DD"));
  };

  // Set to Today
  const handleSetToday = () => {
    setSelectedDate(dayjs().format("YYYY-MM-DD"));
  };

  // 1. Fetch Location Logs for Selected Date
  const locationQuery = useQuery({
    queryKey: ["location", employee?.id, selectedDate],
    queryFn: () => fetchTodayLocation(employee.id, selectedDate),
    enabled: !!employee?.id && isOpen,
    staleTime: 10_000
  });

  // Sync query data to local state
  useEffect(() => {
    if (locationQuery.data) {
      setLiveLocationLogs(locationQuery.data as LocationPing[]);
    }
  }, [locationQuery.data]);

  // 2. Real-Time WebSocket for ONLY this employee when modal is open
  useEffect(() => {
    if (!isOpen || !employee?.id) return;

    const token = getAccessToken();
    if (!token) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
    const socket: Socket = io(socketUrl, {
      auth: { token },
      withCredentials: true,
      path: "/socket.io"
    });

    socket.on("connect", () => {
      if (employee.companyId) {
        socket.emit("join-company", employee.companyId);
      }
    });

    socket.on("location-update", (data: any) => {
      // ONLY update if event is for this specific employee
      if (data && data.userId === employee.id) {
        setLiveLocationLogs((prev) => {
          const newPing: LocationPing = {
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy,
            batteryLevel: data.batteryLevel,
            timestamp: data.timestamp || new Date().toISOString()
          };
          return [...prev, newPing];
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isOpen, employee?.id, employee?.companyId]);

  // 3. Fetch All Tasks for this employee
  const tasksQuery = useQuery({
    queryKey: ["tasks", "employee", employee?.id],
    queryFn: () => fetchTasks({ date: "all" }),
    enabled: !!employee?.id && isOpen,
    staleTime: 30_000
  });

  // 4. Fetch Attendance for this employee
  const attendanceQuery = useQuery({
    queryKey: ["attendance", employee?.id],
    queryFn: () => fetchAttendance(employee.id),
    enabled: !!employee?.id && isOpen,
    staleTime: 30_000
  });

  // 5. Fetch DER Reports for this employee
  const derQuery = useQuery({
    queryKey: ["der", employee?.id],
    queryFn: () => fetchDerHistory(employee.id),
    enabled: !!employee?.id && isOpen,
    staleTime: 30_000
  });

  // Filter tasks for this employee
  const allEmployeeTasks = useMemo(() => {
    if (!tasksQuery.data || !employee?.id) return [];
    return tasksQuery.data.filter((t: any) => t.assignedToId === employee.id && !t.isSubtask);
  }, [tasksQuery.data, employee?.id]);

  // Filter tasks for the selected date
  const dayTasks = useMemo(() => {
    return allEmployeeTasks.filter((t: any) => {
      const dueStr = t.dueDate ? dayjs(t.dueDate).format("YYYY-MM-DD") : "";
      const compStr = t.completedAt ? dayjs(t.completedAt).format("YYYY-MM-DD") : "";
      const startStr = t.startDate ? dayjs(t.startDate).format("YYYY-MM-DD") : "";
      return dueStr === selectedDate || compStr === selectedDate || startStr === selectedDate;
    });
  }, [allEmployeeTasks, selectedDate]);

  // Calculate task points / coins earned
  const totalCoinsEarned = useMemo(() => {
    return allEmployeeTasks
      .filter((t: any) => t.status === "COMPLETED")
      .reduce((sum: number, t: any) => sum + (t.points || 10), 0);
  }, [allEmployeeTasks]);

  // Attendance for selected date
  const dayAttendance = useMemo(() => {
    if (!attendanceQuery.data) return null;
    return attendanceQuery.data.find(
      (a: any) => dayjs(a.date).format("YYYY-MM-DD") === selectedDate
    );
  }, [attendanceQuery.data, selectedDate]);

  // DER for selected date
  const dayDer = useMemo(() => {
    if (!derQuery.data) return null;
    return derQuery.data.find(
      (d: any) => dayjs(d.date).format("YYYY-MM-DD") === selectedDate
    );
  }, [derQuery.data, selectedDate]);

  // Total KM travelled across all records
  const totalKmRecorded = useMemo(() => {
    if (!derQuery.data) return 0;
    return derQuery.data.reduce((sum: number, d: any) => sum + (d.kmTravelled || 0), 0);
  }, [derQuery.data]);

  // Attendance stats count
  const attendanceStats = useMemo(() => {
    const records = attendanceQuery.data || [];
    let present = 0;
    let absent = 0;
    let onLeave = 0;
    let halfDay = 0;

    records.forEach((r: any) => {
      if (r.status === "PRESENT") present++;
      else if (r.status === "ABSENT") absent++;
      else if (r.status === "ON_LEAVE") onLeave++;
      else if (r.status === "HALF_DAY") halfDay++;
    });

    return { present, absent, onLeave, halfDay, total: records.length };
  }, [attendanceQuery.data]);

  if (!employee) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[96vw] w-[1400px] h-[92vh] max-h-[95vh] p-0 flex flex-col overflow-hidden bg-slate-50 rounded-3xl border border-slate-200/80 shadow-2xl">
          {/* Top Sticky Header */}
          <DialogHeader className="px-6 py-4 bg-slate-900 text-white flex flex-row items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar className="h-12 w-12 ring-2 ring-blue-500/50 shrink-0 bg-blue-600 text-white font-black text-lg">
                <AvatarFallback>{employee.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <DialogTitle className="text-lg font-black tracking-tight text-white truncate">
                    {employee.name}
                  </DialogTitle>
                  <Badge className="bg-blue-600 text-white font-bold text-[10px] uppercase px-2.5 py-0.5">
                    {employee.role}
                  </Badge>
                  <Badge variant="outline" className="text-slate-300 border-slate-700 text-[10px] font-bold">
                    {employee.workMode}
                  </Badge>
                  {employee.isLocationOn ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-black flex items-center gap-1.5 animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                      GPS Active
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px] font-medium">
                      GPS Inactive
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 flex-wrap font-medium">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {employee.email}
                  </span>
                  {employee.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-slate-400" /> {employee.phone}
                    </span>
                  )}
                  {employee.designation && (
                    <span className="text-slate-300 font-bold">
                      • {employee.designation}
                    </span>
                  )}
                  {employee.group?.name && (
                    <span className="text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-900/50 text-[10px] font-bold">
                      📁 {employee.group.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Header Right: Total Coins & Close */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 px-3.5 py-1.5 rounded-2xl flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-400 animate-bounce" />
                <div>
                  <p className="text-[9px] uppercase tracking-wider font-black text-amber-300">Task Points</p>
                  <p className="text-sm font-black text-amber-400 leading-none">{totalCoinsEarned} Pts</p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          {/* Date Selector Navigation Bar */}
          <div className="px-6 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-3 shrink-0 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevDay}
                  className="h-8 px-2.5 rounded-xl text-slate-700 hover:bg-white hover:text-blue-600 font-bold text-xs gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev Day
                </Button>

                <div className="px-3 flex items-center gap-2 font-black text-xs text-slate-800 border-x border-slate-200">
                  <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
                  <span>{dayjs(selectedDate).format("DD MMM YYYY (dddd)")}</span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextDay}
                  disabled={selectedDate === dayjs().format("YYYY-MM-DD")}
                  className="h-8 px-2.5 rounded-xl text-slate-700 hover:bg-white hover:text-blue-600 font-bold text-xs gap-1 disabled:opacity-40"
                >
                  Next Day <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSetToday}
                className={cn(
                  "h-10 rounded-xl text-xs font-bold px-3 transition-all",
                  selectedDate === dayjs().format("YYYY-MM-DD")
                    ? "bg-blue-50 border-blue-300 text-blue-600 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                Today
              </Button>

              <div className="relative">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="h-10 text-xs font-bold rounded-xl border-slate-200 w-36 shadow-sm"
                />
              </div>
            </div>

            {/* Quick KPI Stat Chips */}
            <div className="flex items-center gap-3">
              <div className="bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                <span className="text-slate-500 font-medium">Status:</span>
                {dayAttendance ? (
                  <Badge className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5",
                    dayAttendance.status === "PRESENT" ? "bg-emerald-600 text-white" :
                    dayAttendance.status === "HALF_DAY" ? "bg-amber-500 text-white" :
                    dayAttendance.status === "ON_LEAVE" ? "bg-purple-600 text-white" : "bg-rose-500 text-white"
                  )}>
                    {dayAttendance.status}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-400 text-[10px] font-bold">
                    No Record
                  </Badge>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                <Gauge className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-slate-500 font-medium">Day Distance:</span>
                <span className="font-black text-slate-800">{dayDer?.kmTravelled ?? dayAttendance?.endOdometer ? ((dayAttendance?.endOdometer || 0) - (dayAttendance?.startOdometer || 0)) : "0"} KM</span>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-slate-500 font-medium">Tasks:</span>
                <span className="font-black text-slate-800">
                  {dayTasks.filter((t: any) => t.status === "COMPLETED").length}/{dayTasks.length} Completed
                </span>
              </div>
            </div>
          </div>

          {/* Main Body with Tabs */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <TabsList className="bg-slate-200/70 p-1 rounded-2xl gap-1">
                  <TabsTrigger value="gps" className="rounded-xl font-bold text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                    <MapPin className="h-3.5 w-3.5" /> 🗺️ GPS & Live Map
                  </TabsTrigger>
                  <TabsTrigger value="attendance" className="rounded-xl font-bold text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                    <Clock className="h-3.5 w-3.5" /> 📅 Attendance & Odometer
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="rounded-xl font-bold text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 📋 Tasks & Form Submissions ({allEmployeeTasks.length})
                  </TabsTrigger>
                  <TabsTrigger value="der" className="rounded-xl font-bold text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                    <FileText className="h-3.5 w-3.5" /> 📊 Day End Reports (DER)
                  </TabsTrigger>
                </TabsList>

                <p className="text-xs font-bold text-slate-500">
                  Showing data for: <strong className="text-slate-800">{dayjs(selectedDate).format("DD MMMM YYYY")}</strong>
                </p>
              </div>

              {/* TAB 1: 🗺️ GPS Location Trail & Live Map */}
              <TabsContent value="gps" className="space-y-4 m-0 focus-visible:outline-none">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Interactive Map (2 Columns) */}
                  <div className="lg:col-span-2 space-y-3">
                    <FreeOsmMap
                      logs={liveLocationLogs}
                      isLive={Boolean(employee.isLocationOn && selectedDate === dayjs().format("YYYY-MM-DD"))}
                      employeeName={employee.name}
                      height="460px"
                      onRefresh={() => locationQuery.refetch()}
                    />
                  </div>

                  {/* Location Pings Stream / Summary (1 Column) */}
                  <div className="space-y-4">
                    <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
                      <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-blue-600" />
                          <p className="text-xs font-black uppercase text-slate-800">GPS Ping Timeline</p>
                        </div>
                        <Badge variant="secondary" className="font-bold text-[10px]">
                          {liveLocationLogs.length} Pings
                        </Badge>
                      </div>

                      <div className="p-3 max-h-[390px] overflow-y-auto space-y-2">
                        {liveLocationLogs.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 space-y-2">
                            <MapPin className="h-8 w-8 mx-auto opacity-30" />
                            <p className="text-xs font-bold">No GPS Pings Logged</p>
                            <p className="text-[11px]">Staff did not transmit location on this day.</p>
                          </div>
                        ) : (
                          [...liveLocationLogs].reverse().map((ping, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/50 hover:bg-blue-50/30 transition-all flex items-center justify-between text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  <span className="font-bold text-slate-800">
                                    {dayjs(ping.timestamp).format("hh:mm:ss A")}
                                  </span>
                                  {ping.batteryLevel !== undefined && ping.batteryLevel !== null && (
                                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                      🔋 {ping.batteryLevel}%
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {ping.lat.toFixed(5)}, {ping.lng.toFixed(5)}
                                </p>
                              </div>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px] px-2 font-bold text-blue-600"
                                onClick={() => {
                                  window.open(`https://www.google.com/maps?q=${ping.lat},${ping.lng}`, "_blank");
                                }}
                              >
                                View <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: 📅 Attendance & Odometer */}
              <TabsContent value="attendance" className="space-y-6 m-0 focus-visible:outline-none">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Present Days</p>
                    <p className="text-2xl font-black text-emerald-800 mt-1">{attendanceStats.present}</p>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Half Days</p>
                    <p className="text-2xl font-black text-amber-800 mt-1">{attendanceStats.halfDay}</p>
                  </div>
                  <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-purple-700">Leaves Taken</p>
                    <p className="text-2xl font-black text-purple-800 mt-1">{attendanceStats.onLeave}</p>
                  </div>
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-rose-700">Absent Days</p>
                    <p className="text-2xl font-black text-rose-800 mt-1">{attendanceStats.absent}</p>
                  </div>
                </div>

                {/* Selected Day Full Card */}
                {dayAttendance ? (
                  <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h4 className="text-sm font-black text-slate-800">
                          Day Attendance Details: {dayjs(selectedDate).format("DD MMMM YYYY")}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Punch Type: <strong className="text-slate-700">{dayAttendance.punchType || "OFFICE"}</strong> • Shift: <strong className="text-slate-700">{employee.shiftStart || "09:30 AM"} - {employee.shiftEnd || "06:30 PM"}</strong>
                        </p>
                      </div>
                      <Badge className={cn(
                        "text-xs font-black px-3 py-1 uppercase",
                        dayAttendance.status === "PRESENT" ? "bg-emerald-600" :
                        dayAttendance.status === "HALF_DAY" ? "bg-amber-500" :
                        dayAttendance.status === "ON_LEAVE" ? "bg-purple-600" : "bg-rose-500"
                      )}>
                        {dayAttendance.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Check-In Time</p>
                        <p className="text-base font-black text-slate-800">
                          {dayAttendance.checkInTime ? dayjs(dayAttendance.checkInTime).format("hh:mm A") : "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Check-Out Time</p>
                        <p className="text-base font-black text-slate-800">
                          {dayAttendance.checkOutTime ? dayjs(dayAttendance.checkOutTime).format("hh:mm A") : "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Start Odometer</p>
                        <p className="text-base font-black text-slate-800">
                          {dayAttendance.startOdometer ? `${dayAttendance.startOdometer} km` : "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">End Odometer</p>
                        <p className="text-base font-black text-slate-800">
                          {dayAttendance.endOdometer ? `${dayAttendance.endOdometer} km` : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Attendance & Odometer Photos */}
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <p className="text-xs font-black uppercase text-slate-700">Check-In & Odometer Proof Photos</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { label: "Check-In Selfie", url: dayAttendance.checkInPhotoUrl },
                          { label: "Check-Out Selfie", url: dayAttendance.checkOutPhotoUrl },
                          { label: "Start Odometer", url: dayAttendance.startOdometerPhotoUrl },
                          { label: "End Odometer", url: dayAttendance.endOdometerPhotoUrl },
                        ].map((item, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-2">
                            <p className="text-[10px] font-bold uppercase text-slate-500">{item.label}</p>
                            {item.url ? (
                              <div
                                onClick={() => setPreviewPhoto({ url: item.url!, label: item.label })}
                                className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-white cursor-pointer group shadow-sm hover:shadow-md transition-all"
                              >
                                <img src={item.url} alt={item.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Eye className="h-5 w-5 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className="aspect-video rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-bold bg-white">
                                No Photo
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 text-slate-400">
                    <p className="text-sm font-bold">No Attendance Record for {dayjs(selectedDate).format("DD MMM YYYY")}</p>
                  </div>
                )}
              </TabsContent>

              {/* TAB 3: 📋 Tasks, Coins & Form Submission Inspector */}
              <TabsContent value="tasks" className="space-y-4 m-0 focus-visible:outline-none">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="relative w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search tasks..."
                      value={taskSearchQuery}
                      onChange={(e) => setTaskSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs rounded-xl bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-bold border-slate-200 bg-white">
                      Today&apos;s Tasks: {dayTasks.length}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-bold border-slate-200 bg-white">
                      All Assigned Tasks: {allEmployeeTasks.length}
                    </Badge>
                  </div>
                </div>

                {/* Tasks Table / Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allEmployeeTasks
                    .filter((t: any) => 
                      !taskSearchQuery || 
                      t.title?.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
                      t.description?.toLowerCase().includes(taskSearchQuery.toLowerCase())
                    )
                    .map((task: any) => {
                      const hasFormOrChecklist = Boolean(
                        task.checklistResponses?.length || 
                        task.checklist?.length || 
                        task.completionPhotoUrl || 
                        task.completionRemarks
                      );

                      return (
                        <Card
                          key={task.id}
                          className="rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-md transition-all p-4 space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="font-bold text-sm text-slate-900 leading-snug">{task.title}</h5>
                              <Badge className={cn(
                                "text-[10px] font-black uppercase px-2 py-0.5 shrink-0",
                                task.status === "COMPLETED" ? "bg-emerald-600" :
                                task.status === "IN_PROGRESS" ? "bg-blue-600" : "bg-amber-500"
                              )}>
                                {task.status}
                              </Badge>
                            </div>

                            {task.description && (
                              <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>
                            )}
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/50 text-[10px]">
                                <Coins className="h-3 w-3 text-amber-500" />
                                {task.points || 10} Coins
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                Due: {task.dueDate ? dayjs(task.dueDate).format("DD MMM YYYY") : "—"}
                              </span>
                            </div>

                            {hasFormOrChecklist && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setInspectingTask(task)}
                                className="h-7 text-[10px] font-black rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50 gap-1 px-2.5"
                              >
                                <Eye className="h-3 w-3" /> View Form / Submission
                              </Button>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                </div>
              </TabsContent>

              {/* TAB 4: 📊 Daily End Reports (DER) */}
              <TabsContent value="der" className="space-y-4 m-0 focus-visible:outline-none">
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-black text-xs text-slate-600">Date</TableHead>
                        <TableHead className="font-black text-xs text-slate-600">Orders Taken</TableHead>
                        <TableHead className="font-black text-xs text-slate-600">Orders Cancelled</TableHead>
                        <TableHead className="font-black text-xs text-slate-600">KM Travelled</TableHead>
                        <TableHead className="font-black text-xs text-slate-600">Visits Summary</TableHead>
                        <TableHead className="font-black text-xs text-slate-600">Day Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!derQuery.data || derQuery.data.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-400 font-bold text-xs">
                            No Day End Reports Submitted
                          </TableCell>
                        </TableRow>
                      ) : (
                        derQuery.data.map((d: any, idx: number) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50">
                            <TableCell className="font-bold text-xs text-slate-800">
                              {dayjs(d.date).format("DD MMM YYYY")}
                            </TableCell>
                            <TableCell className="font-bold text-xs text-emerald-600">
                              {d.ordersTaken ?? 0}
                            </TableCell>
                            <TableCell className="font-bold text-xs text-rose-500">
                              {d.ordersCancelled ?? 0}
                            </TableCell>
                            <TableCell className="font-bold text-xs text-blue-600">
                              {d.kmTravelled ?? 0} KM
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-xs truncate">
                              {d.visitsSummary || "—"}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-xs truncate">
                              {d.remarks || "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Form / Submission Inspector Modal */}
      {inspectingTask && (
        <Dialog open={!!inspectingTask} onOpenChange={() => setInspectingTask(null)}>
          <DialogContent className="max-w-2xl bg-white rounded-3xl p-6 space-y-5 border border-slate-200 shadow-2xl">
            <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <DialogTitle className="text-base font-black text-slate-900">
                  {inspectingTask.title}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Completed on: {inspectingTask.completedAt ? dayjs(inspectingTask.completedAt).format("DD MMM YYYY, hh:mm A") : "—"}
                </p>
              </div>
              <Badge className="bg-emerald-600 text-white font-black text-[10px] uppercase">
                {inspectingTask.status}
              </Badge>
            </DialogHeader>

            {/* Remarks & Proof */}
            <div className="space-y-4">
              {inspectingTask.completionRemarks && (
                <div className="space-y-1.5 p-3.5 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Completion Remarks</p>
                  <p className="text-xs font-bold text-slate-800">{inspectingTask.completionRemarks}</p>
                </div>
              )}

              {inspectingTask.completionPhotoUrl && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Completion Evidence Photo</p>
                  <div
                    onClick={() => setPreviewPhoto({ url: inspectingTask.completionPhotoUrl, label: "Task Evidence" })}
                    className="relative aspect-video max-h-52 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer group shadow-sm"
                  >
                    <img src={inspectingTask.completionPhotoUrl} alt="Evidence" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              )}

              {/* Checklist & Form Items */}
              {inspectingTask.checklistResponses && (inspectingTask.checklistResponses as any[]).length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Filled Form / Checklist Responses</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {(inspectingTask.checklistResponses as any[]).map((item: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
                        <p className="font-bold text-slate-800">{item.title || item.label || `Field #${idx + 1}`}</p>
                        {item.fileUrl && (
                          <div
                            onClick={() => setPreviewPhoto({ url: item.fileUrl, label: item.title || "Form Attachment" })}
                            className="w-28 h-28 rounded-lg overflow-hidden border border-slate-200 cursor-pointer"
                          >
                            <img src={item.fileUrl} alt="Submission" className="w-full h-full object-cover" />
                          </div>
                        )}
                        {item.response && (
                          <p className="text-slate-600 font-medium bg-white p-2 rounded-lg border border-slate-100">
                            {item.response}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button size="sm" onClick={() => setInspectingTask(null)} className="rounded-xl font-bold px-4">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Global Image Preview Dialog */}
      {previewPhoto && (
        <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
          <DialogContent className="max-w-xl p-0 overflow-hidden bg-transparent border-none shadow-none">
            <div className="relative group">
              <Badge className="absolute top-4 left-4 z-10 bg-black/60 text-white font-black text-[10px] backdrop-blur-md">
                {previewPhoto.label}
              </Badge>
              <img src={previewPhoto.url} alt="Preview" className="w-full h-auto rounded-3xl shadow-2xl ring-1 ring-white/20" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
