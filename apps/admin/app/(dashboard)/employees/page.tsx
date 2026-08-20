"use client";
 
import { Fragment, useEffect, useMemo, useState } from "react";
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
import { calculateDurations, formatDurationLabel } from "@/lib/timeTracking";
import { EmployeeDetailDrawer } from "@/components/admin/employee-detail-drawer";
 
export default function EmployeesPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddManagerOpen, setIsAddManagerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [workModeFilter, setWorkModeFilter] = useState<"ALL" | "FIELD" | "OFFICE">("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "MANAGER" | "EMPLOYEE">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedMapDate, setSelectedMapDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [selectedUserDate, setSelectedUserDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [drawerEmployeeId, setDrawerEmployeeId] = useState<string | null>(null);
  const [derDateFilter, setDerDateFilter] = useState<string>("");
  const todayDate = dayjs().format("YYYY-MM-DD");
  const selectedMapMonth = dayjs(selectedMapDate).month() + 1;
  const selectedMapYear = dayjs(selectedMapDate).year();
  const [liveNow, setLiveNow] = useState(() => Date.now());

  useEffect(() => {
    // Tick every second so open breaks show live duration
    const t = setInterval(() => setLiveNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth(); // Get current user for companyId
  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups
  });
 
  const usersQuery = useQuery({
    queryKey: ["users", search, roleFilter],
    queryFn: () => fetchUsers({
      search,
      role: roleFilter === "ALL" ? undefined : roleFilter,
      page: 1,
      pageSize: 1000 // Fetch all matching users for correct client-side filtering and pagination
    }),
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });

  const todayAttendanceQuery = useQuery({
    queryKey: ["attendance", "overview", selectedUserDate],
    queryFn: () => fetchAllAttendance(selectedUserDate),
    staleTime: 30_000,
    refetchOnWindowFocus: false
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
    queryFn: () => fetchUsers({ page: 1, pageSize: 100, role: "MANAGER" }),
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });
 
  const filteredUsers = useMemo(() => {
    let items = (usersQuery.data?.items ?? []).filter(
      (user) => user.role !== "ADMIN" && user.role !== "SUPERADMIN"
    );

    if (workModeFilter !== "ALL") {
      items = items.filter((user) => user.workMode === workModeFilter);
    }

    if (statusFilter !== "ALL") {
      items = items.filter((user) => {
        const latestUserAttendance = latestTodayAttendanceByUser.get(user.id);
        const isActive = Boolean(latestUserAttendance && latestUserAttendance.checkInTime && !latestUserAttendance.checkOutTime);
        return statusFilter === "ACTIVE" ? isActive : !isActive;
      });
    }

    if (departmentFilter !== "ALL") {
      items = items.filter((user) => user.groupId === departmentFilter);
    }

    // Sort alphabetically by name (immutable copy to prevent lag)
    const sorted = [...items];
    sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "", "en", { sensitivity: "base" }));

    return sorted;
  }, [latestTodayAttendanceByUser, usersQuery.data?.items, workModeFilter, statusFilter, departmentFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, departmentFilter, statusFilter, workModeFilter]);

  useEffect(() => {
    setSelectedMapDate(selectedUserDate);
  }, [selectedUserDate]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * 25;
    return filteredUsers.slice(start, start + 25);
  }, [filteredUsers, currentPage]);

  const managers = useMemo(() => managersQuery.data?.items ?? [], [managersQuery.data?.items]);

  const managersById = useMemo(
    () => new Map(managers.map((manager) => [manager.id, manager])),
    [managers]
  );

  const selectedEmployee = useMemo(
    () => filteredUsers.find((user) => user.id === expandedId),
    [expandedId, filteredUsers]
  );

  const selectedDrawerEmployee = useMemo(
    () => filteredUsers.find((user) => user.id === drawerEmployeeId),
    [drawerEmployeeId, filteredUsers]
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

  const selectedDateBreakMs = useMemo(
    () => calculateDurations(selectedDateSessions, liveNow).breakTimeMs,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDateSessions, liveNow]
  );

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
    queryFn: () => fetchTasks(),
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

  const inlineFilteredTasks = useMemo(() => {
    if (!expandedId) return [];
    return (tasksQuery.data ?? []).filter(t => 
      t.assignedToId === expandedId && 
      dayjs(t.dueDate).format("YYYY-MM-DD") === selectedMapDate
    );
  }, [tasksQuery.data, expandedId, selectedMapDate]);
 
  const employeeReports = useMemo(() => {
    return reportsQuery.data ?? [];
  }, [reportsQuery.data]);

  const inlineFilteredReports = useMemo(() => {
    if (!reportsQuery.data) return [];
    return reportsQuery.data.filter(report => {
      if (!derDateFilter) return true;
      return dayjs(report.date).format("YYYY-MM-DD") === derDateFilter;
    });
  }, [reportsQuery.data, derDateFilter]);

  const handleDownloadDER = async (report: any, employee: any) => {
    if (!employee || !report) return;
    const formattedDate = dayjs(report.date).format("DD MMM YYYY");
    const formattedSubmittedAt = dayjs(report.submittedAt).format("DD MMM YYYY hh:mm A");
    const reportDateStr = dayjs(report.date).format("YYYY-MM-DD");

    // Fetch exact tasks for this date from the API so past and present dates are never empty
    let dayTasks: any[] = [];
    try {
      const fetched = await fetchTasks({ date: reportDateStr });
      dayTasks = (fetched || []).filter((t: any) => t.assignedToId === employee.id);
    } catch {
      dayTasks = (tasksQuery.data ?? []).filter((t: any) => 
        t.assignedToId === employee.id &&
        (dayjs(t.dueDate).format("YYYY-MM-DD") === reportDateStr ||
         (t.completedAt && dayjs(t.completedAt).format("YYYY-MM-DD") === reportDateStr))
      );
    }

    // Only get completed tasks for this day
    const completedTasks = dayTasks.filter((t: any) => 
      t.status === "COMPLETED" &&
      (
        (t.completedAt && dayjs(t.completedAt).format("YYYY-MM-DD") === reportDateStr) ||
        dayjs(t.dueDate).format("YYYY-MM-DD") === reportDateStr ||
        dayjs(t.updatedAt).format("YYYY-MM-DD") === reportDateStr
      )
    );
    const completedCount = completedTasks.length;

    // Calculate month-to-date distance
    const startOfMonth = dayjs(report.date).startOf("month");
    const currentDay = dayjs(report.date);
    const mtdReports = (reportsQuery.data ?? []).filter((r: any) => {
      const d = dayjs(r.date);
      return r.userId === employee.id &&
        (d.isAfter(startOfMonth) || d.isSame(startOfMonth, 'day')) &&
        (d.isBefore(currentDay) || d.isSame(currentDay, 'day'));
    });
    const monthToDateKm = mtdReports.reduce((sum: number, r: any) => sum + (r.kmTravelled ?? r.totalKmTravelled ?? 0), 0);

    // Calculate durations
    const dayAttendanceSessions = (attendanceQuery.data ?? []).filter((session: any) => {
      return dayjs(session.checkInTime).format("YYYY-MM-DD") === reportDateStr;
    });
    const { officeTimeMs, fieldTimeMs, breakTimeMs } = calculateDurations(dayAttendanceSessions);
    const workTimeMs = officeTimeMs + fieldTimeMs;
    const workTimeLabel = workTimeMs > 0 ? formatDurationLabel(workTimeMs) : "0h 0m";
    const breakTimeLabel = breakTimeMs > 0 ? formatDurationLabel(breakTimeMs) : "0h 0m";

    // Helper to extract 1-line details from checklist responses
    const extractDetailsSnippet = (t: any): string => {
      if (t.checklistResponses && Array.isArray(t.checklistResponses) && t.checklistResponses.length > 0) {
        const parts: string[] = [];
        for (const item of t.checklistResponses) {
          const val = item.value !== undefined ? String(item.value).trim() : (item.response !== undefined ? String(item.response).trim() : (item.text !== undefined ? String(item.text).trim() : ""));
          if (val && item.type !== "IMAGE" && item.type !== "VIDEO" && item.type !== "AUDIO") {
            const title = item.title || item.label || "";
            if (title.toLowerCase().includes("farmer") || title.toLowerCase().includes("name")) {
              parts.unshift(`Farmer: ${val}`);
            } else if (title.toLowerCase().includes("village")) {
              parts.push(`Village: ${val}`);
            } else if (title.toLowerCase().includes("crop")) {
              parts.push(`Crop: ${val}`);
            } else if (title.toLowerCase().includes("land")) {
              parts.push(`Land: ${val}`);
            } else if (title.toLowerCase().includes("contact") || title.toLowerCase().includes("phone")) {
              parts.push(`Mob: ${val}`);
            } else if (parts.length < 3) {
              parts.push(`${title ? title + ': ' : ''}${val}`);
            }
          }
        }
        if (parts.length > 0) return parts.slice(0, 3).join(" | ");
      }
      return t.description ? t.description.slice(0, 45) : "";
    };

    // Helper to get task completion photo thumbnail
    const getTaskPhoto = (t: any): string | null => {
      if (t.completionPhotoUrl) return t.completionPhotoUrl;
      if (t.checklistResponses && Array.isArray(t.checklistResponses)) {
        const img = t.checklistResponses.find((item: any) => 
          item.type === "IMAGE" && (item.fileUrl || item.photoUrl || item.image || item.url)
        );
        if (img) return img.fileUrl || img.photoUrl || img.image || img.url;
      }
      return null;
    };

    // Render single task item HTML
    const renderTaskCard = (t: any) => {
      const details = extractDetailsSnippet(t);
      const photo = getTaskPhoto(t);
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 2.5px 6px; border-radius: 4px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 9px; line-height: 1.15; box-sizing: border-box; min-height: 28px;">
          <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; flex: 1; min-width: 0;">
            <span style="font-weight: 800; color: #16a34a; white-space: nowrap;">✅ ${t.title}</span>
            ${details ? `<span style="color: #475569; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">— ${details}</span>` : ""}
            ${t.completionRemarks ? `<span style="color: #64748b; font-style: italic; font-size: 8px; white-space: nowrap;">("${t.completionRemarks}")</span>` : ""}
          </div>
          <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0; margin-left: 4px;">
            <span style="font-size: 8px; font-weight: 800; color: #16a34a; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1px 3px; border-radius: 3px; white-space: nowrap;">+${t.points ?? 10}</span>
            ${photo ? `<img src="${photo}" style="width: 22px; height: 22px; border-radius: 3px; object-fit: cover; border: 1px solid #cbd5e1;" alt="Img" />` : ""}
          </div>
        </div>
      `;
    };

    // Render 2-column table if many tasks, or 1 column if few
    let tasksGridHtml = "";
    if (completedTasks.length === 0) {
      tasksGridHtml = `<p style="font-size: 9.5px; color: #94a3b8; font-style: italic; margin: 0; padding: 2px 0;">No completed tasks recorded on this date.</p>`;
    } else if (completedTasks.length > 5) {
      // 2 columns side by side
      let rows = "";
      for (let i = 0; i < completedTasks.length; i += 2) {
        const t1 = completedTasks[i];
        const t2 = completedTasks[i + 1];
        rows += `
          <tr>
            <td style="width: 50%; padding: 1.5px 3px 1.5px 0; vertical-align: middle;">${renderTaskCard(t1)}</td>
            <td style="width: 50%; padding: 1.5px 0 1.5px 3px; vertical-align: middle;">${t2 ? renderTaskCard(t2) : ""}</td>
          </tr>
        `;
      }
      tasksGridHtml = `<table style="width: 100%; border-collapse: collapse; table-layout: fixed;">${rows}</table>`;
    } else {
      tasksGridHtml = completedTasks.map(t => `<div style="margin-bottom: 3px;">${renderTaskCard(t)}</div>`).join("");
    }

    const htmlContent = `
<div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; padding: 10px 14px; background: #ffffff; box-sizing: border-box; max-width: 820px; margin: 0 auto;">
  
  <!-- Header Bar -->
  <div style="height: 3px; background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%); border-radius: 2px; margin-bottom: 8px;"></div>

  <!-- Main Header Table -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
    <tr>
      <td style="vertical-align: top;">
        <h1 style="font-size: 17px; font-weight: 800; color: #1e293b; margin: 0; letter-spacing: -0.5px;">DAY END REPORT</h1>
        <p style="font-size: 8.5px; font-weight: 700; color: #2563eb; margin: 1px 0 0 0; text-transform: uppercase; letter-spacing: 0.8px;">Vaniki Crop Science Pvt Ltd</p>
      </td>
      <td style="vertical-align: top; text-align: right;">
        <h2 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0;">${employee.name}</h2>
        <p style="font-size: 9px; font-weight: 600; color: #64748b; margin: 1px 0 0 0;">${employee.designation || 'Field Representative'} &bull; ${employee.email}</p>
      </td>
    </tr>
  </table>

  <!-- Meta Stats Row (4 Columns Compact) -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 7px;">
    <tr>
      <td style="width: 25%; padding-right: 3px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; text-align: center; box-sizing: border-box;">
          <p style="font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0 0 1px 0;">Report Date</p>
          <p style="font-size: 10.5px; font-weight: 800; color: #1e293b; margin: 0;">${formattedDate}</p>
        </div>
      </td>
      <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; text-align: center; box-sizing: border-box;">
          <p style="font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0 0 1px 0;">Today Distance</p>
          <p style="font-size: 10.5px; font-weight: 800; color: #2563eb; margin: 0;">${report.kmTravelled ?? report.totalKmTravelled ?? 0} KM</p>
        </div>
      </td>
      <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 4px 6px; text-align: center; box-sizing: border-box;">
          <p style="font-size: 7.5px; font-weight: 700; color: #1e40af; text-transform: uppercase; margin: 0 0 1px 0;">MTD Distance</p>
          <p style="font-size: 10.5px; font-weight: 800; color: #1d4ed8; margin: 0;">${monthToDateKm} KM</p>
        </div>
      </td>
      <td style="width: 25%; padding-left: 3px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; text-align: center; box-sizing: border-box;">
          <p style="font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0 0 1px 0;">Submitted At</p>
          <p style="font-size: 9.5px; font-weight: 800; color: #1e293b; margin: 0;">${formattedSubmittedAt}</p>
        </div>
      </td>
    </tr>
  </table>

  <!-- Orders & Working Metrics (Grid) -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 7px;">
    <tr>
      <td style="width: 25%; padding-right: 3px;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 4px 8px; box-sizing: border-box;">
          <span style="font-size: 7.5px; font-weight: 700; color: #166534; text-transform: uppercase;">Orders Booked:</span>
          <span style="font-size: 12px; font-weight: 800; color: #14532d; margin-left: 4px;">${report.ordersTaken ?? 0}</span>
        </div>
      </td>
      <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 4px 8px; box-sizing: border-box;">
          <span style="font-size: 7.5px; font-weight: 700; color: #991b1b; text-transform: uppercase;">Cancelled:</span>
          <span style="font-size: 12px; font-weight: 800; color: #7f1d1d; margin-left: 4px;">${report.ordersCancelled ?? 0}</span>
        </div>
      </td>
      <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; box-sizing: border-box;">
          <span style="font-size: 7.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Work Time:</span>
          <span style="font-size: 11px; font-weight: 800; color: #166534; margin-left: 4px;">${workTimeLabel}</span>
        </div>
      </td>
      <td style="width: 25%; padding-left: 3px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; box-sizing: border-box;">
          <span style="font-size: 7.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Break Time:</span>
          <span style="font-size: 11px; font-weight: 800; color: #b45309; margin-left: 4px;">${breakTimeLabel}</span>
        </div>
      </td>
    </tr>
  </table>

  <!-- Odometer Readings -->
  ${(report.startOdometer !== null && report.startOdometer !== undefined) || (report.endOdometer !== null && report.endOdometer !== undefined) ? `
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; margin-bottom: 7px; box-sizing: border-box;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 50%;">
          <span style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">Start Odometer: </span>
          <span style="font-size: 11px; font-weight: 800; color: #1e293b;">${report.startOdometer !== null && report.startOdometer !== undefined ? report.startOdometer + ' km' : '--'}</span>
        </td>
        <td style="width: 50%;">
          <span style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">End Odometer: </span>
          <span style="font-size: 11px; font-weight: 800; color: #1e293b;">${report.endOdometer !== null && report.endOdometer !== undefined ? report.endOdometer + ' km' : '--'}</span>
        </td>
      </tr>
    </table>
  </div>
  ` : ''}

  <!-- Tasks Completed (1-line each in compact grid, NO pending list) -->
  <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; margin-bottom: 7px; box-sizing: border-box;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 3px; margin-bottom: 4px;">
      <h3 style="font-size: 9.5px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">Tasks Completed Today</h3>
      <span style="font-size: 8.5px; font-weight: 700; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1px 5px; border-radius: 3px;">
        ✅ ${completedCount} Tasks Completed
      </span>
    </div>
    
    <div>
      ${tasksGridHtml}
    </div>
  </div>

  <!-- Work Summary & Remarks (Side by Side / Compact) -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 7px;">
    <tr>
      <td style="width: ${report.remarks ? '50%' : '100%'}; padding-right: ${report.remarks ? '4px' : '0'}; vertical-align: top;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; box-sizing: border-box; min-height: 38px;">
          <h4 style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0 0 1px 0;">Work Summary</h4>
          <p style="font-size: 9.5px; line-height: 1.25; color: #334155; margin: 0;">${report.visitsSummary || "Field Work Mode"}</p>
        </div>
      </td>
      ${report.remarks ? `
      <td style="width: 50%; padding-left: 4px; vertical-align: top;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; box-sizing: border-box; min-height: 38px;">
          <h4 style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0 0 1px 0;">Remarks</h4>
          <p style="font-size: 9.5px; font-style: italic; line-height: 1.25; color: #64748b; margin: 0;">${report.remarks}</p>
        </div>
      </td>
      ` : ''}
    </tr>
  </table>

  <!-- Verification Media (Compact Thumbnails) -->
  ${report.startOdometerPhotoUrl || report.kmPhotoUrl ? `
  <div style="border-top: 1px solid #e2e8f0; padding-top: 5px; margin-top: 4px; box-sizing: border-box;">
    <h3 style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0 0 4px 0; letter-spacing: 0.5px;">Verification Photos</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        ${report.startOdometerPhotoUrl ? `
        <td style="width: 50%; padding-right: 4px; text-align: center; vertical-align: top;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; box-sizing: border-box;">
            <p style="font-size: 7.5px; font-weight: 700; color: #64748b; margin: 0 0 2px 0; text-transform: uppercase;">Start Odometer</p>
            <img src="${report.startOdometerPhotoUrl}" style="max-width: 100%; max-height: 65px; border-radius: 3px; object-fit: contain;" />
          </div>
        </td>
        ` : ''}
        ${report.kmPhotoUrl ? `
        <td style="width: 50%; padding-left: 4px; text-align: center; vertical-align: top;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; box-sizing: border-box;">
            <p style="font-size: 7.5px; font-weight: 700; color: #64748b; margin: 0 0 2px 0; text-transform: uppercase;">End Odometer</p>
            <img src="${report.kmPhotoUrl}" style="max-width: 100%; max-height: 65px; border-radius: 3px; object-fit: contain;" />
          </div>
        </td>
        ` : ''}
      </tr>
    </table>
  </div>
  ` : ''}
</div>
    `;

    // Open a new popup window and use the browser's native print-to-PDF
    const printWindow = window.open("", "_blank", "width=860,height=750");
    if (!printWindow) {
      alert("Popup blocked! Please allow popups for this site to download the DER.");
      return;
    }

    const filename = `Day_End_Report_${employee.name.replace(/\s+/g, '_')}_${reportDateStr}`;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${filename}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #334155; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      @page { margin: 5mm 6mm; size: A4 portrait; }
    }
    .print-btn {
      display: block;
      margin: 10px auto 0;
      padding: 8px 24px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.5px;
    }
    .print-btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
${htmlContent}
<div class="no-print" style="text-align:center; padding: 8px 0 14px;">
  <button class="print-btn" onclick="window.print()">⬇ Save as PDF / Print</button>
</div>
<script>
  // Auto-trigger print after images load
  window.onload = function() {
    setTimeout(function() { window.print(); }, 600);
  };
<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Employees</h1>
            <p className="mt-1 text-slate-500">Manage, track and organize your field and office team activity.</p>
          </div>
        </div>

        {/* Responsive Grid for filters and menus (4 columns on desktop, 2 on tablet, stacked on mobile) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 w-full bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-inner">
          {/* Row 1 */}
          <div className="flex items-center gap-2 bg-white px-3 h-10 rounded-xl border border-slate-200 shadow-sm w-full">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input 
              type="date" 
              className="bg-transparent border-none text-xs font-bold text-slate-650 focus:outline-none w-full cursor-pointer"
              value={selectedUserDate}
              onChange={e => setSelectedUserDate(e.target.value || dayjs().format("YYYY-MM-DD"))}
            />
          </div>
          <div>
            <Select value={workModeFilter} onValueChange={(v: any) => setWorkModeFilter(v)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-600 bg-white shadow-sm w-full">
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

          {/* Row 2 */}
          <div>
            <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-600 bg-white shadow-sm w-full">
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
          <div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-600 bg-white shadow-sm w-full">
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

          {/* Row 3 */}
          <div>
            <Select value={departmentFilter} onValueChange={(v: any) => setDepartmentFilter(v)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-600 bg-white shadow-sm w-full">
                <Users className="h-4 w-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {(groupsQuery.data ?? []).map((group: any) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button 
              variant="outline" 
              className="border-slate-200 bg-white rounded-xl px-4 h-10 font-bold text-slate-600 shadow-sm gap-2 text-xs w-full hover:bg-slate-50 transition-all"
              onClick={downloadCSV}
              disabled={filteredUsers.length === 0}
            >
              <Download className="h-4 w-4 text-slate-500" />
              Export CSV
            </Button>
          </div>

          {/* Row 4 */}
          <div>
            <DepartmentManagementDialog
              trigger={
                <Button variant="outline" className="border-slate-200 bg-white rounded-xl px-5 h-10 font-bold text-slate-700 shadow-sm text-xs w-full hover:bg-slate-50 transition-all">
                  <Users className="mr-2 h-4 w-4 text-blue-500" />
                  Manage Departments
                </Button>
              }
            />
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddManagerOpen} onOpenChange={setIsAddManagerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-slate-200 bg-white rounded-xl px-3 h-10 font-bold text-slate-700 shadow-sm text-xs w-full">
                  <UserPlus className="mr-2 h-4 w-4 text-emerald-600" />
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
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 rounded-xl px-3 h-10 font-bold w-full">
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
                <th className="py-4 px-8 text-[11px] font-black uppercase tracking-wider text-slate-400">ID</th>
                <th className="py-4 px-8 text-[11px] font-black uppercase tracking-wider text-slate-400">Name</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Phone</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Designation</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Department</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Manager</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Shift Timing</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400 text-center">Work Mode</th>
                <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">Last Seen</th>
                <th className="py-4 px-8 text-[11px] font-black uppercase tracking-wider text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => {
                const isExpanded = expandedId === user.id;
                const userSessions = (todayAttendanceQuery.data ?? []).filter(r => r.userId === user.id && r.checkInTime);
                const latestUserAttendance = userSessions.slice().sort(sortAttendanceByLatestEventDesc)[0];
                const displayedWorkMode = resolveDisplayedWorkMode(user.workMode, latestUserAttendance);
                const isPunchedIn = Boolean(latestUserAttendance && latestUserAttendance.checkInTime && !latestUserAttendance.checkOutTime);
                const todayBreakMs = calculateDurations(userSessions).breakTimeMs;
                return (
                  <Fragment key={user.id}>
                    <tr className={cn(
                      "group border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer",
                      isExpanded && "bg-slate-50/80 hover:bg-slate-50/80"
                    )} onClick={() => setExpandedId(isExpanded ? null : user.id)}>
                      <td className="py-5 px-8 font-black text-xs text-slate-500">
                        {user.employeeCode || "—"}
                      </td>
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
                              <span 
                                className="font-bold text-slate-900 text-sm leading-tight hover:text-blue-600 hover:underline cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDrawerEmployeeId(user.id);
                                }}
                              >
                                {user.name}
                              </span>
                              {selectedUserDate === todayDate ? (
                                isPunchedIn ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm">
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/50 shadow-sm">
                                    Inactive
                                  </span>
                                )
                              ) : (
                                (() => {
                                  const status = latestUserAttendance?.status ?? "ABSENT";
                                  if (status === "PRESENT") {
                                    return (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm">
                                        Present
                                      </span>
                                    );
                                  } else if (status === "HALF_DAY") {
                                    return (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/50 shadow-sm">
                                        Half Day
                                      </span>
                                    );
                                  } else if (status === "ON_LEAVE") {
                                    return (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/50 shadow-sm">
                                        On Leave
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/50 shadow-sm">
                                        Absent
                                      </span>
                                    );
                                  }
                                })()
                              )}
                              {todayBreakMs > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/50 shadow-sm ml-2">
                                  Break: {formatDurationLabel(todayBreakMs)}
                                </span>
                              )}
                              {selectedUserDate === todayDate && user.batteryLevel !== undefined && user.batteryLevel !== null && (
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
                              {selectedUserDate === todayDate && user.isLocationOn !== undefined && (
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
                      <td className="py-5 px-6 text-xs font-semibold text-slate-600 font-mono">
                        {user.shiftStart} - {user.shiftEnd}
                      </td>
                      <td className="py-5 px-6 text-center">
                         <div className={cn(
                           "flex items-center justify-center gap-2 px-3 py-1 rounded-full border w-fit mx-auto",
                           user.workMode === "FIELD"
                             ? "bg-blue-50 text-blue-600 border-blue-100"
                             : user.workMode === "BOTH"
                             ? "bg-violet-50 text-violet-600 border-violet-100"
                             : "bg-indigo-50 text-indigo-600 border-indigo-100"
                         )}>
                            <span className="text-[10px] font-black uppercase tracking-wider">{user.workMode}</span>
                         </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                           {isExpanded && latestLocation ? (
                             <>
                               <span className="text-xs font-bold text-slate-600">{formatTime(latestLocation.timestamp)}</span>
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{`${latestLocation.lat.toFixed(4)}, ${latestLocation.lng.toFixed(4)}`}</span>
                             </>
                           ) : latestUserAttendance && latestUserAttendance.checkInTime ? (
                             <>
                               <span className="text-xs font-bold text-slate-650">
                                 In: {dayjs(latestUserAttendance.checkInTime).format("hh:mm A")}
                               </span>
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                 {latestUserAttendance.checkOutTime 
                                   ? `Out: ${dayjs(latestUserAttendance.checkOutTime).format("hh:mm A")}`
                                   : "Active"}
                               </span>
                             </>
                           ) : (
                             <>
                               <span className="text-xs font-bold text-slate-400">Expand row</span>
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">for live location</span>
                             </>
                           )}
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
                        <td colSpan={10} className="p-0 border-none bg-slate-50/80">
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
 
                                              <div className="mt-8 grid grid-cols-2 gap-4">
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
                                              <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-100 flex flex-col justify-between">
                                                 <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Break Time</p>
                                                    <div className="flex items-end gap-1 mb-1">
                                                       <span className="text-lg font-black text-slate-900 leading-none">{formatDurationLabel(selectedDateBreakMs)}</span>
                                                    </div>
                                                 </div>
                                                 <div className="flex items-center gap-1.5 text-amber-600 mt-1">
                                                    <div className="h-1 w-1 rounded-full bg-amber-500" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider">Break Duration</span>
                                                 </div>
                                              </div>
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
 
                                 {/* Middle: Assigned Tasks List */}
                                  <div className="col-span-6">
                                     <Card className="border-none shadow-sm ring-1 ring-slate-200/50 h-full bg-white p-6 flex flex-col justify-between">
                                        <div>
                                           <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                                              <div className="flex items-center gap-2">
                                                 <ClipboardList className="h-5 w-5 text-blue-500" />
                                                 <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Assigned Tasks</h3>
                                                 <Badge className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black px-2.5 py-0.5 rounded-lg shadow-sm">
                                                    {inlineFilteredTasks.length} task{inlineFilteredTasks.length === 1 ? "" : "s"}
                                                 </Badge>
                                              </div>
                                              <Input 
                                                 type="date" 
                                                 value={selectedMapDate} 
                                                 onChange={(e) => setSelectedMapDate(e.target.value)}
                                                 className="h-8 text-[11px] font-bold rounded-lg border-slate-200 bg-white shadow-sm w-36"
                                              />
                                           </div>
                                           
                                           <div className="overflow-y-auto pr-1 space-y-3 max-h-[420px]">
                                              {inlineFilteredTasks.length === 0 ? (
                                                 <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                                    <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No tasks for this date</p>
                                                    <p className="text-[10px] text-slate-400 mt-1 font-medium">Tasks assigned to {selectedEmployee?.name} on {dayjs(selectedMapDate).format("DD MMM, YYYY")} will appear here.</p>
                                                 </div>
                                              ) : (
                                                 inlineFilteredTasks.map((task) => (
                                                    <div key={task.id} className="p-4 rounded-2xl bg-white border border-slate-100/80 shadow-sm hover:shadow-md transition-all group text-left">
                                                       <div className="flex items-start justify-between">
                                                          <div className="space-y-1">
                                                             <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{task.title}</h4>
                                                             {task.description && (
                                                                <p className="text-xs text-slate-500 font-medium leading-relaxed">{task.description}</p>
                                                             )}
                                                          </div>
                                                          <div className="flex items-center gap-2">
                                                             {task.points > 0 && (
                                                                <Badge className="bg-blue-50 text-blue-700 border border-blue-100 font-bold text-[9px] px-1.5 py-0.5 rounded-md">+{task.points} pts</Badge>
                                                             )}
                                                             <Badge className={cn(
                                                                "text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border shadow-sm",
                                                                task.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                                                                task.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-600 border-blue-100" :
                                                                "bg-amber-50 text-amber-600 border-amber-100"
                                                             )}>
                                                                {task.status.replace("_", " ")}
                                                             </Badge>
                                                          </div>
                                                       </div>

                                                       {/* Task Completion Details Section */}
                                                       {task.status === "COMPLETED" && (
                                                          <div className="mt-3 bg-emerald-50/30 border border-emerald-100/50 rounded-xl p-3 text-left space-y-2">
                                                             <div className="flex items-center justify-between">
                                                                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Completion Info</span>
                                                                {task.endDate && (
                                                                   <span className="text-[9px] font-bold text-slate-500">
                                                                      Completed: {dayjs(task.endDate).format("MMM DD, YYYY hh:mm A")}
                                                                   </span>
                                                                )}
                                                             </div>
                                                             
                                                             {task.completionRemarks && (
                                                                <p className="text-xs font-semibold text-slate-700 bg-white border border-slate-100 p-2 rounded-lg leading-relaxed shadow-sm">
                                                                   {task.completionRemarks}
                                                                </p>
                                                             )}

                                                             {task.completionPhotoUrl && (
                                                                <div className="pt-1">
                                                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Attached Photo:</p>
                                                                   <a 
                                                                      href={task.completionPhotoUrl} 
                                                                      target="_blank" 
                                                                      rel="noopener noreferrer"
                                                                      className="inline-block relative group/img overflow-hidden rounded-lg border border-slate-200"
                                                                   >
                                                                      <img 
                                                                         src={task.completionPhotoUrl} 
                                                                         alt="Completion attachment" 
                                                                         className="max-h-36 max-w-full object-cover transition-transform group-hover/img:scale-105" 
                                                                      />
                                                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                         <span className="text-[10px] text-white font-bold uppercase tracking-widest">Click to Zoom</span>
                                                                      </div>
                                                                   </a>
                                                                </div>
                                                             )}

                                                             {task.checklistResponses && Array.isArray(task.checklistResponses) && task.checklistResponses.length > 0 && (
                                                                <div className="mt-2 space-y-2 pt-2 border-t border-slate-100/80">
                                                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Checklist Answers:</p>
                                                                   <div className="grid grid-cols-1 gap-2">
                                                                      {task.checklistResponses.map((res: any, idx: number) => (
                                                                         <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-100/80 flex flex-col gap-1 text-left shadow-sm">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase leading-none">{res.label || `Question ${idx + 1}`}</span>
                                                                            <span className="text-xs font-bold text-slate-700">{res.value || "No response"}</span>
                                                                            {res.photoUrl && (
                                                                               <a href={res.photoUrl} target="_blank" rel="noopener noreferrer" className="mt-1">
                                                                                  <img src={res.photoUrl} alt="Checklist response attachment" className="max-h-20 rounded-lg object-cover border border-slate-100" />
                                                                               </a>
                                                                            )}
                                                                         </div>
                                                                      ))}
                                                                   </div>
                                                                </div>
                                                             )}
                                                          </div>
                                                       )}

                                                       <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                                                          <div className="flex items-center gap-1.5 text-slate-400">
                                                             <Calendar className="h-3.5 w-3.5" />
                                                             <span className="text-[10px] font-bold uppercase tracking-wider">Due: {dayjs(task.dueDate).format("MMM DD, YYYY hh:mm A")}</span>
                                                          </div>
                                                       </div>
                                                    </div>
                                                 ))
                                              )}
                                           </div>
                                        </div>
                                     </Card>
                                  </div>
 
                                 {/* Right: Tabbed Activity Hub */}
                                 <div className="col-span-3">
                                    <Tabs defaultValue="attendance" className="h-full flex flex-col">
                                       <TabsList className="bg-white/50 p-1 rounded-xl h-11 border border-slate-200/60 shadow-sm">
                                          <TabsTrigger value="attendance" className="rounded-lg font-bold text-[10px] uppercase px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">Attendance</TabsTrigger>
                                          <TabsTrigger value="locations" className="rounded-lg font-bold text-[10px] uppercase px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">Attendance Logs</TabsTrigger>
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
                                                           {calculateDurations([session]).breakTimeMs > 0 && (
                                                             <div className="mt-3 text-[11px] font-bold text-slate-500 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50 flex justify-between items-center">
                                                               <span className="uppercase text-[9px] tracking-wider text-slate-400">Session Break Time</span>
                                                               <span className="text-amber-700 font-extrabold">{formatDurationLabel(calculateDurations([session]).breakTimeMs)}</span>
                                                             </div>
                                                           )}
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
                                                <TabsContent value="locations" className="m-0 py-4 space-y-4">
                                                   <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                                                      <span className="text-xs font-black text-slate-700">Tracking Status:</span>
                                                      <Badge className={cn(
                                                        "text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border shadow-sm",
                                                        (locationQuery.data?.length ?? 0) > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
                                                      )}>
                                                        {(locationQuery.data?.length ?? 0) > 0 ? `${locationQuery.data?.length} Pings Tracked` : "Offline / No Pings"}
                                                      </Badge>
                                                   </div>
                                                   <div className="max-h-[350px] overflow-y-auto pr-1 space-y-3">
                                                      {(locationQuery.data?.length ?? 0) === 0 ? (
                                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
                                                           <MapPin className="mx-auto h-8 w-8 text-slate-300" />
                                                           <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-slate-400">No location logs yet</p>
                                                           <p className="mt-2 text-xs font-bold text-slate-500">Pings will appear here as soon as the staff device uploads coordinates.</p>
                                                        </div>
                                                      ) : (
                                                        [...locationQuery.data!].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((log: any, idx: number) => (
                                                          <div key={log.id || idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100/80 shadow-sm hover:shadow-md transition-all">
                                                             <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                                                <div>
                                                                   <p className="text-xs font-black text-slate-800">{log.lat.toFixed(5)}, {log.lng.toFixed(5)}</p>
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
                                                </TabsContent>
                                                <TabsContent value="der" className="m-0 py-4 space-y-4">
                                                   <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                                                      <span className="text-xs font-black text-slate-700">Filter Date:</span>
                                                      <div className="flex items-center gap-2">
                                                         <Input 
                                                            type="date" 
                                                            value={derDateFilter} 
                                                            onChange={(e) => setDerDateFilter(e.target.value)}
                                                            className="h-8 text-[11px] font-bold rounded-lg border-slate-200 bg-white shadow-sm w-36"
                                                         />
                                                         {derDateFilter && (
                                                            <Button 
                                                               variant="ghost" 
                                                               size="sm" 
                                                               className="h-8 px-2 text-slate-400 hover:text-slate-600 rounded-lg"
                                                               onClick={() => setDerDateFilter("")}
                                                            >
                                                               <X className="h-4 w-4" />
                                                            </Button>
                                                         )}
                                                      </div>
                                                   </div>

                                                   {inlineFilteredReports.length === 0 ? (
                                                      <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                                         <MapIcon className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                                                         <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No reports found</p>
                                                         <p className="text-[10px] text-slate-400 mt-1 font-medium">Try clearing the date filter to see all submissions.</p>
                                                      </div>
                                                   ) : (
                                                      <div className="grid grid-cols-1 gap-4 max-h-[500px] overflow-y-auto pr-1">
                                                         {inlineFilteredReports.map((report) => (
                                                           <div key={report.id} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
                                                              <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                                                                 <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                                                       <Calendar className="h-4 w-4 text-blue-600" />
                                                                    </div>
                                                                    <span className="text-xs font-black text-slate-900">
                                                                       {dayjs(report.date).format("DD MMM YYYY")}
                                                                    </span>
                                                                 </div>
                                                                 <div className="flex items-center gap-2">
                                                                    <Badge className="bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full">{report.kmTravelled} KM</Badge>
                                                                    <Button 
                                                                       variant="outline" 
                                                                       size="sm" 
                                                                       className="h-7 w-7 p-0 rounded-lg border-slate-200 hover:bg-slate-50"
                                                                       onClick={() => handleDownloadDER(report, selectedEmployee)}
                                                                       title="Download PDF"
                                                                    >
                                                                       <Download className="h-3.5 w-3.5 text-slate-500" />
                                                                    </Button>
                                                                 </div>
                                                              </div>
                                                              
                                                              <div className="grid grid-cols-2 gap-3">
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

                                                              {(report.startOdometer !== null || report.endOdometer !== null) && (
                                                                 <div className="p-3 rounded-xl bg-slate-50 border border-slate-100/80 space-y-2">
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Odometer Details</p>
                                                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                                                       <div>
                                                                          <span className="text-slate-400 font-bold">Start:</span>{" "}
                                                                          <span className="text-slate-800 font-black">{report.startOdometer !== null ? `${report.startOdometer} km` : "--"}</span>
                                                                          {report.startOdometerPhotoUrl && (
                                                                             <button 
                                                                                className="mt-1 flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:text-blue-700"
                                                                                onClick={() => window.open(report.startOdometerPhotoUrl || undefined, "_blank")}
                                                                             >
                                                                                View Photo
                                                                             </button>
                                                                          )}
                                                                       </div>
                                                                       <div>
                                                                          <span className="text-slate-400 font-bold">End:</span>{" "}
                                                                          <span className="text-slate-800 font-black">{report.endOdometer !== null ? `${report.endOdometer} km` : "--"}</span>
                                                                          {report.kmPhotoUrl && (
                                                                             <button 
                                                                                className="mt-1 flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:text-blue-700"
                                                                                onClick={() => window.open(report.kmPhotoUrl || undefined, "_blank")}
                                                                             >
                                                                                View Photo
                                                                             </button>
                                                                          )}
                                                                       </div>
                                                                    </div>
                                                                 </div>
                                                              )}

                                                              <div className="space-y-3">
                                                                 <div>
                                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Work Summary</p>
                                                                    <p className="text-xs font-medium text-slate-700 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">{report.visitsSummary}</p>
                                                                 </div>
                                                                 {report.remarks && (
                                                                   <div>
                                                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Additional Remarks</p>
                                                                      <p className="text-xs font-medium text-slate-500 italic leading-relaxed bg-slate-50/20 p-2.5 rounded-xl border border-slate-100/50">{report.remarks}</p>
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
              Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * 25 + 1} to {Math.min(filteredUsers.length, currentPage * 25)} of {filteredUsers.length} entries
           </div>
           <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="h-8 text-xs font-bold text-slate-600 border border-slate-150 px-3 rounded-lg hover:bg-slate-50/80"
              >
                Previous
              </Button>
              {Array.from({ length: Math.ceil(filteredUsers.length / 25) }).map((_, i) => {
                const pageNum = i + 1;
                const isCurrent = pageNum === currentPage;
                return (
                  <Button
                    key={pageNum}
                    variant={isCurrent ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "h-8 w-8 text-xs font-bold rounded-lg border",
                      isCurrent 
                        ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700" 
                        : "text-slate-600 border-slate-150 hover:bg-slate-50/80"
                    )}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={currentPage >= Math.ceil(filteredUsers.length / 25)}
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredUsers.length / 25), prev + 1))}
                className="h-8 text-xs font-bold text-slate-600 border border-slate-150 px-3 rounded-lg hover:bg-slate-50/80"
              >
                Next
              </Button>
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
      <EmployeeDetailDrawer
        employeeId={drawerEmployeeId}
        employee={selectedDrawerEmployee}
        isOpen={!!drawerEmployeeId}
        onClose={() => setDrawerEmployeeId(null)}
      />
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
