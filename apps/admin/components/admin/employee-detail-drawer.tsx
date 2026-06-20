"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { 
  X, CalendarDays, Battery, MapPin, Navigation, Smartphone, 
  ChevronLeft, ChevronRight, CheckCircle, Clock, FileText, 
  ClipboardList, Plus, Search, Calendar, Landmark, AlertCircle,
  Briefcase, MessageSquare, Shield, TrendingUp, Compass, Award, ExternalLink
} from "lucide-react";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel 
} from "@/components/ui/dropdown-menu";
import { 
  fetchAttendance, fetchTodayLocation, fetchUserFormResponses, 
  fetchTasks, fetchExpenses, fetchProjects, fetchIssues, 
  fetchHolidays, markAttendanceStatus, clearAttendanceStatus 
} from "@/lib/api";
import { AttendanceStatusBadge, TaskStatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";

interface EmployeeDetailDrawerProps {
  employeeId: string | null;
  employee: any | null; // Selected employee object from parent list
  isOpen: boolean;
  onClose: () => void;
}

export function EmployeeDetailDrawer({ 
  employeeId, 
  employee, 
  isOpen, 
  onClose 
}: EmployeeDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  
  // Tasks date range filters
  const [taskStartDate, setTaskStartDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [taskEndDate, setTaskEndDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  
  const monthNum = selectedMonth.month() + 1;
  const yearNum = selectedMonth.year();

  // Queries
  const attendanceQuery = useQuery({
    queryKey: ["attendance", employeeId, monthNum, yearNum],
    queryFn: () => fetchAttendance(employeeId!, { month: monthNum, year: yearNum }),
    enabled: !!employeeId && isOpen,
  });

  const locationQuery = useQuery({
    queryKey: ["location", employeeId, dayjs().format("YYYY-MM-DD")],
    queryFn: () => fetchTodayLocation(employeeId!, dayjs().format("YYYY-MM-DD")),
    enabled: !!employeeId && isOpen,
    refetchInterval: 30000, // Poll coordinates
  });

  const formResponsesQuery = useQuery({
    queryKey: ["form-responses", employeeId],
    queryFn: () => fetchUserFormResponses(employeeId!),
    enabled: !!employeeId && isOpen,
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    enabled: !!employeeId && isOpen,
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", employeeId],
    queryFn: () => fetchExpenses({ userId: employeeId! }),
    enabled: !!employeeId && isOpen,
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(),
    enabled: !!employeeId && isOpen,
  });

  const issuesQuery = useQuery({
    queryKey: ["issues"],
    queryFn: () => fetchIssues(),
    enabled: !!employeeId && isOpen,
  });

  const holidaysQuery = useQuery({
    queryKey: ["holidays"],
    queryFn: fetchHolidays,
    enabled: isOpen,
  });

  // Mutations
  const markMutation = useMutation({
    mutationFn: markAttendanceStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["salary-matrix"] });
    }
  });

  const clearMutation = useMutation({
    mutationFn: clearAttendanceStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["salary-matrix"] });
    }
  });

  // Calendar computations
  const calendarGrid = useMemo(() => {
    if (!isOpen) return [];
    const startOfMonth = selectedMonth.startOf('month');
    const daysInMonth = selectedMonth.daysInMonth();
    const startDayOfWeek = startOfMonth.day(); // 0 is Sunday
    
    const grid = [];
    let dayCounter = 1;

    for (let i = 0; i < 6; i++) {
      const week = [];
      for (let j = 0; j < 7; j++) {
        if (i === 0 && j < startDayOfWeek) {
          week.push(null);
        } else if (dayCounter > daysInMonth) {
          week.push(null);
        } else {
          const dateStr = selectedMonth.date(dayCounter).format("YYYY-MM-DD");
          const sessions = (attendanceQuery.data ?? []).filter((a: any) => {
            return dayjs(a.date).format("YYYY-MM-DD") === dateStr;
          });
          
          // Check for holiday
          const holiday = (holidaysQuery.data ?? []).find((h: any) => {
            const hDate = dayjs(h.date).format("YYYY-MM-DD");
            return hDate === dateStr && 
              (!h.groupId || h.groupId === employee?.groupId) && 
              (!h.userId || h.userId === employeeId);
          });

          week.push({
            dayNumber: dayCounter,
            dateStr,
            sessions,
            holiday
          });
          dayCounter++;
        }
      }
      grid.push(week);
      if (dayCounter > daysInMonth) break;
    }
    return grid;
  }, [selectedMonth, attendanceQuery.data, holidaysQuery.data, employee, employeeId, isOpen]);

  // Statistics
  const stats = useMemo(() => {
    const sessions = attendanceQuery.data ?? [];
    let present = 0;
    let absent = 0;
    let leaves = 0;
    let halfDays = 0;
    let late = 0;
    let earlyOut = 0;
    let totalOdo = 0;

    const [sHours, sMinutes] = (employee?.shiftStart || "09:00").split(":").map(Number);
    const [eHours, eMinutes] = (employee?.shiftEnd || "18:00").split(":").map(Number);

    sessions.forEach((s: any) => {
      if (s.startOdometer != null && s.endOdometer != null && s.endOdometer >= s.startOdometer) {
        totalOdo += (s.endOdometer - s.startOdometer);
      }

      if (s.status === "PRESENT") {
        present++;
        if (s.checkInTime) {
          const checkIn = new Date(s.checkInTime);
          const isLate = checkIn.getHours() > sHours || (checkIn.getHours() === sHours && checkIn.getMinutes() > sMinutes);
          if (isLate) late++;
        }
        if (s.checkOutTime) {
          const checkOut = new Date(s.checkOutTime);
          const isEarly = checkOut.getHours() < eHours || (checkOut.getHours() === eHours && checkOut.getMinutes() < eMinutes);
          if (isEarly) earlyOut++;
        }
      } else if (s.status === "ABSENT") {
        absent++;
      } else if (s.status === "ON_LEAVE") {
        leaves++;
      } else if (s.status === "HALF_DAY") {
        halfDays++;
      }
    });

    return {
      present,
      absent,
      leaves,
      halfDays,
      late,
      earlyOut,
      totalOdo
    };
  }, [attendanceQuery.data, employee]);

  // Filter tasks client-side
  const filteredTasks = useMemo(() => {
    if (!tasksQuery.data || !employeeId) return [];
    return tasksQuery.data.filter((t: any) => {
      const assigned = t.assignedToId === employeeId;
      if (!assigned) return false;
      const dueDate = dayjs(t.dueDate).format("YYYY-MM-DD");
      return dueDate >= taskStartDate && dueDate <= taskEndDate;
    });
  }, [tasksQuery.data, employeeId, taskStartDate, taskEndDate]);

  // Filter projects (projects where employee has tasks)
  const employeeProjects = useMemo(() => {
    if (!projectsQuery.data || !tasksQuery.data || !employeeId) return [];
    const userTaskProjectIds = new Set(
      tasksQuery.data
        .filter((t: any) => t.assignedToId === employeeId && t.projectId)
        .map((t: any) => t.projectId)
    );
    return projectsQuery.data.filter((p: any) => userTaskProjectIds.has(p.id));
  }, [projectsQuery.data, tasksQuery.data, employeeId]);

  // Filter issues client-side
  const employeeIssues = useMemo(() => {
    if (!issuesQuery.data || !employeeId) return [];
    return issuesQuery.data.filter((i: any) => i.reportedById === employeeId || i.assigneeId === employeeId);
  }, [issuesQuery.data, employeeId]);

  // Today's attendance session
  const todaySession = useMemo(() => {
    const todayStr = dayjs().format("YYYY-MM-DD");
    return (attendanceQuery.data ?? []).find((a: any) => {
      return dayjs(a.date).format("YYYY-MM-DD") === todayStr;
    });
  }, [attendanceQuery.data]);

  const isPunchedIn = Boolean(todaySession && todaySession.checkInTime && !todaySession.checkOutTime);

  const handleStatusChange = async (dateStr: string, status: string) => {
    if (!employeeId) return;
    if (status === "CLEAR") {
      await clearMutation.mutateAsync({ userId: employeeId, date: dateStr });
    } else {
      await markMutation.mutateAsync({ userId: employeeId, date: dateStr, status: status as any });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-3xl w-full h-full flex flex-col p-0 border-l border-slate-200/80 bg-white overflow-hidden shadow-2xl">
        {/* Header Profile Section */}
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-white shadow-md ring-1 ring-slate-200/60 rounded-2xl">
              {employee?.avatarUrl ? (
                <img src={employee.avatarUrl} alt={employee.name} className="h-full w-full object-cover" />
              ) : (
                <AvatarFallback className="bg-slate-100 text-slate-400 text-lg font-bold">
                  {employee?.name?.slice(0, 2).toUpperCase() || "ST"}
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">{employee?.name || "Staff Details"}</h2>
                {isPunchedIn ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm animate-pulse">
                    Present
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/50 shadow-sm">
                    Punched Out
                  </span>
                )}
                {employee?.isLocationOn !== undefined && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider bg-emerald-50/50 text-emerald-700 border-emerald-100">
                    <span className={cn("h-1.5 w-1.5 rounded-full", employee.isLocationOn ? "bg-emerald-500" : "bg-rose-500 animate-pulse")} />
                    <span>Location {employee.isLocationOn ? "ON" : "OFF"}</span>
                  </div>
                )}
                {employee?.batteryLevel !== undefined && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-black bg-slate-100 text-slate-600 border-slate-200">
                    <Battery className="h-3 w-3 text-slate-400" />
                    <span>{Math.round(employee.batteryLevel)}%</span>
                  </div>
                )}
              </div>
              <p className="text-xs font-bold text-slate-500 mt-0.5 uppercase tracking-wide">
                {employee?.designation || "Staff"} • {employee?.group?.name || "No Department"}
              </p>
              <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">ID: {employeeId}</p>
            </div>
          </div>
          <div className="flex flex-col text-right font-mono text-xs text-slate-500 gap-1 bg-white p-3 border border-slate-100 rounded-xl shadow-sm self-stretch sm:self-auto justify-center">
            <div>Shift: {employee?.shiftStart || "09:00"} - {employee?.shiftEnd || "18:00"}</div>
            {todaySession?.checkInTime && (
              <div className="text-[10px] text-emerald-600 font-bold">
                In: {dayjs(todaySession.checkInTime).format("hh:mm A")}
              </div>
            )}
            {todaySession?.checkOutTime && (
              <div className="text-[10px] text-rose-600 font-bold">
                Out: {dayjs(todaySession.checkOutTime).format("hh:mm A")}
              </div>
            )}
          </div>
        </div>

        {/* Tabs System */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b border-slate-100 bg-slate-50/50">
            <TabsList className="bg-slate-100/80 p-1 rounded-xl h-11 w-full max-w-md my-2">
              <TabsTrigger value="overview" className="rounded-lg text-xs font-bold py-1.5">Overview & Attendance</TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-lg text-xs font-bold py-1.5">Tasks & Projects</TabsTrigger>
              <TabsTrigger value="expenses" className="rounded-lg text-xs font-bold py-1.5">Expenses & Forms</TabsTrigger>
              <TabsTrigger value="logs" className="rounded-lg text-xs font-bold py-1.5">Location Pings</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Overview & Attendance Tab */}
            <TabsContent value="overview" className="mt-0 space-y-6">
              
              {/* Quick stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-emerald-700/60 tracking-wider">Present</span>
                  <div className="text-2xl font-black text-emerald-700 mt-1">{stats.present + stats.halfDays * 0.5} Days</div>
                  <span className="text-[10px] text-emerald-600/80 mt-1 block">Incl. {stats.halfDays} half days</span>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-rose-700/60 tracking-wider">Absences</span>
                  <div className="text-2xl font-black text-rose-700 mt-1">{stats.absent} Days</div>
                  <span className="text-[10px] text-rose-600/80 mt-1 block">Late: {stats.late} | Early Out: {stats.earlyOut}</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-indigo-700/60 tracking-wider">Leaves</span>
                  <div className="text-2xl font-black text-indigo-700 mt-1">{stats.leaves} Days</div>
                  <span className="text-[10px] text-indigo-600/80 mt-1 block">Approved leaves this month</span>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-blue-700/60 tracking-wider">Monthly Odo</span>
                  <div className="text-2xl font-black text-blue-700 mt-1">{stats.totalOdo.toFixed(1)} KM</div>
                  <span className="text-[10px] text-blue-600/80 mt-1 block">Sum of odometer logs</span>
                </div>
              </div>

              {/* Month Selector for Calendar */}
              <div className="flex items-center justify-between bg-white border border-slate-100 shadow-sm rounded-2xl p-4">
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-blue-500" /> Attendance Calendar
                </h4>
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/50">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedMonth(prev => prev.subtract(1, 'month'))} className="h-8 w-8 rounded-lg">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="px-3 text-xs font-black text-slate-700 min-w-[90px] text-center">
                    {selectedMonth.format("MMMM YYYY")}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedMonth(prev => prev.add(1, 'month'))} className="h-8 w-8 rounded-lg">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
                <div className="min-w-[500px]">
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {calendarGrid.map((week, i) => (
                      <div key={i} className="grid grid-cols-7 gap-2">
                        {week.map((day, j) => {
                          if (!day) return <div key={j} className="aspect-square bg-transparent" />;
                          
                          const session = day.sessions[0];
                          const status = session?.status;
                          const isWeekend = dayjs(day.dateStr).day() === 0 || dayjs(day.dateStr).day() === 6;
                          const isHoliday = !!day.holiday;

                          // Late check-in detection
                          const checkInTimeStr = session?.checkInTime;
                          let isLate = false;
                          let isEarlyOut = false;
                          if (status === "PRESENT" && checkInTimeStr) {
                            const punchIn = new Date(checkInTimeStr);
                            const [sH, sM] = (employee?.shiftStart || "09:00").split(":").map(Number);
                            isLate = punchIn.getHours() > sH || (punchIn.getHours() === sH && punchIn.getMinutes() > sM);
                          }
                          if (status === "PRESENT" && session?.checkOutTime) {
                            const punchOut = new Date(session.checkOutTime);
                            const [eH, eM] = (employee?.shiftEnd || "18:00").split(":").map(Number);
                            isEarlyOut = punchOut.getHours() < eH || (punchOut.getHours() === eH && punchOut.getMinutes() < eM);
                          }

                          let bgClass = "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300";
                          let labelText = "";
                          
                          if (status === "PRESENT") {
                            if (isLate && isEarlyOut) {
                              bgClass = "bg-rose-50 border-rose-200 text-rose-700 font-bold shadow-sm";
                              labelText = "LATE/OUT";
                            } else if (isLate) {
                              bgClass = "bg-amber-50 border-amber-200 text-amber-600 font-bold shadow-sm";
                              labelText = "LATE";
                            } else if (isEarlyOut) {
                              bgClass = "bg-orange-50 border-orange-200 text-orange-700 font-bold shadow-sm";
                              labelText = "EARLY OUT";
                            } else {
                              bgClass = "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold shadow-sm";
                              labelText = "PRESENT";
                            }
                          } else if (status === "ABSENT") {
                            bgClass = "bg-rose-50 border-rose-200 text-rose-700 font-bold shadow-sm";
                            labelText = "ABSENT";
                          } else if (status === "ON_LEAVE" || status === "HALF_DAY") {
                            bgClass = "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-sm";
                            labelText = status === "HALF_DAY" ? "HALF DAY" : "ON LEAVE";
                          } else if (isHoliday) {
                            bgClass = "bg-amber-50/50 border-amber-200/50 text-amber-700 opacity-80";
                            labelText = day.holiday?.name || "HOLIDAY";
                          } else if (isWeekend) {
                            bgClass = "bg-slate-100 border-slate-200 text-slate-400 opacity-60";
                            labelText = "WEEKEND";
                          }

                          const points = (session as any)?.points ?? 0;
                          
                          return (
                            <DropdownMenu key={day.dateStr}>
                              <DropdownMenuTrigger asChild>
                                <button className={cn("aspect-square rounded-xl border flex flex-col items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 p-1 relative", bgClass)}>
                                  <span className="text-sm leading-none">{day.dayNumber}</span>
                                  {labelText && (
                                    <span className="text-[7px] mt-1 uppercase tracking-tighter opacity-80 font-black leading-none text-center">
                                      {labelText}
                                    </span>
                                  )}
                                  {points > 0 && (
                                    <span className="absolute top-1 right-1 text-[7px] font-black text-blue-600 bg-blue-100/50 px-1 rounded">
                                      +{points}
                                    </span>
                                  )}
                                  {session?.startOdometer != null && (
                                    <span className="text-[7px] font-mono opacity-80 mt-0.5 leading-none">
                                      🚗 {session.endOdometer ? `${(session.endOdometer - session.startOdometer).toFixed(0)} km` : "Odo..."}
                                    </span>
                                  )}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-52 rounded-2xl shadow-xl p-2 font-bold">
                                <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase tracking-widest">{day.dateStr}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {session && (
                                  <>
                                    <div className="px-2 py-1 text-[10px] text-slate-500 space-y-0.5">
                                      {session.checkInTime && <div>In: {dayjs(session.checkInTime).format("hh:mm A")}</div>}
                                      {session.checkOutTime && <div>Out: {dayjs(session.checkOutTime).format("hh:mm A")}</div>}
                                      {session.startOdometer != null && <div>Start Odo: {session.startOdometer} km</div>}
                                      {session.endOdometer != null && <div>End Odo: {session.endOdometer} km</div>}
                                    </div>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem onClick={() => handleStatusChange(day.dateStr, "PRESENT")} className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer rounded-xl">Mark Present</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(day.dateStr, "ON_LEAVE")} className="text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50 cursor-pointer rounded-xl">Mark Leave (Paid)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(day.dateStr, "ABSENT")} className="text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer rounded-xl">Mark Absent (Unpaid)</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleStatusChange(day.dateStr, "CLEAR")} className="text-slate-600 focus:bg-slate-100 cursor-pointer rounded-xl">Clear Record</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Odometer Detailed Breakdown */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                  🚗 Odometer logs for this month
                </h4>
                <div className="space-y-3">
                  {attendanceQuery.isLoading ? (
                    <div className="text-slate-400 text-xs py-4 text-center">Loading odometer logs...</div>
                  ) : (attendanceQuery.data ?? []).filter((s: any) => s.startOdometer != null).length === 0 ? (
                    <div className="text-slate-400 text-xs py-6 text-center border border-dashed border-slate-150 rounded-xl">No odometer logs manually logged this month.</div>
                  ) : (
                    (attendanceQuery.data ?? [])
                      .filter((s: any) => s.startOdometer != null)
                      .map((s: any) => {
                        const hasDiff = s.endOdometer != null && s.endOdometer >= s.startOdometer;
                        const diff = hasDiff ? s.endOdometer - s.startOdometer : 0;
                        return (
                          <div key={s.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-3">
                              <Calendar className="h-4 w-4 text-blue-500" />
                              <div>
                                <div className="font-bold text-slate-800">{dayjs(s.date).format("MMM DD, YYYY")}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Start: {s.startOdometer} km • End: {s.endOdometer ?? "--"} km</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex gap-2">
                                {s.startOdometerPhotoUrl && (
                                  <a href={s.startOdometerPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-blue-600 hover:underline uppercase flex items-center gap-0.5">Start <ExternalLink className="h-2.5 w-2.5" /></a>
                                )}
                                {s.endOdometerPhotoUrl && (
                                  <a href={s.endOdometerPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-blue-600 hover:underline uppercase flex items-center gap-0.5">End <ExternalLink className="h-2.5 w-2.5" /></a>
                                )}
                              </div>
                              <div className="bg-white border border-slate-200/60 rounded-lg px-2.5 py-1 text-center min-w-[70px]">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Travel</p>
                                <p className="font-black text-slate-900">{hasDiff ? `${diff} km` : "--"}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

            </TabsContent>

            {/* Tasks & Projects Tab */}
            <TabsContent value="tasks" className="mt-0 space-y-6">
              
              {/* Date Filters & Header */}
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4">
                <h4 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-500" /> Filter tasks by date range
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Start Date</label>
                    <Input type="date" value={taskStartDate} onChange={e => setTaskStartDate(e.target.value)} className="h-10 rounded-xl" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">End Date</label>
                    <Input type="date" value={taskEndDate} onChange={e => setTaskEndDate(e.target.value)} className="h-10 rounded-xl" />
                  </div>
                </div>
              </div>

              {/* Scrollable Tasks List */}
              <Card className="border-none shadow-sm ring-1 ring-slate-100">
                <CardContent className="p-0">
                  <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700">Tasks ({filteredTasks.length})</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                    {tasksQuery.isLoading ? (
                      <div className="text-slate-400 text-xs py-8 text-center">Loading tasks...</div>
                    ) : filteredTasks.length === 0 ? (
                      <div className="text-slate-400 text-xs py-12 text-center">No tasks assigned in this date range.</div>
                    ) : (
                      filteredTasks.map((task: any) => (
                        <div key={task.id} className="p-4 hover:bg-slate-50/30 transition-colors flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <h5 className="text-xs font-bold text-slate-900 leading-tight">{task.title}</h5>
                            <p className="text-[10px] text-slate-400 font-mono">Due: {dayjs(task.dueDate).format("MMM DD, YYYY hh:mm A")}</p>
                            {task.description && (
                              <p className="text-[10px] text-slate-500 line-clamp-1">{task.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {task.points > 0 && (
                              <Badge className="bg-blue-50 text-blue-700 border border-blue-100 font-bold text-[9px] px-1.5 py-0.5 rounded-md">+{task.points} pts</Badge>
                            )}
                            <TaskStatusBadge status={task.status} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Projects & Issues side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Projects */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col h-64 overflow-hidden">
                  <h4 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-50 pb-2">
                    <Briefcase className="h-4 w-4 text-blue-500" /> Active Projects
                  </h4>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {projectsQuery.isLoading ? (
                      <div className="text-slate-400 text-xs py-4 text-center">Loading...</div>
                    ) : employeeProjects.length === 0 ? (
                      <div className="text-slate-400 text-xs py-6 text-center">No projects assigned.</div>
                    ) : (
                      employeeProjects.map((proj: any) => (
                        <div key={proj.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                          <div className="font-bold text-slate-800">{proj.name}</div>
                          {proj.description && (
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">{proj.description}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Issues */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col h-64 overflow-hidden">
                  <h4 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-50 pb-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" /> Logged Issues
                  </h4>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {issuesQuery.isLoading ? (
                      <div className="text-slate-400 text-xs py-4 text-center">Loading...</div>
                    ) : employeeIssues.length === 0 ? (
                      <div className="text-slate-400 text-xs py-6 text-center">No issues logged.</div>
                    ) : (
                      employeeIssues.map((issue: any) => (
                        <div key={issue.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-start gap-2">
                          <div>
                            <div className="font-bold text-slate-800">{issue.title}</div>
                            <div className="text-[9px] font-mono text-slate-400 mt-0.5">{dayjs(issue.createdAt).format("MMM DD, YYYY")}</div>
                          </div>
                          <Badge className={cn(
                            "font-bold text-[8px] px-1 py-0 rounded",
                            issue.status === "Open" ? "bg-red-50 text-red-700 border border-red-100"
                            : issue.status === "In Progress" ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          )}>{issue.status}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </TabsContent>

            {/* Expenses & Forms Tab */}
            <TabsContent value="expenses" className="mt-0 space-y-6">
              
              {/* Expenses Table */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-blue-500" /> Monthly Expenses Claimed
                </h4>
                <div className="overflow-x-auto border border-slate-50 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4">Description</th>
                        <th className="py-2.5 px-4 text-right">Amount</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {expensesQuery.isLoading ? (
                        <tr><td colSpan={5} className="py-6 text-center text-slate-400">Loading expenses...</td></tr>
                      ) : (expensesQuery.data ?? []).length === 0 ? (
                        <tr><td colSpan={5} className="py-6 text-center text-slate-400">No expenses logged.</td></tr>
                      ) : (
                        (expensesQuery.data ?? []).map((exp: any) => (
                          <tr key={exp.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="py-3 px-4 font-mono text-[10px]">{dayjs(exp.date).format("MMM DD, YYYY")}</td>
                            <td className="py-3 px-4 font-bold text-slate-700">{exp.category.toLowerCase().replace(/_/g, " ")}</td>
                            <td className="py-3 px-4 text-slate-500 max-w-[150px] truncate">{exp.description}</td>
                            <td className="py-3 px-4 text-right font-black text-slate-800">₹{exp.amount.toLocaleString()}</td>
                            <td className="py-3 px-4 text-center">
                              <Badge className={cn(
                                "font-bold text-[8px] px-1.5 py-0.5 rounded-full border",
                                exp.approved ? "bg-emerald-50 text-emerald-700 border-emerald-200/50" : "bg-amber-50 text-amber-700 border-amber-200/50"
                              )}>{exp.approved ? "Approved" : "Pending"}</Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form Responses Section */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" /> Operational Form Responses
                </h4>
                <div className="space-y-4">
                  {formResponsesQuery.isLoading ? (
                    <div className="text-slate-400 text-xs py-4 text-center">Loading responses...</div>
                  ) : (formResponsesQuery.data ?? []).length === 0 ? (
                    <div className="text-slate-400 text-xs py-6 text-center border border-dashed border-slate-100 rounded-xl">No form responses submitted by this employee yet.</div>
                  ) : (
                    (formResponsesQuery.data ?? []).map((resp: any) => {
                      let parsedData = {};
                      try {
                        parsedData = JSON.parse(resp.data);
                      } catch (e) {}

                      return (
                        <Card key={resp.id} className="border border-slate-100 shadow-sm overflow-hidden bg-slate-50/20">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start gap-4 border-b border-slate-100 pb-2 mb-2">
                              <div>
                                <h5 className="font-bold text-xs text-slate-800">{resp.form?.name || "Operational Form"}</h5>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{resp.form?.category}</p>
                              </div>
                              <span className="text-[9px] font-mono text-slate-400">{dayjs(resp.submittedAt).format("MMM DD, YYYY hh:mm A")}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              {Object.entries(parsedData).map(([key, val]: [string, any]) => (
                                <div key={key} className="bg-white p-2 border border-slate-50 rounded-lg">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide leading-none">{key}</span>
                                  <div className="font-bold text-slate-700 mt-1 break-all">
                                    {typeof val === "string" && val.startsWith("http") ? (
                                      <a href={val} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">View Photo <ExternalLink className="h-3 w-3" /></a>
                                    ) : (
                                      val.toString()
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>

            </TabsContent>

            {/* Location logs tab */}
            <TabsContent value="logs" className="mt-0 space-y-6">
              
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Compass className="h-4 w-4 text-blue-500" /> Today&apos;s Live Location Path Logs
                  </h4>
                  {employee?.isLocationOn && (
                    <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
                  )}
                </div>
                
                <div className="space-y-3">
                  {locationQuery.isLoading ? (
                    <div className="text-slate-400 text-xs py-4 text-center">Loading coordinates...</div>
                  ) : (locationQuery.data ?? []).length === 0 ? (
                    <div className="text-slate-400 text-xs py-10 text-center border border-dashed border-slate-100 rounded-xl">No coordinates logged for today. (Field mode logs will show here)</div>
                  ) : (
                    (locationQuery.data ?? [])
                      .slice()
                      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((log: any, idx: number) => (
                        <div key={log.id || idx} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center font-bold text-blue-500 text-[10px] font-mono">
                              #{idx + 1}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{formatTime(log.timestamp)}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{log.lat.toFixed(5)}, {log.lng.toFixed(5)}</div>
                            </div>
                          </div>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${log.lat},${log.lng}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-white hover:bg-slate-50 transition-colors border border-slate-200/80 rounded-lg px-3 py-1.5 font-bold text-blue-600 flex items-center gap-1.5 shadow-sm text-[10px]"
                          >
                            <MapPin className="h-3.5 w-3.5 text-blue-500" />
                            Open Map
                          </a>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </TabsContent>

          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
