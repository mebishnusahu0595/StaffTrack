"use client";

import React, { useState } from "react";
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  MessageSquare,
  Download,
  Settings,
  Plus,
  Sliders,
  Check,
  Building,
  UserCheck,
  FileSpreadsheet,
  Settings2,
  CalendarDays,
  FileText,
  UserPlus2,
  ListFilter,
  X,
  Trash
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchLeaves, 
  updateLeaveStatus, 
  fetchLeaveTypes, 
  createLeaveType,
  fetchHolidays,
  createHoliday,
  fetchEmployees,
  updateLeaveType,
  deleteLeaveType
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function LeaveManagementPage() {
  const queryClient = useQueryClient();
  const [activeMainTab, setActiveMainTab] = useState<"requests" | "calendar" | "setup">("requests");
  
  // Leave Requests state
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("PENDING");

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState(dayjs());

  // Leave Setup state
  const [showWelcome, setShowWelcome] = useState(true);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [preferredCycle, setPreferredCycle] = useState<"CALENDAR" | "FINANCIAL">("CALENDAR");

  // Create New Leave form state
  const [leaveName, setLeaveName] = useState("");
  const [leaveAlias, setLeaveAlias] = useState("");
  const [leaveDescription, setLeaveDescription] = useState("");
  const [autoAllocCount, setAutoAllocCount] = useState("0");
  const [autoAllocFreq, setAutoAllocFreq] = useState("MONTHLY"); // MONTHLY, YEARLY
  const [carryForwardCount, setCarryForwardCount] = useState("0");
  const [carryForwardFreq, setCarryForwardFreq] = useState("END_OF_MONTH"); // END_OF_MONTH, END_OF_YEAR
  const [encashment, setEncashment] = useState(false);

  // Edit Leave Category state
  const [editingLeaveType, setEditingLeaveType] = useState<any | null>(null);
  const [isEditLeaveOpen, setIsEditLeaveOpen] = useState(false);
  const [editLeaveName, setEditLeaveName] = useState("");
  const [editLeaveAlias, setEditLeaveAlias] = useState("");
  const [editLeaveDescription, setEditLeaveDescription] = useState("");
  const [editAutoAllocCount, setEditAutoAllocCount] = useState("0");
  const [editAutoAllocFreq, setEditAutoAllocFreq] = useState("MONTHLY");
  const [editCarryForwardCount, setEditCarryForwardCount] = useState("0");
  const [editCarryForwardFreq, setEditCarryForwardFreq] = useState("END_OF_MONTH");
  const [editEncashment, setEditEncashment] = useState(false);

  // Delete Leave Category state
  const [deletingLeaveType, setDeletingLeaveType] = useState<any | null>(null);
  const [isDeleteLeaveOpen, setIsDeleteLeaveOpen] = useState(false);

  // New Drawer State
  const [drawerTab, setDrawerTab] = useState<"assign" | "rules">("rules");
  const [assignType, setAssignType] = useState<"HOLIDAY" | "PAID_LEAVE" | "FESTIVAL">("HOLIDAY");
  const [assignName, setAssignName] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [assignEndDate, setAssignEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [assignWeekdays, setAssignWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [assignSelectedUsers, setAssignSelectedUsers] = useState<string[]>([]);
  const [assignCycle, setAssignCycle] = useState<"ONCE" | "WEEKLY" | "MONTHLY">("ONCE");
  const [assignMonthlyDates, setAssignMonthlyDates] = useState<number[]>([]);

  // Fetch employees
  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: () => fetchEmployees()
  });
  const employees = employeesQuery.data || [];

  const handleAssignLeaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignName) {
      alert("Please enter a name.");
      return;
    }

    try {
      let start = dayjs(assignStartDate);
      const end = dayjs(assignEndDate);
      const dates: string[] = [];

      while (start.isBefore(end) || start.isSame(end, "day")) {
        if (assignCycle === "ONCE") {
          dates.push(start.format("YYYY-MM-DD"));
        } else if (assignCycle === "WEEKLY") {
          const dayOfWeek = start.day();
          if (assignWeekdays.includes(dayOfWeek)) {
            dates.push(start.format("YYYY-MM-DD"));
          }
        } else if (assignCycle === "MONTHLY") {
          const dateOfMonth = start.date();
          if (assignMonthlyDates.includes(dateOfMonth)) {
            dates.push(start.format("YYYY-MM-DD"));
          }
        }
        start = start.add(1, "day");
      }

      if (dates.length === 0) {
        alert("No dates match the selected cycle parameters in the range.");
        return;
      }

      const targetUserIds = assignSelectedUsers.length > 0 ? assignSelectedUsers : undefined;

      for (const d of dates) {
        await createHoliday({
          date: new Date(d),
          name: assignName,
          type: assignType,
          userIds: targetUserIds
        });
      }

      alert("Leaves/Holidays assigned successfully!");
      setIsCreateDrawerOpen(false);
      
      // Reset assign form
      setAssignName("");
      setAssignSelectedUsers([]);
      
      void queryClient.invalidateQueries({ queryKey: ["holidays"] });
    } catch (err) {
      console.error(err);
      alert("Failed to assign leaves/holidays");
    }
  };

  // Queries
  const leavesQuery = useQuery({
    queryKey: ["leaves", activeTab],
    queryFn: () => fetchLeaves({ status: activeTab === "ALL" ? undefined : activeTab })
  });

  const leaveTypesQuery = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: fetchLeaveTypes
  });

  const holidaysQuery = useQuery({
    queryKey: ["holidays"],
    queryFn: fetchHolidays
  });

  // Mutations
  const updateLeaveStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: "APPROVED" | "REJECTED" }) => 
      updateLeaveStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leaves"] });
    }
  });

  const createLeaveTypeMutation = useMutation({
    mutationFn: createLeaveType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leaveTypes"] });
      setIsCreateDrawerOpen(false);
      // Reset form
      setLeaveName("");
      setLeaveAlias("");
      setLeaveDescription("");
      setAutoAllocCount("0");
      setAutoAllocFreq("MONTHLY");
      setCarryForwardCount("0");
      setCarryForwardFreq("END_OF_MONTH");
      setEncashment(false);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to create leave type.");
    }
  });

  const updateLeaveTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateLeaveType(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leaveTypes"] });
      setIsEditLeaveOpen(false);
      setEditingLeaveType(null);
      alert("Leave category successfully updated!");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to update leave category.");
    }
  });

  const deleteLeaveTypeMutation = useMutation({
    mutationFn: (id: string) => deleteLeaveType(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leaveTypes"] });
      setIsDeleteLeaveOpen(false);
      setDeletingLeaveType(null);
      alert("Leave category successfully deleted!");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to delete leave category.");
    }
  });

  const handleCreateLeaveType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveName || !leaveAlias) {
      alert("Please fill in all required fields.");
      return;
    }
    createLeaveTypeMutation.mutate({
      name: leaveName,
      alias: leaveAlias,
      description: leaveDescription,
      autoAllocationCount: parseFloat(autoAllocCount),
      autoAllocationFreq: autoAllocFreq,
      carryForward: parseFloat(carryForwardCount),
      carryForwardFreq: carryForwardFreq,
      encashment,
      leaveCycle: preferredCycle
    });
  };

  const leaves = leavesQuery.data ?? [];
  const holidays = holidaysQuery.data ?? [];

  const filteredLeaves = leaves.filter((l: any) => 
    (l.user?.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.reason || "").toLowerCase().includes(search.toLowerCase())
  );

  const leaveTypes = leaveTypesQuery.data ?? [];

  // Generate calendar days
  const startDay = calendarDate.startOf("month").startOf("week");
  const endDay = calendarDate.endOf("month").endOf("week");
  const days: dayjs.Dayjs[] = [];
  let currentCalDay = startDay;
  while (currentCalDay.isBefore(endDay) || currentCalDay.isSame(endDay, "day")) {
    days.push(currentCalDay);
    currentCalDay = currentCalDay.add(1, "day");
  }

  const downloadCSV = () => {
    if (filteredLeaves.length === 0) return;
    const headers = ["Employee Name", "Designation", "Start Date", "End Date", "Reason", "Status", "Processed By", "Processed Date"];
    const rows = filteredLeaves.map((l: any) => [
      l.user?.name || "Unknown",
      l.user?.designation || "Staff",
      dayjs(l.startDate).format("YYYY-MM-DD"),
      dayjs(l.endDate).format("YYYY-MM-DD"),
      l.reason || "",
      l.status || "",
      l.approvedBy?.name || "--",
      l.status !== "PENDING" ? dayjs(l.updatedAt).format("YYYY-MM-DD") : "--"
    ]);
    
    const csvString = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${(val ?? "").toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Leave_Applications_Report_${activeTab}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-500">
      
      {/* Header bar switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Calendar className="h-3 w-3 text-blue-500" />
            <span>Management / Leaves Console</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
            Leaves Control Center
          </h1>
        </div>

        <Button
          onClick={() => {
            setDrawerTab("assign");
            setIsCreateDrawerOpen(true);
          }}
          className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold gap-2 px-5 shadow-lg shadow-blue-100 self-start md:self-auto"
        >
          <Plus className="h-4.5 w-4.5" />
          Assign Leave / Off
        </Button>
      </div>

      {/* ==================== LEAVE REQUESTS ==================== */}
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white p-6 rounded-[32px] border border-slate-200/60 shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="bg-slate-100 p-1 rounded-2xl h-12">
              <TabsTrigger value="PENDING" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 shadow-none">Pending</TabsTrigger>
              <TabsTrigger value="APPROVED" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-emerald-600 shadow-none">Approved</TabsTrigger>
              <TabsTrigger value="REJECTED" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-rose-600 shadow-none">Rejected</TabsTrigger>
              <TabsTrigger value="ALL" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-slate-600 shadow-none">All</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search by name or reason..." 
                className="h-12 pl-12 rounded-2xl bg-slate-50 border-none focus:bg-white transition-all font-bold text-xs" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              className="rounded-2xl border-slate-200 bg-white font-bold text-slate-700 gap-2 h-12 shadow-sm px-5 hover:bg-slate-50 text-xs flex-shrink-0"
              onClick={downloadCSV}
              disabled={filteredLeaves.length === 0}
            >
              <Download className="h-4 w-4 text-slate-500" /> Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leavesQuery.isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 bg-white rounded-[32px] animate-pulse border border-slate-100" />
            ))
          ) : filteredLeaves.length === 0 ? (
            <div className="col-span-full py-24 text-center space-y-4 bg-white rounded-[40px] border-none shadow-sm ring-1 ring-slate-200/60">
               <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                  <Calendar className="h-10 w-10" />
                </div>
                <div>
                   <p className="text-xl font-black text-slate-900">No Applications Found</p>
                   <p className="text-slate-400 font-bold text-sm">There are no leave requests matching your filters.</p>
                </div>
            </div>
          ) : (
            filteredLeaves.map((leave: any) => (
              <Card key={leave.id} className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 hover:ring-blue-400 transition-all duration-300 group bg-white overflow-hidden text-left">
                 <CardHeader className="p-6 border-b border-slate-50">
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 rounded-2xl border-2 border-white shadow-md">
                             <AvatarImage src={leave.user?.avatarUrl} />
                             <AvatarFallback className="bg-slate-50 text-slate-400 font-bold">
                                {leave.user?.name?.[0] || '?'}
                             </AvatarFallback>
                          </Avatar>
                          <div>
                             <h3 className="font-black text-slate-900 leading-none">{leave.user?.name || 'Unknown'}</h3>
                             <p className="text-[10px] font-black uppercase text-slate-400 mt-1">{leave.user?.designation || 'Staff'}</p>
                          </div>
                       </div>
                       <Badge className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-md border",
                          leave.status === "PENDING" ? "bg-amber-50 text-amber-600 border-amber-100" :
                          leave.status === "APPROVED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          "bg-rose-50 text-rose-600 border-rose-100"
                       )}>
                          {leave.status}
                       </Badge>
                    </div>
                 </CardHeader>
                 <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Start Date</p>
                          <p className="text-xs font-black text-slate-700">{dayjs(leave.startDate).format("MMM DD, YYYY")}</p>
                       </div>
                       <div className="p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-1">End Date</p>
                          <p className="text-xs font-black text-slate-700">{dayjs(leave.endDate).format("MMM DD, YYYY")}</p>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <div className="flex items-center gap-2">
                          <MessageSquare className="h-3 w-3 text-slate-400" />
                          <span className="text-[9px] font-black uppercase text-slate-400">Reason</span>
                       </div>
                       <p className="text-xs font-medium text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
                          {leave.reason}
                       </p>
                    </div>

                    {leave.status === "PENDING" && (
                       <div className="flex gap-3 pt-2">
                          <Button 
                            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 rounded-2xl text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-100"
                            onClick={() => updateLeaveStatusMutation.mutate({ id: leave.id, status: "APPROVED" })}
                            disabled={updateLeaveStatusMutation.isPending}
                          >
                             {updateLeaveStatusMutation.isPending ? "..." : "Approve"}
                          </Button>
                          <Button 
                            variant="ghost"
                            className="flex-1 h-12 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                            onClick={() => updateLeaveStatusMutation.mutate({ id: leave.id, status: "REJECTED" })}
                            disabled={updateLeaveStatusMutation.isPending}
                          >
                             Reject
                          </Button>
                       </div>
                    )}

                    {leave.status !== "PENDING" && (
                       <div className="pt-2 flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                             <UserIcon className="h-4 w-4 text-slate-400" />
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 italic">
                             {leave.status.toLowerCase()} by {leave.approvedBy?.name || 'Admin'} on {dayjs(leave.updatedAt).format("MMM DD")}
                          </p>
                       </div>
                    )}
                 </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create New Leave Drawer */}
      <Sheet open={isCreateDrawerOpen} onOpenChange={setIsCreateDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md p-8 overflow-y-auto bg-white rounded-l-[32px] border-none shadow-2xl flex flex-col justify-between">
          <div className="space-y-8">
            <SheetHeader className="text-left">
              <SheetTitle className="text-2xl font-black text-slate-900">Assign Leave / Off</SheetTitle>
            </SheetHeader>

            <form onSubmit={handleAssignLeaveHoliday} className="space-y-6">
              {/* Assign Leave/Holiday Form */}
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Type *</Label>
                 <select 
                    value={assignType}
                    onChange={(e: any) => setAssignType(e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-50 border border-slate-200/60 focus:bg-white transition-all font-bold text-xs outline-none"
                 >
                    <option value="HOLIDAY">Holiday</option>
                    <option value="PAID_LEAVE">Paid Leave</option>
                    <option value="FESTIVAL">Festival / Special Day</option>
                 </select>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Title / Name *</Label>
                 <Input 
                    placeholder="e.g. Sick Leave, General Off" 
                    required
                    value={assignName}
                    onChange={e => setAssignName(e.target.value)}
                    className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold text-xs" 
                 />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Start Date</Label>
                    <Input 
                       type="date"
                       value={assignStartDate}
                       onChange={e => setAssignStartDate(e.target.value)}
                       className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold text-xs" 
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">End Date</Label>
                    <Input 
                       type="date"
                       value={assignEndDate}
                       onChange={e => setAssignEndDate(e.target.value)}
                       className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold text-xs" 
                    />
                 </div>
               </div>

              {/* Cycle Selection */}
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cycle Frequency</Label>
                 <select 
                    value={assignCycle}
                    onChange={(e: any) => setAssignCycle(e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-50 border border-slate-200/60 focus:bg-white transition-all font-bold text-xs outline-none"
                 >
                    <option value="ONCE">Once (Single Range)</option>
                    <option value="WEEKLY">Weekly Recurring</option>
                    <option value="MONTHLY">Monthly Recurring</option>
                 </select>
              </div>

              {/* Weekday Selection */}
              {assignCycle === "WEEKLY" && (
                 <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Weekdays</Label>
                    <div className="flex flex-wrap gap-1.5">
                       {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
                          const isSelected = assignWeekdays.includes(idx);
                          return (
                             <button
                                type="button"
                                key={day}
                                onClick={() => {
                                   if (isSelected) {
                                      setAssignWeekdays(assignWeekdays.filter(w => w !== idx));
                                   } else {
                                      setAssignWeekdays([...assignWeekdays, idx]);
                                   }
                                }}
                                className={cn(
                                   "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all",
                                   isSelected 
                                      ? "bg-blue-600 text-white shadow-sm"
                                      : "bg-slate-50 text-slate-500 border border-slate-200/60 hover:bg-slate-100"
                                )}
                             >
                                {day}
                             </button>
                          );
                       })}
                    </div>
                 </div>
              )}

              {/* Monthly Dates Selection */}
              {assignCycle === "MONTHLY" && (
                 <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Days of Month</Label>
                    <div className="grid grid-cols-7 gap-1 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-100">
                       {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                          const isSelected = assignMonthlyDates.includes(day);
                          return (
                             <button
                                type="button"
                                key={day}
                                onClick={() => {
                                   if (isSelected) {
                                      setAssignMonthlyDates(assignMonthlyDates.filter(d => d !== day));
                                   } else {
                                      setAssignMonthlyDates([...assignMonthlyDates, day]);
                                   }
                                }}
                                className={cn(
                                   "h-8 w-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center",
                                   isSelected 
                                      ? "bg-blue-600 text-white shadow-sm"
                                      : "hover:bg-slate-200 text-slate-600"
                                )}
                             >
                                {day}
                             </button>
                          );
                       })}
                    </div>
                 </div>
              )}

              {/* Select Employees */}
              <div className="space-y-2">
                 <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Employees *</Label>
                    <button 
                       type="button"
                       onClick={() => {
                          if (assignSelectedUsers.length === employees.length) {
                             setAssignSelectedUsers([]);
                          } else {
                             setAssignSelectedUsers(employees.map((e: any) => e.id));
                          }
                       }}
                       className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-700 tracking-wider"
                    >
                       {assignSelectedUsers.length === employees.length ? "Deselect All" : "Select All"}
                    </button>
                 </div>
                 <div className="border border-slate-200/60 rounded-2xl p-4 bg-slate-50/50 max-h-48 overflow-y-auto space-y-2">
                    {employeesQuery.isLoading ? (
                       <p className="text-xs font-bold text-slate-400 text-center py-4">Loading employees...</p>
                    ) : employees.length === 0 ? (
                       <p className="text-xs font-bold text-slate-400 text-center py-4">No employees found.</p>
                    ) : (
                       employees.map((emp: any) => {
                          const isSelected = assignSelectedUsers.includes(emp.id);
                          return (
                             <div 
                               key={emp.id} 
                               onClick={() => {
                                  if (isSelected) {
                                     setAssignSelectedUsers(assignSelectedUsers.filter(id => id !== emp.id));
                                  } else {
                                     setAssignSelectedUsers([...assignSelectedUsers, emp.id]);
                                  }
                               }}
                               className={cn(
                                  "flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all hover:bg-slate-100/50",
                                  isSelected && "bg-white shadow-sm ring-1 ring-slate-200/50"
                               )}
                             >
                                <div className="flex items-center gap-2.5">
                                   <Avatar className="h-7 w-7 rounded-lg">
                                      <AvatarImage src={emp.avatarUrl} />
                                      <AvatarFallback className="bg-slate-100 text-[10px] font-black text-slate-400">
                                         {emp.name?.[0] || '?'}
                                      </AvatarFallback>
                                   </Avatar>
                                   <div>
                                      <p className="text-xs font-black text-slate-800 leading-none">{emp.name}</p>
                                      <p className="text-[8px] font-black uppercase text-slate-400 mt-0.5">{emp.designation || 'Staff'}</p>
                                   </div>
                                </div>
                                <div className={cn(
                                   "h-4 w-4 rounded border flex items-center justify-center transition-all",
                                   isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"
                                )}>
                                   {isSelected && <Check className="h-2.5 w-2.5 font-bold" />}
                                </div>
                             </div>
                          );
                       })
                    )}
                 </div>
              </div>

              <Button 
                type="submit"
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] mt-6"
              >
                 Assign Leave / Off
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
