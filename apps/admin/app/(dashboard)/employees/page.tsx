"use client";
 
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { 
  Edit, 
  Plus, 
  Search, 
  MoreHorizontal, 
  User as UserIcon, 
  Briefcase, 
  Home, 
  Eye, 
  ChevronUp, 
  ChevronDown, 
  MapPin, 
  Smartphone, 
  Battery, 
  Clock, 
  MessageSquare, 
  UserPlus, 
  Users,
  Navigation,
  Globe,
  Filter,
  MoreVertical,
  Trash2,
  Pencil,
  Calendar,
  CheckCircle,
  Package,
  XCircle,
  Map as MapIcon,
  Download,
  ClipboardList,
  X
} from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { AttendanceStatusBadge } from "@/components/admin/status-badge";
import { DepartmentManagementDialog } from "@/components/admin/department-management-dialog";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createUser, fetchAllAttendance, fetchAttendance, fetchTodayLocation, fetchUsers, updateUser, createTask, deleteUser, fetchTasks, fetchDerHistory, fetchGroups, forceCheckoutUser } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttendanceRecord, WorkMode, User } from "@/lib/types";
import dayjs from "dayjs";
 
export default function EmployeesPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddManagerOpen, setIsAddManagerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [workModeFilter, setWorkModeFilter] = useState<"ALL" | "FIELD" | "OFFICE">("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "MANAGER" | "EMPLOYEE">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedMapDate, setSelectedMapDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const todayDate = dayjs().format("YYYY-MM-DD");
  const selectedMapMonth = dayjs(selectedMapDate).month() + 1;
  const selectedMapYear = dayjs(selectedMapDate).year();
  
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth(); // Get current user for companyId
 
  const usersQuery = useQuery({ 
    queryKey: ["users", search, roleFilter], 
    queryFn: () => fetchUsers({ 
      page: 1, 
      pageSize: 100, 
      search, 
      role: roleFilter === "ALL" ? undefined : roleFilter
    }) 
  });

  const todayAttendanceQuery = useQuery({
    queryKey: ["attendance", "overview", todayDate],
    queryFn: () => fetchAllAttendance(todayDate),
    refetchInterval: 20_000
  });

  const latestTodayAttendanceByUser = useMemo(() => {
    const grouped = new Map<string, AttendanceRecord[]>();

    for (const record of todayAttendanceQuery.data ?? []) {
      if (!record.checkInTime) {
        continue;
      }

      const sessions = grouped.get(record.userId) ?? [];
      sessions.push(record);
      grouped.set(record.userId, sessions);
    }

    return new Map(
      Array.from(grouped.entries()).map(([userId, sessions]) => [
        userId,
        sessions.sort(sortAttendanceByLatestEventDesc)[0]
      ])
    );
  }, [todayAttendanceQuery.data]);

  const managersQuery = useQuery({
    queryKey: ["users", "managers"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 100, role: "MANAGER" })
  });
 
  const filteredUsers = useMemo(() => {
    let items = (usersQuery.data?.items ?? []).filter(
      (user) => user.role !== "ADMIN" && user.role !== "SUPERADMIN"
    );

    if (workModeFilter !== "ALL") {
      items = items.filter((user) => resolveDisplayedWorkMode(user.workMode, latestTodayAttendanceByUser.get(user.id)) === workModeFilter);
    }

    if (statusFilter !== "ALL") {
      items = items.filter((user) => {
        const latestUserAttendance = latestTodayAttendanceByUser.get(user.id);
        const isActive = Boolean(latestUserAttendance && latestUserAttendance.checkInTime && !latestUserAttendance.checkOutTime);
        return statusFilter === "ACTIVE" ? isActive : !isActive;
      });
    }

    return items;
  }, [latestTodayAttendanceByUser, usersQuery.data?.items, workModeFilter, statusFilter]);

  const managers = useMemo(() => managersQuery.data?.items ?? [], [managersQuery.data?.items]);

  const managersById = useMemo(
    () => new Map(managers.map((manager) => [manager.id, manager])),
    [managers]
  );

  const selectedEmployee = useMemo(
    () => filteredUsers.find((user) => user.id === expandedId),
    [expandedId, filteredUsers]
  );
  const attendanceQuery = useQuery({
    queryKey: ["attendance", expandedId, selectedMapMonth, selectedMapYear],
    queryFn: () => fetchAttendance(expandedId!, { month: selectedMapMonth, year: selectedMapYear }),
    enabled: !!expandedId,
    refetchInterval: expandedId && selectedMapDate === todayDate ? 20_000 : false,
  });

  const selectedDateSessions = useMemo(
    () => getAttendanceSessionsForDate(attendanceQuery.data ?? [], selectedMapDate),
    [attendanceQuery.data, selectedMapDate]
  );

  const latestAttendance = selectedDateSessions[0];

  // Fetch details for the expanded employee
  const locationQuery = useQuery({
    queryKey: ["location", expandedId, selectedMapDate],
    queryFn: () => fetchTodayLocation(expandedId!, selectedMapDate),
    enabled: Boolean(expandedId),
    refetchInterval: expandedId && selectedMapDate === todayDate ? 20_000 : false,
  });

  const isFieldEmployee = useMemo(() => {
    return (
      latestAttendance?.punchType === "FIELD" ||
      Boolean(locationQuery.data?.length) ||
      (!latestAttendance && (selectedEmployee?.workMode === "FIELD" || selectedEmployee?.workMode === "BOTH"))
    );
  }, [latestAttendance, locationQuery.data?.length, selectedEmployee]);

  const latestLocation = useMemo(() => {
    const logs = locationQuery.data ?? [];
    return logs.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [locationQuery.data]);

  const distanceKm = useMemo(() => calculateDistanceKm(locationQuery.data ?? []), [locationQuery.data]);

  const monthlyOdoTotal = useMemo(() => {
    const sessions = attendanceQuery.data ?? [];
    return sessions.reduce((sum, session) => {
      if (session.startOdometer != null && session.endOdometer != null && session.endOdometer >= session.startOdometer) {
        return sum + (session.endOdometer - session.startOdometer);
      }
      return sum;
    }, 0);
  }, [attendanceQuery.data]);
 
  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    enabled: !!expandedId,
  });
 
  const reportsQuery = useQuery({
    queryKey: ["reports", expandedId],
    queryFn: () => fetchDerHistory(expandedId!),
    enabled: !!expandedId,
  });
 
  const employeeTasks = useMemo(() => {
    if (!expandedId) return [];
    return (tasksQuery.data ?? []).filter(t => t.assignedToId === expandedId);
  }, [tasksQuery.data, expandedId]);
 
  const employeeReports = useMemo(() => {
    return reportsQuery.data ?? [];
  }, [reportsQuery.data]);

  const handleForceCheckout = async (userId: string) => {
    if (!confirm("Are you sure you want to force check-out this employee? This will close their active attendance session.")) {
      return;
    }
    try {
      await forceCheckoutUser(userId);
      alert("Employee checked out successfully.");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to force check-out employee.");
    }
  };

  const downloadCSV = () => {
    if (filteredUsers.length === 0) return;
    const headers = ["Employee Name", "Email", "Phone", "Role", "Designation", "Department", "Work Mode", "Salary", "Manager"];
    const rows = filteredUsers.map(e => [
      e.name || "",
      e.email || "",
      e.phone || "--",
      e.role || "",
      e.designation || "Staff",
      e.group?.name || "Unassigned",
      e.workMode || "",
      e.baseSalary ? `INR ${e.baseSalary}` : "--",
      e.managerId ? (managersById.get(e.managerId)?.name || "--") : "--"
    ]);
    
    const csvString = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${(val ?? "").toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Employees_Report_${workModeFilter}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
 
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Employees</h1>
          <p className="mt-1 text-slate-500">Manage, track and organize your field and office team activity.</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
              <Select value={workModeFilter} onValueChange={(v: any) => setWorkModeFilter(v)}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-600 bg-white shadow-sm w-[140px]">
                  <Globe className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Work Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Modes</SelectItem>
                  <SelectItem value="FIELD">Field Work</SelectItem>
                  <SelectItem value="OFFICE">Office Work</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 mr-4">
              <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-600 bg-white shadow-sm w-[140px]">
                  <UserIcon className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  <SelectItem value="MANAGER">Managers</SelectItem>
                  <SelectItem value="EMPLOYEE">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 mr-4">
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-600 bg-white shadow-sm w-[140px]">
                  <CheckCircle className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active (Punch In)</SelectItem>
                  <SelectItem value="INACTIVE">Inactive (Punch Out)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              variant="outline" 
              className="border-slate-200 bg-white rounded-xl px-4 h-10 font-bold text-slate-600 shadow-sm gap-2 text-xs mr-2 hover:bg-slate-50 transition-all"
              onClick={downloadCSV}
              disabled={filteredUsers.length === 0}
            >
              <Download className="h-4 w-4 text-slate-500" />
              Export CSV
            </Button>
            <DepartmentManagementDialog
              trigger={
                <Button variant="outline" className="border-slate-200 bg-white rounded-xl px-5 h-10 font-bold text-slate-700 shadow-sm text-xs mr-2 hover:bg-slate-50 transition-all">
                  <Users className="mr-2 h-4 w-4 text-blue-500" />
                  Manage Departments
                </Button>
              }
            />
           <Dialog open={isAddManagerOpen} onOpenChange={setIsAddManagerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-slate-200 bg-white rounded-xl px-5 h-10 font-bold text-slate-700 shadow-sm text-xs">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Manager
                </Button>
              </DialogTrigger>
              <EmployeeDialog
                mode="CREATE"
                role="MANAGER"
                managers={managers}
                onSuccess={() => {
                  setIsAddManagerOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["users"] });
                }}
              />
           </Dialog>
           <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 rounded-xl px-5 h-10 font-bold">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <EmployeeDialog 
                mode="CREATE" 
                role="EMPLOYEE"
                managers={managers}
                onSuccess={() => {
                  setIsAddOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["users"] });
                }} 
              />
           </Dialog>
        </div>
      </div>
 
      <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search employees..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 border-slate-200 bg-white rounded-xl text-sm"
            />
          </div>
        </div>
 
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="py-4 px-8 text-[11px] font-black uppercase tracking-wider text-slate-400">Name</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Phone</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Designation</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Department</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Manager</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400 text-center">Work Mode</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Last Seen</th>
                <th className="py-4 px-8 text-[11px] font-black uppercase tracking-wider text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isExpanded = expandedId === user.id;
                const latestUserAttendance = latestTodayAttendanceByUser.get(user.id);
                const displayedWorkMode = resolveDisplayedWorkMode(user.workMode, latestUserAttendance);
                const isPunchedIn = Boolean(latestUserAttendance && latestUserAttendance.checkInTime && !latestUserAttendance.checkOutTime);
                return (
                  <Fragment key={user.id}>
                    <tr className={cn(
                      "group border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer",
                      isExpanded && "bg-slate-50/80 hover:bg-slate-50/80"
                    )} onClick={() => setExpandedId(isExpanded ? null : user.id)}>
                      <td className="py-5 px-8">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10 border border-slate-100 shadow-sm ring-2 ring-white">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                            ) : (
                              <AvatarFallback className="bg-slate-50 text-slate-400">
                                <UserIcon className="h-5 w-5" />
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm leading-tight">{user.name}</span>
                              {isPunchedIn ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/50 shadow-sm">
                                  Inactive
                                </span>
                              )}
                              {user.batteryLevel !== undefined && user.batteryLevel !== null && (
                                <div className={cn(
                                  "flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-md border",
                                  user.batteryLevel >= 50 ? "text-emerald-700 bg-emerald-50 border-emerald-200/50"
                                  : user.batteryLevel >= 20 ? "text-amber-700 bg-amber-50 border-amber-200/50"
                                  : "text-rose-700 bg-rose-50 border-rose-200/50"
                                )}>
                                  <Battery className={cn(
                                    "h-2.5 w-2.5",
                                    user.batteryLevel >= 50 ? "text-emerald-500"
                                    : user.batteryLevel >= 20 ? "text-amber-500"
                                    : "text-rose-500"
                                  )} />
                                  <span>{Math.round(user.batteryLevel)}%</span>
                                </div>
                              )}
                              {user.isLocationOn !== undefined && (
                                <span 
                                  className={cn(
                                    "h-2 w-2 rounded-full ring-2 ring-white shadow-sm",
                                    user.isLocationOn ? "bg-emerald-500" : "bg-rose-500 animate-pulse"
                                  )} 
                                  title={user.isLocationOn ? "Location On" : "Location Off"} 
                                />
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6 text-xs font-semibold text-slate-600">{user.phone || "Not available"}</td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700 leading-tight">{user.designation || "Staff"}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{user.role}</span>
                        </div>
                      </td>
                      <td className="py-5 px-6 text-xs font-semibold text-slate-700">
                        {user.group?.name || "Unassigned"}
                      </td>
                      <td className="py-5 px-6 text-xs font-semibold text-slate-700">
                        {user.role === "MANAGER" 
                          ? "Manager" 
                          : user.role === "SUPERADMIN" || user.role === "ADMIN"
                          ? "Administrator"
                          : user.managerId 
                          ? managersById.get(user.managerId)?.name ?? "Unknown manager" 
                          : "Unassigned"}
                      </td>
                      <td className="py-5 px-6 text-center">
                         <div className={cn(
                           "flex items-center justify-center gap-2 px-3 py-1 rounded-full border w-fit mx-auto",
                           displayedWorkMode === "FIELD"
                             ? "bg-blue-50 text-blue-600 border-blue-100"
                             : displayedWorkMode === "BOTH"
                             ? "bg-violet-50 text-violet-600 border-violet-100"
                             : "bg-indigo-50 text-indigo-600 border-indigo-100"
                         )}>
                            <span className="text-[10px] font-black uppercase tracking-wider">{displayedWorkMode}</span>
                         </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                           <span className="text-xs font-bold text-slate-600">{isExpanded && latestLocation ? formatTime(latestLocation.timestamp) : "Expand row"}</span>
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{isExpanded && latestLocation ? `${latestLocation.lat.toFixed(4)}, ${latestLocation.lng.toFixed(4)}` : "for live location"}</span>
                        </div>
                      </td>
                      <td className="py-5 px-8 text-right">
                         <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 className="h-9 w-9 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white hover:shadow-sm"
                               >
                                 <MoreVertical className="h-4 w-4" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-xl border border-slate-200 p-1">
                               <DropdownMenuItem 
                                 className="gap-3 py-2.5 px-3 cursor-pointer text-sm font-semibold text-slate-700 focus:bg-blue-50 focus:text-blue-700 rounded-lg"
                                 onSelect={(e) => { e.preventDefault(); setTimeout(() => setEditingUser(user), 0); }}
                               >
                                 <Pencil className="h-4 w-4" />
                                 Edit Employee
                               </DropdownMenuItem>
                               <DropdownMenuItem 
                                 className="gap-3 py-2.5 px-3 cursor-pointer text-sm font-semibold text-slate-700 focus:bg-blue-50 focus:text-blue-700 rounded-lg"
                                 onSelect={(e) => { e.preventDefault(); setTimeout(() => { setSelectedUser(user); setIsAssignOpen(true); }, 0); }}
                               >
                                 <UserPlus className="h-4 w-4" />
                                 Assign Task
                               </DropdownMenuItem>
                               <DropdownMenuItem 
                                 className="gap-3 py-2.5 px-3 cursor-pointer text-sm font-semibold text-amber-600 focus:bg-amber-50 focus:text-amber-700 rounded-lg"
                                 onSelect={(e) => { e.preventDefault(); handleForceCheckout(user.id); }}
                               >
                                 <Clock className="h-4 w-4" />
                                 Force Check-Out
                               </DropdownMenuItem>
                               <DropdownMenuSeparator />
                               <DropdownMenuItem 
                                 className="gap-3 py-2.5 px-3 cursor-pointer text-sm font-semibold text-red-600 focus:bg-red-50 focus:text-red-700 rounded-lg"
                                 onSelect={(e) => { e.preventDefault(); setTimeout(() => setDeleteConfirmUser(user), 0); }}
                                 disabled={user.id === currentUser?.id}
                               >
                                 <Trash2 className="h-4 w-4" />
                                 Delete Employee
                               </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-sm transition-all"
                              onClick={(e) => { e.stopPropagation(); setEditingUser(user); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn(
                                "h-9 w-9 rounded-lg transition-all",
                                isExpanded ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "text-slate-400 hover:bg-white hover:shadow-sm"
                              )}
                              onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : user.id); }}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                         </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="p-0 border-none bg-slate-50/80">
                           <div className="px-8 py-8 animate-in slide-in-from-top-4 duration-300">
                              <div className="grid grid-cols-12 gap-8">
                                 {/* Left: Profile & Quick Stats */}
                                 <div className="col-span-3 space-y-6">
                                    <Card className="border-none shadow-sm ring-1 ring-slate-200/50 bg-white overflow-hidden">
                                       <CardContent className="p-6">
                                          <div className="flex items-center justify-between mb-6">
                                             <div className="flex items-center gap-3">
                                                <Avatar className="h-12 w-12 border-2 border-white shadow-md ring-1 ring-slate-100">
                                                   {user.avatarUrl ? (
                                                     <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                                                   ) : (
                                                     <AvatarFallback className="bg-slate-50 text-slate-400">
                                                       <UserIcon className="h-6 w-6" />
                                                     </AvatarFallback>
                                                   )}
                                                </Avatar>
                                                <div>
                                                   <h3 className="font-bold text-slate-900 leading-tight">{user.name}</h3>
                                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {user.id.slice(0, 8)}</p>
                                                </div>
                                             </div>
                                          </div>
 
                                            <div className="space-y-4">
                                             <div className="flex items-center gap-3 text-slate-500 pt-2">
                                                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                                   <Navigation className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <div className="flex-1">
                                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Live Location</p>
                                                   <p className="text-xs font-bold text-slate-700">
                                                     {isFieldEmployee ? (latestLocation ? `${latestLocation.lat.toFixed(5)}, ${latestLocation.lng.toFixed(5)}` : "No field pings today") : "Office mode"}
                                                   </p>
                                                </div>
                                             </div>
                                             
                                             {(user.batteryLevel !== undefined && user.batteryLevel !== null) && (
                                               <div className="flex items-center gap-3 text-slate-500">
                                                  <div className={cn(
                                                    "h-8 w-8 rounded-lg flex items-center justify-center",
                                                    user.batteryLevel >= 50 ? "bg-emerald-50" : user.batteryLevel >= 20 ? "bg-amber-50" : "bg-rose-50"
                                                  )}>
                                                     <Battery className={cn(
                                                       "h-4 w-4",
                                                       user.batteryLevel >= 50 ? "text-emerald-500" : user.batteryLevel >= 20 ? "text-amber-500" : "text-rose-500"
                                                     )} />
                                                  </div>
                                                  <div className="flex-1">
                                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Device Battery</p>
                                                     <div className="flex items-center gap-2">
                                                       <p className={cn(
                                                         "text-xs font-black",
                                                         user.batteryLevel >= 50 ? "text-emerald-700" : user.batteryLevel >= 20 ? "text-amber-700" : "text-rose-700"
                                                       )}>{Math.round(user.batteryLevel)}%</p>
                                                       {/* Visual battery bar */}
                                                       <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                                                         <div
                                                           className={cn(
                                                             "h-full rounded-full transition-all",
                                                             user.batteryLevel >= 50 ? "bg-emerald-500" : user.batteryLevel >= 20 ? "bg-amber-500" : "bg-rose-500"
                                                           )}
                                                           style={{ width: `${Math.min(100, Math.max(0, Math.round(user.batteryLevel)))}%` }}
                                                         />
                                                       </div>
                                                       <p className="text-[10px] font-bold text-slate-400">
                                                         {user.isLocationOn ? "📡 Online" : "📵 Location Off"}
                                                       </p>
                                                     </div>
                                                  </div>
                                               </div>
                                             )}
                                          </div>
 
                                              <div className={cn(
                                                "mt-8 grid gap-4",
                                                isFieldEmployee ? "grid-cols-3" : "grid-cols-2"
                                              )}>
                                              <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Attendance Sessions</p>
                                                 <div className="flex items-end gap-1 mb-1">
                                                    <span className="text-lg font-black text-slate-900 leading-none">{selectedDateSessions.length}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">sessions</span>
                                                 </div>
                                                 <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div className={cn("h-full rounded-full", selectedDateSessions.length > 0 ? "w-full bg-blue-600" : "w-0 bg-blue-600")} />
                                                 </div>
                                              </div>
                                              <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{isFieldEmployee ? "Distance (Today)" : "Punch Mode"}</p>
                                                 <div className="flex items-end gap-1 mb-1">
                                                    <span className="text-lg font-black text-slate-900 leading-none">{isFieldEmployee ? distanceKm.toFixed(1) : latestAttendance?.punchType ?? user.workMode}</span>
                                                    {isFieldEmployee ? <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">km</span> : null}
                                                 </div>
                                                 <div className={cn("flex items-center gap-1.5", isFieldEmployee ? "text-emerald-600" : "text-indigo-600")}>
                                                    <div className={cn("h-1 w-1 rounded-full", isFieldEmployee ? "bg-emerald-500" : "bg-indigo-500")} />
                                                    <span className="text-[10px] font-black uppercase tracking-wider">{isFieldEmployee ? "On Track" : "No KM Tracking"}</span>
                                                 </div>
                                              </div>
                                              {isFieldEmployee && (
                                                <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-100 flex flex-col justify-between">
                                                   <div>
                                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Monthly Odo Total</p>
                                                      <div className="flex items-end gap-1 mb-1">
                                                         <span className="text-lg font-black text-slate-900 leading-none">{monthlyOdoTotal.toFixed(1)}</span>
                                                         <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">km</span>
                                                      </div>
                                                   </div>
                                                   <div className="text-[9px] font-black uppercase text-blue-600 mt-1">
                                                      {dayjs(selectedMapDate).format("MMMM YYYY")}
                                                   </div>
                                                </div>
                                              )}
                                           </div>

                                           {isFieldEmployee && latestAttendance && (latestAttendance.startOdometer != null || latestAttendance.endOdometer != null) && (
                                              <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                                                 <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Odometer Readings</p>
                                                 <div className="grid grid-cols-3 gap-3">
                                                    <div className="rounded-xl bg-slate-50/50 p-3 border border-slate-100 flex flex-col justify-between">
                                                       <div>
                                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Start Odo</p>
                                                          <p className="text-xs font-bold text-slate-700">
                                                             {latestAttendance.startOdometer != null ? `${latestAttendance.startOdometer} km` : "No reading"}
                                                          </p>
                                                       </div>
                                                       {latestAttendance.startOdometerPhotoUrl && (
                                                          <a
                                                             href={latestAttendance.startOdometerPhotoUrl}
                                                             target="_blank"
                                                             rel="noopener noreferrer"
                                                             className="mt-2 text-[9px] font-black uppercase text-blue-600 hover:underline"
                                                          >
                                                             View Photo
                                                          </a>
                                                       )}
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50/50 p-3 border border-slate-100 flex flex-col justify-between">
                                                       <div>
                                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">End Odo</p>
                                                          <p className="text-xs font-bold text-slate-700">
                                                             {latestAttendance.endOdometer != null ? `${latestAttendance.endOdometer} km` : "No reading"}
                                                          </p>
                                                       </div>
                                                       {latestAttendance.endOdometerPhotoUrl && (
                                                          <a
                                                             href={latestAttendance.endOdometerPhotoUrl}
                                                             target="_blank"
                                                             rel="noopener noreferrer"
                                                             className="mt-2 text-[9px] font-black uppercase text-blue-600 hover:underline"
                                                          >
                                                             View Photo
                                                          </a>
                                                       )}
                                                    </div>
                                                    <div className={cn(
                                                       "rounded-xl p-3 border flex flex-col justify-center",
                                                       latestAttendance.startOdometer != null && latestAttendance.endOdometer != null && latestAttendance.endOdometer < latestAttendance.startOdometer
                                                          ? "bg-rose-50 border-rose-100 text-rose-700"
                                                          : "bg-blue-50/50 border-blue-100/60 text-blue-700"
                                                    )}>
                                                       <p className={cn(
                                                          "text-[9px] font-bold uppercase tracking-wider leading-none mb-1",
                                                          latestAttendance.startOdometer != null && latestAttendance.endOdometer != null && latestAttendance.endOdometer < latestAttendance.startOdometer
                                                             ? "text-rose-500"
                                                             : "text-blue-500"
                                                       )}>Distance</p>
                                                       <p className="text-xs font-black">
                                                          {latestAttendance.startOdometer != null && latestAttendance.endOdometer != null
                                                             ? latestAttendance.endOdometer >= latestAttendance.startOdometer
                                                                ? `${(latestAttendance.endOdometer - latestAttendance.startOdometer).toFixed(1)} km`
                                                                : "Error"
                                                             : "--"}
                                                       </p>
                                                    </div>
                                                 </div>
                                              </div>
                                            )}
                                       </CardContent>
                                    </Card>
                                 </div>
 
                                 {/* Middle: Map Integration */}
                                 <div className="col-span-6">
                                    <Card className="border-none shadow-sm ring-1 ring-slate-200/50 h-full relative overflow-hidden bg-slate-200">
                                       <div className="absolute top-4 left-4 z-10">
                                          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white shadow-sm ring-1 ring-slate-200/20 animate-pulse">
                                             <div className={cn("h-2 w-2 rounded-full", isFieldEmployee ? "bg-emerald-500" : "bg-indigo-500")} />
                                             <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">{isFieldEmployee ? "Live Tracking Active" : "Office Attendance"}</span>
                                          </div>
                                       </div>

                                       <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                                          <Input 
                                             type="date" 
                                             value={selectedMapDate} 
                                             onChange={(e) => setSelectedMapDate(e.target.value)}
                                             className="h-8 text-[11px] font-bold rounded-lg border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm w-36"
                                          />
                                       </div>
                                       
                                       <div className="w-full h-full bg-[#E5E7EB] flex items-center justify-center p-10">
                                          <div className="w-full max-w-md rounded-2xl bg-white/90 p-6 text-center shadow-sm ring-1 ring-slate-200">
                                             <MapPin className="mx-auto h-8 w-8 text-blue-600" />
                                             <p className="mt-3 text-sm font-black text-slate-900">{isFieldEmployee ? "Latest Location" : "Office Punch Details"}</p>
                                             <p className="mt-1 text-xs font-bold text-slate-500">
                                               {isFieldEmployee
                                                 ? (latestLocation ? `${latestLocation.lat.toFixed(5)}, ${latestLocation.lng.toFixed(5)}` : `No location logs for ${dayjs(selectedMapDate).format("DD MMM")}.`)
                                                 : (latestAttendance?.checkInTime ? `Checked in ${formatTime(latestAttendance.checkInTime)}` : `No office check-in for ${dayjs(selectedMapDate).format("DD MMM")}.`)}
                                             </p>
                                             <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                               {isFieldEmployee ? `${locationQuery.data?.length ?? 0} pings tracked` : `${user.shiftStart} - ${user.shiftEnd} shift`}
                                             </p>

                                             {isFieldEmployee && (
                                                <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
                                                  <DialogTrigger asChild>
                                                    <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-4 font-bold text-xs shadow-md">
                                                       View Location History ({locationQuery.data?.length ?? 0} pings)
                                                    </Button>
                                                  </DialogTrigger>
                                                  <DialogContent className="max-w-lg p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close text-left">
                                                    <DialogHeader className="p-8 bg-blue-600 text-white relative">
                                                      <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
                                                         <X className="h-4 w-4" />
                                                      </DialogClose>
                                                      <DialogTitle className="text-2xl font-black">Location Logs History</DialogTitle>
                                                      <p className="text-blue-100 text-xs font-bold mt-1">
                                                         Viewing historic GPS pings for {selectedEmployee?.name} on {dayjs(selectedMapDate).format("DD MMM, YYYY")}.
                                                      </p>
                                                    </DialogHeader>
                                                    <div className="p-8 space-y-4 max-h-[50vh] overflow-y-auto">
                                                      {(locationQuery.data?.length ?? 0) === 0 ? (
                                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-12 text-center">
                                                          <MapPin className="mx-auto h-8 w-8 text-slate-300" />
                                                          <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-slate-400">No location logs yet</p>
                                                          <p className="mt-2 text-xs font-bold text-slate-500">Pings will appear here as soon as the staff device uploads coordinates.</p>
                                                        </div>
                                                      ) : (
                                                        locationQuery.data!.map((log: any, idx: number) => (
                                                          <div key={log.id || idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100/80 shadow-sm">
                                                            <div className="flex items-center gap-3">
                                                              <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                                              <div>
                                                                <p className="text-xs font-black text-slate-800">{log.lat.toFixed(6)}, {log.lng.toFixed(6)}</p>
                                                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{dayjs(log.timestamp).format("hh:mm:ss A")} • Accuracy: {log.accuracy.toFixed(1)}m</p>
                                                              </div>
                                                            </div>
                                                            <Button 
                                                              variant="secondary" 
                                                              size="sm" 
                                                              className="rounded-xl font-bold gap-1 text-[10px] uppercase bg-white border border-slate-200/60 hover:bg-slate-50"
                                                              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${log.lat},${log.lng}`, "_blank")}
                                                            >
                                                              Maps
                                                            </Button>
                                                          </div>
                                                        ))
                                                      )}
                                                    </div>
                                                  </DialogContent>
                                                </Dialog>
                                             )}
                                          </div>
                                       </div>

                                       <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                                          <Button size="icon" variant="secondary" className="h-10 w-10 rounded-xl bg-white/90 backdrop-blur-sm border-white shadow-xl hover:bg-white">
                                             <Navigation className="h-5 w-5 text-slate-600" />
                                          </Button>
                                          <Button size="icon" variant="secondary" className="h-10 w-10 rounded-xl bg-white/90 backdrop-blur-sm border-white shadow-xl hover:bg-white">
                                             <Search className="h-5 w-5 text-slate-600" />
                                          </Button>
                                       </div>
                                    </Card>
                                 </div>
 
                                 {/* Right: Tabbed Activity Hub */}
                                 <div className="col-span-3">
                                    <Tabs defaultValue="attendance" className="h-full flex flex-col">
                                       <TabsList className="bg-white/50 p-1 rounded-xl h-11 border border-slate-200/60 shadow-sm">
                                          <TabsTrigger value="attendance" className="rounded-lg font-bold text-[10px] uppercase px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">Attendance</TabsTrigger>
                                          <TabsTrigger value="tasks" className="rounded-lg font-bold text-[10px] uppercase px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">Tasks</TabsTrigger>
                                          <TabsTrigger value="der" className="rounded-lg font-bold text-[10px] uppercase px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">DER</TabsTrigger>
                                       </TabsList>
                                       
                                       <div className="flex-1 mt-4">
                                          <Card className="border-none shadow-sm ring-1 ring-slate-200/50 bg-white h-full">
                                             <CardContent className="p-6">
                                                <TabsContent value="attendance" className="m-0 space-y-6">
                                                   <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                                                      <div>
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Selected Date</p>
                                                        <p className="mt-1 text-xs font-bold text-slate-900">{dayjs(selectedMapDate).format("DD MMM, YYYY")}</p>
                                                      </div>
                                                      <Badge className="bg-white text-slate-700 border border-slate-200 text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
                                                        {selectedDateSessions.length} session{selectedDateSessions.length === 1 ? "" : "s"}
                                                      </Badge>
                                                   </div>
                                                   {selectedDateSessions.length === 0 ? (
                                                     <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
                                                        <Clock className="mx-auto h-8 w-8 text-slate-300" />
                                                        <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-slate-400">No attendance sessions found</p>
                                                     </div>
                                                   ) : (
                                                     selectedDateSessions.map((session, index) => (
                                                       <div key={session.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm">
                                                          <div className="flex items-start justify-between gap-3">
                                                             <div>
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Session {selectedDateSessions.length - index}</p>
                                                                <div className="mt-2 flex items-center gap-2">
                                                                   <Badge className={cn(
                                                                     "text-[10px] font-black uppercase px-2.5 py-1 rounded-full border",
                                                                     session.punchType === "FIELD"
                                                                       ? "bg-blue-50 text-blue-600 border-blue-100"
                                                                       : "bg-indigo-50 text-indigo-600 border-indigo-100"
                                                                   )}>
                                                                     {session.punchType ?? "MANUAL"}
                                                                   </Badge>
                                                                   <AttendanceStatusBadge
                                                                     status={session.status ?? "ABSENT"}
                                                                     hasCheckOut={Boolean(session.checkOutTime)}
                                                                     checkInTime={session.checkInTime ?? undefined}
                                                                     checkOutTime={session.checkOutTime}
                                                                     shiftStart={user.shiftStart}
                                                                     shiftEnd={user.shiftEnd}
                                                                   />
                                                                </div>
                                                             </div>
                                                             <div className="text-right">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Timeline</p>
                                                                <p className="mt-1 text-xs font-bold text-slate-900">
                                                                  {session.checkInTime ? formatTime(session.checkInTime) : "--"} to {session.checkOutTime ? formatTime(session.checkOutTime) : "Active"}
                                                                </p>
                                                             </div>
                                                          </div>
                                                          <div className="mt-4 grid grid-cols-2 gap-3">
                                                             <div className="rounded-xl bg-white p-3 border border-slate-100">
                                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Check In Coordinates</p>
                                                                <p className="mt-1 text-[11px] font-bold text-slate-700">
                                                                  {session.checkInLat != null && session.checkInLng != null
                                                                    ? `${session.checkInLat.toFixed(4)}, ${session.checkInLng.toFixed(4)}`
                                                                    : "No coordinates"}
                                                                </p>
                                                             </div>
                                                             <div className="rounded-xl bg-white p-3 border border-slate-100">
                                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Check Out Coordinates</p>
                                                                <p className="mt-1 text-[11px] font-bold text-slate-700">
                                                                  {session.checkOutLat != null && session.checkOutLng != null
                                                                    ? `${session.checkOutLat.toFixed(4)}, ${session.checkOutLng.toFixed(4)}`
                                                                    : "Not checked out"}
                                                                </p>
                                                             </div>
                                                          </div>
                                                       </div>
                                                     ))
                                                   )}
                                                   <div className="flex items-start gap-4">
                                                      <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                                                         <MapPin className="h-4 w-4 text-amber-600" />
                                                      </div>
                                                      <div className="flex-1">
                                                         <div className="flex items-center justify-between">
                                                            <p className="text-xs font-bold text-slate-900">{isFieldEmployee ? "Waypoint Reached" : "Punch Location"}</p>
                                                            <span className="text-[10px] font-bold text-slate-400">{dayjs(selectedMapDate).format("DD MMM")}</span>
                                                         </div>
                                                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">{isFieldEmployee ? (latestLocation ? formatTime(latestLocation.timestamp) : "No location pings") : (latestAttendance?.checkInLat != null && latestAttendance?.checkInLng != null ? `${latestAttendance.checkInLat.toFixed(4)}, ${latestAttendance.checkInLng.toFixed(4)}` : "No punch coordinates")}</p>
                                                      </div>
                                                   </div>
                                                </TabsContent>
                                                <TabsContent value="tasks" className="m-0 py-4">
                                                   {employeeTasks.length === 0 ? (
                                                     <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                                        <ClipboardList className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No tasks assigned yet</p>
                                                     </div>
                                                   ) : (
                                                     <div className="grid grid-cols-1 gap-3">
                                                        {employeeTasks.map((task) => (
                                                          <div key={task.id} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                                                             <div className="flex items-start justify-between">
                                                                <div className="space-y-1">
                                                                   <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{task.title}</h4>
                                                                   <p className="text-xs text-slate-500 font-medium leading-relaxed">{task.description}</p>
                                                                </div>
                                                                <Badge className={cn(
                                                                  "text-[10px] font-black uppercase px-2.5 py-1 rounded-lg",
                                                                  task.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                                                                  task.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-600 border-blue-100" :
                                                                  "bg-amber-50 text-amber-600 border-amber-100"
                                                                )}>
                                                                  {task.status.replace("_", " ")}
                                                                </Badge>
                                                             </div>
                                                             <div className="mt-4 pt-3 border-t border-slate-50 flex items-center gap-4">
                                                                <div className="flex items-center gap-1.5 text-slate-400">
                                                                   <Calendar className="h-3.5 w-3.5" />
                                                                   <span className="text-[10px] font-bold uppercase tracking-wider">{new Date(task.dueDate).toLocaleDateString()}</span>
                                                                </div>
                                                             </div>
                                                          </div>
                                                        ))}
                                                     </div>
                                                   )}
                                                </TabsContent>
                                                <TabsContent value="der" className="m-0 py-4">
                                                   {employeeReports.length === 0 ? (
                                                     <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                                        <MapIcon className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No reports submitted yet</p>
                                                     </div>
                                                   ) : (
                                                     <div className="grid grid-cols-1 gap-4">
                                                        {employeeReports.map((report) => (
                                                          <div key={report.id} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                                             <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                                                                <div className="flex items-center gap-2">
                                                                   <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                                                      <Calendar className="h-4 w-4 text-blue-600" />
                                                                   </div>
                                                                   <span className="text-xs font-black text-slate-900">{new Date(report.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                                </div>
                                                                <Badge className="bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full">{report.kmTravelled} KM</Badge>
                                                             </div>
                                                             
                                                             <div className="grid grid-cols-2 gap-3 mb-4">
                                                                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/50 flex items-center gap-3">
                                                                   <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                                                                      <Package className="h-3.5 w-3.5 text-emerald-600" />
                                                                   </div>
                                                                   <div>
                                                                      <p className="text-[10px] font-black text-emerald-800 uppercase leading-none">{report.ordersTaken}</p>
                                                                      <p className="text-[9px] font-bold text-emerald-600 uppercase mt-1">Orders</p>
                                                                   </div>
                                                                </div>
                                                                <div className="p-3 rounded-xl bg-red-50/50 border border-red-100/50 flex items-center gap-3">
                                                                   <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                                                                      <XCircle className="h-3.5 w-3.5 text-red-600" />
                                                                   </div>
                                                                   <div>
                                                                      <p className="text-[10px] font-black text-red-800 uppercase leading-none">{report.ordersCancelled}</p>
                                                                      <p className="text-[9px] font-bold text-red-600 uppercase mt-1">Cancelled</p>
                                                                   </div>
                                                                </div>
                                                             </div>

                                                             <div className="space-y-3">
                                                                <div>
                                                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Work Summary</p>
                                                                   <p className="text-xs font-medium text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">{report.visitsSummary}</p>
                                                                </div>
                                                                {report.remarks && (
                                                                  <div>
                                                                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Additional Remarks</p>
                                                                     <p className="text-xs font-medium text-slate-500 italic leading-relaxed">{report.remarks}</p>
                                                                  </div>
                                                                )}
                                                             </div>
                                                          </div>
                                                        ))}
                                                     </div>
                                                   )}
                                                </TabsContent>
                                             </CardContent>
                                          </Card>
                                       </div>
                                    </Tabs>
                                 </div>
                              </div>
                           </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
 
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/10">
           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Showing {filteredUsers.length} of {usersQuery.data?.total ?? filteredUsers.length} entries
           </div>
           <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><ChevronRight className="h-4 w-4" /></Button>
           </div>
        </div>
      </Card>

      {/* Edit Employee Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        {editingUser && (
          <EmployeeDialog 
            mode="EDIT" 
            user={editingUser}
            role={editingUser.role === "MANAGER" ? "MANAGER" : "EMPLOYEE"}
            managers={managers}
            onSuccess={() => {
              setEditingUser(null);
              queryClient.invalidateQueries({ queryKey: ["users"] });
            }} 
          />
        )}
      </Dialog>

      {/* Assign Task Dialog (from dropdown) */}
      <Dialog open={isAssignOpen && !!selectedUser} onOpenChange={(open) => { if (!open) { setIsAssignOpen(false); setSelectedUser(null); }}}>
        {selectedUser && (
          <TaskDialog 
            user={selectedUser} 
            onSuccess={() => {
              setIsAssignOpen(false);
              setSelectedUser(null);
              queryClient.invalidateQueries({ queryKey: ["tasks"] });
            }} 
          />
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmUser} onOpenChange={(open) => !open && setDeleteConfirmUser(null)}>
        <DialogContent className="max-w-sm rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Delete Employee</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Are you sure you want to permanently delete <strong className="text-slate-700">{deleteConfirmUser?.name}</strong>? This will remove all their attendance records, tasks, location logs, reports, and expenses. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-4">
            <Button 
              variant="ghost" 
              onClick={() => setDeleteConfirmUser(null)} 
              className="rounded-xl font-bold text-slate-500"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              className="rounded-xl font-bold bg-red-600 hover:bg-red-700 shadow-lg shadow-red-100"
              disabled={isDeleting}
              onClick={async () => {
                if (!deleteConfirmUser) return;
                setIsDeleting(true);
                try {
                  await deleteUser(deleteConfirmUser.id);
                  queryClient.invalidateQueries({ queryKey: ["users"] });
                  setDeleteConfirmUser(null);
                  if (expandedId === deleteConfirmUser.id) setExpandedId(null);
                } catch (err: any) {
                  alert(err?.response?.data?.message ?? "Failed to delete employee.");
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
 
function EmployeeDialog({ 
  mode, 
  user, 
  role = "EMPLOYEE",
  managers,
  onSuccess 
}: { 
  mode: "CREATE" | "EDIT", 
  user?: User,
  role?: "EMPLOYEE" | "MANAGER",
  managers: User[],
  onSuccess: () => void 
}) {
  const { user: currentUser } = useAuth();
  const staffRole = mode === "EDIT" ? user?.role ?? role : role;
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [workMode, setWorkMode] = useState<WorkMode>(user?.workMode ?? "OFFICE");
  const [designation, setDesignation] = useState(user?.designation ?? (staffRole === "MANAGER" ? "Manager" : ""));
  const [joiningDate, setJoiningDate] = useState(user?.joiningDate ? new Date(user.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [managerId, setManagerId] = useState(user?.managerId ?? "none");
  const [groupId, setGroupId] = useState(user?.groupId ?? "none");
  const [baseSalary, setBaseSalary] = useState(user?.baseSalary?.toString() ?? "0");
  const [shiftStart, setShiftStart] = useState(user?.shiftStart ?? "09:00");
  const [shiftEnd, setShiftEnd] = useState(user?.shiftEnd ?? "18:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setAvatarUrl(data.url);
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const finalDesignation = staffRole === "MANAGER" && !designation.trim() ? "Manager" : designation;
    try {
      if (mode === "CREATE") {
        await createUser({ 
          name, email, password, phone, role: staffRole as any, workMode,
          designation: finalDesignation, joiningDate: new Date(joiningDate),
          companyId: currentUser?.companyId, managerId: managerId === "none" ? undefined : managerId,
          groupId: groupId === "none" ? undefined : groupId, avatarUrl, baseSalary: parseFloat(baseSalary || "0"),
          shiftStart, shiftEnd
        });
      } else if (user) {
        const updatePayload: any = {
          name, email, phone, workMode, designation: finalDesignation, joiningDate: new Date(joiningDate),
          avatarUrl, managerId: managerId === "none" ? null : managerId,
          groupId: groupId === "none" ? null : groupId, baseSalary: parseFloat(baseSalary || "0"),
          shiftStart, shiftEnd
        };
        if (password.trim()) {
          updatePayload.password = password;
        }
        await updateUser(user.id, updatePayload);
      }
      onSuccess();
    } catch (err: any) {
      alert(JSON.stringify(err?.response?.data?.error || err?.response?.data?.message || err.message, null, 2));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-white">
      <DialogHeader className="sr-only">
        <DialogTitle>
          {mode === "CREATE" ? `Add New ${staffRole === "MANAGER" ? "Manager" : "Employee"}` : "Edit Employee"}
        </DialogTitle>
        <DialogDescription>Fill in the details for the staff member.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col md:flex-row h-full">
        {/* Left Side: Profile & Branding */}
        <div className="w-full md:w-1/3 bg-slate-900 p-10 flex flex-col items-center justify-center text-center">
          <div className="relative group mb-6">
            <Avatar className="h-40 w-40 border-4 border-slate-800 shadow-2xl ring-4 ring-blue-600/20 group-hover:ring-blue-600/40 transition-all">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <AvatarFallback className="bg-slate-800 text-slate-400">
                  <UserIcon className="h-16 w-16" />
                </AvatarFallback>
              )}
            </Avatar>
            <label htmlFor="avatar-upload" className="absolute bottom-2 right-2 h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center cursor-pointer shadow-lg transition-transform hover:scale-110 active:scale-95">
              {isUploading ? <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> : <Edit className="h-5 w-5 text-white" />}
              <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
            </label>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{name || `New ${staffRole === "MANAGER" ? "Manager" : "Employee"}`}</h2>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-relaxed">
            {mode === "CREATE" ? "Account Setup" : "Profile Settings"}
          </p>
          <div className="mt-8 space-y-4 w-full">
             <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Company Access</p>
                <p className="text-xs font-bold text-white truncate">{email || "email@company.com"}</p>
             </div>
             <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Security Status</p>
                <div className="flex items-center gap-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                   <p className="text-xs font-bold text-emerald-400">Verified System Access</p>
                </div>
             </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="flex-1 p-10 max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex items-center justify-between">
               <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Personnel Details</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mt-1">Professional Identity & Contact</p>
               </div>
               <Badge className="bg-blue-50 text-blue-600 border-blue-100 font-bold px-3 py-1">
                 Role: {staffRole}
               </Badge>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Full Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Phone *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} required className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {mode === "CREATE" ? "Password *" : "New Password (leave blank to keep current)"}
                </Label>
                <Input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required={mode === "CREATE"} 
                  className="h-11 rounded-xl" 
                  placeholder={mode === "EDIT" ? "••••••••" : ""}
                />
              </div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Designation</Label><Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Senior Technician" className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Joining Date</Label><Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Work Mode</Label>
                <Select value={workMode} onValueChange={(v: any) => setWorkMode(v)}>
                   <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                   <SelectContent><SelectItem value="OFFICE">Office</SelectItem><SelectItem value="FIELD">Field</SelectItem><SelectItem value="BOTH">Both</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Assign Department</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                   <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="No Department" /></SelectTrigger>
                   <SelectContent>
                      <SelectItem value="none">No Department (Independent)</SelectItem>
                      {groupsQuery.data?.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>
              {staffRole === "EMPLOYEE" && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reporting Manager</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Directly to Admin</SelectItem>
                      {managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Base Salary</Label><Input type="number" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Shift Start *</Label><Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} required className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Shift End *</Label><Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} required className="h-11 rounded-xl" /></div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-blue-600 rounded-xl font-bold shadow-xl shadow-blue-100">
               {isSubmitting ? "Processing..." : "Save Staff Member"}
            </Button>
          </form>
        </div>
      </div>
    </DialogContent>
  );
}

function calculateDistanceKm(logs: { lat: number; lng: number; timestamp: string }[]) {
  const orderedLogs = logs
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return orderedLogs.reduce((total, point, index) => {
    const previous = orderedLogs[index - 1];
    return previous ? total + haversineKm(previous, point) : total;
  }, 0);
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * radiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function resolveDisplayedWorkMode(defaultWorkMode: WorkMode, latestAttendance?: AttendanceRecord) {
  return latestAttendance?.punchType ?? defaultWorkMode;
}

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

function getAttendanceSessionsForDate(records: AttendanceRecord[], dateStr: string) {
  const dayKey = dayjs(dateStr).format("YYYY-MM-DD");

  return records
    .filter((record) => Boolean(record.checkInTime) && dayjs(record.date).format("YYYY-MM-DD") === dayKey)
    .sort(sortAttendanceByLatestEventDesc);
}

function sortAttendanceByLatestEventDesc(a: AttendanceRecord, b: AttendanceRecord) {
  return getAttendanceLatestEventTs(b) - getAttendanceLatestEventTs(a);
}

function getAttendanceLatestEventTs(record: AttendanceRecord) {
  return new Date(record.checkOutTime ?? record.checkInTime ?? record.date).getTime();
}

function TaskDialog({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createTask({
        title,
        description,
        assignedToId: user.id,
        dueDate: new Date(dueDate).toISOString(),
        isRepeating,
        repeatFrequency: isRepeating ? repeatFrequency : undefined
      });
      onSuccess();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to assign task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white">
      <DialogHeader className="p-8 bg-blue-600 text-white">
        <DialogTitle className="text-xl font-bold">Assign Task to {user.name}</DialogTitle>
        <DialogDescription className="text-blue-100 text-xs font-medium">Create a new directive for this team member.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Task Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Visit Client Site" className="h-11 rounded-xl bg-slate-50 border-slate-200" required />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide specific instructions..." className="h-11 rounded-xl bg-slate-50 border-slate-200" required />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11 rounded-xl bg-slate-50 border-slate-200" required />
          </div>
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
             <div className="flex items-center gap-2 flex-1">
                <input 
                  type="checkbox" 
                  id="isRepeating" 
                  checked={isRepeating} 
                  onChange={(e) => setIsRepeating(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <Label htmlFor="isRepeating" className="text-xs font-bold text-slate-700">Repeating Task</Label>
             </div>
             {isRepeating && (
                <Select value={repeatFrequency} onValueChange={(v: any) => setRepeatFrequency(v)}>
                   <SelectTrigger className="h-9 w-32 rounded-lg bg-white border-slate-200 text-xs font-bold">
                      <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                   </SelectContent>
                </Select>
             )}
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 rounded-xl font-bold" disabled={isSubmitting}>
             {isSubmitting ? "Assigning..." : "Assign Task"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
 
function ChevronLeft(props: any) { return <ChevronUp className="rotate-[270deg]" {...props} />; }
function ChevronRight(props: any) { return <ChevronUp className="rotate-[90deg]" {...props} />; }
