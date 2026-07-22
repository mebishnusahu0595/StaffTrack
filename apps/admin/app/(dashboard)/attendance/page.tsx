"use client";
 
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CalendarPlus, MapPin, ChevronLeft, ChevronRight, Filter, Clock, User as UserIcon, Download, Battery, CheckCircle2, XCircle, AlertCircle, CalendarX, Search, Pencil, Upload, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AttendanceStatusBadge } from "@/components/admin/status-badge";
import { fetchAllAttendance, fetchUsers, markAttendanceStatus, superUpdateAttendance, fetchGroups, uploadFile } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { calculateDurations, formatDurationLabel } from "@/lib/timeTracking";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { AttendanceRecord, AttendanceStatus, User } from "@/lib/types";

function PhotoViewer({ url, title, children }: { url: string; title: string; children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none bg-transparent shadow-none">
        <div className="relative group animate-in zoom-in-95 duration-200">
          <div className="absolute top-4 left-4 z-10">
            <Badge className="bg-black/60 text-white border-none backdrop-blur-md px-3 py-1 font-black uppercase tracking-widest text-[10px]">
              {title}
            </Badge>
          </div>
          <img 
            src={url} 
            className="w-full h-auto rounded-3xl shadow-2xl ring-1 ring-white/20" 
            alt={title} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
 
export default function AttendancePage() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingRecord, setViewingRecord] = useState<(AttendanceRecord & { user: User }) | null>(null);
  const [isMarkDialogOpen, setIsMarkDialogOpen] = useState(false);
  const [manualUserId, setManualUserId] = useState("");
  const [manualDate, setManualDate] = useState(startDate);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);
  const [manualStatus, setManualStatus] = useState<Extract<AttendanceStatus, "ON_LEAVE" | "HALF_DAY">>("ON_LEAVE");
  const queryClient = useQueryClient();
  
  const attendanceQuery = useQuery({ 
    queryKey: ["attendance", startDate, endDate], 
    queryFn: () => fetchAllAttendance(undefined, startDate, endDate) 
  });
 
  const usersQuery = useQuery({ 
    queryKey: ["users", "attendance"], 
    queryFn: () => fetchUsers({ page: 1, pageSize: 1000 }) 
  });

  const groupsQuery = useQuery({
    queryKey: ["groups", "attendance"],
    queryFn: fetchGroups
  });
 
  const employees = usersQuery.data?.items ?? [];
  const groups = groupsQuery.data ?? [];
  const attendanceData = useMemo(() => attendanceQuery.data ?? [], [attendanceQuery.data]);

  const filteredData = useMemo(() => {
    let data = attendanceData;
    if (employeeFilter !== "all") {
      data = data.filter(record => record.userId === employeeFilter);
    }
    if (selectedDepartment !== "all") {
      data = data.filter(record => record.user?.groupId === selectedDepartment || record.user?.group?.id === selectedDepartment);
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      data = data.filter(record => 
        record.user?.name?.toLowerCase().includes(q) || 
        record.user?.email?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [attendanceData, employeeFilter, selectedDepartment, searchQuery]);

  const summaryCounts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let onLeave = 0;
    filteredData.forEach((r) => {
      if (r.status === "PRESENT") present++;
      else if (r.status === "ABSENT") absent++;
      else if (r.status === "HALF_DAY") halfDay++;
      else if (r.status === "ON_LEAVE") onLeave++;
    });
    return {
      present,
      absent,
      halfDay,
      onLeave,
      total: filteredData.length
    };
  }, [filteredData]);

  const markMutation = useMutation({
    mutationFn: markAttendanceStatus,
    onSuccess: () => {
      setIsMarkDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message ?? "Failed to update attendance status.");
    }
  });

  const changeDate = (days: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    const newDateStr = d.toISOString().split("T")[0];
    setStartDate(newDateStr);
    setEndDate(newDateStr);
  };

  const downloadCSV = () => {
    if (filteredData.length === 0) return;
    const headers = ["Employee Name", "Email", "Work Mode", "Check In Time", "Check In Lat/Lng", "Check Out Time", "Check Out Lat/Lng", "Type", "Status"];
    const rows = filteredData.map(r => [
      r.user?.name || "--",
      r.user?.email || "--",
      r.user?.workMode || "--",
      r.checkInTime ? formatTime(r.checkInTime) : "--",
      formatCoords(r.checkInLat, r.checkInLng, 6),
      r.checkOutTime ? formatTime(r.checkOutTime) : "--",
      formatCoords(r.checkOutLat, r.checkOutLng, 6),
      r.punchType || "MANUAL",
      r.status || ""
    ]);
    
    const csvString = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${(val ?? "").toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_Report_${startDate}_to_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
 
  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-slate-900">Attendance Log</h1>
           <p className="mt-1 text-slate-500 text-sm">Review and verify employee punch records with photo and GPS validation.</p>
        </div>
        <div className="flex items-center gap-3">
        <Dialog open={isMarkDialogOpen} onOpenChange={setIsMarkDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="h-11 rounded-xl bg-blue-600 px-4 font-bold shadow-lg shadow-blue-100 hover:bg-blue-700"
              onClick={() => setManualDate(startDate)}
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              Mark Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">Mark Manual Attendance</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Use this for approved leave or admin-marked half-day records.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-5 pt-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!manualUserId) {
                  alert("Select an employee first.");
                  return;
                }
                markMutation.mutate({ userId: manualUserId, date: manualDate, status: manualStatus });
              }}
            >
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Employee</Label>
                <Select value={manualUserId} onValueChange={setManualUserId}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Date</Label>
                  <Input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} className="h-11 rounded-xl border-slate-200" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status</Label>
                  <Select value={manualStatus} onValueChange={(value) => setManualStatus(value as typeof manualStatus)}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ON_LEAVE">Leave</SelectItem>
                      <SelectItem value="HALF_DAY">Half Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsMarkDialogOpen(false)} className="rounded-xl font-bold text-slate-500">
                  Cancel
                </Button>
                <Button type="submit" disabled={markMutation.isPending} className="rounded-xl bg-blue-600 font-bold hover:bg-blue-700">
                  {markMutation.isPending ? "Saving..." : "Save Status"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm ring-1 ring-slate-200/60">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
            onClick={() => changeDate(-1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 px-3 border-x border-slate-100">
             <Calendar className="h-4 w-4 text-blue-600" />
             <div className="flex items-center gap-1.5 text-xs font-bold text-slate-650">
               <input 
                 type="date" 
                 value={startDate} 
                 onChange={e => setStartDate(e.target.value || new Date().toISOString().split("T")[0])} 
                 className="bg-transparent border-none focus:outline-none text-slate-700" 
               />
               <span className="text-slate-400">to</span>
               <input 
                 type="date" 
                 value={endDate} 
                 onChange={e => setEndDate(e.target.value || new Date().toISOString().split("T")[0])} 
                 className="bg-transparent border-none focus:outline-none text-slate-700" 
               />
             </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
            onClick={() => changeDate(1)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-none shadow-sm ring-1 ring-slate-200/50 bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Rostered</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{summaryCounts.total}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400">
              <UserIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200/50 bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Present</p>
              <h3 className="text-xl font-bold text-emerald-600 mt-1">{summaryCounts.present}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200/50 bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-500">Absent</p>
              <h3 className="text-xl font-bold text-rose-600 mt-1">{summaryCounts.absent}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-100">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200/50 bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-500">Half Day</p>
              <h3 className="text-xl font-bold text-amber-600 mt-1">{summaryCounts.halfDay}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200/50 bg-white col-span-2 md:col-span-1">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-500">On Leave</p>
              <h3 className="text-xl font-bold text-blue-600 mt-1">{summaryCounts.onLeave}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
            <div className="flex flex-wrap items-center gap-3">
               <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input 
                    placeholder="Search employees..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs rounded-lg border-slate-200 bg-white"
                  />
               </div>

               <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                 <SelectTrigger className="w-[160px] h-9 rounded-lg border-slate-200 bg-white text-xs font-semibold shadow-sm">
                   <div className="flex items-center gap-2">
                     <Filter className="h-3.5 w-3.5 text-slate-400" />
                     <SelectValue placeholder="All Departments" />
                   </div>
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Departments</SelectItem>
                   {groups.map((g: any) => (
                     <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>

               <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                 <SelectTrigger className="w-[160px] h-9 rounded-lg border-slate-200 bg-white text-xs font-semibold shadow-sm">
                   <div className="flex items-center gap-2">
                     <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                     <SelectValue placeholder="All Employees" />
                   </div>
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Employees</SelectItem>
                   {employees.map(e => (
                     <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>

               <Button 
                 variant="outline" 
                 size="sm" 
                 className="h-9 rounded-lg border-slate-200 bg-white font-bold text-slate-600 gap-2 shadow-sm text-xs"
                 onClick={downloadCSV}
                 disabled={filteredData.length === 0}
               >
                 <Download className="h-3.5 w-3.5" />
                 Export CSV
               </Button>
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
               Showing {filteredData.length} entries
            </div>
         </div>

        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="py-4 px-4 text-[11px] font-black uppercase tracking-wider text-slate-400 text-center w-12">S.No.</TableHead>
              <TableHead className="py-4 px-8 text-[11px] font-black uppercase tracking-wider text-slate-400">Employee</TableHead>
              <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Check In</TableHead>
              <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Check Out</TableHead>
              <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400 text-center">Type</TableHead>
              <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400 text-center">Duration</TableHead>
              <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400 text-center">Verification</TableHead>
              <TableHead className="py-4 px-8 text-[11px] font-black uppercase tracking-wider text-slate-400 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendanceQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fetching records...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-300">
                    <UserIcon className="h-10 w-10 opacity-20" />
                    <span className="text-xs font-bold uppercase tracking-widest">No records found for this date.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((record, index) => (
                <TableRow 
                  key={record.id} 
                  className="group hover:bg-blue-50/30 border-slate-50 transition-colors cursor-pointer"
                  onClick={() => setViewingRecord(record)}
                >
                  <TableCell className="py-5 px-4 text-center text-xs font-bold text-slate-500">
                    {index + 1}
                  </TableCell>
                  <TableCell className="py-5 px-8">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-slate-100 shadow-sm ring-2 ring-white">
                        <AvatarFallback className="bg-slate-50 text-slate-400 font-bold text-xs">{record.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm leading-tight group-hover:text-blue-600 transition-colors">{record.user.name}</span>
                          {record.user.batteryLevel !== undefined && record.user.batteryLevel !== null && (
                            <div className="flex items-center gap-0.5 text-[9px] font-black text-slate-500 bg-slate-100/80 px-1.5 py-0.5 rounded-md border border-slate-200/50">
                              <Battery className="h-2.5 w-2.5 text-slate-500" />
                              <span>{record.user.batteryLevel}%</span>
                            </div>
                          )}
                          {record.user.isLocationOn !== undefined && (
                            <span 
                              className={cn(
                                "h-2 w-2 rounded-full ring-2 ring-white shadow-sm",
                                record.user.isLocationOn ? "bg-emerald-500" : "bg-rose-500 animate-pulse"
                              )} 
                              title={record.user.isLocationOn ? "Location On" : "Location Off"} 
                            />
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{record.user.email} / {record.user.workMode}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-600">{record.checkInTime ? formatTime(record.checkInTime) : "--"}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{formatCoords(record.checkInLat, record.checkInLng)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    {record.checkOutTime ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-600">{formatTime(record.checkOutTime)}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{formatCoords(record.checkOutLat, record.checkOutLng)}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">In Progress</span>
                    )}
                  </TableCell>
                  <TableCell className="py-5 px-6 text-center">
                    <div className={cn(
                      "inline-flex items-center justify-center px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider",
                      record.punchType === "FIELD" ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {record.punchType || "MANUAL"}
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6 text-center">
                    <span className="text-xs font-bold text-slate-600">
                      {formatDurationLabel(calculateDurations([record]).officeTimeMs + calculateDurations([record]).fieldTimeMs)}
                    </span>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                     <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {record.checkInPhotoUrl ? (
                          <PhotoViewer url={record.checkInPhotoUrl} title="Check In">
                             <div className="relative h-8 w-10 rounded border border-slate-200 overflow-hidden cursor-zoom-in hover:border-blue-400 transition-all">
                               <img src={record.checkInPhotoUrl} className="h-full w-full object-cover" alt={`${record.user.name} check-in thumbnail`} />
                             </div>
                          </PhotoViewer>
                        ) : null}
                        {record.punchType === "FIELD" && record.startOdometerPhotoUrl ? (
                           <PhotoViewer url={record.startOdometerPhotoUrl} title={`Start Odometer ${record.startOdometer ? `(${record.startOdometer} KM)` : ""}`}>
                              <div className="relative h-8 w-10 rounded border border-amber-200 overflow-hidden cursor-zoom-in hover:border-amber-400 transition-all bg-amber-50">
                                <img src={record.startOdometerPhotoUrl} className="h-full w-full object-cover" alt={`${record.user.name} start odometer`} />
                              </div>
                           </PhotoViewer>
                         ) : null}
                        {record.checkOutPhotoUrl ? (
                          <PhotoViewer url={record.checkOutPhotoUrl} title="Check Out">
                             <div className="relative h-8 w-10 rounded border border-slate-200 overflow-hidden cursor-zoom-in hover:border-blue-400 transition-all">
                               <img src={record.checkOutPhotoUrl} className="h-full w-full object-cover" alt={`${record.user.name} check-out thumbnail`} />
                             </div>
                          </PhotoViewer>
                        ) : null}
                        {record.punchType === "FIELD" && record.endOdometerPhotoUrl ? (
                           <PhotoViewer url={record.endOdometerPhotoUrl} title={`End Odometer ${record.endOdometer ? `(${record.endOdometer} KM)` : ""}`}>
                              <div className="relative h-8 w-10 rounded border border-amber-200 overflow-hidden cursor-zoom-in hover:border-amber-400 transition-all bg-amber-50">
                                <img src={record.endOdometerPhotoUrl} className="h-full w-full object-cover" alt={`${record.user.name} end odometer`} />
                              </div>
                           </PhotoViewer>
                         ) : null}
                     </div>
                  </TableCell>
                  <TableCell className="py-5 px-8 text-right">
                    <AttendanceStatusBadge
                      status={record.status}
                      hasCheckOut={Boolean(record.checkOutTime)}
                      checkInTime={record.checkInTime ?? undefined}
                      checkOutTime={record.checkOutTime}
                      shiftStart={record.user.shiftStart}
                      shiftEnd={record.user.shiftEnd}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AttendanceDetailDialog 
        record={viewingRecord} 
        userRecords={filteredData.filter(r => r.userId === viewingRecord?.userId)}
        onOpenChange={(open) => !open && setViewingRecord(null)} 
      />
    </div>
  );
}

function AttendanceDetailDialog({ 
  record: propRecord, 
  userRecords,
  onOpenChange 
}: { 
  record: (AttendanceRecord & { user: User }) | null; 
  userRecords: (AttendanceRecord & { user: User })[];
  onOpenChange: (open: boolean) => void 
}) {
  const queryClient = useQueryClient();
  const [isEditingOdo, setIsEditingOdo] = useState(false);
  const [startOdoVal, setStartOdoVal] = useState("");
  const [endOdoVal, setEndOdoVal] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Full attendance edit state
  const [isEditingFull, setIsEditingFull] = useState(false);
  const [editData, setEditData] = useState<{
    status: string;
    punchType: string;
    checkInTime: string;
    checkOutTime: string;
    checkInPhotoUrl: string | null;
    checkOutPhotoUrl: string | null;
    startOdometerPhotoUrl: string | null;
    endOdometerPhotoUrl: string | null;
    startOdometer: string;
    endOdometer: string;
  } | null>(null);
  const [photoUploading, setPhotoUploading] = useState<string | null>(null);

  useEffect(() => {
    if (propRecord) {
      setStartOdoVal(propRecord.startOdometer?.toString() ?? "");
      setEndOdoVal(propRecord.endOdometer?.toString() ?? "");
      setIsEditingOdo(false);
      setIsEditingFull(false);
      setEditData(null);
    }
  }, [propRecord]);

  if (!propRecord) return null;

  const record = userRecords.find(r => r.id === propRecord.id) || propRecord;
  const totals = calculateDurations(userRecords);

  const handleSaveOdometer = async () => {
    setIsSaving(true);
    try {
      const startOdo = startOdoVal.trim() !== "" ? parseFloat(startOdoVal) : null;
      const endOdo = endOdoVal.trim() !== "" ? parseFloat(endOdoVal) : null;

      if (startOdo !== null && isNaN(startOdo)) {
        alert("Start odometer must be a valid number");
        setIsSaving(false);
        return;
      }
      if (endOdo !== null && isNaN(endOdo)) {
        alert("End odometer must be a valid number");
        setIsSaving(false);
        return;
      }

      await superUpdateAttendance(record.id, {
        userId: record.userId,
        date: record.date,
        startOdometer: startOdo,
        endOdometer: endOdo
      });

      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setIsEditingOdo(false);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to update odometer readings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenFullEdit = () => {
    setEditData({
      status: record.status,
      punchType: record.punchType || "OFFICE",
      checkInTime: record.checkInTime ? new Date(record.checkInTime).toISOString().slice(0, 16) : "",
      checkOutTime: record.checkOutTime ? new Date(record.checkOutTime).toISOString().slice(0, 16) : "",
      checkInPhotoUrl: record.checkInPhotoUrl ?? null,
      checkOutPhotoUrl: record.checkOutPhotoUrl ?? null,
      startOdometerPhotoUrl: record.startOdometerPhotoUrl ?? null,
      endOdometerPhotoUrl: record.endOdometerPhotoUrl ?? null,
      startOdometer: record.startOdometer?.toString() ?? "",
      endOdometer: record.endOdometer?.toString() ?? "",
    });
    setIsEditingFull(true);
  };

  const handleUploadPhoto = async (field: string, file?: File) => {
    if (!file || !editData) return;
    setPhotoUploading(field);
    try {
      const url = await uploadFile(file);
      setEditData((prev) => prev ? { ...prev, [field]: url } : null);
    } catch {
      alert("Image upload failed");
    } finally {
      setPhotoUploading(null);
    }
  };

  const handleSaveFullEdit = async () => {
    if (!editData) return;
    setIsSaving(true);
    try {
      await superUpdateAttendance(record.id, {
        userId: record.userId,
        date: record.date,
        status: editData.status as any,
        punchType: editData.punchType as any,
        checkInTime: editData.checkInTime || null,
        checkOutTime: editData.checkOutTime || null,
        checkInPhotoUrl: editData.checkInPhotoUrl,
        checkOutPhotoUrl: editData.checkOutPhotoUrl,
        startOdometerPhotoUrl: editData.startOdometerPhotoUrl,
        endOdometerPhotoUrl: editData.endOdometerPhotoUrl,
        startOdometer: editData.startOdometer !== "" ? parseFloat(editData.startOdometer) : null,
        endOdometer: editData.endOdometer !== "" ? parseFloat(editData.endOdometer) : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setIsEditingFull(false);
      setEditData(null);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to update attendance.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setStartOdoVal(record.startOdometer?.toString() ?? "");
    setEndOdoVal(record.endOdometer?.toString() ?? "");
    setIsEditingOdo(false);
  };

  const handlePrintAttendance = (rec: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const formattedDate = new Date(rec.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const inTime = rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : "--";
    const outTime = rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : "Active";
    const duration = formatDurationLabel(calculateDurations([rec]).officeTimeMs + calculateDurations([rec]).fieldTimeMs);
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Attendance Record - ${rec.user.name} - ${formattedDate}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page { size: landscape; margin: 20mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body class="bg-white p-8 text-slate-800 font-sans">
  <div class="max-w-6xl mx-auto border border-slate-200 rounded-3xl p-8 shadow-sm">
    <div class="flex justify-between items-center border-b border-slate-200 pb-6 mb-6">
      <div>
        <h1 class="text-2xl font-black text-slate-900 tracking-tight">ATTENDANCE LOG</h1>
        <p class="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">StaffTrack Verification Report</p>
      </div>
      <div class="text-right">
        <p class="text-lg font-black text-slate-900">${rec.user.name}</p>
        <p class="text-xs font-bold text-slate-500 mt-0.5">${rec.user.email}</p>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-4 mb-8">
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
        <p class="text-sm font-black text-slate-800">${formattedDate}</p>
      </div>
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Check In Time</p>
        <p class="text-sm font-black text-slate-800">${inTime}</p>
      </div>
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Check Out Time</p>
        <p class="text-sm font-black text-slate-800">${outTime}</p>
      </div>
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Duration</p>
        <p class="text-sm font-black text-blue-600">${duration}</p>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-8">
      <div class="border border-slate-150 rounded-2xl p-6 bg-slate-50/50">
        <h3 class="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 border-b pb-2">Check In Details</h3>
        <p class="text-xs font-bold text-slate-500 mb-4">Location: ${rec.checkInLat && rec.checkInLng ? `${rec.checkInLat.toFixed(5)}, ${rec.checkInLng.toFixed(5)}` : "—"}</p>
        \${rec.checkInPhotoUrl ? \`<img src="\${rec.checkInPhotoUrl}" class="max-h-64 object-contain rounded-xl border border-slate-200" />\` : \`<p class="text-xs text-slate-400">No Photo Uploaded</p>\`}
      </div>

      <div class="border border-slate-150 rounded-2xl p-6 bg-slate-50/50">
        <h3 class="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 border-b pb-2">Check Out Details</h3>
        <p class="text-xs font-bold text-slate-500 mb-4">Location: ${rec.checkOutLat && rec.checkOutLng ? `${rec.checkOutLat.toFixed(5)}, ${rec.checkOutLng.toFixed(5)}` : "—"}</p>
        \${rec.checkOutPhotoUrl ? \`<img src="\${rec.checkOutPhotoUrl}" class="max-h-64 object-contain rounded-xl border border-slate-200" />\` : \`<p class="text-xs text-slate-400">No Photo Uploaded / Session Active</p>\`}
      </div>
    </div>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
</body>
</html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <Dialog open={!!propRecord} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-white">
        <div className="bg-slate-900 p-8 text-white">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Avatar className="h-12 w-12 border-2 border-slate-800 shadow-xl">
                    <AvatarFallback className="bg-slate-800 text-slate-400 font-bold">{record.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                 </Avatar>
                 <div>
                    <h2 className="text-xl font-bold">{record.user.name}</h2>
                    <p className="text-xs font-medium text-slate-400">{record.user.email} / {new Date(record.date).toLocaleDateString()}</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <Button 
                   variant="outline" 
                   size="sm" 
                   className="h-9 border-slate-700 bg-transparent text-white hover:bg-slate-800 hover:text-white font-bold text-xs gap-1.5"
                   onClick={() => handlePrintAttendance(record)}
                 >
                   Print Details (Landscape)
                 </Button>
                 <Button
                    size="sm"
                    className="h-9 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1.5"
                    onClick={handleOpenFullEdit}
                  >
                    <Pencil className="w-3 h-3" /> Edit Attendance
                  </Button>
                 <AttendanceStatusBadge 
                   status={record.status} 
                   hasCheckOut={!!record.checkOutTime} 
                   checkInTime={record.checkInTime ?? undefined} 
                   checkOutTime={record.checkOutTime}
                   shiftStart={record.user.shiftStart}
                   shiftEnd={record.user.shiftEnd}
                 />
              </div>
           </div>
           
           {/* Durations Row */}
           <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Total Office Time</p>
                <p className="text-lg font-bold text-blue-400">{formatDurationLabel(totals.officeTimeMs)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Total Field Time</p>
                <p className="text-lg font-bold text-amber-400">{formatDurationLabel(totals.fieldTimeMs)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Total Break Time</p>
                <p className="text-lg font-bold text-emerald-400">{formatDurationLabel(totals.breakTimeMs)}</p>
              </div>
           </div>
        </div>

        {/* Full Edit Panel */}
        {isEditingFull && editData && (
          <div className="px-8 pt-6 pb-4 border-b border-slate-100 bg-amber-50/30">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-black uppercase tracking-wider text-amber-700">✏️ Edit Attendance Record</p>
              <Button variant="ghost" size="sm" className="text-slate-500 h-7 text-xs" onClick={() => { setIsEditingFull(false); setEditData(null); }}>Cancel</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Status</Label>
                <Select value={editData.status} onValueChange={(v) => setEditData((p) => p ? { ...p, status: v } : null)}>
                  <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="HALF_DAY">Half Day</SelectItem>
                    <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Punch Type</Label>
                <Select value={editData.punchType} onValueChange={(v) => setEditData((p) => p ? { ...p, punchType: v } : null)}>
                  <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OFFICE">Office</SelectItem>
                    <SelectItem value="FIELD">Field</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Check In Time</Label>
                <Input type="datetime-local" value={editData.checkInTime} onChange={(e) => setEditData((p) => p ? { ...p, checkInTime: e.target.value } : null)} className="h-9 text-xs rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Check Out Time</Label>
                <Input type="datetime-local" value={editData.checkOutTime} onChange={(e) => setEditData((p) => p ? { ...p, checkOutTime: e.target.value } : null)} className="h-9 text-xs rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Start Odometer</Label>
                <Input type="number" placeholder="e.g. 45000" value={editData.startOdometer} onChange={(e) => setEditData((p) => p ? { ...p, startOdometer: e.target.value } : null)} className="h-9 text-xs rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">End Odometer</Label>
                <Input type="number" placeholder="e.g. 45080" value={editData.endOdometer} onChange={(e) => setEditData((p) => p ? { ...p, endOdometer: e.target.value } : null)} className="h-9 text-xs rounded-lg" />
              </div>
            </div>
            {/* Photo fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {([
                { field: "checkInPhotoUrl", label: "Check-In Photo" },
                { field: "checkOutPhotoUrl", label: "Check-Out Photo" },
                { field: "startOdometerPhotoUrl", label: "Start Odo Photo" },
                { field: "endOdometerPhotoUrl", label: "End Odo Photo" },
              ] as const).map(({ field, label }) => (
                <div key={field} className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-500">{label}</Label>
                  <div className="flex items-center gap-2">
                    <div className="h-12 w-16 rounded border bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                      {editData[field] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={editData[field]!} alt={label} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded border bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50">
                        {photoUploading === field ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        {editData[field] ? "Replace" : "Upload"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadPhoto(field, e.target.files?.[0])} />
                      </label>
                      {editData[field] && (
                        <button type="button" onClick={() => setEditData((p) => p ? { ...p, [field]: null } : null)} className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-700">
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-slate-500" onClick={() => { setIsEditingFull(false); setEditData(null); }} disabled={isSaving}>Cancel</Button>
              <Button size="sm" className="h-8 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white" onClick={handleSaveFullEdit} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save All Changes"}
              </Button>
            </div>
          </div>
        )}

        {record.punchType === "FIELD" && (
          <div className="px-8 pt-8">
            {isEditingOdo ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm space-y-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-700">Edit Odometer Readings</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="startOdo" className="text-[10px] font-black uppercase text-slate-500">Start Odometer</Label>
                    <Input 
                      id="startOdo"
                      type="number" 
                      placeholder="e.g. 452538"
                      value={startOdoVal}
                      onChange={(e) => setStartOdoVal(e.target.value)}
                      className="h-9 text-xs rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="endOdo" className="text-[10px] font-black uppercase text-slate-500">End Odometer</Label>
                    <Input 
                      id="endOdo"
                      type="number" 
                      placeholder="e.g. 452597"
                      value={endOdoVal}
                      onChange={(e) => setEndOdoVal(e.target.value)}
                      className="h-9 text-xs rounded-lg"
                    />
                  </div>
                </div>
                
                {startOdoVal !== "" && endOdoVal !== "" && (
                  <div className={cn(
                     "rounded-xl p-3 border flex flex-col justify-center text-center",
                     parseFloat(endOdoVal) < parseFloat(startOdoVal)
                       ? "bg-rose-50 border-rose-100 text-rose-700"
                       : "bg-blue-50/50 border-blue-100/60 text-blue-700"
                  )}>
                    <p className="mt-1 text-sm font-black">
                      {parseFloat(endOdoVal) >= parseFloat(startOdoVal)
                        ? `Calculated Distance: ${(parseFloat(endOdoVal) - parseFloat(startOdoVal)).toFixed(1)} km`
                        : "Warning: End Odometer is less than Start Odometer"}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-3 text-xs font-bold text-slate-500 hover:bg-slate-100"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-8 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleSaveOdometer}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Readings"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm grid grid-cols-3 gap-6">
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Start Odometer</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {record.startOdometer != null ? `${record.startOdometer} km` : "No reading"}
                    </p>
                  </div>
                  <div className="mt-2">
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="p-0 h-auto text-[10px] font-bold text-blue-600 hover:underline"
                      onClick={() => setIsEditingOdo(true)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">End Odometer</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {record.endOdometer != null ? `${record.endOdometer} km` : "No reading"}
                    </p>
                  </div>
                  <div className="mt-2">
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="p-0 h-auto text-[10px] font-bold text-blue-600 hover:underline"
                      onClick={() => setIsEditingOdo(true)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
                <div className={cn(
                   "rounded-xl p-3 border flex flex-col justify-center",
                   record.startOdometer != null && record.endOdometer != null && record.endOdometer < record.startOdometer
                     ? "bg-rose-50 border-rose-100 text-rose-700"
                     : "bg-blue-50/50 border-blue-100/60 text-blue-700"
                )}>
                  <p className={cn(
                     "text-[10px] font-black uppercase tracking-wider",
                     record.startOdometer != null && record.endOdometer != null && record.endOdometer < record.startOdometer
                       ? "text-rose-500"
                       : "text-blue-500"
                  )}>Odometer Distance</p>
                  <p className="mt-1 text-lg font-black">
                    {record.startOdometer != null && record.endOdometer != null
                      ? record.endOdometer >= record.startOdometer
                        ? `${(record.endOdometer - record.startOdometer).toFixed(1)} km`
                        : "Error: End < Start"
                      : "--"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-8 grid grid-cols-2 gap-8">
           {/* Punch In */}
           <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                 <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
                       <Clock className="h-4 w-4 text-emerald-600" />
                    </div>
                   <div>
                       <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">Check In</p>
                       <p className="text-sm font-bold text-slate-900">{record.checkInTime ? formatTime(record.checkInTime) : "--"}</p>
                    </div>
                 </div>
                 {record.checkInLat != null && record.checkInLng != null ? (
                   <a 
                     href={`https://www.google.com/maps/search/?api=1&query=${record.checkInLat},${record.checkInLng}`} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="h-8 px-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 hover:bg-blue-50 hover:border-blue-100 transition-all"
                   >
                      <MapPin className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-[10px] font-bold text-slate-600 uppercase">View Map</span>
                   </a>
                 ) : null}
              </div>
              <div className="aspect-[4/3] rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden shadow-inner group relative">
                 {record.checkInPhotoUrl ? (
                    <img src={record.checkInPhotoUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={`${record.user.name} check-in verification`} />
                 ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                       <UserIcon className="h-10 w-10 opacity-20" />
                       <p className="text-[10px] font-bold uppercase mt-2">No photo available</p>
                    </div>
                 )}
                 <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-[9px] font-black text-slate-700 uppercase tracking-widest border border-white shadow-sm ring-1 ring-black/5">
                    Live Photo Check-in
                 </div>
              </div>
              {record.punchType === "FIELD" && record.startOdometerPhotoUrl && (
                  <div className="mt-3 space-y-2">
                     <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Start Odometer Verification{record.startOdometer ? ` (${record.startOdometer} KM)` : ""}</p>
                     <PhotoViewer url={record.startOdometerPhotoUrl} title={`Start Odometer ${record.startOdometer ? `(${record.startOdometer} KM)` : ""}`}>
                        <div className="aspect-[16/9] rounded-2xl border border-amber-100 bg-amber-50/20 overflow-hidden shadow-sm group/odo relative cursor-zoom-in">
                           <img src={record.startOdometerPhotoUrl} className="w-full h-full object-cover transition-transform group-hover/odo:scale-105" alt="Start Odometer" />
                           <div className="absolute top-2 left-2 bg-amber-600/90 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shadow-sm">
                              Odometer{record.startOdometer ? `: ${record.startOdometer} KM` : ""}
                           </div>
                        </div>
                     </PhotoViewer>
                  </div>
               )}
              <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-tighter">Coordinates: {formatCoords(record.checkInLat, record.checkInLng, 6)}</p>
           </div>

           {/* Punch Out */}
           <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                 <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-100">
                       <Clock className="h-4 w-4 text-rose-600" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">Check Out</p>
                       <p className="text-sm font-bold text-slate-900">{record.checkOutTime ? formatTime(record.checkOutTime) : "Active"}</p>
                    </div>
                 </div>
                 {record.checkOutTime && record.checkOutLat != null && record.checkOutLng != null && (
                   <a 
                     href={`https://www.google.com/maps/search/?api=1&query=${record.checkOutLat},${record.checkOutLng}`} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="h-8 px-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 hover:bg-blue-50 hover:border-blue-100 transition-all"
                   >
                      <MapPin className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-[10px] font-bold text-slate-600 uppercase">View Map</span>
                   </a>
                 )}
              </div>
              <div className="aspect-[4/3] rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden shadow-inner group relative">
                 {record.checkOutPhotoUrl ? (
                    <img src={record.checkOutPhotoUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={`${record.user.name} check-out verification`} />
                 ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                       <UserIcon className="h-10 w-10 opacity-20" />
                       <p className="text-[10px] font-bold uppercase mt-2">{record.checkOutTime ? "No photo available" : "Employee still on site"}</p>
                    </div>
                 )}
                 {record.checkOutTime && (
                   <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-[9px] font-black text-slate-700 uppercase tracking-widest border border-white shadow-sm ring-1 ring-black/5">
                      Live Photo Check-out
                   </div>
                 )}
              </div>
              {record.punchType === "FIELD" && record.endOdometerPhotoUrl && (
                  <div className="mt-3 space-y-2">
                     <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">End Odometer Verification{record.endOdometer ? ` (${record.endOdometer} KM)` : ""}</p>
                     <PhotoViewer url={record.endOdometerPhotoUrl} title={`End Odometer ${record.endOdometer ? `(${record.endOdometer} KM)` : ""}`}>
                        <div className="aspect-[16/9] rounded-2xl border border-amber-100 bg-amber-50/20 overflow-hidden shadow-sm group/odo relative cursor-zoom-in">
                           <img src={record.endOdometerPhotoUrl} className="w-full h-full object-cover transition-transform group-hover/odo:scale-105" alt="End Odometer" />
                           <div className="absolute top-2 left-2 bg-amber-600/90 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shadow-sm">
                              Odometer{record.endOdometer ? `: ${record.endOdometer} KM` : ""}
                           </div>
                        </div>
                     </PhotoViewer>
                  </div>
               )}
              <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-tighter">
                {record.checkOutTime ? `Coordinates: ${formatCoords(record.checkOutLat, record.checkOutLng, 6)}` : "Ongoing activity..."}
              </p>
           </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
           <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 rounded-xl font-bold text-slate-500 hover:text-slate-700 border-slate-200">
              Close Verification
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatCoords(lat?: number | null, lng?: number | null, digits = 4) {
  if (lat == null || lng == null) {
    return "--";
  }

  return `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;
}
