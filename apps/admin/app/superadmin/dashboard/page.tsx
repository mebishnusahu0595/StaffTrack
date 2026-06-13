"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Clock,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Pencil,
  Upload,
  Trash2,
  ImageIcon,
  Loader2,
  Receipt,
  Calendar,
  CheckSquare
} from "lucide-react";
import {
  superFetchUsers,
  superUpdateUser,
  superFetchAttendance,
  superUpdateAttendance,
  superFetchManagers,
  uploadFile,
  superFetchExpenses,
  superUpdateExpense,
  superDeleteExpense,
  superFetchLeaves,
  superUpdateLeave,
  superDeleteLeave,
  superFetchTasks,
  superUpdateTask,
  superDeleteTask,
  superBulkMarkAttendance
} from "@/lib/api";
import type { User, AttendanceRecord, Role } from "@/lib/types";
import { calculateDurations, formatDurationLabel } from "@/lib/timeTracking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";
import { format } from "date-fns";

type AttRow = AttendanceRecord & { user: { name: string; email: string } };
type ManagerLite = { id: string; name: string; role: string };

// Convert an ISO timestamp to the value a <input type="datetime-local"> expects.
function toLocalInput(value?: string | null) {
  if (!value) return "";
  try {
    return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

/** Reusable image field: shows current image, lets you upload a new one or clear it. */
function ImageField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      onChange(url);
    } catch {
      alert("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase text-slate-500">{label}</Label>
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-slate-100 flex items-center justify-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-300" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {value ? "Replace" : "Upload"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SuperDashboardPage() {
  const { user: currentUser, signOut } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [managers, setManagers] = useState<ManagerLite[]>([]);
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Attendance date filter
  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Bulk marking dialog state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkData, setBulkData] = useState({
    userId: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    status: "PRESENT",
    punchType: "OFFICE",
    checkInTime: "09:00",
    checkOutTime: "18:00"
  });

  // Edit dialog state
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editAtt, setEditAtt] = useState<AttRow | null>(null);
  const [editExpense, setEditExpense] = useState<any | null>(null);
  const [editLeave, setEditLeave] = useState<any | null>(null);
  const [editTask, setEditTask] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadAttendance(attendanceDate);
  }, [attendanceDate]);

  async function loadAttendance(dateStr: string) {
    try {
      const a = await superFetchAttendance(undefined, dateStr);
      setAttendance(a);
    } catch (err) {
      console.error("Failed to load attendance logs", err);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [u, m, exp, lvs, tks] = await Promise.all([
        superFetchUsers(),
        superFetchManagers(),
        superFetchExpenses(),
        superFetchLeaves(),
        superFetchTasks()
      ]);
      setUsers(u);
      setManagers(m);
      setExpenses(exp);
      setLeaves(lvs);
      setTasks(tks);
      await loadAttendance(attendanceDate);
    } catch (err) {
      console.error("Failed to load superadmin data", err);
    } finally {
      setLoading(false);
    }
  }


  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleQuickAttendance = async (record: AttRow, status: string) => {
    try {
      await superUpdateAttendance(record.id, {
        userId: record.userId,
        date: record.date,
        status: status as AttendanceRecord["status"]
      });
      await loadData();
    } catch {
      alert("Failed to update attendance");
    }
  };

  const saveUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await superUpdateUser(editUser.id, {
        name: editUser.name,
        email: editUser.email,
        phone: editUser.phone,
        designation: editUser.designation,
        workMode: editUser.workMode,
        baseSalary: editUser.baseSalary,
        travelRate: editUser.travelRate,
        shiftStart: editUser.shiftStart,
        shiftEnd: editUser.shiftEnd,
        managerId: editUser.managerId,
        role: editUser.role
      });
      setEditUser(null);
      await loadData();
    } catch {
      alert("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const saveAttendance = async () => {
    if (!editAtt) return;
    setSaving(true);
    try {
      await superUpdateAttendance(editAtt.id, {
        userId: editAtt.userId,
        date: editAtt.date,
        status: editAtt.status,
        punchType: editAtt.punchType,
        checkInTime: editAtt.checkInTime || null,
        checkOutTime: editAtt.checkOutTime || null,
        startOdometer: editAtt.startOdometer,
        endOdometer: editAtt.endOdometer,
        checkInPhotoUrl: editAtt.checkInPhotoUrl,
        checkOutPhotoUrl: editAtt.checkOutPhotoUrl,
        startOdometerPhotoUrl: editAtt.startOdometerPhotoUrl,
        endOdometerPhotoUrl: editAtt.endOdometerPhotoUrl
      });
      setEditAtt(null);
      await loadData();
    } catch {
      alert("Failed to update attendance");
    } finally {
      setSaving(false);
    }
  };

  const saveExpense = async () => {
    if (!editExpense) return;
    setSaving(true);
    try {
      await superUpdateExpense(editExpense.id, {
        category: editExpense.category,
        amount: Number(editExpense.amount),
        description: editExpense.description,
        date: editExpense.date,
        approved: editExpense.approved,
        receiptUrl: editExpense.receiptUrl
      });
      setEditExpense(null);
      await loadData();
    } catch {
      alert("Failed to update expense");
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      await superDeleteExpense(id);
      await loadData();
    } catch {
      alert("Failed to delete expense");
    }
  };

  const saveLeave = async () => {
    if (!editLeave) return;
    setSaving(true);
    try {
      await superUpdateLeave(editLeave.id, {
        startDate: editLeave.startDate,
        endDate: editLeave.endDate,
        reason: editLeave.reason,
        status: editLeave.status
      });
      setEditLeave(null);
      await loadData();
    } catch {
      alert("Failed to update leave request");
    } finally {
      setSaving(false);
    }
  };

  const deleteLeave = async (id: string) => {
    if (!confirm("Are you sure you want to delete this leave request?")) return;
    try {
      await superDeleteLeave(id);
      await loadData();
    } catch {
      alert("Failed to delete leave request");
    }
  };

  const saveTask = async () => {
    if (!editTask) return;
    setSaving(true);
    try {
      await superUpdateTask(editTask.id, {
        title: editTask.title,
        description: editTask.description,
        status: editTask.status,
        priority: editTask.priority,
        points: Number(editTask.points),
        dueDate: editTask.dueDate,
        assignedToId: editTask.assignedToId
      });
      setEditTask(null);
      await loadData();
    } catch {
      alert("Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await superDeleteTask(id);
      await loadData();
    } catch {
      alert("Failed to delete task");
    }
  };

  const submitBulkAttendance = async () => {
    if (!bulkData.userId) {
      alert("Please select an employee");
      return;
    }
    setSaving(true);
    try {
      await superBulkMarkAttendance({
        userId: bulkData.userId,
        startDate: bulkData.startDate,
        endDate: bulkData.endDate,
        status: bulkData.status,
        punchType: bulkData.punchType === "none" ? null : bulkData.punchType,
        checkInTime: bulkData.checkInTime || null,
        checkOutTime: bulkData.checkOutTime || null
      });
      setBulkOpen(false);
      await loadAttendance(attendanceDate);
      alert("Bulk attendance updated successfully!");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update bulk attendance");
    } finally {
      setSaving(false);
    }
  };



  if (currentUser?.role !== "SUPERADMIN" && currentUser?.role !== "ADMIN") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-slate-400">Restricted Area: Level 5 Authorization Required</p>
          <Button onClick={() => (window.location.href = "/login")} className="mt-4 bg-blue-600">
            Return to Safety
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-black uppercase tracking-tighter text-xl">
              SuperAdmin <span className="text-blue-500">Console</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-slate-400">CHANNEL: 0595</span>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
              onClick={signOut}
            >
              Logout Console
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Override</h1>
            <p className="text-slate-500 font-medium">Global management and data correction</p>
          </div>
          <Button onClick={loadData} variant="outline" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl shadow-sm">
            <TabsTrigger value="users" className="rounded-lg gap-2 px-6">
              <Users className="w-4 h-4" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="attendance" className="rounded-lg gap-2 px-6">
              <Clock className="w-4 h-4" />
              Attendance &amp; Odometer
            </TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg gap-2 px-6">
              <Receipt className="w-4 h-4" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="leaves" className="rounded-lg gap-2 px-6">
              <Calendar className="w-4 h-4" />
              Leaves
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-lg gap-2 px-6">
              <CheckSquare className="w-4 h-4" />
              Tasks
            </TabsTrigger>
          </TabsList>

          {/* USERS */}
          <TabsContent value="users">
            <Card className="border-none shadow-xl shadow-slate-200/50">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Edit every detail — profile, role, shift, salary &amp; manager</CardDescription>
                  </div>
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search users..."
                      className="pl-10 rounded-lg"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Employee</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id} className="group">
                        <TableCell>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{u.company?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-bold border-slate-200">
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">
                          {u.shiftStart} - {u.shiftEnd}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {managers.find((m) => m.id === u.managerId)?.name || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 font-bold hover:text-blue-700 gap-1"
                            onClick={() => setEditUser({ ...u })}
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                          No users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ATTENDANCE */}
          <TabsContent value="attendance">
            <Card className="border-none shadow-xl shadow-slate-200/50">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Attendance &amp; Odometer Correction</CardTitle>
                    <CardDescription>
                      Fix status, punch times, odometer readings and replace odometer / selfie images
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="att-date" className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Date:</Label>
                      <Input
                        id="att-date"
                        type="date"
                        className="rounded-lg h-9 w-40"
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => setBulkOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 gap-1 rounded-lg px-4"
                    >
                      <Clock className="w-4 h-4" />
                      Bulk Mark
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Punch</TableHead>
                      <TableHead>Break Time</TableHead>
                      <TableHead>Odometer</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-bold text-slate-900">{a.user.name}</div>
                          <div className="text-xs text-slate-500">{a.user.email}</div>
                        </TableCell>
                        <TableCell className="font-medium">{format(new Date(a.date), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              a.status === "PRESENT"
                                 ? "bg-emerald-500 hover:bg-emerald-600"
                                 : a.status === "ABSENT"
                                 ? "bg-rose-500 hover:bg-rose-600"
                                 : "bg-amber-500 hover:bg-amber-600"
                            }
                          >
                            {a.isCheckInPending ? "PENDING" : a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-500">
                          {a.checkInTime ? format(new Date(a.checkInTime), "HH:mm") : "--:--"} |{" "}
                          {a.checkOutTime ? format(new Date(a.checkOutTime), "HH:mm") : "--:--"}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-amber-600">
                          {formatDurationLabel(calculateDurations([a]).breakTimeMs)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {a.startOdometer ?? "—"} → {a.endOdometer ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {a.status === "ABSENT" && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 gap-1 h-8 px-3"
                                onClick={() => handleQuickAttendance(a, "PRESENT")}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Present
                              </Button>
                            )}
                            {a.status === "PRESENT" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1 h-8 px-3"
                                onClick={() => handleQuickAttendance(a, "ABSENT")}
                              >
                                <XCircle className="w-3 h-3" />
                                Absent
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 font-bold hover:text-blue-700 gap-1 h-8 px-3"
                              onClick={() => setEditAtt({ ...a })}
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {attendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                          No recent attendance logs found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EXPENSES */}
          <TabsContent value="expenses">
            <Card className="border-none shadow-xl shadow-slate-200/50">
              <CardHeader>
                <CardTitle>Expense Management</CardTitle>
                <CardDescription>Edit expense categories, amounts, dates, status, or delete records</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Employee</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="font-bold text-slate-900">{e.user?.name || "—"}</div>
                          <div className="text-xs text-slate-500">{e.user?.email || "—"}</div>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-700 capitalize">{e.category?.toLowerCase()}</TableCell>
                        <TableCell className="font-bold text-slate-900">₹{e.amount}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {e.date ? format(new Date(e.date), "dd MMM yyyy") : "—"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-slate-500">{e.description}</TableCell>
                        <TableCell>
                          <Badge className={e.approved ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-500 hover:bg-amber-600"}>
                            {e.approved ? "APPROVED" : "PENDING"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 font-bold hover:text-blue-700 gap-1 h-8 px-3"
                              onClick={() => setEditExpense({ ...e })}
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600 font-bold hover:text-rose-700 gap-1 h-8 px-3"
                              onClick={() => deleteExpense(e.id)}
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {expenses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-400 font-medium">
                          No expense records found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LEAVES */}
          <TabsContent value="leaves">
            <Card className="border-none shadow-xl shadow-slate-200/50">
              <CardHeader>
                <CardTitle>Leave Correction</CardTitle>
                <CardDescription>Adjust leave dates, reasons, approval status, or delete leave requests</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Employee</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-bold text-slate-900">{l.user?.name || "—"}</div>
                          <div className="text-xs text-slate-500">{l.user?.email || "—"}</div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {l.startDate ? format(new Date(l.startDate), "dd MMM yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {l.endDate ? format(new Date(l.endDate), "dd MMM yyyy") : "—"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-slate-500">{l.reason}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              l.status === "APPROVED"
                                ? "bg-emerald-500 hover:bg-emerald-600"
                                : l.status === "REJECTED"
                                ? "bg-rose-500 hover:bg-rose-600"
                                : "bg-amber-500 hover:bg-amber-600"
                            }
                          >
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 font-bold hover:text-blue-700 gap-1 h-8 px-3"
                              onClick={() => setEditLeave({ ...l })}
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600 font-bold hover:text-rose-700 gap-1 h-8 px-3"
                              onClick={() => deleteLeave(l.id)}
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {leaves.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                          No leave requests found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TASKS */}
          <TabsContent value="tasks">
            <Card className="border-none shadow-xl shadow-slate-200/50">
              <CardHeader>
                <CardTitle>Task &amp; Point Overrides</CardTitle>
                <CardDescription>Edit tasks, override task points, change status, or delete tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Task Title</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="font-bold text-slate-900">{t.title}</div>
                          <div className="text-xs text-slate-500 max-w-xs truncate">{t.description || "No description"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-semibold text-slate-700">{t.assignedTo?.name || "—"}</div>
                          <div className="text-[10px] text-slate-500">{t.assignedTo?.email || "—"}</div>
                        </TableCell>
                        <TableCell className="font-black text-blue-600">{t.points} pts</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              t.status === "COMPLETED"
                                ? "bg-emerald-500 hover:bg-emerald-600"
                                : t.status === "CANCELLED"
                                ? "bg-slate-500 hover:bg-slate-600"
                                : t.status === "IN_PROGRESS"
                                ? "bg-blue-500 hover:bg-blue-600"
                                : "bg-amber-500 hover:bg-amber-600"
                            }
                          >
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-bold border-slate-200">
                            {t.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {t.dueDate ? format(new Date(t.dueDate), "dd MMM yyyy HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 font-bold hover:text-blue-700 gap-1 h-8 px-3"
                              onClick={() => setEditTask({ ...t })}
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600 font-bold hover:text-rose-700 gap-1 h-8 px-3"
                              onClick={() => deleteTask(t.id)}
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {tasks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-400 font-medium">
                          No tasks found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>

      {/* EDIT USER DIALOG */}
      <Dialog open={Boolean(editUser)} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update profile, role and pay details</DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Name</Label>
                <Input value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Email</Label>
                <Input value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Phone</Label>
                <Input value={editUser.phone} onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Designation</Label>
                <Input
                  value={editUser.designation || ""}
                  onChange={(e) => setEditUser({ ...editUser, designation: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Role</Label>
                <Select value={editUser.role} onValueChange={(v) => setEditUser({ ...editUser, role: v as Role })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPERADMIN">SUPERADMIN</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                    <SelectItem value="MANAGER">MANAGER</SelectItem>
                    <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Work Mode</Label>
                <Select
                  value={editUser.workMode}
                  onValueChange={(v) => setEditUser({ ...editUser, workMode: v as User["workMode"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIELD">FIELD</SelectItem>
                    <SelectItem value="OFFICE">OFFICE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Manager</Label>
                <Select
                  value={editUser.managerId || "none"}
                  onValueChange={(v) => setEditUser({ ...editUser, managerId: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {managers
                      .filter((m) => m.id !== editUser.id)
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Shift Start</Label>
                <Input
                  type="time"
                  value={editUser.shiftStart}
                  onChange={(e) => setEditUser({ ...editUser, shiftStart: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Shift End</Label>
                <Input
                  type="time"
                  value={editUser.shiftEnd}
                  onChange={(e) => setEditUser({ ...editUser, shiftEnd: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Base Salary</Label>
                <Input
                  type="number"
                  value={editUser.baseSalary ?? 0}
                  onChange={(e) => setEditUser({ ...editUser, baseSalary: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Travel Rate (₹/km)</Label>
                <Input
                  type="number"
                  value={editUser.travelRate ?? 0}
                  onChange={(e) => setEditUser({ ...editUser, travelRate: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveUser} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT ATTENDANCE DIALOG */}
      <Dialog open={Boolean(editAtt)} onOpenChange={(o) => !o && setEditAtt(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Attendance — {editAtt?.user.name}</DialogTitle>
            <DialogDescription>
              {editAtt ? format(new Date(editAtt.date), "dd MMM yyyy") : ""} · correct any field below
            </DialogDescription>
          </DialogHeader>
          {editAtt && (
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500">Status</Label>
                  <Select
                    value={editAtt.status}
                    onValueChange={(v) => setEditAtt({ ...editAtt, status: v as AttendanceRecord["status"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRESENT">PRESENT</SelectItem>
                      <SelectItem value="ABSENT">ABSENT</SelectItem>
                      <SelectItem value="HALF_DAY">HALF_DAY</SelectItem>
                      <SelectItem value="ON_LEAVE">ON_LEAVE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500">Punch Type</Label>
                  <Select
                    value={editAtt.punchType || "none"}
                    onValueChange={(v) =>
                      setEditAtt({ ...editAtt, punchType: v === "none" ? null : (v as "OFFICE" | "FIELD") })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="OFFICE">OFFICE</SelectItem>
                      <SelectItem value="FIELD">FIELD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500">Check In</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(editAtt.checkInTime)}
                    onChange={(e) =>
                      setEditAtt({ ...editAtt, checkInTime: e.target.value ? new Date(e.target.value).toISOString() : null })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500">Check Out</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(editAtt.checkOutTime)}
                    onChange={(e) =>
                      setEditAtt({ ...editAtt, checkOutTime: e.target.value ? new Date(e.target.value).toISOString() : null })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500">Start Odometer (KM)</Label>
                  <Input
                    type="number"
                    value={editAtt.startOdometer ?? ""}
                    onChange={(e) =>
                      setEditAtt({ ...editAtt, startOdometer: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500">End Odometer (KM)</Label>
                  <Input
                    type="number"
                    value={editAtt.endOdometer ?? ""}
                    onChange={(e) =>
                      setEditAtt({ ...editAtt, endOdometer: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <ImageField
                  label="Start Odometer Photo"
                  value={editAtt.startOdometerPhotoUrl}
                  onChange={(url) => setEditAtt({ ...editAtt, startOdometerPhotoUrl: url })}
                />
                <ImageField
                  label="End Odometer Photo"
                  value={editAtt.endOdometerPhotoUrl}
                  onChange={(url) => setEditAtt({ ...editAtt, endOdometerPhotoUrl: url })}
                />
                <ImageField
                  label="Check-In Selfie"
                  value={editAtt.checkInPhotoUrl}
                  onChange={(url) => setEditAtt({ ...editAtt, checkInPhotoUrl: url })}
                />
                <ImageField
                  label="Check-Out Selfie"
                  value={editAtt.checkOutPhotoUrl}
                  onChange={(url) => setEditAtt({ ...editAtt, checkOutPhotoUrl: url })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAtt(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveAttendance} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT EXPENSE DIALOG */}
      <Dialog open={Boolean(editExpense)} onOpenChange={(o) => !o && setEditExpense(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Modify expense category, amount, description, or approval status</DialogDescription>
          </DialogHeader>
          {editExpense && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Category</Label>
                <Select
                  value={editExpense.category}
                  onValueChange={(v) => setEditExpense({ ...editExpense, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRAVEL">TRAVEL</SelectItem>
                    <SelectItem value="FOOD">FOOD</SelectItem>
                    <SelectItem value="ACCOMMODATION">ACCOMMODATION</SelectItem>
                    <SelectItem value="OTHER">OTHER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Amount (₹)</Label>
                <Input
                  type="number"
                  value={editExpense.amount}
                  onChange={(e) => setEditExpense({ ...editExpense, amount: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Description</Label>
                <Input
                  value={editExpense.description}
                  onChange={(e) => setEditExpense({ ...editExpense, description: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Date</Label>
                <Input
                  type="date"
                  value={editExpense.date ? format(new Date(editExpense.date), "yyyy-MM-dd") : ""}
                  onChange={(e) =>
                    setEditExpense({ ...editExpense, date: e.target.value ? new Date(e.target.value).toISOString() : "" })
                  }
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Approval Status</Label>
                <Select
                  value={editExpense.approved ? "true" : "false"}
                  onValueChange={(v) => setEditExpense({ ...editExpense, approved: v === "true" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">PENDING</SelectItem>
                    <SelectItem value="true">APPROVED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 border-t pt-4">
                <ImageField
                  label="Receipt Image"
                  value={editExpense.receiptUrl}
                  onChange={(url) => setEditExpense({ ...editExpense, receiptUrl: url })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExpense(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveExpense} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT LEAVE DIALOG */}
      <Dialog open={Boolean(editLeave)} onOpenChange={(o) => !o && setEditLeave(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
            <DialogDescription>Modify leave dates, reason, or status</DialogDescription>
          </DialogHeader>
          {editLeave && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Start Date</Label>
                <Input
                  type="date"
                  value={editLeave.startDate ? format(new Date(editLeave.startDate), "yyyy-MM-dd") : ""}
                  onChange={(e) =>
                    setEditLeave({ ...editLeave, startDate: e.target.value ? new Date(e.target.value).toISOString() : "" })
                  }
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">End Date</Label>
                <Input
                  type="date"
                  value={editLeave.endDate ? format(new Date(editLeave.endDate), "yyyy-MM-dd") : ""}
                  onChange={(e) =>
                    setEditLeave({ ...editLeave, endDate: e.target.value ? new Date(e.target.value).toISOString() : "" })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Reason</Label>
                <Input
                  value={editLeave.reason}
                  onChange={(e) => setEditLeave({ ...editLeave, reason: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Status</Label>
                <Select
                  value={editLeave.status}
                  onValueChange={(v) => setEditLeave({ ...editLeave, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="APPROVED">APPROVED</SelectItem>
                    <SelectItem value="REJECTED">REJECTED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLeave(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveLeave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT TASK DIALOG */}
      <Dialog open={Boolean(editTask)} onOpenChange={(o) => !o && setEditTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Task &amp; Points</DialogTitle>
            <DialogDescription>Modify task details, assignee, points, or status</DialogDescription>
          </DialogHeader>
          {editTask && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Title</Label>
                <Input
                  value={editTask.title}
                  onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Description</Label>
                <Input
                  value={editTask.description || ""}
                  onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Points</Label>
                <Input
                  type="number"
                  value={editTask.points}
                  onChange={(e) => setEditTask({ ...editTask, points: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Priority</Label>
                <Select
                  value={editTask.priority}
                  onValueChange={(v) => setEditTask({ ...editTask, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Status</Label>
                <Select
                  value={editTask.status}
                  onValueChange={(v) => setEditTask({ ...editTask, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                    <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Due Date</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInput(editTask.dueDate)}
                  onChange={(e) =>
                    setEditTask({ ...editTask, dueDate: e.target.value ? new Date(e.target.value).toISOString() : "" })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Assignee</Label>
                <Select
                  value={editTask.assignedToId}
                  onValueChange={(v) => setEditTask({ ...editTask, assignedToId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTask(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveTask} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK MARK ATTENDANCE DIALOG */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !o && setBulkOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Mark Attendance</DialogTitle>
            <DialogDescription>Apply standard status and timings across multiple dates</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Employee</Label>
              <Select
                value={bulkData.userId}
                onValueChange={(v) => setBulkData({ ...bulkData, userId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase text-slate-500">Start Date</Label>
              <Input
                type="date"
                value={bulkData.startDate}
                onChange={(e) => setBulkData({ ...bulkData, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase text-slate-500">End Date</Label>
              <Input
                type="date"
                value={bulkData.endDate}
                onChange={(e) => setBulkData({ ...bulkData, endDate: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase text-slate-500">Status</Label>
              <Select
                value={bulkData.status}
                onValueChange={(v) => setBulkData({ ...bulkData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">PRESENT</SelectItem>
                  <SelectItem value="ABSENT">ABSENT</SelectItem>
                  <SelectItem value="HALF_DAY">HALF_DAY</SelectItem>
                  <SelectItem value="ON_LEAVE">ON_LEAVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase text-slate-500">Punch Type</Label>
              <Select
                value={bulkData.punchType}
                onValueChange={(v) => setBulkData({ ...bulkData, punchType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFFICE">OFFICE</SelectItem>
                  <SelectItem value="FIELD">FIELD</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(bulkData.status === "PRESENT" || bulkData.status === "HALF_DAY") && (
              <>
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500">Check In Time</Label>
                  <Input
                    type="time"
                    value={bulkData.checkInTime}
                    onChange={(e) => setBulkData({ ...bulkData, checkInTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500">Check Out Time</Label>
                  <Input
                    type="time"
                    value={bulkData.checkOutTime}
                    onChange={(e) => setBulkData({ ...bulkData, checkOutTime: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitBulkAttendance} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Bulk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

