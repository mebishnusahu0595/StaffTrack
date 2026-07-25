"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Check, 
  X, 
  Search, 
  SlidersHorizontal,
  FileCheck,
  Calendar,
  Clock,
  Filter,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MoreVertical,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { fetchAttendanceRequests, approveAttendanceRequest, rejectAttendanceRequest, fetchPendingLateCheckIns, approveLateCheckIn, rejectLateCheckIn } from "@/lib/api";

export default function ApprovalRequestsPage() {
  const [mainTab, setMainTab] = useState<"ADJUSTMENTS" | "LATE_CHECKINS">("ADJUSTMENTS");
  const [activeTab, setActiveTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [searchName, setSearchName] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [appliedName, setAppliedName] = useState("");
  const [appliedType, setAppliedType] = useState("ALL");
  // Shared date filter (empty = all dates). Used by both tabs with day-step arrows.
  const [dateFilter, setDateFilter] = useState("");

  const queryClient = useQueryClient();

  const sameDay = (iso: string, ymd: string) => {
    if (!ymd) return true;
    const d = new Date(iso);
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return local === ymd;
  };

  const stepDate = (days: number) => {
    const base = dateFilter ? new Date(`${dateFilter}T00:00:00`) : new Date();
    base.setDate(base.getDate() + days);
    setDateFilter(
      `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`
    );
  };

  const { data = [], isLoading } = useQuery({
    queryKey: ["attendanceRequests", activeTab],
    queryFn: () => fetchAttendanceRequests(activeTab)
  });

  const { data: lateCheckIns = [], isLoading: isLateCheckInsLoading } = useQuery({
    queryKey: ["pendingLateCheckIns"],
    queryFn: fetchPendingLateCheckIns,
    enabled: mainTab === "LATE_CHECKINS"
  });

  const approveLateCheckInMutation = useMutation({
    mutationFn: approveLateCheckIn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pendingLateCheckIns"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["attendanceRequests"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to approve late check-in.");
    }
  });

  const rejectLateCheckInMutation = useMutation({
    mutationFn: rejectLateCheckIn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pendingLateCheckIns"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["attendanceRequests"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to reject late check-in.");
    }
  });

  const approveMutation = useMutation({
    mutationFn: approveAttendanceRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendanceRequests"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to approve adjustment request.");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: rejectAttendanceRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendanceRequests"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to reject adjustment request.");
    }
  });

  // Client-side search and filters
  const filteredData = data.filter((item: any) => {
    const matchesName = appliedName === "" ||
      item.name.toLowerCase().includes(appliedName.toLowerCase()) ||
      item.employeeId.toLowerCase().includes(appliedName.toLowerCase());

    const matchesType = appliedType === "ALL" || item.type === appliedType;

    const matchesDate = sameDay(item.date, dateFilter);

    return matchesName && matchesType && matchesDate;
  });

  const filteredLateCheckIns = lateCheckIns.filter((item: any) => sameDay(item.date, dateFilter));

  const handleSearch = () => {
    setAppliedName(searchName);
    setAppliedType(filterType);
  };

  const handleClear = () => {
    setSearchName("");
    setFilterType("ALL");
    setAppliedName("");
    setAppliedType("ALL");
  };

  // Dynamically extract unique request types present in data
  const requestTypes = Array.from(new Set(data.map((item: any) => item.type).filter(Boolean))) as string[];

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
          Approval Requests
        </h1>
        <p className="text-slate-500 text-sm">
          Approve or reject employee punch adjustment logs, forgot check-ins, and shift verification overrides.
        </p>
      </div>

      {/* Main Tab Toggle */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setMainTab("ADJUSTMENTS")}
          className={`py-4 px-6 font-bold text-sm border-b-2 transition-all ${
            mainTab === "ADJUSTMENTS"
              ? "border-blue-600 text-blue-600 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Adjustment Requests
        </button>
        <button
          onClick={() => setMainTab("LATE_CHECKINS")}
          className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            mainTab === "LATE_CHECKINS"
              ? "border-blue-600 text-blue-600 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Late Check-in Approvals
          {lateCheckIns.length > 0 && (
            <Badge className="bg-rose-50 text-rose-600 hover:bg-rose-50 border-none font-bold text-xs rounded-full">
              {lateCheckIns.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Shared date-wise filter with day-step arrows */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filter by date</span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={() => stepDate(-1)}
            className="h-9 w-9 rounded-xl border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 w-[170px] rounded-xl border-slate-200 text-xs font-bold text-slate-700"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => stepDate(1)}
            className="h-9 w-9 rounded-xl border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {dateFilter ? (
          <Button
            variant="ghost"
            onClick={() => setDateFilter("")}
            className="h-9 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 px-3"
          >
            All dates
          </Button>
        ) : (
          <span className="text-xs font-bold text-slate-400">Showing all dates</span>
        )}
      </div>

      {mainTab === "LATE_CHECKINS" ? (
        <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-100">
                <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Employee</TableHead>
                <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Scheduled Shift Start</TableHead>
                <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Actual Check-In Time</TableHead>
                <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLateCheckInsLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading Late Check-Ins...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLateCheckIns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                      <FileCheck className="h-10 w-10 opacity-20" />
                      <span className="text-xs font-bold uppercase tracking-widest">No pending late check-in requests</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLateCheckIns.map((item: any) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 border-slate-50 transition-colors">
                    <TableCell className="py-5 px-6">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 shadow-sm">
                          <AvatarFallback className="bg-blue-50 text-blue-600 font-bold text-xs">
                            {(item.name || "??").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm leading-tight">{item.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                            {item.email} / {item.designation || "Staff"}
                          </span>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                              item.lateCheckInsCount >= 3
                                ? "bg-rose-50 text-rose-600 border-rose-200"
                                : item.lateCheckInsCount === 2
                                ? "bg-amber-50 text-amber-600 border-amber-200"
                                : "bg-emerald-50 text-emerald-600 border-emerald-200"
                            }`}>
                              Late this month: {item.lateCheckInsCount ?? 0} / 3
                            </span>
                            {(item.lateCheckInsCount ?? 0) >= 3 && (
                              <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider animate-pulse">
                                Limit Exceeded!
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-5 px-6">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-600">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{item.shiftStart || "09:30 AM"}</span>
                      </div>
                    </TableCell>

                    <TableCell className="py-5 px-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 font-black text-xs text-rose-600">
                          <Clock className="h-3.5 w-3.5 text-rose-500" />
                          <span>{item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--"}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          Date: {new Date(item.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => rejectLateCheckInMutation.mutate(item.id)}
                          disabled={rejectLateCheckInMutation.isPending || approveLateCheckInMutation.isPending}
                          className="h-8 w-8 rounded-lg border-slate-200 text-rose-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 shadow-sm"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          onClick={() => approveLateCheckInMutation.mutate(item.id)}
                          disabled={approveLateCheckInMutation.isPending || rejectLateCheckInMutation.isPending}
                          className="h-8 w-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <>
          {/* Dynamic Tab Selector */}
          <div className="flex border-b border-slate-200">
            {[
              { id: "PENDING", label: "Pending" },
              { id: "APPROVED", label: "Approved" },
              { id: "REJECTED", label: "Rejected" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-50 border-none font-bold text-xs rounded-full">
                    {filteredData.length}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Filter and Search Box */}
          <Card className="border-none shadow-sm shadow-slate-100 ring-1 ring-slate-100 bg-white">
            <CardContent className="p-5 flex flex-col md:flex-row md:items-end gap-4">
              
              <div className="flex-1 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Choose One</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs">
                    <SelectValue placeholder="Choose Request Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Request Types</SelectItem>
                    {requestTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-[1.5] space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Write Employee Name</Label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Enter employee name or ID..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-10 h-10 rounded-xl border-slate-200 text-xs shadow-sm bg-white"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSearch}
                  className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 shadow-md shadow-blue-100"
                >
                  Search
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClear}
                  className="h-10 rounded-xl border-slate-200 font-bold text-xs text-slate-500 hover:bg-slate-50 px-5"
                >
                  Clear
                </Button>
              </div>

            </CardContent>
          </Card>

          {/* Main Approval Table */}
          <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-100">
                  <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 w-[240px]">Type</TableHead>
                  <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Requested By</TableHead>
                  <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Details</TableHead>
                  <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading Requests...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                        <FileCheck className="h-10 w-10 opacity-20" />
                        <span className="text-xs font-bold uppercase tracking-widest">No approval requests found</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item: any) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 border-slate-50 transition-colors">
                      
                      {/* Type Column */}
                      <TableCell className="py-5 px-6">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-bold text-slate-800 text-sm leading-none">{item.type}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                            Requested: {new Date(item.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      </TableCell>

                      {/* Requested By Column */}
                      <TableCell className="py-5 px-6">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 shadow-sm">
                            <AvatarFallback className="bg-blue-50 text-blue-600 font-bold text-xs">
                              {item.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-sm leading-tight">{item.name}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                              ID: #{item.employeeId} / {item.designation}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Details Column */}
                      <TableCell className="py-5 px-6">
                        <div className="flex flex-col gap-2 max-w-[400px]">
                          <p className="text-slate-600 text-xs italic leading-relaxed">&quot;{item.reason}&quot;</p>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                              <Calendar className="h-3 w-3 text-blue-500" />
                              <span>{new Date(item.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                              <Clock className="h-3 w-3 text-emerald-500" />
                              <span className="text-blue-600 font-black">{item.newPunch}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Actions Column */}
                      <TableCell className="py-5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.status === "PENDING" ? (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => rejectMutation.mutate(item.id)}
                                disabled={rejectMutation.isPending || approveMutation.isPending}
                                className="h-8 w-8 rounded-lg border-slate-200 text-rose-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 shadow-sm"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                onClick={() => approveMutation.mutate(item.id)}
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                className="h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Badge className={
                              item.status === "APPROVED" 
                                ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-none font-bold text-[10px] px-2.5 py-1"
                                : "bg-rose-50 text-rose-600 hover:bg-rose-50 border-none font-bold text-[10px] px-2.5 py-1"
                            }>
                              {item.status}
                            </Badge>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-slate-200 shadow-xl bg-white">
                              <DropdownMenuItem className="text-slate-600 font-bold text-xs gap-2 cursor-pointer">
                                <Eye className="h-3.5 w-3.5" />
                                View Request Specs
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-slate-600 font-bold text-xs gap-2 cursor-pointer">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Employee Record
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>

                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
