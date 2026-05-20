"use client";

import { useEffect, useState } from "react";
import { 
  Users, 
  Clock, 
  UserCog, 
  Search, 
  Save, 
  RefreshCw, 
  Calendar, 
  AlertTriangle,
  UserMinus,
  CheckCircle2,
  XCircle,
  LayoutDashboard,
  ShieldCheck
} from "lucide-react";
import { 
  superFetchUsers, 
  superUpdateUser, 
  superFetchAttendance, 
  superUpdateAttendance,
  superFetchManagers 
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
import { useAuth } from "@/components/auth-provider";
import { format } from "date-fns";

export default function SuperDashboardPage() {
  const { user: currentUser, signOut } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [attendance, setAttendance] = useState<(AttendanceRecord & { user: { name: string; email: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("users");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [u, m, a] = await Promise.all([
        superFetchUsers(),
        superFetchManagers(),
        superFetchAttendance()
      ]);
      setUsers(u);
      setManagers(m);
      setAttendance(a);
    } catch (err) {
      console.error("Failed to load superadmin data", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpdateUser = async (id: string, data: Partial<User>) => {
    try {
      await superUpdateUser(id, data);
      await loadData();
    } catch (err) {
      alert("Failed to update user");
    }
  };

  const handleUpdateAttendance = async (record: AttendanceRecord, status: string) => {
    try {
      await superUpdateAttendance(record.id, { 
        userId: record.userId,
        date: record.date,
        status: status as any 
      });
      await loadData();
    } catch (err) {
      alert("Failed to update attendance");
    }
  };

  if (currentUser?.role !== "SUPERADMIN" && currentUser?.role !== "ADMIN") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-slate-400">Restricted Area: Level 5 Authorization Required</p>
          <Button onClick={() => window.location.href = "/login"} className="mt-4 bg-blue-600">Return to Safety</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-black uppercase tracking-tighter text-xl">SuperAdmin <span className="text-blue-500">Console</span></span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-slate-400">CHANNEL: 0595</span>
            <Button variant="outline" size="sm" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800" onClick={signOut}>
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
          <div className="flex gap-2">
            <Button onClick={loadData} variant="outline" className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-6" onValueChange={setActiveTab}>
          <TabsList className="bg-white border p-1 rounded-xl shadow-sm">
            <TabsTrigger value="users" className="rounded-lg gap-2 px-6">
              <Users className="w-4 h-4" />
              Employee Timing
            </TabsTrigger>
            <TabsTrigger value="attendance" className="rounded-lg gap-2 px-6">
              <Clock className="w-4 h-4" />
              Attendance Fixes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card className="border-none shadow-xl shadow-slate-200/50">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Edit shifts, roles, and manager assignments</CardDescription>
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
                      <TableHead>Role</TableHead>
                      <TableHead>Shift Timing</TableHead>
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
                        <TableCell>
                          <Badge variant="outline" className="font-bold border-slate-200">
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="time" 
                              className="w-24 h-8 px-2 text-xs" 
                              defaultValue={u.shiftStart}
                              onBlur={(e) => handleUpdateUser(u.id, { shiftStart: e.target.value })}
                            />
                            <span className="text-slate-400">-</span>
                            <Input 
                              type="time" 
                              className="w-24 h-8 px-2 text-xs" 
                              defaultValue={u.shiftEnd}
                              onBlur={(e) => handleUpdateUser(u.id, { shiftEnd: e.target.value })}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select 
                            defaultValue={u.managerId || "none"} 
                            onValueChange={(val) => handleUpdateUser(u.id, { managerId: val === "none" ? null : val })}
                          >
                            <SelectTrigger className="h-8 w-40 text-xs">
                              <SelectValue placeholder="No Manager" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Manager</SelectItem>
                              {managers.filter(m => m.id !== u.id).map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.name} ({m.role})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-blue-600 font-bold hover:text-blue-700">
                            Save
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card className="border-none shadow-xl shadow-slate-200/50">
              <CardHeader>
                <CardTitle>Attendance Correction</CardTitle>
                <CardDescription>Manually change status from ABSENT to PRESENT or vice versa</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Punch Times</TableHead>
                      <TableHead className="text-right">Manual Override</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-bold text-slate-900">{a.user.name}</div>
                          <div className="text-xs text-slate-500">{a.user.email}</div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {format(new Date(a.date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            a.status === 'PRESENT' ? 'bg-emerald-500 hover:bg-emerald-600' :
                            a.status === 'ABSENT' ? 'bg-rose-500 hover:bg-rose-600' :
                            'bg-amber-500 hover:bg-amber-600'
                          }>
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-500">
                          {a.checkInTime ? format(new Date(a.checkInTime), "HH:mm") : '--:--'} | 
                          {a.checkOutTime ? format(new Date(a.checkOutTime), "HH:mm") : '--:--'}
                        </TableCell>
                        <TableCell className="text-right flex justify-end gap-2">
                          {a.status === 'ABSENT' && (
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1 h-8 px-3" onClick={() => handleUpdateAttendance(a, 'PRESENT')}>
                              <CheckCircle2 className="w-3 h-3" />
                              Mark Present
                            </Button>
                          )}
                          {a.status === 'PRESENT' && (
                            <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1 h-8 px-3" onClick={() => handleUpdateAttendance(a, 'ABSENT')}>
                              <XCircle className="w-3 h-3" />
                              Mark Absent
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {attendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-400 font-medium">
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
    </div>
  );
}
