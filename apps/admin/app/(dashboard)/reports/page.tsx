"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  Users, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Gauge, 
  Sparkles, 
  ChevronRight, 
  Filter, 
  RefreshCw, 
  Building2, 
  ShieldCheck, 
  FileText,
  Calendar,
  Coins
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { EmployeeFullReportModal } from "@/components/admin/employee-full-report-modal";
import { 
  fetchUsers, 
  fetchAllAttendance, 
  fetchTasks, 
  fetchGroups, 
  fetchAllReports 
} from "@/lib/api";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

export default function ReportsPage() {
  const todayDateStr = dayjs().format("YYYY-MM-DD");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [workModeFilter, setWorkModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selected Employee for 360° Full Screen Modal
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Fetch Users
  const usersQuery = useQuery({
    queryKey: ["users", "reports-overview"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 1000 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  // 2. Fetch Groups / Departments
  const groupsQuery = useQuery({
    queryKey: ["groups", "reports"],
    queryFn: fetchGroups,
    staleTime: 300_000,
    refetchOnWindowFocus: false
  });

  // 3. Fetch Today's Attendance for all company employees
  const todayAttendanceQuery = useQuery({
    queryKey: ["attendance", "today-reports", todayDateStr],
    queryFn: () => fetchAllAttendance(todayDateStr),
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });

  // 4. Fetch Tasks
  const tasksQuery = useQuery({
    queryKey: ["tasks", "reports-overview"],
    queryFn: () => fetchTasks({ date: "all" }),
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });

  // 5. Fetch DER Reports
  const derQuery = useQuery({
    queryKey: ["der", "reports-overview"],
    queryFn: () => fetchAllReports(),
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  // Map today's attendance by userId
  const attendanceByUserId = useMemo(() => {
    const map = new Map<string, any>();
    (todayAttendanceQuery.data || []).forEach((record: any) => {
      map.set(record.userId, record);
    });
    return map;
  }, [todayAttendanceQuery.data]);

  // Map tasks by assignedToId
  const tasksByUserId = useMemo(() => {
    const map = new Map<string, any[]>();
    (tasksQuery.data || []).forEach((task: any) => {
      if (task.assignedToId && !task.isSubtask) {
        const list = map.get(task.assignedToId) || [];
        list.push(task);
        map.set(task.assignedToId, list);
      }
    });
    return map;
  }, [tasksQuery.data]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    const users = (usersQuery.data?.items || []).filter(
      (u) => u.role !== "ADMIN" && u.role !== "SUPERADMIN"
    );

    return users.filter((u) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        const matchesPhone = u.phone?.toLowerCase().includes(q);
        const matchesDesig = u.designation?.toLowerCase().includes(q);
        const matchesGroup = u.group?.name?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesDesig && !matchesGroup) {
          return false;
        }
      }

      // 2. Department Filter
      if (departmentFilter !== "all") {
        if (u.groupId !== departmentFilter && u.group?.id !== departmentFilter) {
          return false;
        }
      }

      // 3. Work Mode Filter
      if (workModeFilter !== "all") {
        if (u.workMode !== workModeFilter) {
          return false;
        }
      }

      // 4. Today's Attendance Status Filter
      if (statusFilter !== "all") {
        const att = attendanceByUserId.get(u.id);
        const status = att?.status || "ABSENT";
        if (statusFilter === "PRESENT" && status !== "PRESENT") return false;
        if (statusFilter === "ABSENT" && status !== "ABSENT") return false;
        if (statusFilter === "HALF_DAY" && status !== "HALF_DAY") return false;
        if (statusFilter === "ON_LEAVE" && status !== "ON_LEAVE") return false;
      }

      return true;
    });
  }, [
    usersQuery.data?.items, 
    searchQuery, 
    departmentFilter, 
    workModeFilter, 
    statusFilter, 
    attendanceByUserId
  ]);

  // Top KPI Stats
  const topStats = useMemo(() => {
    const allUsers = (usersQuery.data?.items || []).filter(
      (u) => u.role !== "ADMIN" && u.role !== "SUPERADMIN"
    );
    const totalStaff = allUsers.length;

    let presentToday = 0;
    allUsers.forEach((u) => {
      const att = attendanceByUserId.get(u.id);
      if (att && att.status === "PRESENT") {
        presentToday++;
      }
    });

    let todayTasksTotal = 0;
    let todayTasksCompleted = 0;
    (tasksQuery.data || []).forEach((t: any) => {
      const dueStr = t.dueDate ? dayjs(t.dueDate).format("YYYY-MM-DD") : "";
      if (dueStr === todayDateStr && !t.isSubtask) {
        todayTasksTotal++;
        if (t.status === "COMPLETED") todayTasksCompleted++;
      }
    });

    let totalKmToday = 0;
    (todayAttendanceQuery.data || []).forEach((a: any) => {
      if (a.endOdometer && a.startOdometer && a.endOdometer > a.startOdometer) {
        totalKmToday += (a.endOdometer - a.startOdometer);
      }
    });

    return {
      totalStaff,
      presentToday,
      todayTasksTotal,
      todayTasksCompleted,
      totalKmToday
    };
  }, [
    usersQuery.data?.items, 
    attendanceByUserId, 
    tasksQuery.data, 
    todayAttendanceQuery.data, 
    todayDateStr
  ]);

  const handleOpenReport = (employee: any) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Employee 360° Activity Reports
            </h1>
            <Badge className="bg-blue-600 text-white font-black text-xs px-2.5 py-0.5">
              Live Monitoring
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time GPS trails, daily attendance logs, task completion, and odometer reports for all staff members.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              usersQuery.refetch();
              todayAttendanceQuery.refetch();
              tasksQuery.refetch();
            }}
            className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold gap-1.5 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-3xl border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Staff</span>
            <div className="h-9 w-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{topStats.totalStaff}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Registered employees</p>
        </Card>

        <Card className="rounded-3xl border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Present Today</span>
            <div className="h-9 w-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{topStats.presentToday}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            {topStats.totalStaff > 0 ? Math.round((topStats.presentToday / topStats.totalStaff) * 100) : 0}% Attendance Rate
          </p>
        </Card>

        <Card className="rounded-3xl border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">Today&apos;s Tasks</span>
            <div className="h-9 w-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {topStats.todayTasksCompleted} / {topStats.todayTasksTotal}
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            {topStats.todayTasksTotal > 0 ? Math.round((topStats.todayTasksCompleted / topStats.todayTasksTotal) * 100) : 0}% Tasks Completed
          </p>
        </Card>

        <Card className="rounded-3xl border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Distance Travelled Today</span>
            <div className="h-9 w-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Gauge className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{topStats.totalKmToday.toFixed(1)} KM</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Odometer field travel</p>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card className="rounded-3xl border-slate-200/80 bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Live Search */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by staff name, email, phone, designation or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 text-xs rounded-2xl bg-slate-50 border-slate-200 font-medium"
            />
          </div>

          {/* Department Filter */}
          <div className="w-44">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="h-10 text-xs rounded-2xl bg-slate-50 border-slate-200 font-bold">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {(groupsQuery.data || []).map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Work Mode Filter */}
          <div className="w-36">
            <Select value={workModeFilter} onValueChange={setWorkModeFilter}>
              <SelectTrigger className="h-10 text-xs rounded-2xl bg-slate-50 border-slate-200 font-bold">
                <SelectValue placeholder="Work Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="FIELD">Field</SelectItem>
                <SelectItem value="OFFICE">Office</SelectItem>
                <SelectItem value="BOTH">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Today Attendance Filter */}
          <div className="w-36">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 text-xs rounded-2xl bg-slate-50 border-slate-200 font-bold">
                <SelectValue placeholder="Today Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
                <SelectItem value="HALF_DAY">Half Day</SelectItem>
                <SelectItem value="ON_LEAVE">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Main Employee Reports Table */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-14 font-black text-xs text-slate-500 uppercase text-center">#</TableHead>
              <TableHead className="font-black text-xs text-slate-500 uppercase">Employee Details</TableHead>
              <TableHead className="font-black text-xs text-slate-500 uppercase">Today Attendance</TableHead>
              <TableHead className="font-black text-xs text-slate-500 uppercase">Today&apos;s Tasks</TableHead>
              <TableHead className="font-black text-xs text-slate-500 uppercase">Today Distance</TableHead>
              <TableHead className="text-right font-black text-xs text-slate-500 uppercase pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-400 space-y-2">
                  <Users className="h-8 w-8 mx-auto opacity-30" />
                  <p className="text-sm font-bold text-slate-600">No Employees Match Filter</p>
                  <p className="text-xs">Try adjusting your search query or department filter.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((user, idx) => {
                const todayAtt = attendanceByUserId.get(user.id);
                const userTasks = tasksByUserId.get(user.id) || [];
                
                // Tasks for today
                const userTodayTasks = userTasks.filter((t: any) => {
                  const dueStr = t.dueDate ? dayjs(t.dueDate).format("YYYY-MM-DD") : "";
                  return dueStr === todayDateStr;
                });
                const completedTodayTasks = userTodayTasks.filter((t: any) => t.status === "COMPLETED");

                // Day KM
                let dayKm = 0;
                if (todayAtt?.endOdometer && todayAtt?.startOdometer && todayAtt.endOdometer > todayAtt.startOdometer) {
                  dayKm = todayAtt.endOdometer - todayAtt.startOdometer;
                }

                return (
                  <TableRow
                    key={user.id}
                    onClick={() => handleOpenReport(user)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                  >
                    {/* Serial No */}
                    <TableCell className="text-center font-bold text-xs text-slate-400">
                      {String(idx + 1).padStart(2, "0")}
                    </TableCell>

                    {/* Employee Profile */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10 ring-2 ring-slate-100 group-hover:ring-blue-200 transition-all bg-blue-600 text-white font-bold text-sm">
                            <AvatarFallback>{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {user.isLocationOn && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                              {user.name}
                            </span>
                            {user.designation && (
                              <span className="text-[11px] text-slate-500 font-medium">
                                ({user.designation})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <span>{user.email}</span>
                            {user.group?.name && (
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-bold">
                                {user.group.name}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              • {user.workMode}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Today Attendance */}
                    <TableCell>
                      {todayAtt ? (
                        <div className="space-y-1">
                          <Badge className={cn(
                            "text-[10px] font-black uppercase px-2.5 py-0.5",
                            todayAtt.status === "PRESENT" ? "bg-emerald-600 text-white" :
                            todayAtt.status === "HALF_DAY" ? "bg-amber-500 text-white" :
                            todayAtt.status === "ON_LEAVE" ? "bg-purple-600 text-white" : "bg-rose-500 text-white"
                          )}>
                            {todayAtt.status}
                          </Badge>
                          {todayAtt.checkInTime && (
                            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              In: {dayjs(todayAtt.checkInTime).format("hh:mm A")}
                              {todayAtt.checkOutTime && ` • Out: ${dayjs(todayAtt.checkOutTime).format("hh:mm A")}`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px] font-bold">
                          Not Checked In
                        </Badge>
                      )}
                    </TableCell>

                    {/* Today Tasks */}
                    <TableCell>
                      <div className="space-y-1.5 max-w-[160px]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 text-[11px]">
                            {completedTodayTasks.length} / {userTodayTasks.length} Done
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {userTodayTasks.length > 0 ? Math.round((completedTodayTasks.length / userTodayTasks.length) * 100) : 0}%
                          </span>
                        </div>
                        <Progress
                          value={userTodayTasks.length > 0 ? (completedTodayTasks.length / userTodayTasks.length) * 100 : 0}
                          className="h-1.5 bg-slate-100"
                        />
                      </div>
                    </TableCell>

                    {/* Distance / Odo */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="font-black text-xs text-slate-800 flex items-center gap-1">
                          <Gauge className="h-3.5 w-3.5 text-blue-600" />
                          {dayKm > 0 ? `${dayKm} KM` : "0 KM"}
                        </span>
                        {todayAtt?.startOdometer && (
                          <p className="text-[10px] text-slate-400">
                            Odo: {todayAtt.startOdometer} {todayAtt.endOdometer ? `→ ${todayAtt.endOdometer}` : ""}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Action Button */}
                    <TableCell className="text-right pr-6">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenReport(user);
                        }}
                        className="h-8 px-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-black text-xs gap-1 border border-blue-200/60 shadow-none transition-all group-hover:bg-blue-600 group-hover:text-white"
                      >
                        <span>View 360° Report</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Full Screen 360° Employee Report Modal */}
      {selectedEmployee && (
        <EmployeeFullReportModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEmployee(null);
          }}
          employee={selectedEmployee}
          initialDate={todayDateStr}
        />
      )}
    </div>
  );
}
