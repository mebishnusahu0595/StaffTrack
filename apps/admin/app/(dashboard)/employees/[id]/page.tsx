"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { LocationMap } from "@/components/admin/google-map";
import { TaskStatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAttendance, fetchDerHistory, fetchExpenses, fetchTasks, fetchTodayLocation, fetchUser, fetchUsers } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const userQuery = useQuery({ queryKey: ["user", id], queryFn: () => fetchUser(id) });
  const managersQuery = useQuery({ queryKey: ["users", "managers"], queryFn: () => fetchUsers({ page: 1, pageSize: 100 }) });
  const attendanceQuery = useQuery({ queryKey: ["attendance", id], queryFn: () => fetchAttendance(id) });
  const tasksQuery = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const reportsQuery = useQuery({ queryKey: ["reports", id], queryFn: () => fetchDerHistory(id) });
  const expensesQuery = useQuery({ queryKey: ["expenses", id], queryFn: () => fetchExpenses({ userId: id }) });
  const locationQuery = useQuery({
    queryKey: ["location", id, "today"],
    queryFn: () => fetchTodayLocation(id),
    refetchInterval: 60_000
  });

  const employee = userQuery.data;
  const manager = managersQuery.data?.items.find((item) => item.id === employee?.managerId);
  const employeeTasks = (tasksQuery.data ?? []).filter((task) => task.assignedToId === id);

  const profileStats = useMemo(
    () => [
      { label: "Phone", value: employee?.phone ?? "—" },
      { label: "Role", value: employee?.role ?? "—" },
      { label: "Assigned Manager", value: manager?.name ?? "Unassigned" }
    ],
    [employee, manager]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee?.name ?? "Employee detail"}
        description={employee ? `Last synced profile for ${employee.email}` : "Loading employee profile"}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {profileStats.map((item) => (
              <div key={item.label} className="rounded-lg border bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</div>
                <div className="mt-2 text-sm font-medium text-slate-900">{item.value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Live Map</CardTitle>
          </CardHeader>
          <CardContent>
            <LocationMap logs={locationQuery.data ?? []} />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="reports">DER History</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(attendanceQuery.data ?? []).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{formatDateTime(record.checkInTime)}</TableCell>
                      <TableCell>{formatDateTime(record.checkOutTime)}</TableCell>
                      <TableCell>{record.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-slate-500">{task.description}</div>
                      </TableCell>
                      <TableCell>{formatDate(task.dueDate)}</TableCell>
                      <TableCell>
                        <TaskStatusBadge status={task.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Visits</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>KM</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reportsQuery.data ?? []).map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>{formatDate(report.date)}</TableCell>
                      <TableCell>{report.visitsSummary}</TableCell>
                      <TableCell>{report.ordersTaken}</TableCell>
                      <TableCell>{report.kmTravelled}</TableCell>
                      <TableCell>{formatDateTime(report.submittedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(expensesQuery.data ?? []).map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{formatDate(expense.date)}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>{formatCurrency(expense.amount)}</TableCell>
                      <TableCell>{expense.approved ? "Approved" : "Pending"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
