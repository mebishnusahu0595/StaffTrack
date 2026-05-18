"use client";

import React, { useState, useMemo } from "react";
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
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Hash,
  RefreshCw,
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTasks, deleteTask, updateTask, createTask as apiCreateTask, fetchUsers } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
type FilterType = "ALL" | "TODAYS" | "ONGOING" | "OVERDUE" | "MISSED" | "SCHEDULED" | "COMPLETE" | "GROUP" | "REPEAT" | "REVIEW" | "ISSUE" | "TRASHED";

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("LIST");
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<any>(null);
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
      // Format date for API
      return apiCreateTask({
        ...data,
        dueDate: new Date(data.dueDate).toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setIsCreateOpen(false);
      setActiveFilter("ALL"); // Switch to ALL to see the new task
    }
  });

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

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

    // Filter Logic
    const now = startOfDay(new Date());
    switch (activeFilter) {
      case "ALL":
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

    return filtered;
  }, [tasks, searchQuery, activeFilter, filterDate]);

  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page]);

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
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">TAMRAKAR GROUPS ( AGROTECH )</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
           </div>
           <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-50"><Lightbulb className="h-5 w-5 text-slate-400" /></Button>
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
                  />
               </Dialog>
           </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-180px)]">
        
        {/* Header Actions */}
        <div className="p-4 border-b border-slate-50 flex items-center justify-between gap-4">
           <div className="flex items-center gap-1 bg-[#f1f3f5] p-1 rounded-xl">
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
         <div className="p-4 flex items-center justify-end gap-3 bg-white">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-xl border border-slate-100">
               <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
               <input 
                 type="date" 
                 className="bg-transparent border-none text-[10px] font-bold text-slate-600 focus:outline-none"
                 value={filterDate}
                 onChange={e => setFilterDate(e.target.value)}
               />
               {filterDate && (
                 <button onClick={() => setFilterDate("")} className="text-slate-400 hover:text-rose-500">
                    <X className="h-3 w-3" />
                 </button>
               )}
            </div>
            <Button variant="ghost" size="sm" className="h-9 rounded-lg text-slate-500 font-bold gap-2 hover:bg-slate-50">
               <Filter className="h-4 w-4" /> Filter
            </Button>
           <Button variant="ghost" size="sm" className="h-9 rounded-lg text-slate-500 font-bold gap-2 hover:bg-slate-50">
              <Hash className="h-4 w-4" /> View
           </Button>
        </div>

        {/* The Table */}
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
              ) : paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest bg-slate-50/10">
                    No tasks found matching current filters
                  </td>
                </tr>
              ) : paginatedTasks.map((task) => (
                <tr key={task.id} className="group hover:bg-[#f1f3f5]/30 transition-colors">
                  <td className="py-4 px-6"><input type="checkbox" className="rounded border-slate-300" /></td>
                  <td className="py-4 px-4">
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
                               : "Particular Date"}
                          </span>
                       </div>
                       <div>
                          <p className="text-sm font-bold text-slate-700 leading-tight flex items-center gap-2">
                             {task.title}
                          </p>
                       </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
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
                  <td className="py-4 px-4">
                    <span className="text-xs font-bold text-slate-500">{task.assignedTo?.managerId ? "Agrotech" : "Agrotech"}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex justify-center">
                       <StatusBadge status={task.status} dueDate={task.dueDate} />
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="inline-flex items-center justify-center h-7 w-12 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black">
                       {task.points || 0}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <Badge variant="outline" className={cn(
                       "text-[10px] font-black uppercase tracking-widest px-2 py-0.5",
                       task.priority === "High" ? "border-rose-200 text-rose-600 bg-rose-50" :
                       task.priority === "Medium" ? "border-amber-200 text-amber-600 bg-amber-50" :
                       "border-emerald-200 text-emerald-600 bg-emerald-50"
                    )}>
                       {task.priority || "Medium"}
                    </Badge>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-[10px] font-bold text-slate-400">{format(new Date(task.createdAt), 'dd-MM-yyyy, hh:mm a')}</span>
                  </td>
                  <td className="py-4 px-6 text-right">
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
                           <DropdownMenuContent align="end" className="w-40 rounded-xl">
                              <DropdownMenuItem className="text-xs font-bold gap-2">Edit Task</DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-xs font-bold gap-2 text-rose-500"
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
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <ViewTaskDetailsDialog task={viewingTask} />
      </Dialog>
    </div>
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
  const isOverdue = isBefore(new Date(dueDate), startOfDay(new Date())) && status !== "COMPLETED";
  
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
}
function CreateTaskDialog({ users, onSubmit, isSubmitting }: any) {
  const [data, setData] = useState({ 
    title: "", 
    description: "", 
    assignedToId: "", 
    dueDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    priority: "Medium",
    points: 10,
    repeatFrequency: "NONE",
    repeatDays: [] as number[],
    repeatDates: [] as number[],
    skipHolidays: false
  });

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

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px]">
      <DialogHeader className="p-8 bg-blue-600 text-white relative">
        <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
           <X className="h-4 w-4" />
        </DialogClose>
        <DialogTitle className="text-2xl font-black">Create New Task</DialogTitle>
        <p className="text-blue-100 text-xs font-bold mt-1">Assign a new task to your team members.</p>
      </DialogHeader>
      <div className="p-8 space-y-6">
         <div className="space-y-4">
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Task Title</Label>
               <Input 
                 placeholder="e.g. Site Visit & Audit" 
                 className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                 value={data.title}
                 onChange={e => setData({...data, title: e.target.value})}
               />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Assign To</Label>
                  <Select value={data.assignedToId} onValueChange={v => setData({...data, assignedToId: v})}>
                     <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                        <SelectValue placeholder="Select Staff" />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl">
                        {users?.map((u: any) => (
                           <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Due Date</Label>
                  <Input 
                    type="date"
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                    value={data.dueDate}
                    onChange={e => setData({...data, dueDate: e.target.value})}
                  />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Priority</Label>
                  <Select value={data.priority} onValueChange={v => setData({...data, priority: v})}>
                     <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl">
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Points</Label>
                  <Input 
                    type="number"
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                    value={data.points}
                    onChange={e => setData({...data, points: parseInt(e.target.value)})}
                  />
               </div>
            </div>

            <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400">Repeat Task (Recurring)</Label>
                <Select value={data.repeatFrequency} onValueChange={v => setData({...data, repeatFrequency: v})}>
                   <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                      <SelectValue />
                   </SelectTrigger>
                   <SelectContent className="rounded-2xl">
                      <SelectItem value="NONE">No Repeat</SelectItem>
                      <SelectItem value="DAILY">Every Day</SelectItem>
                      <SelectItem value="WEEKLY">Every Week</SelectItem>
                      <SelectItem value="MONTHLY">Every Month</SelectItem>
                   </SelectContent>
                </Select>

                {data.repeatFrequency === 'WEEKLY' && (
                  <div className="p-4 bg-slate-50 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-1">
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
                  <div className="p-4 bg-slate-50 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-1">
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

                {(data.repeatFrequency !== 'NONE') && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                    <input 
                      type="checkbox" 
                      id="skipHolidays"
                      className="h-4 w-4 rounded border-blue-200 text-blue-600"
                      checked={data.skipHolidays}
                      onChange={e => setData({...data, skipHolidays: e.target.checked})}
                    />
                    <Label htmlFor="skipHolidays" className="text-[10px] font-black uppercase text-blue-700 cursor-pointer">Skip Holidays</Label>
                  </div>
                )}
             </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Description</Label>
               <Textarea 
                 placeholder="Briefly describe the task..." 
                 className="min-h-[80px] rounded-2xl bg-slate-50 border-none font-medium resize-none" 
                 value={data.description}
                 onChange={e => setData({...data, description: e.target.value})}
               />
            </div>
         </div>
         <Button 
          className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 rounded-2xl font-black uppercase tracking-widest text-xs"
           onClick={() => onSubmit({
             ...data,
             isRepeating: data.repeatFrequency !== "NONE",
             repeatDays: data.repeatDays.join(','),
             repeatDates: data.repeatDates.join(','),
           })}
          disabled={isSubmitting || !data.title || !data.assignedToId}
         >
            {isSubmitting ? "Creating..." : "Create Task"}
         </Button>
      </div>
    </DialogContent>
  );
}
function ViewTaskDetailsDialog({ task }: any) {
  if (!task) return null;

  return (
    <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px]">
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
         </div>
      </div>
    </DialogContent>
  );
}
