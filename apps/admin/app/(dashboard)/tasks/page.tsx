"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  List, 
  Layout, 
  Filter, 
  Eye, 
  MoreHorizontal, 
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Hash,
  RefreshCw,
  X,
  Pencil,
  Trash2,
  Check,
  Flag,
  Folder,
  MessageSquare,
  Star,
  MapPin,
  Save,
  Bell,
  Video,
  Mic,
  Image,
  FileText,
  ListTodo,
  Paperclip,
  Download,
  Loader2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { fetchTasks, deleteTask, updateTask, createTask as apiCreateTask, fetchUsers, createTemplate, fetchProjects, createProject as apiCreateProject } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { GeoFenceMapPicker } from "@/components/admin/geofence-map-picker";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { 
  format, 
  addDays, 
  isSameDay, 
  isBefore, 
  isAfter, 
  startOfDay, 
  parseISO 
} from "date-fns";

type ViewMode = "LIST" | "BOARD" | "CALENDAR";
type FilterType = "ALL" | "ACTIVE" | "INACTIVE" | "TODAYS" | "ONGOING" | "OVERDUE" | "MISSED" | "SCHEDULED" | "COMPLETE" | "GROUP" | "REPEAT" | "REVIEW" | "ISSUE" | "TRASHED";

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("LIST");
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [centerDate, setCenterDate] = useState<Date>(new Date());
  
  const sliderDates = useMemo(() => {
    const datesList = [];
    for (let i = -4; i <= 4; i++) {
      datesList.push(addDays(centerDate, i));
    }
    return datesList;
  }, [centerDate]);

  const [page, setPage] = useState(1);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<any>(null);
  
  // Custom Filter & View Options
  const [selectedAssignee, setSelectedAssignee] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("DUE_DATE_ASC"); 
  const [viewDensity, setViewDensity] = useState<"COMPACT" | "COZY">("COZY");

  // Edit Task States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  // Calendar States
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

  // Task Creation default date
  const [initialCreateDate, setInitialCreateDate] = useState<string>("");

  const pageSize = 10;

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: users = { items: [], total: 0 } as any } = useQuery({
    queryKey: ["users-for-tasks"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 100 })
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      return apiCreateTask({
        ...data,
        dueDate: new Date(data.dueDate).toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setIsCreateOpen(false);
      setInitialCreateDate("");
      setActiveFilter("ALL");
    }
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => {
      const { id, ...payload } = data;
      return updateTask(id, {
        ...payload,
        dueDate: new Date(payload.dueDate).toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setIsEditOpen(false);
      setEditingTask(null);
    }
  });

  // Apply inline status transitions
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await updateTask(taskId, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch {
      alert("Failed to update status");
    }
  };

  // Generate Daily PDF for a specific user or grouped by user
  const generateDailyPDF = (employeeName: string, employeeTasks: any[], date: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const statusColor: Record<string, string> = {
      COMPLETED: "#10b981",
      PENDING: "#f59e0b",
      IN_PROGRESS: "#3b82f6",
      MISSED: "#ef4444",
      REVIEW: "#8b5cf6",
      CANCELLED: "#94a3b8"
    };

    const isGrouped = employeeName === "All Staff";
    let bodyContent = "";

    if (isGrouped) {
      // Group tasks by assignee name
      const tasksByUser: Record<string, { name: string; tasks: any[] }> = {};
      employeeTasks.forEach(task => {
        const userId = task.assignedTo?.id || "unassigned";
        const userName = task.assignedTo?.name || "Unassigned / Group Tasks";
        if (!tasksByUser[userId]) {
          tasksByUser[userId] = { name: userName, tasks: [] };
        }
        tasksByUser[userId].tasks.push(task);
      });

      bodyContent = Object.values(tasksByUser).map(({ name, tasks }) => {
        const completed = tasks.filter(t => t.status === "COMPLETED").length;
        const pending = tasks.filter(t => t.status === "PENDING").length;
        const inProgress = tasks.filter(t => t.status === "IN_PROGRESS").length;
        const userRows = tasks.map((task, i) => `
          <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}; page-break-inside: avoid;">
            <td style="padding: 10px 14px; font-weight: 700; color: #1e293b; font-size: 12px;">${i + 1}. ${task.title}</td>
            <td style="padding: 10px 14px; text-align:center;">
              <span style="background:${statusColor[task.status] || '#94a3b8'}20; color:${statusColor[task.status] || '#94a3b8'}; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase;">${task.status}</span>
            </td>
            <td style="padding: 10px 14px; color: #64748b; font-size: 11px; font-weight: 600; text-align:center;">${task.priority || "Medium"}</td>
            <td style="padding: 10px 14px; color: #64748b; font-size: 11px;">${task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</td>
            <td style="padding: 10px 14px; color: #64748b; font-size: 11px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${task.description || "—"}</td>
            ${task.attachmentName ? `<td style="padding:10px 14px;"><a href="${task.attachmentUrl}" style="color:#3b82f6; font-size:10px; font-weight:700; text-decoration:none;">📎 ${task.attachmentName.slice(0, 15)}</a></td>` : '<td style="padding:10px 14px; color:#94a3b8; font-size:10px;">—</td>'}
          </tr>
        `).join("");

        return `
          <div style="margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; page-break-inside: avoid; background: white;">
            <div style="background: #f8fafc; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
              <h2 style="font-size: 15px; font-weight: 800; color: #0f172a;">👤 ${name}</h2>
              <div style="display: flex; gap: 8px;">
                <span style="background: #ef8f0b15; color: #d97706; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700;">Total: ${tasks.length}</span>
                <span style="background: #10b98115; color: #059669; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700;">Done: ${completed}</span>
                <span style="background: #3b82f615; color: #2563eb; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700;">In Progress: ${inProgress}</span>
                <span style="background: #ef444415; color: #dc2626; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700;">Pending: ${pending}</span>
              </div>
            </div>
            <div style="padding: 12px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="text-align: left; background: #1e293b; color: white;">
                    <th style="padding: 8px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase;">Task</th>
                    <th style="padding: 8px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; text-align: center;">Status</th>
                    <th style="padding: 8px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; text-align: center;">Priority</th>
                    <th style="padding: 8px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase;">Due</th>
                    <th style="padding: 8px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase;">Description</th>
                    <th style="padding: 8px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase;">Attachment</th>
                  </tr>
                </thead>
                <tbody>
                  ${userRows}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }).join("");
    } else {
      const completed = employeeTasks.filter(t => t.status === "COMPLETED").length;
      const pending = employeeTasks.filter(t => t.status === "PENDING").length;
      const inProgress = employeeTasks.filter(t => t.status === "IN_PROGRESS").length;
      const taskRows = employeeTasks.map((task, i) => `
        <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}; page-break-inside: avoid;">
          <td style="padding: 12px 16px; font-weight: 700; color: #1e293b; font-size: 13px;">${i + 1}. ${task.title}</td>
          <td style="padding: 12px 16px; text-align:center;">
            <span style="background:${statusColor[task.status] || '#94a3b8'}20; color:${statusColor[task.status] || '#94a3b8'}; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">${task.status}</span>
          </td>
          <td style="padding: 12px 16px; color: #64748b; font-size: 12px; font-weight: 600; text-align:center;">${task.priority || "Medium"}</td>
          <td style="padding: 12px 16px; color: #64748b; font-size: 12px;">${task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</td>
          <td style="padding: 12px 16px; color: #64748b; font-size: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${task.description || "—"}</td>
          ${task.attachmentName ? `<td style="padding:12px 16px;"><a href="${task.attachmentUrl}" style="color:#3b82f6; font-size:11px; font-weight:700; text-decoration:none;">📎 ${task.attachmentName.slice(0, 20)}</a></td>` : '<td style="padding:12px 16px; color:#94a3b8; font-size:11px;">—</td>'}
        </tr>
      `).join("");

      bodyContent = `
        <div class="stats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 24px 48px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; margin-bottom: 30px;">
          <div class="stat-card" style="background: white; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;"><div class="stat-num" style="font-size: 26px; font-weight: 900; color: #1e293b;">${employeeTasks.length}</div><div class="stat-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-top: 2px;">Total Tasks</div></div>
          <div class="stat-card" style="background: white; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;"><div class="stat-num" style="font-size: 26px; font-weight: 900; color: #10b981;">${completed}</div><div class="stat-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-top: 2px;">Completed</div></div>
          <div class="stat-card" style="background: white; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;"><div class="stat-num" style="font-size: 26px; font-weight: 900; color: #3b82f6;">${inProgress}</div><div class="stat-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-top: 2px;">In Progress</div></div>
          <div class="stat-card" style="background: white; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;"><div class="stat-num" style="font-size: 26px; font-weight: 900; color: #f59e0b;">${pending}</div><div class="stat-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-top: 2px;">Pending</div></div>
        </div>
        <div class="content" style="padding: 0 48px 48px;">
          <p class="section-title" style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 16px;">Task Breakdown</p>
          <table style="width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
            <thead><tr style="background: #1e293b; color: white;"><th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Task</th><th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Status</th><th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Priority</th><th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Due</th><th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Description</th><th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Attachment</th></tr></thead>
            <tbody>${taskRows}</tbody>
          </table>
        </div>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Daily Task Schedule – ${employeeName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; color: #0f172a; }
    @media print {
      body { background: white; }
      .no-print { display: none; }
    }
    .page { max-width: 900px; margin: 0 auto; background: white; box-shadow: 0 4px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 40px 48px 32px; }
    .company-badge { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 6px 14px; display:inline-block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom: 24px; }
    .header h1 { font-size: 28px; font-weight: 900; margin-bottom: 6px; }
    .header p { color: rgba(255,255,255,0.65); font-size: 13px; font-weight: 600; }
    .footer { padding: 20px 48px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
    .footer p { color: #94a3b8; font-size: 11px; font-weight: 700; }
    .print-btn { no-print: block; background: #3b82f6; color: white; border: none; padding: 12px 28px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; margin: 24px auto; display: block; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company-badge">StaffTrack</div>
      <h1>Daily Task Schedule</h1>
      <p>${employeeName} &nbsp;•&nbsp; ${new Date(date || Date.now()).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
    </div>
    ${bodyContent}
    <div class="footer">
      <p>Generated by StaffTrack &nbsp;|&nbsp; ${new Date().toLocaleString("en-IN")}</p>
      <p>Confidential</p>
    </div>
  </div>
  <button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>
  <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(t => !t.isSubtask); // Exclude subtasks from main list

    // Search
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assignedTo?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Date Filter
    if (filterDate) {
      const selectedDate = parseISO(filterDate);
      filtered = filtered.filter(t => isSameDay(new Date(t.dueDate), selectedDate));
    }

    // Sub Navigation Filters
    const now = startOfDay(new Date());
    switch (activeFilter) {
      case "ALL":
        break;
      case "ACTIVE":
        filtered = filtered.filter(t => t.status === "PENDING" || t.status === "IN_PROGRESS");
        break;
      case "INACTIVE":
        filtered = filtered.filter(t => t.status === "COMPLETED" || t.status === "CANCELLED");
        break;
      case "TODAYS":
        filtered = filtered.filter(t => 
          (isSameDay(new Date(t.dueDate), now) || (isBefore(new Date(t.dueDate), now) && t.status !== "COMPLETED"))
        );
        break;
      case "ONGOING":
        filtered = filtered.filter(t => t.status === "IN_PROGRESS");
        break;
      case "OVERDUE":
      case "MISSED":
        filtered = filtered.filter(t => isBefore(new Date(t.dueDate), now) && t.status !== "COMPLETED");
        break;
      case "SCHEDULED":
        filtered = filtered.filter(t => isAfter(new Date(t.dueDate), now) && t.status !== "COMPLETED");
        break;
      case "REPEAT":
        filtered = filtered.filter(t => t.isRepeating);
        break;
      case "COMPLETE":
        filtered = filtered.filter(t => t.status === "COMPLETED");
        break;
      case "TRASHED":
        filtered = filtered.filter(t => t.status === "CANCELLED");
        break;
      default:
        break;
    }

    // Custom Dropdown Filters
    if (selectedAssignee !== "ALL") {
      filtered = filtered.filter(t => t.assignedToId === selectedAssignee);
    }
    if (selectedPriority !== "ALL") {
      filtered = filtered.filter(t => t.priority === selectedPriority);
    }
    if (selectedFrequency !== "ALL") {
      if (selectedFrequency === "ONCE") {
        filtered = filtered.filter(t => !t.isRepeating);
      } else {
        filtered = filtered.filter(t => t.isRepeating && t.repeatFrequency === selectedFrequency);
      }
    }

    // Sorting
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "DUE_DATE_ASC") {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "DUE_DATE_DESC") {
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      }
      if (sortBy === "POINTS_ASC") {
        return (a.points || 0) - (b.points || 0);
      }
      if (sortBy === "POINTS_DESC") {
        return (b.points || 0) - (a.points || 0);
      }
      return 0;
    });

    return filtered;
  }, [tasks, searchQuery, activeFilter, filterDate, selectedAssignee, selectedPriority, selectedFrequency, sortBy]);

  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page]);

  // Calendar cells calculation helper
  const calendarDays = useMemo(() => {
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
    const firstDayIndex = getFirstDayOfMonth(calendarYear, calendarMonth);
    
    const days = [];
    
    // Previous month padding days
    const prevMonthMonth = calendarMonth === 0 ? 11 : calendarMonth - 1;
    const prevMonthYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
    const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonthMonth);
    
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const date = new Date(prevMonthYear, prevMonthMonth, daysInPrevMonth - i);
      days.push({
        date,
        isCurrentMonth: false,
        dayNum: daysInPrevMonth - i
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(calendarYear, calendarMonth, i);
      days.push({
        date,
        isCurrentMonth: true,
        dayNum: i
      });
    }
    
    // Next month padding days to fill 42 cells (6 rows * 7 days)
    const nextMonthMonth = calendarMonth === 11 ? 0 : calendarMonth + 1;
    const nextMonthYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
    const totalCells = 42;
    const nextPaddingCount = totalCells - days.length;
    
    for (let i = 1; i <= nextPaddingCount; i++) {
      const date = new Date(nextMonthYear, nextMonthMonth, i);
      days.push({
        date,
        isCurrentMonth: false,
        dayNum: i
      });
    }
    
    return days;
  }, [calendarYear, calendarMonth]);

  const monthName = useMemo(() => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${months[calendarMonth]} ${calendarYear}`;
  }, [calendarMonth, calendarYear]);

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(y => y - 1);
    } else {
      setCalendarMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(y => y + 1);
    } else {
      setCalendarMonth(m => m + 1);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#fcfdfe] min-h-screen animate-in fade-in duration-500">
      {/* Breadcrumb & Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="hover:text-blue-600 cursor-pointer">Home</span>
          <span>/</span>
          <span className="text-slate-600 font-bold">Task</span>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-full border border-slate-100 shadow-sm">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">StaffTrack Workspace</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
           </div>
           <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-50"><Lightbulb className="h-5 w-5 text-slate-400" /></Button>
              <Button
                 variant="outline"
                 className="h-10 rounded-lg px-4 font-bold text-xs gap-2 border-slate-200 hover:bg-slate-50"
                 onClick={() => {
                   const date = filterDate || new Date().toISOString().split('T')[0];
                   const tasksForPDF = filteredTasks;
                   const name = selectedAssignee !== "ALL"
                     ? (users.items?.find((u: any) => u.id === selectedAssignee)?.name || "All Staff")
                     : "All Staff";
                   generateDailyPDF(name, tasksForPDF, date);
                 }}
               >
                 <FileText className="h-4 w-4 text-emerald-600" /> Daily PDF
               </Button>
               <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                     <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 h-10 font-bold flex items-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
                        <Plus className="h-4 w-4" /> Create
                     </Button>
                  </DialogTrigger>
                  <CreateTaskDialog 
                    users={(users as any).items ?? []}
                    onSubmit={(data: any) => createMutation.mutate(data)}
                    isSubmitting={createMutation.isPending}
                    initialDate={initialCreateDate}
                  />
               </Dialog>
           </div>
        </div>
      </div>

      {/* Date Slider Strip */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl hover:bg-slate-50 border border-slate-100"
            onClick={() => setCenterDate(prev => addDays(prev, -7))}
          >
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-xl font-extrabold text-[10px] uppercase tracking-wider hover:bg-slate-50 border border-slate-100 text-blue-600"
            onClick={() => {
              const today = new Date();
              setCenterDate(today);
              setFilterDate(format(today, "yyyy-MM-dd"));
            }}
          >
            Today
          </Button>
        </div>

        <div className="flex-1 overflow-x-auto scrollbar-hide py-1">
          <div className="flex items-center justify-center gap-3 min-w-max">
            <Button
              variant="ghost"
              className={cn(
                "h-12 px-6 rounded-2xl flex flex-col items-center justify-center border transition-all text-xs font-bold",
                !filterDate ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-slate-50/50 border-slate-100 text-slate-500 hover:bg-slate-50"
              )}
              onClick={() => setFilterDate("")}
            >
              <span className="text-[9px] uppercase tracking-widest font-black opacity-80">All</span>
              <span className="text-sm font-black mt-0.5">Tasks</span>
            </Button>

            {sliderDates.map((dateObj, idx) => {
              const dateStr = format(dateObj, "yyyy-MM-dd");
              const isSelected = filterDate === dateStr;
              const isTodayDate = isSameDay(dateObj, new Date());
              
              return (
                <button
                  key={idx}
                  onClick={() => setFilterDate(dateStr)}
                  className={cn(
                    "h-14 w-16 rounded-2xl flex flex-col items-center justify-center border transition-all hover:scale-[1.02] active:scale-[0.98]",
                    isSelected 
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100" 
                      : "bg-slate-50/50 border-slate-150 text-slate-600 hover:bg-slate-55/80 hover:border-slate-200",
                    isTodayDate && !isSelected && "border-blue-300 ring-1 ring-blue-100"
                  )}
                >
                  <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-75">
                    {format(dateObj, "EEE")}
                  </span>
                  <span className="text-sm font-black leading-none mt-0.5">
                    {format(dateObj, "d")}
                  </span>
                  <span className="text-[8px] font-bold opacity-60">
                    {format(dateObj, "MMM")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-xl border border-slate-100">
             <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
             <input 
               type="date" 
               className="bg-transparent border-none text-[10px] font-bold text-slate-600 focus:outline-none"
               value={filterDate}
               onChange={e => {
                 const newD = e.target.value;
                 setFilterDate(newD);
                 if (newD) {
                   setCenterDate(new Date(newD));
                 }
               }}
             />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl hover:bg-slate-50 border border-slate-100"
            onClick={() => setCenterDate(prev => addDays(prev, 7))}
          >
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-180px)]">
        
        {/* Header Actions */}
        <div className="p-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div className="flex items-center gap-1 bg-[#f1f3f5] p-1 rounded-xl w-fit">
              <ViewTab active={viewMode === "LIST"} onClick={() => setViewMode("LIST")} icon={<List className="h-4 w-4" />} label="List" />
              <ViewTab active={viewMode === "BOARD"} onClick={() => setViewMode("BOARD")} icon={<Layout className="h-4 w-4" />} label="Board" />
              <ViewTab active={viewMode === "CALENDAR"} onClick={() => setViewMode("CALENDAR")} icon={<CalendarIcon className="h-4 w-4" />} label="Calendar" />
           </div>

           <div className="flex-1 max-w-md relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search Board" 
                className="h-11 pl-12 rounded-xl bg-slate-50 border-none focus:bg-white transition-all text-sm font-medium" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="px-6 border-b border-slate-50 overflow-x-auto">
           <div className="flex items-center gap-8 min-w-max">
              <FilterTab active={activeFilter === "ALL"} onClick={() => setActiveFilter("ALL")} label="All Tasks" />
              <FilterTab active={activeFilter === "ACTIVE"} onClick={() => setActiveFilter("ACTIVE")} label="Active Tasks" />
              <FilterTab active={activeFilter === "INACTIVE"} onClick={() => setActiveFilter("INACTIVE")} label="Inactive Tasks" />
              <FilterTab active={activeFilter === "TODAYS"} onClick={() => setActiveFilter("TODAYS")} label="Todays Tasks" />
              <FilterTab active={activeFilter === "ONGOING"} onClick={() => setActiveFilter("ONGOING")} label="Ongoing" />
              <FilterTab active={activeFilter === "OVERDUE"} onClick={() => setActiveFilter("OVERDUE")} label="Overdue" />
              <FilterTab active={activeFilter === "MISSED"} onClick={() => setActiveFilter("MISSED")} label="Missed" />
              <FilterTab active={activeFilter === "SCHEDULED"} onClick={() => setActiveFilter("SCHEDULED")} label="Scheduled" />
              <FilterTab active={activeFilter === "COMPLETE"} onClick={() => setActiveFilter("COMPLETE")} label="Complete" />
              <FilterTab active={activeFilter === "GROUP"} onClick={() => setActiveFilter("GROUP")} label="Group Task" />
              <FilterTab active={activeFilter === "REPEAT"} onClick={() => setActiveFilter("REPEAT")} label="Repeat task" />
              <FilterTab active={activeFilter === "REVIEW"} onClick={() => setActiveFilter("REVIEW")} label="Review" />
              <FilterTab active={activeFilter === "ISSUE"} onClick={() => setActiveFilter("ISSUE")} label="Ongoing With Issue" />
              <FilterTab active={activeFilter === "TRASHED"} onClick={() => setActiveFilter("TRASHED")} label="Trashed" />
           </div>
        </div>

        {/* Table Toolbar */}
         <div className="p-4 flex items-center justify-end gap-3 bg-white border-b border-slate-50">
            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 rounded-lg text-slate-500 font-bold gap-2 hover:bg-slate-50 border border-slate-100">
                  <Filter className="h-4 w-4" /> Filter
                  {(selectedAssignee !== "ALL" || selectedPriority !== "ALL" || selectedFrequency !== "ALL") && (
                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 p-2.5 rounded-2xl space-y-3 bg-white z-50 shadow-xl">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Assigned To</label>
                  <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                    <SelectTrigger className="h-9 rounded-xl text-xs font-bold bg-slate-50">
                      <SelectValue placeholder="All Members" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL">All Members</SelectItem>
                      {users.items?.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Priority</label>
                  <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                    <SelectTrigger className="h-9 rounded-xl text-xs font-bold bg-slate-50">
                      <SelectValue placeholder="All Priorities" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL">All Priorities</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Task Type</label>
                  <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
                    <SelectTrigger className="h-9 rounded-xl text-xs font-bold bg-slate-50">
                      <SelectValue placeholder="All Frequencies" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL">All Tasks</SelectItem>
                      <SelectItem value="ONCE">Once (No Repeat)</SelectItem>
                      <SelectItem value="DAILY">Daily Repeat</SelectItem>
                      <SelectItem value="WEEKLY">Weekly Repeat</SelectItem>
                      <SelectItem value="MONTHLY">Monthly Repeat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(selectedAssignee !== "ALL" || selectedPriority !== "ALL" || selectedFrequency !== "ALL") && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-[10px] font-black uppercase tracking-wider"
                    onClick={() => {
                      setSelectedAssignee("ALL");
                      setSelectedPriority("ALL");
                      setSelectedFrequency("ALL");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 rounded-lg text-slate-500 font-bold gap-2 hover:bg-slate-50 border border-slate-100">
                  <Hash className="h-4 w-4" /> View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 p-2.5 rounded-2xl space-y-3 bg-white z-50 shadow-xl">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-9 rounded-xl text-xs font-bold bg-slate-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="DUE_DATE_ASC">Due Date: Ascending</SelectItem>
                      <SelectItem value="DUE_DATE_DESC">Due Date: Descending</SelectItem>
                      <SelectItem value="POINTS_ASC">Points: Low to High</SelectItem>
                      <SelectItem value="POINTS_DESC">Points: High to Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Density</label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-50 p-0.5 rounded-xl">
                    <button 
                      className={cn("py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all", viewDensity === "COZY" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
                      onClick={() => setViewDensity("COZY")}
                    >
                      Cozy
                    </button>
                    <button 
                      className={cn("py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all", viewDensity === "COMPACT" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
                      onClick={() => setViewDensity("COMPACT")}
                    >
                      Compact
                    </button>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
         </div>

        {/* ── View Rendering Options ────────────────────────────────────────── */}
        
        {/* 1. LIST VIEW */}
        {viewMode === "LIST" && (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f8f9fa] border-y border-slate-50">
                <tr className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6 w-12"><input type="checkbox" className="rounded border-slate-300" /></th>
                  <th className="py-4 px-4 min-w-[250px]">Task Name</th>
                  <th className="py-4 px-4 min-w-[150px]">Assigned to</th>
                  <th className="py-4 px-4 min-w-[150px]">Team</th>
                  <th className="py-4 px-4 text-center">Status</th>
                  <th className="py-4 px-4 text-center">Points</th>
                  <th className="py-4 px-4 text-center">Priority</th>
                  <th className="py-4 px-4">Created on</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="p-8"><div className="h-10 bg-slate-100 rounded-xl" /></td>
                    </tr>
                  ))
                                ) : (() => {
                  if (selectedAssignee === "ALL") {
                    const tasksByUser: Record<string, { user: any; tasks: any[] }> = {};
                    paginatedTasks.forEach(task => {
                      const userId = task.assignedTo?.id || "unassigned";
                      if (!tasksByUser[userId]) {
                        tasksByUser[userId] = {
                          user: task.assignedTo || { name: "Unassigned / Group Tasks" },
                          tasks: []
                        };
                      }
                      tasksByUser[userId].tasks.push(task);
                    });

                    return Object.entries(tasksByUser).map(([userId, group]) => {
                      const completed = group.tasks.filter(t => t.status === "COMPLETED").length;
                      const pending = group.tasks.filter(t => t.status === "PENDING" || t.status === "IN_PROGRESS" || t.status === "MISSED").length;
                      return (
                        <React.Fragment key={userId}>
                          <tr className="bg-slate-50/70 hover:bg-slate-100/50 transition-colors">
                            <td colSpan={9} className="py-2.5 px-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-slate-800">👤 {group.user.name}</span>
                                  <span className="text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-full font-bold">Total: {group.tasks.length}</span>
                                </div>
                                <div className="flex gap-2">
                                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-black uppercase">Done: {completed}</span>
                                  <span className="text-[9px] bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-black uppercase">Pending: {pending}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {group.tasks.map((task) => (
                            <tr 
                              key={task.id} 
                              className={cn(
                                "group hover:bg-[#f1f3f5]/30 transition-colors",
                                viewDensity === "COMPACT" ? "h-11" : "h-16"
                              )}
                            >
                              <td className="py-2 px-6"><input type="checkbox" className="rounded border-slate-300" /></td>
                              <td className="py-2 px-4">
                                <div className="flex items-center gap-3">
                                   <div className={cn(
                                      "flex items-center gap-1.5 px-2 py-0.5 rounded-md border transition-colors",
                                      task.isRepeating ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-slate-100 border-slate-200 text-slate-400"
                                   )}>
                                      {task.isRepeating ? <RefreshCw className="h-3 w-3" /> : <CalendarIcon className="h-3 w-3" />}
                                      <span className="text-[9px] font-black uppercase tracking-tighter">
                                           {task.isRepeating 
                                             ? (task.repeatFrequency === 'DAILY' ? 'Every Day' : 
                                                task.repeatFrequency === 'WEEKLY' ? 'Every Week' : 
                                                task.repeatFrequency === 'MONTHLY' ? 'Every Month' : 
                                                task.repeatFrequency)
                                             : format(new Date(task.createdAt), "dd MMM, yyyy")}
                                           </span>
                                   </div>
                                   <div>
                                      <p className="text-sm font-bold text-slate-700 leading-tight flex items-center gap-2">
                                         {task.title}
                                         {task.subtasks && task.subtasks.length > 0 && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200/50 uppercase tracking-tighter">
                                               📋 {task.subtasks.filter((s: any) => s.status === 'COMPLETED').length}/{task.subtasks.length} Subtasks
                                            </span>
                                         )}
                                      </p>
                                   </div>
                                </div>
                              </td>
                              <td className="py-2 px-4">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7 rounded-full border border-slate-100">
                                    <AvatarImage src={task.assignedTo?.avatarUrl} />
                                    <AvatarFallback className="bg-blue-600 text-white text-[9px] font-black">
                                      {task.assignedTo?.name?.slice(0, 1).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-bold text-slate-600">{task.assignedTo?.name}</span>
                                </div>
                              </td>
                              <td className="py-2 px-4">
                                <span className="text-xs font-bold text-slate-500">{task.assignedTo?.workMode || "Unassigned"}</span>
                              </td>
                              <td className="py-2 px-4">
                                <div className="flex justify-center">
                                   <StatusBadge status={task.status} dueDate={task.dueDate} />
                                </div>
                              </td>
                              <td className="py-2 px-4 text-center">
                                <div className="inline-flex items-center justify-center h-7 w-12 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black">
                                   {task.points || 0}
                                </div>
                              </td>
                              <td className="py-2 px-4 text-center">
                                <Badge variant="outline" className={cn(
                                   "text-[10px] font-black uppercase tracking-widest px-2 py-0.5",
                                   task.priority === "High" ? "border-rose-200 text-rose-600 bg-rose-50" :
                                   task.priority === "Medium" ? "border-amber-200 text-amber-600 bg-amber-50" :
                                   "border-emerald-200 text-emerald-600 bg-emerald-50"
                                )}>
                                   {task.priority || "Medium"}
                                </Badge>
                              </td>
                              <td className="py-2 px-4">
                                <span className="text-[10px] font-bold text-slate-400">{format(new Date(task.createdAt), 'dd-MM-yyyy')}</span>
                              </td>
                              <td className="py-2 px-6 text-right">
                                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <Button 
                                     variant="ghost" 
                                     size="icon" 
                                     className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                     onClick={() => {
                                       setViewingTask(task);
                                       setIsDetailsOpen(true);
                                     }}
                                   >
                                      <Eye className="h-4 w-4" />
                                   </Button>
                                   <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400">
                                            <MoreHorizontal className="h-4 w-4" />
                                         </Button>
                                      </DropdownMenuTrigger>
                                       <DropdownMenuContent align="end" className="w-40 rounded-xl bg-white z-50 border shadow-md">
                                          <DropdownMenuItem 
                                            className="text-xs font-bold gap-2 cursor-pointer"
                                            onClick={() => {
                                              setEditingTask(task);
                                              setIsEditOpen(true);
                                            }}
                                          >
                                            Edit Task
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            className="text-xs font-bold gap-2 text-rose-500 cursor-pointer"
                                            onClick={() => {
                                              if (confirm("Are you sure you want to cancel this task?")) {
                                                updateTask(task.id, { status: "CANCELLED" }).then(() => {
                                                  queryClient.invalidateQueries({ queryKey: ["tasks"] });
                                                });
                                              }
                                            }}
                                          >
                                            Cancel Task
                                          </DropdownMenuItem>
                                       </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    });
                  }

                  return paginatedTasks.map((task) => (
                    <tr 
                      key={task.id} 
                      className={cn(
                        "group hover:bg-[#f1f3f5]/30 transition-colors",
                        viewDensity === "COMPACT" ? "h-11" : "h-16"
                      )}
                    >
                      <td className="py-2 px-6"><input type="checkbox" className="rounded border-slate-300" /></td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                              "flex items-center gap-1.5 px-2 py-0.5 rounded-md border transition-colors",
                              task.isRepeating ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-slate-100 border-slate-200 text-slate-400"
                           )}>
                              {task.isRepeating ? <RefreshCw className="h-3 w-3" /> : <CalendarIcon className="h-3 w-3" />}
                              <span className="text-[9px] font-black uppercase tracking-tighter">
                                   {task.isRepeating 
                                     ? (task.repeatFrequency === 'DAILY' ? 'Every Day' : 
                                        task.repeatFrequency === 'WEEKLY' ? 'Every Week' : 
                                        task.repeatFrequency === 'MONTHLY' ? 'Every Month' : 
                                        task.repeatFrequency)
                                     : format(new Date(task.createdAt), "dd MMM, yyyy")}
                                   </span>
                           </div>
                           <div>
                              <p className="text-sm font-bold text-slate-700 leading-tight flex items-center gap-2">
                                 {task.title}
                                 {task.subtasks && task.subtasks.length > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200/50 uppercase tracking-tighter">
                                       📋 {task.subtasks.filter((s: any) => s.status === 'COMPLETED').length}/{task.subtasks.length} Subtasks
                                    </span>
                                 )}
                              </p>
                           </div>
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 rounded-full border border-slate-100">
                            <AvatarImage src={task.assignedTo?.avatarUrl} />
                            <AvatarFallback className="bg-blue-600 text-white text-[9px] font-black">
                              {task.assignedTo?.name?.slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-bold text-slate-600">{task.assignedTo?.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <span className="text-xs font-bold text-slate-500">{task.assignedTo?.workMode || "Unassigned"}</span>
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex justify-center">
                           <StatusBadge status={task.status} dueDate={task.dueDate} />
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <div className="inline-flex items-center justify-center h-7 w-12 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black">
                           {task.points || 0}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <Badge variant="outline" className={cn(
                           "text-[10px] font-black uppercase tracking-widest px-2 py-0.5",
                           task.priority === "High" ? "border-rose-200 text-rose-600 bg-rose-50" :
                           task.priority === "Medium" ? "border-amber-200 text-amber-600 bg-amber-50" :
                           "border-emerald-200 text-emerald-600 bg-emerald-50"
                        )}>
                           {task.priority || "Medium"}
                        </Badge>
                      </td>
                      <td className="py-2 px-4">
                        <span className="text-[10px] font-bold text-slate-400">{format(new Date(task.createdAt), 'dd-MM-yyyy')}</span>
                      </td>
                      <td className="py-2 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                             onClick={() => {
                               setViewingTask(task);
                               setIsDetailsOpen(true);
                             }}
                           >
                              <Eye className="h-4 w-4" />
                           </Button>
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400">
                                    <MoreHorizontal className="h-4 w-4" />
                                 </Button>
                              </DropdownMenuTrigger>
                               <DropdownMenuContent align="end" className="w-40 rounded-xl bg-white z-50 border shadow-md">
                                  <DropdownMenuItem 
                                    className="text-xs font-bold gap-2 cursor-pointer"
                                    onClick={() => {
                                      setEditingTask(task);
                                      setIsEditOpen(true);
                                    }}
                                  >
                                    Edit Task
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-xs font-bold gap-2 text-rose-500 cursor-pointer"
                                    onClick={() => {
                                      if (confirm("Are you sure you want to cancel this task?")) {
                                        updateTask(task.id, { status: "CANCELLED" }).then(() => {
                                          queryClient.invalidateQueries({ queryKey: ["tasks"] });
                                        });
                                      }
                                    }}
                                  >
                                    Cancel Task
                                  </DropdownMenuItem>
                               </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. BOARD VIEW */}
        {viewMode === "BOARD" && (
          <div className="flex-1 p-6 bg-[#f8f9fa] overflow-x-auto flex gap-6 min-h-[500px]">
            {[
              { id: "PENDING", title: "Pending", border: "border-t-slate-400", countColor: "bg-slate-100 text-slate-600" },
              { id: "IN_PROGRESS", title: "Ongoing", border: "border-t-blue-500", countColor: "bg-blue-50 text-blue-600" },
              { id: "COMPLETED", title: "Completed", border: "border-t-emerald-500", countColor: "bg-emerald-50 text-emerald-600" },
              { id: "CANCELLED", title: "Cancelled", border: "border-t-rose-400", countColor: "bg-rose-50 text-rose-600" }
            ].map(col => {
              const colTasks = filteredTasks.filter(t => t.status === col.id || (col.id === "PENDING" && !t.status));
              return (
                <div key={col.id} className="flex-1 min-w-[280px] max-w-[320px] bg-slate-50/50 rounded-2xl border border-slate-200/50 p-4 flex flex-col gap-4">
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-black text-xs text-slate-700 uppercase tracking-widest">{col.title}</h4>
                      <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", col.countColor)}>
                        {colTasks.length}
                      </span>
                    </div>
                  </div>

                  {/* Tasks List */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[500px]">
                    {colTasks.map(task => (
                      <div 
                        key={task.id} 
                        className={cn(
                          "bg-white rounded-xl p-4 border border-slate-200/60 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col gap-3 group border-t-4",
                          col.border
                        )}
                      >
                        {/* Task Card Header */}
                        <div className="flex items-start justify-between">
                          <Badge variant="outline" className={cn(
                             "text-[9px] font-black uppercase px-2 py-0.5",
                             task.priority === "High" ? "border-rose-200 text-rose-600 bg-rose-50" :
                             task.priority === "Medium" ? "border-amber-200 text-amber-600 bg-amber-50" :
                             "border-emerald-200 text-emerald-600 bg-emerald-50"
                          )}>
                             {task.priority || "Medium"}
                          </Badge>

                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 rounded hover:bg-slate-50 text-slate-400"
                              onClick={() => {
                                setViewingTask(task);
                                setIsDetailsOpen(true);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-slate-50 text-slate-400">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="rounded-xl z-50 bg-white border shadow-md">
                                <DropdownMenuItem 
                                  className="text-xs font-bold gap-2 cursor-pointer"
                                  onClick={() => {
                                    setEditingTask(task);
                                    setIsEditOpen(true);
                                  }}
                                >
                                  Edit Task
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-xs font-bold gap-2 text-rose-500 cursor-pointer"
                                  onClick={() => {
                                    if (confirm("Are you sure?")) {
                                      updateTask(task.id, { status: "CANCELLED" }).then(() => {
                                        queryClient.invalidateQueries({ queryKey: ["tasks"] });
                                      });
                                    }
                                  }}
                                >
                                  Cancel Task
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Title */}
                        <h5 className="font-bold text-sm text-slate-800 leading-tight">{task.title}</h5>

                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                             <span>📋 {task.subtasks.filter((s: any) => s.status === 'COMPLETED').length}/{task.subtasks.length} subtasks</span>
                          </div>
                        )}

                        {/* Assignee & Meta */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6 border border-slate-100">
                              <AvatarImage src={task.assignedTo?.avatarUrl} />
                              <AvatarFallback className="bg-blue-600 text-white text-[8px] font-black">
                                {task.assignedTo?.name?.slice(0,1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] font-black text-slate-500">{task.assignedTo?.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {task.points} pts
                            </span>
                          </div>
                        </div>

                        {/* Due Date & Move Controls */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(task.dueDate), "dd MMM")}
                          </span>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-6 px-2 text-[9px] font-black uppercase tracking-wider bg-slate-50 hover:bg-slate-100 border border-slate-200/50 rounded-lg gap-1">
                                Move <ChevronDown className="h-2.5 w-2.5 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="rounded-xl z-50 bg-white border">
                              <DropdownMenuItem className="cursor-pointer font-bold text-xs" onClick={() => handleStatusChange(task.id, "PENDING")}>Pending</DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer font-bold text-xs" onClick={() => handleStatusChange(task.id, "IN_PROGRESS")}>Ongoing</DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer font-bold text-xs" onClick={() => handleStatusChange(task.id, "COMPLETED")}>Completed</DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer font-bold text-xs" onClick={() => handleStatusChange(task.id, "CANCELLED")}>Cancelled</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div className="py-8 text-center text-[10px] font-bold text-slate-400 bg-white/40 rounded-xl border border-dashed border-slate-200">
                        No Tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. CALENDAR VIEW */}
        {viewMode === "CALENDAR" && (
          <div className="flex-1 p-6 bg-white flex flex-col gap-4">
            {/* Calendar Month Selector */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800">{monthName}</h3>
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-[10px] font-black uppercase text-slate-500 tracking-wider hover:bg-white px-3"
                  onClick={() => {
                    setCalendarYear(new Date().getFullYear());
                    setCalendarMonth(new Date().getMonth());
                  }}
                >
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Grid layout */}
            <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-2xl overflow-hidden border border-slate-100">
              {/* Week Headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} className="bg-[#f8f9fa] py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {day}
                </div>
              ))}

              {/* Day Cells */}
              {calendarDays.map((cell, idx) => {
                const dayTasks = filteredTasks.filter(t => isSameDay(new Date(t.dueDate), cell.date));
                const isToday = isSameDay(cell.date, new Date());
                
                return (
                  <div 
                    key={idx} 
                    className={cn(
                      "bg-white min-h-[100px] p-2 flex flex-col gap-1.5 transition-all group relative hover:bg-slate-50/50 cursor-pointer",
                      !cell.isCurrentMonth && "bg-slate-50/40 text-slate-300"
                    )}
                    onClick={() => {
                      setInitialCreateDate(format(cell.date, 'yyyy-MM-dd'));
                      setIsCreateOpen(true);
                    }}
                  >
                    {/* Date label & quick add */}
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center transition-colors",
                        isToday ? "bg-blue-600 text-white" : cell.isCurrentMonth ? "text-slate-700" : "text-slate-300"
                      )}>
                        {cell.dayNum}
                      </span>

                      {/* Small Quick-Add Plus Button on Hover */}
                      <button 
                        className="opacity-0 group-hover:opacity-100 h-4 w-4 rounded bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInitialCreateDate(format(cell.date, 'yyyy-MM-dd'));
                          setIsCreateOpen(true);
                        }}
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                    </div>

                    {/* Small list of Tasks inside the cell */}
                    <div className="flex-1 overflow-y-auto space-y-1 max-h-[80px]" onClick={e => e.stopPropagation()}>
                      {dayTasks.slice(0, 3).map(task => (
                        <div
                          key={task.id}
                          className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-bold truncate transition-all text-slate-800 border flex items-center justify-between hover:scale-[1.02]",
                            task.status === "COMPLETED" ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                            task.status === "IN_PROGRESS" ? "bg-blue-50 border-blue-100 text-blue-700" :
                            task.status === "CANCELLED" ? "bg-slate-100 border-slate-200 text-slate-400" :
                            "bg-amber-50 border-amber-100 text-amber-700"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingTask(task);
                            setIsDetailsOpen(true);
                          }}
                        >
                          {task.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[7px] font-black text-slate-400 text-center uppercase tracking-wider">
                          + {dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination (Only for LIST view) */}
        {viewMode === "LIST" && (
          <div className="p-4 border-t border-slate-50 flex items-center justify-between bg-white">
             <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Showing <span className="text-slate-900">{Math.min(filteredTasks.length, page * pageSize)}</span> Of <span className="text-slate-900">{filteredTasks.length}</span> Result
             </div>
             <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                   {Array.from({ length: Math.ceil(filteredTasks.length / pageSize) }).map((_, i) => (
                      <Button 
                        key={i}
                        variant="ghost" 
                        className={cn(
                          "h-8 w-8 rounded-lg text-xs font-black",
                          page === i + 1 ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white" : "text-slate-400"
                        )}
                        onClick={() => setPage(i + 1)}
                      >
                        {i + 1}
                      </Button>
                   ))}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg"
                  disabled={page >= Math.ceil(filteredTasks.length / pageSize)}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
             </div>
          </div>
        )}
      </div>

      {/* Viewing Task Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <ViewTaskDetailsDialog task={viewingTask} />
      </Dialog>

      {/* Editing Task Dialog Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        {editingTask && (
          <EditTaskDialog 
            task={editingTask}
            users={(users as any).items ?? []}
            onSubmit={(data: any) => editMutation.mutate(data)}
            isSubmitting={editMutation.isPending}
          />
        )}
      </Dialog>
    </div>
  );
}

function ViewTab({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
        active ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterTab({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "py-5 relative text-[11px] font-black uppercase tracking-wider transition-all min-w-max",
        active ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
      )}
    >
      {label}
      {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
    </button>
  );
}

function StatusBadge({ status, dueDate }: { status: string, dueDate: string }) {
  const now = new Date();
  const due = new Date(dueDate);
  const isOverdue = isBefore(due, startOfDay(now)) && status !== "COMPLETED";
  
  // Calculate remaining time text
  let timeText = "";
  if (status !== "COMPLETED" && status !== "CANCELLED") {
    const diffMs = due.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / (60 * 1000));
    
    if (diffMin < 0) {
      const absMin = Math.abs(diffMin);
      if (absMin < 60) {
        timeText = `Overdue by ${absMin}m`;
      } else if (absMin < 24 * 60) {
        timeText = `Overdue by ${Math.floor(absMin / 60)}h`;
      } else {
        timeText = `Overdue by ${Math.floor(absMin / (24 * 60))}d`;
      }
    } else {
      if (diffMin < 60) {
        timeText = `${diffMin}m left`;
      } else if (diffMin < 24 * 60) {
        const hours = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        timeText = `${hours}h ${mins}m left`;
      } else {
        timeText = `${Math.floor(diffMin / (24 * 60))}d left`;
      }
    }
  }

  const badgeElement = (() => {
    if (isOverdue) {
      return (
        <div className="px-3 py-1 rounded-lg border border-rose-100 bg-rose-50 text-rose-500 text-[10px] font-black uppercase tracking-widest">
          Overdue
        </div>
      );
    }

    const configs: any = {
      PENDING: { label: "Pending", bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200" },
      IN_PROGRESS: { label: "Ongoing", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
      COMPLETED: { label: "Completed", bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
      CANCELLED: { label: "Cancelled", bg: "bg-slate-50", text: "text-slate-400", border: "border-slate-200" },
    };

    const config = configs[status] || configs.PENDING;

    return (
      <div className={cn("px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest", config.bg, config.text, config.border)}>
        {config.label}
      </div>
    );
  })();

  return (
    <div className="flex flex-col items-center">
      {badgeElement}
      {timeText && (
        <span className={cn(
          "text-[9px] font-bold mt-0.5",
          isOverdue ? "text-rose-500" : "text-amber-500"
        )}>
          {timeText}
        </span>
      )}
    </div>
  );
}

function CreateTaskDialog({ users, onSubmit, isSubmitting, initialDate }: any) {
  const [showDescription, setShowDescription] = useState(false);
  const [showValidations, setShowValidations] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const [showGeofence, setShowGeofence] = useState(false);

  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
  const [fileError, setFileError] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingFile(true);
    setFileUploadProgress(0);
    setFileError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || progressEvent.loaded)
          );
          setFileUploadProgress(percentCompleted);
        }
      });
      setData(prev => ({
        ...prev,
        attachmentUrl: response.data.url,
        attachmentName: file.name
      }));
    } catch (err: any) {
      setFileError("Upload failed. Try again.");
      console.error(err);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const [data, setData] = useState({ 
    title: "", 
    description: "", 
    assignedToId: "", 
    dueDate: initialDate || format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    priority: "Medium",
    points: 10,
    repeatFrequency: "NONE",
    repeatDays: [] as number[],
    repeatDates: [] as number[],
    skipHolidays: false,
    attachmentUrl: null as string | null,
    attachmentName: null as string | null,
    validations: [] as string[],
    checklist: [] as Array<{
      id: string;
      title: string;
      required: boolean;
      validations: string[];
    }>,
    geofenceLat: "",
    geofenceLng: "",
    geofenceRadius: "",
    reminder: "",
    projectId: "",
    subtasks: [] as Array<{
      id: string;
      title: string;
      description: string;
      assignedToId: string;
      startDate: string;
      endDate: string;
      priority: string;
      validations: string[];
      checklist: any[];
      geofenceLat: string;
      geofenceLng: string;
      geofenceRadius: string;
      reminder: string;
    }>
  });

  useEffect(() => {
    if (initialDate) {
      setData(d => ({ ...d, dueDate: initialDate, endDate: `${initialDate}T23:59` }));
    }
  }, [initialDate]);

  const toggleDay = (day: number) => {
    setData(prev => ({
      ...prev,
      repeatDays: prev.repeatDays.includes(day) 
        ? prev.repeatDays.filter(d => d !== day)
        : [...prev.repeatDays, day]
    }));
  };

  const toggleDate = (date: number) => {
    setData(prev => ({
      ...prev,
      repeatDates: prev.repeatDates.includes(date)
        ? prev.repeatDates.filter(d => d !== date)
        : [...prev.repeatDates, date]
    }));
  };

  const toggleValidation = (val: string) => {
    setData(prev => ({
      ...prev,
      validations: prev.validations.includes(val)
        ? prev.validations.filter(v => v !== val)
        : [...prev.validations, val]
    }));
  };

  const addChecklistField = () => {
    setData(prev => ({
      ...prev,
      checklist: [
        ...prev.checklist,
        {
          id: Math.random().toString(),
          title: "",
          required: true,
          validations: []
        }
      ]
    }));
  };

  const removeChecklistField = (id: string) => {
    setData(prev => ({
      ...prev,
      checklist: prev.checklist.filter(c => c.id !== id)
    }));
  };

  const updateChecklistField = (id: string, updates: any) => {
    setData(prev => ({
      ...prev,
      checklist: prev.checklist.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const toggleChecklistItemValidation = (id: string, val: string) => {
    setData(prev => ({
      ...prev,
      checklist: prev.checklist.map(c => {
        if (c.id === id) {
          const validations = c.validations.includes(val)
            ? c.validations.filter(v => v !== val)
            : [...c.validations, val];
          return { ...c, validations };
        }
        return c;
      })
    }));
  };

  const addSubtask = () => {
    setData(prev => ({
      ...prev,
      subtasks: [
        ...prev.subtasks,
        {
          id: Math.random().toString(),
          title: "",
          description: "",
          assignedToId: "",
          startDate: format(new Date(), 'yyyy-MM-dd'),
          endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
          priority: "Medium",
          validations: [],
          checklist: [],
          geofenceLat: "",
          geofenceLng: "",
          geofenceRadius: "",
          reminder: ""
        }
      ]
    }));
  };

  const removeSubtask = (id: string) => {
    setData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter(s => s.id !== id)
    }));
  };

  const updateSubtask = (id: string, updates: any) => {
    setData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const toggleSubtaskValidation = (subtaskId: string, val: string) => {
    setData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map(s => {
        if (s.id === subtaskId) {
          const validations = s.validations.includes(val)
            ? s.validations.filter(v => v !== val)
            : [...s.validations, val];
          return { ...s, validations };
        }
        return s;
      })
    }));
  };

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const validationTypes = [
    { label: "Video", val: "VIDEO" },
    { label: "Audio", val: "AUDIO" },
    { label: "Image", val: "IMAGE" },
    { label: "File", val: "FILE" },
    { label: "Text", val: "TEXT" },
    { label: "Dropdown", val: "DROPDOWN" },
    { label: "Geo Tag", val: "GEOTAG" }
  ];

  const handleSaveTemplate = async () => {
    if (!data.title) {
      alert("Please enter a task name to save as a template.");
      return;
    }
    try {
      await createTemplate({
        name: data.title,
        type: "Task",
        priority: data.priority,
        description: data.description,
        data: JSON.stringify({
          validations: data.validations,
          checklist: data.checklist,
          geofenceLat: data.geofenceLat,
          geofenceLng: data.geofenceLng,
          geofenceRadius: data.geofenceRadius,
          reminder: data.reminder
        })
      });
      alert("Template saved successfully!");
    } catch (err: any) {
      alert("Failed to save template: " + (err.message || "Unknown error"));
    }
  };

  const [showInlineProject, setShowInlineProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-tasks"],
    queryFn: () => fetchProjects()
  });

  const handleCreateInlineProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const created = await apiCreateProject({ name: newProjectName.trim(), status: "Ongoing" });
      setData(d => ({ ...d, projectId: created.id }));
      setNewProjectName("");
      setShowInlineProject(false);
    } catch {
      // silently ignore
    } finally {
      setCreatingProject(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close max-h-[85vh] flex flex-col">
      <DialogHeader className="p-6 bg-blue-50/50 border-b border-blue-100 relative shrink-0">
        <DialogClose className="absolute right-6 top-6 rounded-xl bg-slate-200/50 p-1.5 text-slate-600 hover:bg-slate-300 transition-all">
           <X className="h-4 w-4" />
        </DialogClose>
        <DialogTitle className="text-xl font-bold text-slate-800 flex items-center">Create Task</DialogTitle>
        <p className="text-slate-500 text-xs font-semibold mt-0.5">Assign a new task with advanced validation rules.</p>
      </DialogHeader>
      
      <div className="p-6 space-y-6 overflow-y-auto flex-1">
         <div className="space-y-4">
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Assign User*</Label>
               <Select value={data.assignedToId} onValueChange={v => setData({...data, assignedToId: v})}>
                  <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                     <SelectValue placeholder="Select User" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                     {users?.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            {/* Project Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                  <Folder className="h-3 w-3 text-blue-500" /> Add Project (optional)
                </Label>
                <button
                  type="button"
                  onClick={() => { setShowInlineProject(!showInlineProject); setNewProjectName(""); }}
                  className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-wider flex items-center gap-1"
                >
                  {showInlineProject ? "✕ Cancel" : "+ New Project"}
                </button>
              </div>

              {showInlineProject ? (
                <div className="flex gap-2 items-center p-3 bg-blue-50/60 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-top-1 duration-150">
                  <span className="text-blue-500"><Folder className="h-4 w-4" /></span>
                  <input
                    type="text"
                    placeholder="New project name..."
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateInlineProject(); if (e.key === 'Escape') setShowInlineProject(false); }}
                    className="flex-1 bg-transparent text-sm font-bold text-slate-800 placeholder:text-slate-400 outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateInlineProject}
                    disabled={creatingProject || !newProjectName.trim()}
                    className="h-8 px-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 disabled:opacity-50 transition-all"
                  >
                    {creatingProject ? "Creating..." : "Create"}
                  </button>
                </div>
              ) : (
                <Select value={data.projectId} onValueChange={v => setData({...data, projectId: v === "__none__" ? "" : v})}>
                  <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                    <SelectValue placeholder="Select a project..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="__none__" className="rounded-xl font-bold text-slate-500 italic">No Project</SelectItem>
                    {(projects as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="rounded-xl font-bold">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "h-2 w-2 rounded-full flex-shrink-0",
                            p.status === "Ongoing" ? "bg-amber-400" : p.status === "Completed" ? "bg-emerald-400" : "bg-blue-400"
                          )} />
                          {p.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {data.projectId && !showInlineProject && (() => {
                const proj = (projects as any[]).find((p: any) => p.id === data.projectId);
                return proj ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100">
                    <Folder className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-bold text-blue-700">{proj.name}</span>
                    <span className={cn(
                      "ml-auto text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg",
                      proj.status === "Ongoing" ? "bg-amber-100 text-amber-700" : proj.status === "Completed" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                    )}>{proj.status}</span>
                  </div>
                ) : null;
              })()}
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Task Name*</Label>
               <div className="relative flex items-center">
                  <span className="absolute left-4 w-3.5 h-3.5 rounded bg-blue-600 shrink-0" />
                  <Input 
                    placeholder="Enter task name" 
                    className="h-12 pl-10 rounded-2xl bg-slate-50 border-none font-bold" 
                    value={data.title}
                    onChange={e => setData({...data, title: e.target.value})}
                  />
               </div>
            </div>

            <div className="space-y-2">
               <button 
                 type="button" 
                 onClick={() => setShowDescription(!showDescription)}
                 className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 flex items-center gap-1"
               >
                 {showDescription ? "- Remove Description" : "+ Add Description (optional)"}
               </button>
               {showDescription && (
                  <Textarea 
                    placeholder="Enter task description here..." 
                    className="min-h-[80px] rounded-2xl bg-slate-50 border-none font-medium resize-none" 
                    value={data.description}
                    onChange={e => setData({...data, description: e.target.value})}
                  />
               )}
            </div>

            {/* Task Attachment Upload */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-blue-500" /> Task Attachment
              </Label>
              {data.attachmentUrl ? (
                <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-2xl animate-in fade-in duration-200">
                  <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xs uppercase">
                    {data.attachmentName?.split('.').pop()?.slice(0, 4) || 'FILE'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{data.attachmentName}</p>
                    <p className="text-[10px] font-medium text-slate-400">Attached successfully</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setData(prev => ({ ...prev, attachmentUrl: null, attachmentName: null }))}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : isUploadingFile ? (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                      Uploading Attachment...
                    </span>
                    <span>{fileUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-150" style={{ width: `${fileUploadProgress}%` }}></div>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer group transition-all duration-200">
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <div className="h-9 w-9 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all mb-2">
                      <Paperclip className="h-4 w-4" />
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors">Click to attach document</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">PDF, Excel, Word, Image, ZIP up to 500MB</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
              {fileError && <p className="text-[10px] font-bold text-rose-500">{fileError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Start Date</Label>
                  <Input 
                    type="date" 
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                    value={data.startDate}
                    onChange={e => setData({...data, startDate: e.target.value})}
                  />
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">End Date</Label>
                  <Input 
                    type="date" 
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                    value={data.endDate}
                    onChange={e => setData({...data, endDate: e.target.value, dueDate: e.target.value})}
                  />
               </div>
            </div>

            <div className="flex gap-2 flex-wrap pt-2">
               <Button 
                 type="button"
                 variant="outline"
                 onClick={() => setShowValidations(!showValidations)}
                 className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showValidations && "bg-blue-50 border-blue-200 text-blue-700")}
               >
                 <CheckCircle2 className="h-4 w-4" /> Ask Validations
               </Button>

               <Button 
                 type="button"
                 variant="outline"
                 onClick={() => setShowRepeat(!showRepeat)}
                 className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showRepeat && "bg-blue-50 border-blue-200 text-blue-700")}
               >
                 <RefreshCw className="h-4 w-4" /> Repeat
               </Button>

               <Button 
                 type="button"
                 variant="outline"
                 onClick={() => setShowReminder(!showReminder)}
                 className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showReminder && "bg-blue-50 border-blue-200 text-blue-700")}
               >
                 <Bell className="h-4 w-4" /> Reminder
               </Button>
            </div>

            {showValidations && (
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100 animate-in fade-in slide-in-from-top-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Require Completion Proof (Select Validations)</Label>
                <div className="flex flex-wrap gap-4">
                  {validationTypes.map(v => (
                    <label key={v.val} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={data.validations.includes(v.val)}
                        onChange={() => toggleValidation(v.val)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                      />
                      {v.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {showRepeat && (
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100 animate-in fade-in slide-in-from-top-1">
                 <Label className="text-[9px] font-black uppercase text-slate-500">Repeat Task (Recurring)</Label>
                 <Select value={data.repeatFrequency} onValueChange={v => setData({...data, repeatFrequency: v})}>
                    <SelectTrigger className="h-10 bg-white border-slate-200 font-bold text-xs rounded-xl">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                       <SelectItem value="NONE">No Repeat</SelectItem>
                       <SelectItem value="DAILY">Every Day</SelectItem>
                       <SelectItem value="WEEKLY">Every Week</SelectItem>
                       <SelectItem value="MONTHLY">Every Month</SelectItem>
                    </SelectContent>
                 </Select>

                 {data.repeatFrequency === 'WEEKLY' && (
                   <div className="space-y-3">
                     <Label className="text-[9px] font-black uppercase text-slate-500">Select Days of Week</Label>
                     <div className="flex justify-between">
                       {dayNames.map((name, i) => (
                         <button
                           key={i}
                           type="button"
                           onClick={() => toggleDay(i)}
                           className={cn(
                             "h-8 w-8 rounded-full text-[10px] font-black transition-all",
                             data.repeatDays.includes(i) ? "bg-blue-600 text-white" : "bg-white text-slate-400 border border-slate-200"
                           )}
                         >
                           {name}
                         </button>
                       ))}
                     </div>
                   </div>
                 )}

                 {data.repeatFrequency === 'MONTHLY' && (
                   <div className="space-y-3">
                     <Label className="text-[9px] font-black uppercase text-slate-500">Select Dates of Month</Label>
                     <div className="grid grid-cols-7 gap-1">
                       {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                         <button
                           key={date}
                           type="button"
                           onClick={() => toggleDate(date)}
                           className={cn(
                             "h-7 w-7 rounded-lg text-[9px] font-bold transition-all",
                             data.repeatDates.includes(date) ? "bg-blue-600 text-white" : "bg-white text-slate-400 border border-slate-200"
                           )}
                         >
                           {date}
                         </button>
                       ))}
                     </div>
                   </div>
                 )}

                 {data.repeatFrequency !== 'NONE' && (
                   <div className="flex items-center gap-3 p-3 bg-blue-50/30 rounded-xl border border-blue-100/50">
                     <input 
                       type="checkbox" 
                       id="skipHolidays"
                       className="h-4 w-4 rounded border-slate-300 text-blue-600"
                       checked={data.skipHolidays}
                       onChange={e => setData({...data, skipHolidays: e.target.checked})}
                     />
                     <Label htmlFor="skipHolidays" className="text-[10px] font-black uppercase text-blue-700 cursor-pointer">Skip Holidays</Label>
                   </div>
                 )}
              </div>
            )}

            {showReminder && (
              <div className="p-4 bg-slate-50 rounded-2xl space-y-2 border border-slate-100 animate-in fade-in slide-in-from-top-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Send Notification Reminder</Label>
                <div className="flex items-center gap-3">
                  <Input 
                    type="number"
                    placeholder="e.g. 15, 30, 60"
                    className="h-10 w-32 rounded-xl bg-white border-slate-200 font-bold"
                    value={data.reminder}
                    onChange={e => setData({...data, reminder: e.target.value})}
                  />
                  <span className="text-xs font-bold text-slate-500">minutes before deadline</span>
                </div>
              </div>
            )}

            {/* Checklist Section */}
            <div className="border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setShowChecklist(!showChecklist)}
                className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-black text-xs uppercase tracking-wider"
              >
                <ListTodo className="h-4 w-4 text-blue-600" />
                {showChecklist ? "Hide Checklist Setup" : "Build Checklist"}
              </button>

              {showChecklist && (
                <div className="mt-3 space-y-4 p-4 bg-[#fcfdfd] border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-1">
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                     <span className="text-[10px] font-black uppercase text-slate-400">Checklist Items</span>
                     <button 
                       type="button" 
                       onClick={addChecklistField} 
                       className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700"
                     >
                       + Add Checklist Item
                     </button>
                   </div>

                   {data.checklist.map((item, idx) => (
                     <div key={item.id} className="p-3 bg-white border border-slate-100 rounded-xl space-y-3 relative group">
                        <button 
                          type="button"
                          onClick={() => removeChecklistField(item.id)}
                          className="absolute right-2 top-2 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        <div className="flex items-center gap-4">
                           <label className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-500 cursor-pointer shrink-0">
                             <input 
                               type="checkbox"
                               checked={item.required}
                               onChange={e => updateChecklistField(item.id, { required: e.target.checked })}
                               className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                             />
                             Required
                           </label>
                           <Input 
                             placeholder="Enter field title here"
                             className="h-9 border-none bg-slate-50 font-bold text-xs rounded-lg flex-1"
                             value={item.title}
                             onChange={e => updateChecklistField(item.id, { title: e.target.value })}
                           />
                        </div>

                        <div className="space-y-1.5">
                           <span className="text-[8px] font-black uppercase text-slate-400">Validations</span>
                           <div className="flex flex-wrap gap-3">
                              {validationTypes.map(v => (
                                 <label key={v.val} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer">
                                   <input 
                                     type="checkbox"
                                     checked={item.validations.includes(v.val)}
                                     onChange={() => toggleChecklistItemValidation(item.id, v.val)}
                                     className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                   />
                                   {v.label}
                                 </label>
                              ))}
                           </div>
                        </div>
                     </div>
                   ))}

                   {data.checklist.length === 0 && (
                     <p className="text-center text-[10px] font-bold text-slate-400 py-2">No checklist items. Click add to begin.</p>
                   )}
                </div>
              )}
            </div>

            {/* Subtasks Section */}
            <div className="border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setShowSubtasks(!showSubtasks)}
                className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-black text-xs uppercase tracking-wider"
              >
                <Plus className="h-4 w-4 text-blue-600" />
                {showSubtasks ? "Hide Sub Tasks" : "Add Sub Task"}
              </button>

              {showSubtasks && (
                <div className="mt-3 space-y-4 p-4 bg-[#fcfdfd] border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-1">
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                     <span className="text-[10px] font-black uppercase text-slate-400">Sub Tasks</span>
                     <button 
                       type="button" 
                       onClick={addSubtask} 
                       className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700"
                     >
                       + Add Subtask
                     </button>
                   </div>

                   {data.subtasks.map((sub, idx) => (
                     <div key={sub.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 relative">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                           <span className="text-xs font-black text-slate-700">Subtask-{idx+1}</span>
                           <button 
                             type="button"
                             onClick={() => removeSubtask(sub.id)}
                             className="text-slate-400 hover:text-rose-500 transition-colors"
                           >
                             <Trash2 className="h-4 w-4" />
                           </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Subtask Name*</Label>
                              <Input 
                                placeholder="Enter subtask name"
                                className="h-10 bg-slate-50 border-none font-bold text-xs rounded-xl"
                                value={sub.title}
                                onChange={e => updateSubtask(sub.id, { title: e.target.value })}
                              />
                           </div>
                           <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Assign User*</Label>
                              <Select value={sub.assignedToId} onValueChange={v => updateSubtask(sub.id, { assignedToId: v })}>
                                 <SelectTrigger className="h-10 bg-slate-50 border-none font-bold text-xs rounded-xl">
                                    <SelectValue placeholder="Select User" />
                                 </SelectTrigger>
                                 <SelectContent className="rounded-xl">
                                    {users?.map((u: any) => (
                                       <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Start Date & Time</Label>
                              <Input 
                                type="date"
                                className="h-10 bg-slate-50 border-none font-bold text-xs rounded-xl"
                                value={sub.startDate}
                                onChange={e => updateSubtask(sub.id, { startDate: e.target.value })}
                              />
                           </div>
                           <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">End Date & Time</Label>
                              <Input 
                                type="date"
                                className="h-10 bg-slate-50 border-none font-bold text-xs rounded-xl"
                                value={sub.endDate}
                                onChange={e => updateSubtask(sub.id, { endDate: e.target.value })}
                              />
                           </div>
                        </div>


                         {/* Subtask Checklist Builder */}
                         <div className="border-t border-slate-100 pt-3">
                           <div className="flex items-center justify-between mb-2">
                             <span className="text-[9px] font-black uppercase text-slate-400">Subtask Checklist Questions</span>
                             <button type="button" onClick={() => { const newCl = [...(sub.checklist||[]),{id:Math.random().toString(36).slice(2),title:"",required:true,validations:[]}]; updateSubtask(sub.id,{checklist:newCl}); }} className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-700">+ Add Question</button>
                           </div>
                           {(sub.checklist||[]).map((ci:any)=>(
                             <div key={ci.id} className="p-2 bg-slate-50 rounded-lg mb-2 space-y-2 relative border border-slate-100">
                               <button type="button" onClick={()=>updateSubtask(sub.id,{checklist:(sub.checklist||[]).filter((c:any)=>c.id!==ci.id)})} className="absolute right-2 top-2 text-slate-400 hover:text-rose-500"><X className="h-3 w-3"/></button>
                               <div className="flex items-center gap-3 pr-6">
                                 <label className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 cursor-pointer shrink-0"><input type="checkbox" checked={ci.required} onChange={e=>updateSubtask(sub.id,{checklist:(sub.checklist||[]).map((c:any)=>c.id===ci.id?{...c,required:e.target.checked}:c)})} className="rounded border-slate-300"/> Required</label>
                                 <Input placeholder="Question title" className="h-8 border-none bg-white font-bold text-xs rounded-lg flex-1" value={ci.title} onChange={e=>updateSubtask(sub.id,{checklist:(sub.checklist||[]).map((c:any)=>c.id===ci.id?{...c,title:e.target.value}:c)})}/>
                               </div>
                               <div className="flex flex-wrap gap-2">
                                 {validationTypes.map(v=>(<label key={v.val} className="flex items-center gap-1 text-[9px] font-bold text-slate-600 cursor-pointer"><input type="checkbox" checked={(ci.validations||[]).includes(v.val)} onChange={()=>{const nv=(ci.validations||[]).includes(v.val)?(ci.validations||[]).filter((x:string)=>x!==v.val):[...(ci.validations||[]),v.val];updateSubtask(sub.id,{checklist:(sub.checklist||[]).map((c:any)=>c.id===ci.id?{...c,validations:nv}:c)});}} className="rounded border-slate-300"/> {v.label}</label>))}
                               </div>
                             </div>
                           ))}
                           {(!sub.checklist||sub.checklist.length===0)&&<p className="text-[9px] text-slate-400 font-bold text-center py-1">No questions yet.</p>}
                         </div>
                        <div className="space-y-2">
                           <span className="text-[8px] font-black uppercase text-slate-400">Subtask Validations</span>
                           <div className="flex flex-wrap gap-3">
                              {validationTypes.map(v => (
                                 <label key={v.val} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer">
                                   <input 
                                     type="checkbox"
                                     checked={sub.validations.includes(v.val)}
                                     onChange={() => toggleSubtaskValidation(sub.id, v.val)}
                                     className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                   />
                                   {v.label}
                                 </label>
                              ))}
                           </div>
                        </div>
                     </div>
                   ))}

                   {data.subtasks.length === 0 && (
                     <p className="text-center text-[10px] font-bold text-slate-400 py-2">No sub tasks added. Click add to begin.</p>
                   )}
                </div>
              )}
            </div>

            {/* Advanced Options Accordion */}
            <div className="border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-slate-700 hover:text-slate-900 font-black text-xs uppercase tracking-wider"
              >
                <span>Advanced Options</span>
                <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", showAdvanced && "rotate-180")} />
              </button>

              {showAdvanced && (
                <div className="mt-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-1">
                   {/* Switches Row */}
                   <div className="flex items-center gap-4">
                      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 flex-1 h-12">
                         <span className="text-xs font-bold text-slate-700">Add points</span>
                         <Switch 
                            checked={showPoints} 
                            onCheckedChange={(checked) => {
                               setShowPoints(checked);
                               if (!checked) {
                                  setData(d => ({ ...d, points: 0 }));
                               } else {
                                  setData(d => ({ ...d, points: 10 }));
                               }
                            }} 
                         />
                      </div>

                      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 flex-1 h-12">
                         <span className="text-xs font-bold text-slate-700">Enable Geo Fence</span>
                         <Switch 
                            checked={showGeofence} 
                            onCheckedChange={(checked) => {
                               setShowGeofence(checked);
                               if (!checked) {
                                  setData(d => ({ ...d, geofenceLat: "", geofenceLng: "", geofenceRadius: "" }));
                               } else {
                                  setData(d => ({
                                     ...d,
                                     geofenceLat: d.geofenceLat || "21.1938",
                                     geofenceLng: d.geofenceLng || "81.3509",
                                     geofenceRadius: d.geofenceRadius || "500"
                                  }));
                               }
                            }} 
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <Label className="text-[9px] font-black uppercase text-slate-400">Priority</Label>
                         <Select value={data.priority} onValueChange={v => setData({...data, priority: v})}>
                            <SelectTrigger className="h-10 bg-white border-slate-200 font-bold text-xs rounded-xl">
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                               <SelectItem value="Low">Low</SelectItem>
                               <SelectItem value="Medium">Medium</SelectItem>
                               <SelectItem value="High">High</SelectItem>
                            </SelectContent>
                         </Select>
                      </div>

                      {showPoints && (
                         <div className="space-y-1 animate-in fade-in duration-200">
                            <Label className="text-[9px] font-black uppercase text-slate-400">Points</Label>
                            <Input 
                              type="number"
                              className="h-10 bg-white border-slate-200 font-bold text-xs rounded-xl"
                              value={data.points}
                              onChange={e => setData({...data, points: parseInt(e.target.value) || 0})}
                            />
                         </div>
                      )}
                   </div>

                   {/* Interactive Geofence Map Picker */}
                   {showGeofence && (
                     <div className="animate-in fade-in duration-300">
                       <GeoFenceMapPicker
                         lat={data.geofenceLat}
                         lng={data.geofenceLng}
                         radius={data.geofenceRadius}
                         onUpdate={(latVal, lngVal, radVal) => {
                           setData(d => ({
                             ...d,
                             geofenceLat: latVal.toString(),
                             geofenceLng: lngVal.toString(),
                             geofenceRadius: radVal.toString()
                           }));
                         }}
                       />
                     </div>
                   )}

                   <div className="flex justify-end pt-2 border-t border-slate-200/50">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSaveTemplate}
                        className="h-10 rounded-xl text-xs font-bold gap-2 border-slate-200 hover:bg-slate-100"
                      >
                        <Save className="h-4 w-4 text-blue-600" /> Save as Template
                      </Button>
                   </div>
                </div>
              )}
            </div>
         </div>
      </div>
      
      <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-end gap-3 rounded-b-[32px]">
         <DialogClose asChild>
            <Button variant="ghost" className="h-12 rounded-xl text-xs font-bold uppercase tracking-wider px-6">Cancel</Button>
         </DialogClose>
         <Button 
          className="h-12 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 rounded-xl font-bold uppercase tracking-wider text-xs px-6"
           onClick={() => onSubmit({
             ...data,
             description: data.description || null,
             isRepeating: data.repeatFrequency !== "NONE",
             repeatDays: data.repeatDays.join(','),
             repeatDates: data.repeatDates.join(','),
             startDate: data.startDate ? new Date(data.startDate) : null,
             endDate: data.endDate ? new Date(data.endDate) : null,
             geofenceLat: data.geofenceLat ? parseFloat(data.geofenceLat) : null,
             geofenceLng: data.geofenceLng ? parseFloat(data.geofenceLng) : null,
             geofenceRadius: data.geofenceRadius ? parseFloat(data.geofenceRadius) : null,
             reminder: data.reminder ? parseInt(data.reminder) : null,
             projectId: data.projectId || null,
             subtasks: data.subtasks.map(s => ({
               ...s,
               startDate: s.startDate ? new Date(s.startDate) : null,
               endDate: s.endDate ? new Date(s.endDate) : null,
               geofenceLat: s.geofenceLat ? parseFloat(s.geofenceLat) : null,
               geofenceLng: s.geofenceLng ? parseFloat(s.geofenceLng) : null,
               geofenceRadius: s.geofenceRadius ? parseFloat(s.geofenceRadius) : null,
               reminder: s.reminder ? parseInt(s.reminder) : null
             }))
           })}
          disabled={isSubmitting || !data.title || !data.assignedToId}
         >
            {isSubmitting ? "Creating..." : "Create Task"}
         </Button>
      </div>
    </DialogContent>
  );
}

function EditTaskDialog({ task, users, onSubmit, isSubmitting }: any) {
  const [showDescription, setShowDescription] = useState(!!task.description);
  const [showValidations, setShowValidations] = useState(task.validations && task.validations.length > 0);
  const [showRepeat, setShowRepeat] = useState(task.repeatFrequency && task.repeatFrequency !== "NONE");
  const [showReminder, setShowReminder] = useState(!!task.reminder);
  const [showChecklist, setShowChecklist] = useState(task.checklist && task.checklist.length > 0);
  const [showSubtasks, setShowSubtasks] = useState(task.subtasks && task.subtasks.length > 0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPoints, setShowPoints] = useState(task.points !== undefined && task.points !== null && task.points > 0);
  const [showGeofence, setShowGeofence] = useState(!!task.geofenceLat);

  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
  const [fileError, setFileError] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingFile(true);
    setFileUploadProgress(0);
    setFileError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || progressEvent.loaded)
          );
          setFileUploadProgress(percentCompleted);
        }
      });
      setData(prev => ({
        ...prev,
        attachmentUrl: response.data.url,
        attachmentName: file.name
      }));
    } catch (err: any) {
      setFileError("Upload failed. Try again.");
      console.error(err);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const [data, setData] = useState({
    id: task.id,
    title: task.title || "",
    description: task.description || "",
    assignedToId: task.assignedToId || "",
    dueDate: task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    startDate: task.startDate ? format(new Date(task.startDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    endDate: task.endDate ? format(new Date(task.endDate), 'yyyy-MM-dd') : format(new Date(task.dueDate || new Date()), 'yyyy-MM-dd'),
    priority: task.priority || "Medium",
    points: task.points || 10,
    status: task.status || "PENDING",
    attachmentUrl: task.attachmentUrl || null as string | null,
    attachmentName: task.attachmentName || null as string | null,
    repeatFrequency: task.repeatFrequency || "NONE",
    repeatDays: task.repeatDays ? task.repeatDays.split(',').map((x: string) => parseInt(x)).filter((x: number) => !isNaN(x)) : [] as number[],
    repeatDates: task.repeatDates ? task.repeatDates.split(',').map((x: string) => parseInt(x)).filter((x: number) => !isNaN(x)) : [] as number[],
    skipHolidays: task.skipHolidays || false,
    validations: task.validations || [] as string[],
    checklist: (task.checklist || []) as Array<{
      id: string;
      title: string;
      required: boolean;
      validations: string[];
    }>,
    geofenceLat: task.geofenceLat !== null && task.geofenceLat !== undefined ? String(task.geofenceLat) : "",
    geofenceLng: task.geofenceLng !== null && task.geofenceLng !== undefined ? String(task.geofenceLng) : "",
    geofenceRadius: task.geofenceRadius !== null && task.geofenceRadius !== undefined ? String(task.geofenceRadius) : "",
    reminder: task.reminder !== null && task.reminder !== undefined ? String(task.reminder) : "",
    subtasks: (task.subtasks || []) as Array<{
      id: string;
      title: string;
      description: string;
      assignedToId: string;
      startDate: string;
      endDate: string;
      priority: string;
      validations: string[];
      checklist: any[];
      geofenceLat: string;
      geofenceLng: string;
      geofenceRadius: string;
      reminder: string;
    }>
  });

  const toggleDay = (day: number) => {
    setData(prev => ({
      ...prev,
      repeatDays: prev.repeatDays.includes(day) 
        ? prev.repeatDays.filter((d: number) => d !== day)
        : [...prev.repeatDays, day]
    }));
  };

  const toggleDate = (date: number) => {
    setData(prev => ({
      ...prev,
      repeatDates: prev.repeatDates.includes(date)
        ? prev.repeatDates.filter((d: number) => d !== date)
        : [...prev.repeatDates, date]
    }));
  };

  const toggleValidation = (val: string) => {
    setData(prev => ({
      ...prev,
      validations: prev.validations.includes(val)
        ? prev.validations.filter((v: string) => v !== val)
        : [...prev.validations, val]
    }));
  };

  const addChecklistField = () => {
    setData(prev => ({
      ...prev,
      checklist: [
        ...prev.checklist,
        {
          id: Math.random().toString(),
          title: "",
          required: true,
          validations: []
        }
      ]
    }));
  };

  const removeChecklistField = (id: string) => {
    setData(prev => ({
      ...prev,
      checklist: prev.checklist.filter((c: any) => c.id !== id)
    }));
  };

  const updateChecklistField = (id: string, updates: any) => {
    setData(prev => ({
      ...prev,
      checklist: prev.checklist.map((c: any) => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const toggleChecklistItemValidation = (id: string, val: string) => {
    setData(prev => ({
      ...prev,
      checklist: prev.checklist.map((c: any) => {
        if (c.id === id) {
          const validations = c.validations.includes(val)
            ? c.validations.filter((v: string) => v !== val)
            : [...c.validations, val];
          return { ...c, validations };
        }
        return c;
      })
    }));
  };

  const addSubtask = () => {
    setData(prev => ({
      ...prev,
      subtasks: [
        ...prev.subtasks,
        {
          id: Math.random().toString(),
          title: "",
          description: "",
          assignedToId: "",
          startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
          endDate: format(addDays(new Date(), 1), "yyyy-MM-dd'T'23:59"),
          priority: "Medium",
          validations: [],
          checklist: [],
          geofenceLat: "",
          geofenceLng: "",
          geofenceRadius: "",
          reminder: ""
        }
      ]
    }));
  };

  const removeSubtask = (id: string) => {
    setData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter((s: any) => s.id !== id)
    }));
  };

  const updateSubtask = (id: string, updates: any) => {
    setData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map((s: any) => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const toggleSubtaskValidation = (subtaskId: string, val: string) => {
    setData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map((s: any) => {
        if (s.id === subtaskId) {
          const validations = s.validations.includes(val)
            ? s.validations.filter((v: string) => v !== val)
            : [...s.validations, val];
          return { ...s, validations };
        }
        return s;
      })
    }));
  };

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const validationTypes = [
    { label: "Video", val: "VIDEO" },
    { label: "Audio", val: "AUDIO" },
    { label: "Image", val: "IMAGE" },
    { label: "File", val: "FILE" },
    { label: "Text", val: "TEXT" },
    { label: "Dropdown", val: "DROPDOWN" },
    { label: "Geo Tag", val: "GEOTAG" }
  ];

  const handleSaveTemplate = async () => {
    if (!data.title) {
      alert("Please enter a task name to save as a template.");
      return;
    }
    try {
      await createTemplate({
        name: data.title,
        type: "Task",
        priority: data.priority,
        description: data.description,
        data: JSON.stringify({
          validations: data.validations,
          checklist: data.checklist,
          geofenceLat: data.geofenceLat,
          geofenceLng: data.geofenceLng,
          geofenceRadius: data.geofenceRadius,
          reminder: data.reminder
        })
      });
      alert("Template saved successfully!");
    } catch (err: any) {
      alert("Failed to save template: " + (err.message || "Unknown error"));
    }
  };

  const [showInlineProject, setShowInlineProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-tasks"],
    queryFn: () => fetchProjects()
  });

  const handleCreateInlineProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const created = await apiCreateProject({ name: newProjectName.trim(), status: "Ongoing" });
      setData(d => ({ ...d, projectId: created.id }));
      setNewProjectName("");
      setShowInlineProject(false);
    } catch {
      // silently ignore
    } finally {
      setCreatingProject(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close max-h-[85vh] flex flex-col">
      <DialogHeader className="p-6 bg-blue-50/50 border-b border-blue-100 relative shrink-0">
        <DialogClose className="absolute right-6 top-6 rounded-xl bg-slate-200/50 p-1.5 text-slate-600 hover:bg-slate-300 transition-all">
           <X className="h-4 w-4" />
        </DialogClose>
        <DialogTitle className="text-xl font-bold text-slate-800 flex items-center">Edit Task</DialogTitle>
        <p className="text-slate-500 text-xs font-semibold mt-0.5">Modify task details and assignments.</p>
      </DialogHeader>
      
      <div className="p-6 space-y-6 overflow-y-auto flex-1">
         <div className="space-y-4">
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Assign User*</Label>
               <Select value={data.assignedToId} onValueChange={v => setData({...data, assignedToId: v})}>
                  <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                     <SelectValue placeholder="Select User" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                     {users?.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Task Name*</Label>
               <div className="relative flex items-center">
                  <span className="absolute left-4 w-3.5 h-3.5 rounded bg-blue-600 shrink-0" />
                  <Input 
                    placeholder="Enter task name" 
                    className="h-12 pl-10 rounded-2xl bg-slate-50 border-none font-bold" 
                    value={data.title}
                    onChange={e => setData({...data, title: e.target.value})}
                  />
               </div>
            </div>

            <div className="space-y-2">
               <button 
                 type="button" 
                 onClick={() => setShowDescription(!showDescription)}
                 className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 flex items-center gap-1"
               >
                 {showDescription ? "- Remove Description" : "+ Add Description (optional)"}
               </button>
               {showDescription && (
                  <Textarea 
                    placeholder="Enter task description here..." 
                    className="min-h-[80px] rounded-2xl bg-slate-50 border-none font-medium resize-none" 
                    value={data.description}
                    onChange={e => setData({...data, description: e.target.value})}
                  />
               )}
            </div>

            {/* Task Attachment Upload */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-blue-500" /> Task Attachment
              </Label>
              {data.attachmentUrl ? (
                <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-2xl animate-in fade-in duration-200">
                  <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xs uppercase">
                    {data.attachmentName?.split('.').pop()?.slice(0, 4) || 'FILE'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{data.attachmentName}</p>
                    <p className="text-[10px] font-medium text-slate-400">Attached successfully</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setData(prev => ({ ...prev, attachmentUrl: null, attachmentName: null }))}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : isUploadingFile ? (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                      Uploading Attachment...
                    </span>
                    <span>{fileUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-150" style={{ width: `${fileUploadProgress}%` }}></div>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer group transition-all duration-200">
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <div className="h-9 w-9 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all mb-2">
                      <Paperclip className="h-4 w-4" />
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors">Click to attach document</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">PDF, Excel, Word, Image, ZIP up to 500MB</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
              {fileError && <p className="text-[10px] font-bold text-rose-500">{fileError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Start Date</Label>
                  <Input 
                    type="date"
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                    value={data.startDate}
                    onChange={e => setData({...data, startDate: e.target.value})}
                  />
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">End Date</Label>
                  <Input 
                    type="date"
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                    value={data.endDate}
                    onChange={e => setData({...data, endDate: e.target.value, dueDate: e.target.value})}
                  />
               </div>
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Task Status</Label>
               <Select value={data.status} onValueChange={v => setData({...data, status: v})}>
                  <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                     <SelectItem value="PENDING">Pending</SelectItem>
                     <SelectItem value="IN_PROGRESS">Ongoing</SelectItem>
                     <SelectItem value="COMPLETED">Completed</SelectItem>
                     <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            <div className="flex gap-2 flex-wrap pt-2">
               <Button 
                 type="button"
                 variant="outline"
                 onClick={() => setShowValidations(!showValidations)}
                 className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showValidations && "bg-blue-50 border-blue-200 text-blue-700")}
               >
                 <CheckCircle2 className="h-4 w-4" /> Ask Validations
               </Button>

               <Button 
                 type="button"
                 variant="outline"
                 onClick={() => setShowRepeat(!showRepeat)}
                 className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showRepeat && "bg-blue-50 border-blue-200 text-blue-700")}
               >
                 <RefreshCw className="h-4 w-4" /> Repeat
               </Button>

               <Button 
                 type="button"
                 variant="outline"
                 onClick={() => setShowReminder(!showReminder)}
                 className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showReminder && "bg-blue-50 border-blue-200 text-blue-700")}
               >
                 <Bell className="h-4 w-4" /> Reminder
               </Button>
            </div>

            {showValidations && (
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100 animate-in fade-in slide-in-from-top-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Require Completion Proof (Select Validations)</Label>
                <div className="flex flex-wrap gap-4">
                  {validationTypes.map(v => (
                    <label key={v.val} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={data.validations.includes(v.val)}
                        onChange={() => toggleValidation(v.val)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                      />
                      {v.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {showRepeat && (
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100 animate-in fade-in slide-in-from-top-1">
                 <Label className="text-[9px] font-black uppercase text-slate-500">Repeat Task (Recurring)</Label>
                 <Select value={data.repeatFrequency} onValueChange={v => setData({...data, repeatFrequency: v})}>
                    <SelectTrigger className="h-10 bg-white border-slate-200 font-bold text-xs rounded-xl">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                       <SelectItem value="NONE">No Repeat</SelectItem>
                       <SelectItem value="DAILY">Every Day</SelectItem>
                       <SelectItem value="WEEKLY">Every Week</SelectItem>
                       <SelectItem value="MONTHLY">Every Month</SelectItem>
                    </SelectContent>
                 </Select>

                 {data.repeatFrequency === 'WEEKLY' && (
                   <div className="space-y-3">
                     <Label className="text-[9px] font-black uppercase text-slate-500">Select Days of Week</Label>
                     <div className="flex justify-between">
                       {dayNames.map((name, i) => (
                         <button
                           key={i}
                           type="button"
                           onClick={() => toggleDay(i)}
                           className={cn(
                             "h-8 w-8 rounded-full text-[10px] font-black transition-all",
                             data.repeatDays.includes(i) ? "bg-blue-600 text-white" : "bg-white text-slate-400 border border-slate-200"
                           )}
                         >
                           {name}
                         </button>
                       ))}
                     </div>
                   </div>
                 )}

                 {data.repeatFrequency === 'MONTHLY' && (
                   <div className="space-y-3">
                     <Label className="text-[9px] font-black uppercase text-slate-500">Select Dates of Month</Label>
                     <div className="grid grid-cols-7 gap-1">
                       {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                         <button
                           key={date}
                           type="button"
                           onClick={() => toggleDate(date)}
                           className={cn(
                             "h-7 w-7 rounded-lg text-[9px] font-bold transition-all",
                             data.repeatDates.includes(date) ? "bg-blue-600 text-white" : "bg-white text-slate-400 border border-slate-200"
                           )}
                         >
                           {date}
                         </button>
                       ))}
                     </div>
                   </div>
                 )}

                 {data.repeatFrequency !== 'NONE' && (
                   <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                     <input 
                       type="checkbox" 
                       id="editSkipHolidays"
                       className="h-4 w-4 rounded border-slate-300 text-blue-600"
                       checked={data.skipHolidays}
                       onChange={e => setData({...data, skipHolidays: e.target.checked})}
                     />
                     <Label htmlFor="editSkipHolidays" className="text-[10px] font-black uppercase text-blue-700 cursor-pointer">Skip Holidays</Label>
                   </div>
                 )}
              </div>
            )}

            {showReminder && (
              <div className="p-4 bg-slate-50 rounded-2xl space-y-2 border border-slate-100 animate-in fade-in slide-in-from-top-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Send Notification Reminder</Label>
                <div className="flex items-center gap-3">
                  <Input 
                    type="number"
                    placeholder="e.g. 15, 30, 60"
                    className="h-10 w-32 rounded-xl bg-white border-slate-200 font-bold"
                    value={data.reminder}
                    onChange={e => setData({...data, reminder: e.target.value})}
                  />
                  <span className="text-xs font-bold text-slate-500">minutes before deadline</span>
                </div>
              </div>
            )}

            {/* Checklist Section */}
            <div className="border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setShowChecklist(!showChecklist)}
                className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-black text-xs uppercase tracking-wider"
              >
                <ListTodo className="h-4 w-4 text-blue-600" />
                {showChecklist ? "Hide Checklist Setup" : "Build Checklist"}
              </button>

              {showChecklist && (
                <div className="mt-3 space-y-4 p-4 bg-[#fcfdfd] border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-1">
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                     <span className="text-[10px] font-black uppercase text-slate-400">Checklist Items</span>
                     <button 
                       type="button" 
                       onClick={addChecklistField} 
                       className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700"
                     >
                       + Add Checklist Item
                     </button>
                   </div>

                   {data.checklist.map((item, idx) => (
                     <div key={item.id} className="p-3 bg-white border border-slate-100 rounded-xl space-y-3 relative group">
                        <button 
                          type="button"
                          onClick={() => removeChecklistField(item.id)}
                          className="absolute right-2 top-2 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        <div className="flex items-center gap-4">
                           <label className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-500 cursor-pointer shrink-0">
                             <input 
                               type="checkbox"
                               checked={item.required}
                               onChange={e => updateChecklistField(item.id, { required: e.target.checked })}
                               className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                             />
                             Required
                           </label>
                           <Input 
                             placeholder="Enter field title here"
                             className="h-9 border-none bg-slate-50 font-bold text-xs rounded-lg flex-1"
                             value={item.title}
                             onChange={e => updateChecklistField(item.id, { title: e.target.value })}
                           />
                        </div>

                        <div className="space-y-1.5">
                           <span className="text-[8px] font-black uppercase text-slate-400">Validations</span>
                           <div className="flex flex-wrap gap-3">
                              {validationTypes.map(v => (
                                 <label key={v.val} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer">
                                   <input 
                                     type="checkbox"
                                     checked={item.validations.includes(v.val)}
                                     onChange={() => toggleChecklistItemValidation(item.id, v.val)}
                                     className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                   />
                                   {v.label}
                                 </label>
                              ))}
                           </div>
                        </div>
                     </div>
                   ))}

                   {data.checklist.length === 0 && (
                     <p className="text-center text-[10px] font-bold text-slate-400 py-2">No checklist items. Click add to begin.</p>
                   )}
                </div>
              )}
            </div>

            {/* Subtasks Section */}
            <div className="border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setShowSubtasks(!showSubtasks)}
                className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-black text-xs uppercase tracking-wider"
              >
                <Plus className="h-4 w-4 text-blue-600" />
                {showSubtasks ? "Hide Sub Tasks" : "Add Sub Task"}
              </button>

              {showSubtasks && (
                <div className="mt-3 space-y-4 p-4 bg-[#fcfdfd] border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-1">
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                     <span className="text-[10px] font-black uppercase text-slate-400">Sub Tasks</span>
                     <button 
                       type="button" 
                       onClick={addSubtask} 
                       className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700"
                     >
                       + Add Subtask
                     </button>
                   </div>

                   {data.subtasks.map((sub, idx) => (
                     <div key={sub.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 relative">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                           <span className="text-xs font-black text-slate-700">Subtask-{idx+1}</span>
                           <button 
                             type="button"
                             onClick={() => removeSubtask(sub.id)}
                             className="text-slate-400 hover:text-rose-500 transition-colors"
                           >
                             <Trash2 className="h-4 w-4" />
                           </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Subtask Name*</Label>
                              <Input 
                                placeholder="Enter subtask name"
                                className="h-10 bg-slate-50 border-none font-bold text-xs rounded-xl"
                                value={sub.title}
                                onChange={e => updateSubtask(sub.id, { title: e.target.value })}
                              />
                           </div>
                           <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Assign User*</Label>
                              <Select value={sub.assignedToId} onValueChange={v => updateSubtask(sub.id, { assignedToId: v })}>
                                 <SelectTrigger className="h-10 bg-slate-50 border-none font-bold text-xs rounded-xl">
                                    <SelectValue placeholder="Select User" />
                                 </SelectTrigger>
                                 <SelectContent className="rounded-xl">
                                    {users?.map((u: any) => (
                                       <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Start Date & Time</Label>
                              <Input 
                                type="date"
                                className="h-10 bg-slate-50 border-none font-bold text-xs rounded-xl"
                                value={sub.startDate}
                                onChange={e => updateSubtask(sub.id, { startDate: e.target.value })}
                              />
                           </div>
                           <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase text-slate-400">End Date & Time</Label>
                              <Input 
                                type="date"
                                className="h-10 bg-slate-50 border-none font-bold text-xs rounded-xl"
                                value={sub.endDate}
                                onChange={e => updateSubtask(sub.id, { endDate: e.target.value })}
                              />
                           </div>
                        </div>


                         {/* Subtask Checklist Builder */}
                         <div className="border-t border-slate-100 pt-3">
                           <div className="flex items-center justify-between mb-2">
                             <span className="text-[9px] font-black uppercase text-slate-400">Subtask Checklist Questions</span>
                             <button type="button" onClick={() => { const newCl = [...(sub.checklist||[]),{id:Math.random().toString(36).slice(2),title:"",required:true,validations:[]}]; updateSubtask(sub.id,{checklist:newCl}); }} className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-700">+ Add Question</button>
                           </div>
                           {(sub.checklist||[]).map((ci:any)=>(
                             <div key={ci.id} className="p-2 bg-slate-50 rounded-lg mb-2 space-y-2 relative border border-slate-100">
                               <button type="button" onClick={()=>updateSubtask(sub.id,{checklist:(sub.checklist||[]).filter((c:any)=>c.id!==ci.id)})} className="absolute right-2 top-2 text-slate-400 hover:text-rose-500"><X className="h-3 w-3"/></button>
                               <div className="flex items-center gap-3 pr-6">
                                 <label className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 cursor-pointer shrink-0"><input type="checkbox" checked={ci.required} onChange={e=>updateSubtask(sub.id,{checklist:(sub.checklist||[]).map((c:any)=>c.id===ci.id?{...c,required:e.target.checked}:c)})} className="rounded border-slate-300"/> Required</label>
                                 <Input placeholder="Question title" className="h-8 border-none bg-white font-bold text-xs rounded-lg flex-1" value={ci.title} onChange={e=>updateSubtask(sub.id,{checklist:(sub.checklist||[]).map((c:any)=>c.id===ci.id?{...c,title:e.target.value}:c)})}/>
                               </div>
                               <div className="flex flex-wrap gap-2">
                                 {validationTypes.map(v=>(<label key={v.val} className="flex items-center gap-1 text-[9px] font-bold text-slate-600 cursor-pointer"><input type="checkbox" checked={(ci.validations||[]).includes(v.val)} onChange={()=>{const nv=(ci.validations||[]).includes(v.val)?(ci.validations||[]).filter((x:string)=>x!==v.val):[...(ci.validations||[]),v.val];updateSubtask(sub.id,{checklist:(sub.checklist||[]).map((c:any)=>c.id===ci.id?{...c,validations:nv}:c)});}} className="rounded border-slate-300"/> {v.label}</label>))}
                               </div>
                             </div>
                           ))}
                           {(!sub.checklist||sub.checklist.length===0)&&<p className="text-[9px] text-slate-400 font-bold text-center py-1">No questions yet.</p>}
                         </div>
                        <div className="space-y-2">
                           <span className="text-[8px] font-black uppercase text-slate-400">Subtask Validations</span>
                           <div className="flex flex-wrap gap-3">
                              {validationTypes.map(v => (
                                 <label key={v.val} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer">
                                   <input 
                                     type="checkbox"
                                     checked={sub.validations.includes(v.val)}
                                     onChange={() => toggleSubtaskValidation(sub.id, v.val)}
                                     className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                   />
                                   {v.label}
                                 </label>
                              ))}
                           </div>
                        </div>
                     </div>
                   ))}

                   {data.subtasks.length === 0 && (
                     <p className="text-center text-[10px] font-bold text-slate-400 py-2">No sub tasks added. Click add to begin.</p>
                   )}
                </div>
              )}
            </div>

            {/* Advanced Options Accordion */}
            <div className="border-t border-slate-100 pt-4">
              <button 
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-slate-700 hover:text-slate-900 font-black text-xs uppercase tracking-wider"
              >
                <span>Advanced Options</span>
                <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", showAdvanced && "rotate-180")} />
              </button>

              {showAdvanced && (
                <div className="mt-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-1">
                   {/* Switches Row */}
                   <div className="flex items-center gap-4">
                      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 flex-1 h-12">
                         <span className="text-xs font-bold text-slate-700">Add points</span>
                         <Switch 
                            checked={showPoints} 
                            onCheckedChange={(checked) => {
                               setShowPoints(checked);
                               if (!checked) {
                                  setData(d => ({ ...d, points: 0 }));
                               } else {
                                  setData(d => ({ ...d, points: 10 }));
                               }
                            }} 
                         />
                      </div>

                      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 flex-1 h-12">
                         <span className="text-xs font-bold text-slate-700">Enable Geo Fence</span>
                         <Switch 
                            checked={showGeofence} 
                            onCheckedChange={(checked) => {
                               setShowGeofence(checked);
                               if (!checked) {
                                  setData(d => ({ ...d, geofenceLat: "", geofenceLng: "", geofenceRadius: "" }));
                               } else {
                                  setData(d => ({
                                     ...d,
                                     geofenceLat: d.geofenceLat || "21.1938",
                                     geofenceLng: d.geofenceLng || "81.3509",
                                     geofenceRadius: d.geofenceRadius || "500"
                                  }));
                               }
                            }} 
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <Label className="text-[9px] font-black uppercase text-slate-400">Priority</Label>
                         <Select value={data.priority} onValueChange={v => setData({...data, priority: v})}>
                            <SelectTrigger className="h-10 bg-white border-slate-200 font-bold text-xs rounded-xl">
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                               <SelectItem value="Low">Low</SelectItem>
                               <SelectItem value="Medium">Medium</SelectItem>
                               <SelectItem value="High">High</SelectItem>
                            </SelectContent>
                         </Select>
                      </div>

                      {showPoints && (
                         <div className="space-y-1 animate-in fade-in duration-200">
                            <Label className="text-[9px] font-black uppercase text-slate-400">Points</Label>
                            <Input 
                              type="number"
                              className="h-10 bg-white border-slate-200 font-bold text-xs rounded-xl"
                              value={data.points}
                              onChange={e => setData({...data, points: parseInt(e.target.value) || 0})}
                            />
                         </div>
                      )}
                   </div>

                   {/* Interactive Geofence Map Picker */}
                   {showGeofence && (
                     <div className="animate-in fade-in duration-300">
                       <GeoFenceMapPicker
                         lat={data.geofenceLat}
                         lng={data.geofenceLng}
                         radius={data.geofenceRadius}
                         onUpdate={(latVal, lngVal, radVal) => {
                           setData(d => ({
                             ...d,
                             geofenceLat: latVal.toString(),
                             geofenceLng: lngVal.toString(),
                             geofenceRadius: radVal.toString()
                           }));
                         }}
                       />
                     </div>
                   )}

                   <div className="flex justify-end pt-2 border-t border-slate-200/50">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSaveTemplate}
                        className="h-10 rounded-xl text-xs font-bold gap-2 border-slate-200 hover:bg-slate-100"
                      >
                        <Save className="h-4 w-4 text-blue-600" /> Save as Template
                      </Button>
                   </div>
                </div>
              )}
            </div>
         </div>
      </div>
      
      <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-end gap-3 rounded-b-[32px]">
         <DialogClose asChild>
            <Button variant="ghost" className="h-12 rounded-xl text-xs font-bold uppercase tracking-wider px-6">Cancel</Button>
         </DialogClose>
         <Button 
          className="h-12 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 rounded-xl font-bold uppercase tracking-wider text-xs px-6"
           onClick={() => onSubmit({
             ...data,
             description: data.description || null,
             isRepeating: data.repeatFrequency !== "NONE",
             repeatDays: data.repeatDays.join(','),
             repeatDates: data.repeatDates.join(','),
             startDate: data.startDate ? new Date(data.startDate) : null,
             endDate: data.endDate ? new Date(data.endDate) : null,
             geofenceLat: data.geofenceLat ? parseFloat(data.geofenceLat) : null,
             geofenceLng: data.geofenceLng ? parseFloat(data.geofenceLng) : null,
             geofenceRadius: data.geofenceRadius ? parseFloat(data.geofenceRadius) : null,
             reminder: data.reminder ? parseInt(data.reminder) : null,
             subtasks: data.subtasks.map(s => ({
               ...s,
               startDate: s.startDate ? new Date(s.startDate) : null,
               endDate: s.endDate ? new Date(s.endDate) : null,
               geofenceLat: s.geofenceLat ? parseFloat(s.geofenceLat) : null,
               geofenceLng: s.geofenceLng ? parseFloat(s.geofenceLng) : null,
               geofenceRadius: s.geofenceRadius ? parseFloat(s.geofenceRadius) : null,
               reminder: s.reminder ? parseInt(s.reminder) : null
             }))
           })}
          disabled={isSubmitting || !data.title || !data.assignedToId}
         >
            {isSubmitting ? "Saving..." : "Save Changes"}
         </Button>
      </div>
    </DialogContent>
  );
}

function ViewTaskDetailsDialog({ task }: any) {
  if (!task) return null;

  return (
    <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close">
      <DialogHeader className="p-8 bg-slate-900 text-white relative">
        <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
           <X className="h-4 w-4" />
        </DialogClose>
        <div className="flex items-center gap-3 mb-2">
           <StatusBadge status={task.status} dueDate={task.dueDate} />
           <Badge variant="outline" className="border-white/20 text-white/60 text-[9px] font-black uppercase">Task ID: {task.id.slice(-6)}</Badge>
        </div>
        <DialogTitle className="text-2xl font-black">{task.title}</DialogTitle>
        <div className="flex items-center gap-4 mt-2">
           <p className="text-slate-400 text-xs font-bold">Created on {format(new Date(task.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
           <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase",
              task.isRepeating ? "bg-blue-500/20 text-blue-200" : "bg-slate-500/20 text-slate-300"
           )}>
              {task.isRepeating ? <RefreshCw className="h-3 w-3" /> : <CalendarIcon className="h-3 w-3" />}
               {task.isRepeating 
                 ? (task.repeatFrequency === 'DAILY' ? 'Every Day' : 
                    task.repeatFrequency === 'WEEKLY' ? `Every Week (${task.repeatDays?.split(',').map((d:any) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')})` : 
                    task.repeatFrequency === 'MONTHLY' ? `Every Month (${task.repeatDates})` : 
                    task.repeatFrequency)
                 : "No Repeat"}
               {task.skipHolidays && <span className="ml-1 opacity-60">(Skip Holidays)</span>}
           </div>
        </div>
      </DialogHeader>

      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="space-y-6">
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Description</Label>
               <p className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl min-h-[100px]">
                  {task.description || "No description provided."}
               </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Assigned To</Label>
                  <div className="flex items-center gap-2">
                     <Avatar className="h-6 w-6">
                        <AvatarImage src={task.assignedTo?.avatarUrl} />
                        <AvatarFallback className="bg-blue-600 text-white text-[8px] font-black">{task.assignedTo?.name?.slice(0, 1)}</AvatarFallback>
                     </Avatar>
                     <span className="text-xs font-bold text-slate-700">{task.assignedTo?.name}</span>
                  </div>
               </div>
               <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Due Date</Label>
                  <p className="text-xs font-bold text-slate-700">{format(new Date(task.dueDate), 'dd MMM yyyy')}</p>
               </div>
            </div>

            {task.status === "COMPLETED" && (
               <div className="space-y-2 pt-4 border-t border-slate-100">
                  <Label className="text-[10px] font-black uppercase text-blue-600">Completion Remarks</Label>
                  <p className="text-sm font-bold text-slate-800 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                     {task.completionRemarks || "No remarks provided."}
                  </p>
               </div>
            )}

            {task.attachmentUrl && (
               <div className="space-y-2 pt-4 border-t border-slate-100">
                  <Label className="text-[10px] font-black uppercase text-blue-600">Task Attachment</Label>
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/50 rounded-2xl">
                     <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                           {task.attachmentName?.split('.').pop()?.slice(0, 4) || 'FILE'}
                        </div>
                        <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{task.attachmentName || "Attachment"}</span>
                     </div>
                     <Button 
                       size="sm" 
                       variant="ghost" 
                       className="h-8 rounded-lg text-blue-600 hover:text-blue-700 font-bold text-xs gap-1"
                       onClick={() => window.open(task.attachmentUrl)}
                     >
                        <Download className="h-3.5 w-3.5" /> Download
                     </Button>
                  </div>
               </div>
            )}
         </div>

         <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase text-slate-400">Evidence / Attachments</Label>
            {task.completionPhotoUrl ? (
               <div className="relative aspect-square rounded-[24px] overflow-hidden border-4 border-slate-50 shadow-inner group">
                  <img 
                    src={task.completionPhotoUrl} 
                    alt="Task Completion" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                     <Button variant="secondary" size="sm" className="w-full rounded-xl font-bold" onClick={() => window.open(task.completionPhotoUrl)}>
                        Open Full Image
                     </Button>
                  </div>
               </div>
            ) : (
               <div className="aspect-square rounded-[24px] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                     <Eye className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider">No evidence uploaded</p>
                  <p className="text-[10px] mt-2 font-medium">Photo will appear here after staff completes the task.</p>
               </div>
            )}

            {task.checklistResponses && (task.checklistResponses as any[]).length > 0 && (
               <div className="space-y-3 pt-4 border-t border-slate-100">
                  <Label className="text-[10px] font-black uppercase text-blue-600">Checklist Responses</Label>
                  <div className="grid grid-cols-1 gap-4 max-h-[350px] overflow-y-auto pr-1">
                     {(task.checklistResponses as any[]).map((item: any, idx: number) => (
                        <div key={idx} className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2">
                           {item.type === "IMAGE" && item.fileUrl && (
                              <div className="space-y-1.5">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.title}</span>
                                 <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200/50 shadow-inner group">
                                    <img src={item.fileUrl} alt={item.title} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                       <Button size="sm" variant="secondary" className="h-7 text-[10px] px-2 font-black" onClick={() => window.open(item.fileUrl)}>OPEN</Button>
                                    </div>
                                 </div>
                              </div>
                           )}
                           {item.type === "VIDEO" && item.fileUrl && (
                              <div className="space-y-1.5 w-full">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.title}</span>
                                 <video src={item.fileUrl} controls className="w-full max-h-48 rounded-xl border border-slate-200/50 bg-black" />
                              </div>
                           )}
                           {item.type === "AUDIO" && item.fileUrl && (
                              <div className="space-y-1.5 w-full">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.title}</span>
                                 <audio src={item.fileUrl} controls className="w-full h-9" />
                              </div>
                           )}
                           {item.type === "FILE" && item.fileUrl && (
                              <div className="space-y-1.5 w-full">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.title}</span>
                                 <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[180px]">{item.fileName || "File"}</span>
                                    <Button size="sm" variant="ghost" className="h-8 text-blue-600 hover:text-blue-700 font-bold text-xs gap-1" onClick={() => window.open(item.fileUrl)}>
                                       Download
                                    </Button>
                                 </div>
                              </div>
                           )}
                           {item.type === "TEXT" && (
                              <div className="space-y-1.5">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.title}</span>
                                 <p className="text-xs font-bold text-slate-800 bg-white border border-slate-100 p-3 rounded-xl">{item.value}</p>
                              </div>
                           )}
                           {item.type === "DROPDOWN" && (
                              <div className="space-y-1.5">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.title}</span>
                                 <div>
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 uppercase tracking-wide">
                                       {item.value}
                                    </span>
                                 </div>
                              </div>
                           )}
                           {item.type === "GEOTAG" && (
                              <div className="space-y-1.5">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.title}</span>
                                 <div>
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="h-8 font-black text-xs gap-1.5 rounded-xl border-slate-200 hover:bg-slate-50" 
                                      onClick={() => window.open(`https://maps.google.com/?q=${item.value}`)}
                                    >
                                       📍 {item.value} (Open Maps)
                                    </Button>
                                 </div>
                              </div>
                           )}
                        </div>
                     ))}
                  </div>
                </div>
             )}
          </div>

          {task.subtasks && task.subtasks.length > 0 && (
             <div className="md:col-span-2 pt-6 border-t border-slate-100 space-y-4">
                <Label className="text-[10px] font-black uppercase text-slate-400">Subtasks ({task.subtasks.length})</Label>
                <div className="space-y-3">
                   {task.subtasks.map((sub: any) => (
                      <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200/50 rounded-2xl gap-3">
                         <div className="flex items-center gap-3">
                            <StatusBadge status={sub.status} dueDate={sub.dueDate} />
                            <div>
                               <p className="text-sm font-bold text-slate-800">{sub.title}</p>
                               {sub.description && <p className="text-xs font-medium text-slate-500 mt-0.5">{sub.description}</p>}
                            </div>
                         </div>
                         <div className="flex items-center gap-4 self-end sm:self-auto">
                            <div className="flex items-center gap-2">
                               <Avatar className="h-6 w-6">
                                  <AvatarImage src={sub.assignedTo?.avatarUrl} />
                                  <AvatarFallback className="bg-blue-600 text-white text-[8px] font-black">{sub.assignedTo?.name?.slice(0, 1)}</AvatarFallback>
                               </Avatar>
                               <span className="text-xs font-bold text-slate-700">{sub.assignedTo?.name}</span>
                            </div>
                            <div className="text-right shrink-0">
                               <p className="text-xs font-black text-slate-700">{sub.points} pts</p>
                               <p className="text-[10px] font-bold text-slate-400 mt-0.5">{format(new Date(sub.dueDate), 'dd MMM yyyy')}</p>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}
       </div>
    </DialogContent>
  );
}
