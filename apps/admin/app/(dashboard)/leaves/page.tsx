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
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchLeaves, 
  updateLeaveStatus, 
  fetchLeaveTypes, 
  createLeaveType 
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
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function LeaveManagementPage() {
  const queryClient = useQueryClient();
  const [activeMainTab, setActiveMainTab] = useState<"requests" | "setup">("requests");
  
  // Leave Requests state
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("PENDING");

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

  // Queries
  const leavesQuery = useQuery({
    queryKey: ["leaves", activeTab],
    queryFn: () => fetchLeaves({ status: activeTab === "ALL" ? undefined : activeTab })
  });

  const leaveTypesQuery = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: fetchLeaveTypes
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
  const filteredLeaves = leaves.filter((l: any) => 
    l.user.name.toLowerCase().includes(search.toLowerCase()) ||
    l.reason.toLowerCase().includes(search.toLowerCase())
  );

  const leaveTypes = leaveTypesQuery.data ?? [];

  const downloadCSV = () => {
    if (filteredLeaves.length === 0) return;
    const headers = ["Employee Name", "Designation", "Start Date", "End Date", "Reason", "Status", "Processed By", "Processed Date"];
    const rows = filteredLeaves.map((l: any) => [
      l.user.name,
      l.user.designation || "Staff",
      dayjs(l.startDate).format("YYYY-MM-DD"),
      dayjs(l.endDate).format("YYYY-MM-DD"),
      l.reason,
      l.status,
      l.approvedBy?.name || "--",
      l.status !== "PENDING" ? dayjs(l.updatedAt).format("YYYY-MM-DD") : "--"
    ]);
    
    const csvString = [headers.join(","), ...rows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(","))].join("\n");
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

        {/* Console Switcher Tab list */}
        <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center self-start md:self-auto shadow-inner border border-slate-200/40">
          <button
            onClick={() => setActiveMainTab("requests")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all",
              activeMainTab === "requests" 
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            Leave Requests
          </button>
          <button
            onClick={() => setActiveMainTab("setup")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all",
              activeMainTab === "setup" 
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            Leave Setup
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: LEAVE REQUESTS ==================== */}
      {activeMainTab === "requests" && (
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
                <Card key={leave.id} className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 hover:ring-blue-400 transition-all duration-300 group bg-white overflow-hidden">
                   <CardHeader className="p-6 border-b border-slate-50">
                      <div className="flex justify-between items-start">
                         <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 rounded-2xl border-2 border-white shadow-md">
                               <AvatarImage src={leave.user.avatarUrl} />
                               <AvatarFallback className="bg-slate-50 text-slate-400 font-bold">
                                  {leave.user.name[0]}
                               </AvatarFallback>
                            </Avatar>
                            <div>
                               <h3 className="font-black text-slate-900 leading-none">{leave.user.name}</h3>
                               <p className="text-[10px] font-black uppercase text-slate-400 mt-1">{leave.user.designation || 'Staff'}</p>
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
      )}

      {/* ==================== TAB 2: LEAVE SETUP ==================== */}
      {activeMainTab === "setup" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Welcome Screen (Screenshot #1) */}
          {showWelcome && leaveTypes.length === 0 ? (
            <Card className="rounded-[40px] border-none shadow-xl shadow-slate-200/50 bg-white overflow-hidden p-8 md:p-12 ring-1 ring-slate-100">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                
                {/* Visual Art/Illustration representation (Screenshot #1) */}
                <div className="lg:col-span-6 flex justify-center">
                  <div className="relative w-full max-w-[420px] aspect-[4/3] bg-gradient-to-br from-blue-50/50 via-slate-50 to-indigo-50/30 rounded-3xl p-6 flex flex-col justify-end border border-slate-100 shadow-inner">
                    
                    {/* CSS Line Drawing/Illustration representation of 3 standing employees and Biometric device */}
                    <div className="absolute inset-0 flex items-center justify-around px-8 pb-10">
                      
                      {/* Character 1 */}
                      <div className="flex flex-col items-center translate-y-4">
                        <div className="h-20 w-8 border-[2.5px] border-slate-400 bg-white rounded-full flex flex-col justify-between p-1 items-center">
                          <div className="h-3 w-3 rounded-full bg-slate-400" />
                          <div className="h-8 w-full bg-slate-200 rounded-b-full" />
                        </div>
                        <div className="h-3 w-1 bg-slate-400 mt-1" />
                      </div>

                      {/* Character 2 */}
                      <div className="flex flex-col items-center">
                        <div className="h-24 w-9 border-[2.5px] border-slate-700 bg-slate-900 rounded-full flex flex-col justify-between p-1 items-center">
                          <div className="h-3.5 w-3.5 rounded-full bg-white" />
                          <div className="h-10 w-full bg-slate-700 rounded-b-full" />
                        </div>
                        <div className="h-4 w-1 bg-slate-700 mt-1" />
                      </div>

                      {/* Character 3 punching device */}
                      <div className="flex flex-col items-center -translate-y-4 relative">
                        <div className="h-28 w-10 border-[2.5px] border-slate-500 bg-white rounded-full flex flex-col justify-between p-1.5 items-center">
                          <div className="h-4 w-4 rounded-full bg-slate-400" />
                          <div className="h-12 w-full bg-blue-100 rounded-b-full" />
                        </div>
                        <div className="h-5 w-1 bg-slate-500 mt-1" />
                        
                        {/* Hand pointing to device */}
                        <div className="absolute right-[-14px] top-8 h-2 w-5 bg-slate-400 rounded-full rotate-[-15deg] border-t border-slate-600" />
                      </div>

                      {/* Biometric Circle Punch Device on door */}
                      <div className="absolute right-10 top-16 h-10 w-10 rounded-full bg-slate-900 border-[3px] border-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <div className="h-4 w-4 rounded-full bg-blue-500 animate-ping opacity-60" />
                      </div>

                    </div>

                    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-md flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                        <UserCheck className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Leave Setup Status</p>
                        <p className="text-xs font-black text-slate-800">Not configured yet</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content block */}
                <div className="lg:col-span-6 space-y-6 text-left">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                    Leave Management
                  </h2>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    PetPooja Payroll is equipped with a comprehensive Leave Management Module!
                  </p>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Simplify your leave tracking process and ensure accurate payroll management seamlessly integrated within a single platform.
                  </p>
                  <Button 
                    onClick={() => setShowWelcome(false)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-8 h-12 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-blue-200"
                  >
                    Get Started
                  </Button>
                </div>

              </div>

              {/* 4 Feature Cards at the bottom (Screenshot #1) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-12 border-t border-slate-100 mt-12">
                {[
                  { icon: CalendarDays, title: "Easy Leave Management", desc: "Easily manage staff leaves and records" },
                  { icon: Sliders, title: "Comprehensive Leave Types", desc: "Create Sick, Casual, Paid leave categories" },
                  { icon: Clock, title: "Leave Balances and History", desc: "Track historical balances and monthly overrides" },
                  { icon: FileSpreadsheet, title: "Report & Analytics", desc: "Generate tabular reports instantly" }
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100/60 space-y-4 hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all duration-300">
                    <div className="h-12 w-12 rounded-xl bg-white border border-slate-200/50 flex items-center justify-center text-blue-600 shadow-sm">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">{item.title}</h4>
                      <p className="text-slate-400 text-xs font-semibold leading-relaxed mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

            </Card>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Header Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-[32px] border border-slate-200/60 shadow-sm">
                <div>
                  <h3 className="text-lg font-black text-slate-800">Leave Categories Setup</h3>
                  <p className="text-slate-400 text-xs font-semibold mt-0.5">Configure allocate rules, encashment, and carry forward parameters.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  
                  {/* Select Leave Cycle Trigger (Screenshot #3) */}
                  <Dialog open={isCycleModalOpen} onOpenChange={setIsCycleModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="h-11 rounded-xl border-slate-200 font-bold text-xs gap-2 px-4">
                        <Sliders className="h-4 w-4 text-slate-500" />
                        Preferred Leave Cycle: {preferredCycle === "CALENDAR" ? "Calendar Year" : "Financial Year"}
                      </Button>
                    </DialogTrigger>
                    
                    <DialogContent className="max-w-md p-8 overflow-hidden border-none shadow-2xl bg-white rounded-3xl animate-in zoom-in-95 duration-200">
                      <DialogHeader className="p-0 text-left">
                        <div className="flex items-center justify-between mb-4">
                          <DialogTitle className="text-xl font-black text-slate-900">Create New Leave</DialogTitle>
                        </div>
                        <p className="text-slate-500 text-xs font-bold leading-normal">
                          Select your preferred leave cycle for leave calculations
                        </p>
                      </DialogHeader>

                      <div className="space-y-6 pt-6">
                        
                        {/* Option 1: Calendar Year */}
                        <div 
                          onClick={() => setPreferredCycle("CALENDAR")}
                          className={cn(
                            "flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all",
                            preferredCycle === "CALENDAR" 
                              ? "border-blue-600 bg-blue-50/20" 
                              : "border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div className={cn(
                            "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                            preferredCycle === "CALENDAR" ? "border-blue-600" : "border-slate-300"
                          )}>
                            {preferredCycle === "CALENDAR" && <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-800 text-sm">Calendar Year</p>
                            <p className="text-slate-400 text-xs font-semibold mt-1">January to December timeframe</p>
                          </div>
                        </div>

                        {/* Option 2: Financial Year */}
                        <div 
                          onClick={() => setPreferredCycle("FINANCIAL")}
                          className={cn(
                            "flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all",
                            preferredCycle === "FINANCIAL" 
                              ? "border-blue-600 bg-blue-50/20" 
                              : "border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div className={cn(
                            "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                            preferredCycle === "FINANCIAL" ? "border-blue-600" : "border-slate-300"
                          )}>
                            {preferredCycle === "FINANCIAL" && <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-800 text-sm">Financial Year</p>
                            <p className="text-slate-400 text-xs font-semibold mt-1">Fiscal year, spanning from April to March</p>
                          </div>
                        </div>

                      </div>

                      <DialogFooter className="pt-6">
                        <Button 
                          onClick={() => setIsCycleModalOpen(false)}
                          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-widest text-[10px]"
                        >
                          Confirm & Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Create New Leave Drawer (Screenshot #2) */}
                  <Sheet open={isCreateDrawerOpen} onOpenChange={setIsCreateDrawerOpen}>
                    <SheetTrigger asChild>
                      <Button className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold gap-2 px-5 shadow-lg shadow-blue-100">
                        <Plus className="h-4.5 w-4.5" />
                        Create New Leave
                      </Button>
                    </SheetTrigger>
                    
                    <SheetContent className="w-full sm:max-w-md p-8 overflow-y-auto bg-white rounded-l-[32px] border-none shadow-2xl flex flex-col justify-between">
                      <div className="space-y-8">
                        <SheetHeader className="text-left">
                          <SheetTitle className="text-2xl font-black text-slate-900">Create New Leave</SheetTitle>
                        </SheetHeader>

                        <form onSubmit={handleCreateLeaveType} className="space-y-6">
                          
                          {/* Leave Name */}
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Leave Name *</Label>
                            <Input 
                              placeholder="e.g. Sick Leave" 
                              required
                              value={leaveName}
                              onChange={e => setLeaveName(e.target.value)}
                              className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold text-xs" 
                            />
                          </div>

                          {/* Alias */}
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Alias *</Label>
                            <Input 
                              placeholder="e.g. SL" 
                              required
                              value={leaveAlias}
                              onChange={e => setLeaveAlias(e.target.value)}
                              className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold text-xs" 
                            />
                          </div>

                          {/* Description */}
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Description</Label>
                            <Input 
                              placeholder="Short description..." 
                              value={leaveDescription}
                              onChange={e => setLeaveDescription(e.target.value)}
                              className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold text-xs" 
                            />
                          </div>

                          {/* Number of Auto Allocation Leaves */}
                          <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Number Of Auto Allocation Leaves *</Label>
                            <Input 
                              type="number"
                              required
                              value={autoAllocCount}
                              onChange={e => setAutoAllocCount(e.target.value)}
                              className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold text-xs" 
                            />
                            
                            {/* Every Month vs Every Calendar Year radios */}
                            <div className="flex items-center gap-6">
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="autoAllocFreq" 
                                  checked={autoAllocFreq === "MONTHLY"}
                                  onChange={() => setAutoAllocFreq("MONTHLY")}
                                  className="h-4.5 w-4.5 text-blue-600 border-slate-300 focus:ring-blue-500" 
                                />
                                <span className="text-xs font-bold text-slate-600">Every Month</span>
                              </label>
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="autoAllocFreq" 
                                  checked={autoAllocFreq === "YEARLY"}
                                  onChange={() => setAutoAllocFreq("YEARLY")}
                                  className="h-4.5 w-4.5 text-blue-600 border-slate-300 focus:ring-blue-500" 
                                />
                                <span className="text-xs font-bold text-slate-600">Every Calendar Year</span>
                              </label>
                            </div>
                          </div>

                          {/* Carry Forward */}
                          <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Carry Forward *</Label>
                            <Input 
                              type="number"
                              required
                              value={carryForwardCount}
                              onChange={e => setCarryForwardCount(e.target.value)}
                              className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold text-xs" 
                            />
                            
                            {/* End of month vs calendar year */}
                            <div className="flex items-center gap-6">
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="carryForwardFreq" 
                                  checked={carryForwardFreq === "END_OF_MONTH"}
                                  onChange={() => setCarryForwardFreq("END_OF_MONTH")}
                                  className="h-4.5 w-4.5 text-blue-600 border-slate-300 focus:ring-blue-500" 
                                />
                                <span className="text-xs font-bold text-slate-600">End Of Every Month</span>
                              </label>
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="carryForwardFreq" 
                                  checked={carryForwardFreq === "END_OF_YEAR"}
                                  onChange={() => setCarryForwardFreq("END_OF_YEAR")}
                                  className="h-4.5 w-4.5 text-blue-600 border-slate-300 focus:ring-blue-500" 
                                />
                                <span className="text-xs font-bold text-slate-600">End Of Every Calendar Year</span>
                              </label>
                            </div>
                          </div>

                          {/* Encashment */}
                          <div className="space-y-2.5">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-extrabold">Encashment Of Leave</Label>
                            <div className="flex items-center gap-6">
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="encashment" 
                                  checked={!encashment}
                                  onChange={() => setEncashment(false)}
                                  className="h-4.5 w-4.5 text-blue-600 border-slate-300 focus:ring-blue-500" 
                                />
                                <span className="text-xs font-bold text-slate-600">Off</span>
                              </label>
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="encashment" 
                                  checked={encashment}
                                  onChange={() => setEncashment(true)}
                                  className="h-4.5 w-4.5 text-blue-600 border-slate-300 focus:ring-blue-500" 
                                />
                                <span className="text-xs font-bold text-slate-600">On</span>
                              </label>
                            </div>
                          </div>

                        </form>
                      </div>

                      <SheetFooter className="pt-8">
                        <Button 
                          onClick={handleCreateLeaveType}
                          disabled={createLeaveTypeMutation.isPending}
                          className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px]"
                        >
                          {createLeaveTypeMutation.isPending ? "Creating..." : "Create"}
                        </Button>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>

              {/* Grid of active configurations */}
              {leaveTypesQuery.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-48 bg-white rounded-3xl animate-pulse border border-slate-100" />
                  ))}
                </div>
              ) : leaveTypes.length === 0 ? (
                <div className="py-20 text-center space-y-4 bg-white rounded-[32px] border border-slate-200/50 shadow-sm flex flex-col items-center">
                  <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                    <Sliders className="h-8 w-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-800">No Custom Leave Categories Created</h4>
                    <p className="text-slate-400 text-xs font-semibold mt-1">Configure your leave rules using the &quot;Create New Leave&quot; button above.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {leaveTypes.map((type: any) => (
                    <Card key={type.id} className="rounded-3xl border-none shadow-sm ring-1 ring-slate-200/50 bg-white hover:ring-blue-400 hover:shadow-xl hover:shadow-slate-100 transition-all duration-300 overflow-hidden">
                      <CardHeader className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
                        <div>
                          <h4 className="font-black text-slate-900 text-base">{type.name}</h4>
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{type.alias}</span>
                        </div>
                        <Badge className="bg-blue-50 text-blue-600 font-bold border-none text-[10px] px-2 py-0.5 rounded-md">
                          Active
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                          {type.description || "No description provided."}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Auto Allocation</span>
                            <span className="text-xs font-black text-slate-700">{type.autoAllocationCount} / {type.autoAllocationFreq === "MONTHLY" ? "Month" : "Year"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Carry Forward Limit</span>
                            <span className="text-xs font-black text-slate-700">{type.carryForward} ({type.carryForwardFreq === "END_OF_MONTH" ? "End of Month" : "End of Year"})</span>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between border-t border-slate-50">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Encashment Support</span>
                            <span className="text-xs font-black text-slate-700">{type.encashment ? "Supported" : "Off"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Leave Cycle</span>
                            <span className="text-xs font-black text-slate-700">{type.leaveCycle === "CALENDAR" ? "Jan - Dec" : "Apr - Mar"}</span>
                          </div>
                        </div>

                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
}
