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
  Loader2
} from "lucide-react";
import {
  superFetchUsers,
  superUpdateUser,
  superFetchAttendance,
  superUpdateAttendance,
  superFetchManagers,
  uploadFile
} from "@/lib/api";
import type { User, AttendanceRecord, Role } from "@/lib/types";
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit dialog state
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editAtt, setEditAtt] = useState<AttRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [u, m, a] = await Promise.all([superFetchUsers(), superFetchManagers(), superFetchAttendance()]);
      setUsers(u);
      setManagers(m);
      setAttendance(a);
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
                <CardTitle>Attendance &amp; Odometer Correction</CardTitle>
                <CardDescription>
                  Fix status, punch times, odometer readings and replace odometer / selfie images
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Punch</TableHead>
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
    </div>
  );
}
