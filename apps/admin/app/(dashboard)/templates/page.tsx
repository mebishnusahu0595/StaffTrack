"use client";

import React, { useState, useRef, useMemo } from "react";
import { 
  Library, 
  Plus, 
  Search, 
  Download,
  Filter,
  Eye,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  History,
  Zap,
  Star,
  Layers,
  FileText,
  Send,
  Edit2,
  Trash2,
  CalendarOff,
  Pencil,
  ChevronDown,
  CheckCircle2,
  RefreshCw,
  Bell,
  ListTodo,
  Paperclip,
  Loader2,
  Save,
  Folder
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GeoFenceMapPicker } from "@/components/admin/geofence-map-picker";
import axios from "axios";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchTemplates, 
  createTemplate, 
  createTask, 
  fetchUsers,
  updateTemplate,
  deleteTemplateTasks,
  deleteTemplate,
  cleanupTemplateDuplicates
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import dayjs from "dayjs";

export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Tasks");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [viewTemplate, setViewTemplate] = useState<any>(null);
  const [assignTemplate, setAssignTemplate] = useState<any>(null);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [deleteTasksTemplate, setDeleteTasksTemplate] = useState<any>(null);
  const [deleteTemplateItem, setDeleteTemplateItem] = useState<any>(null);
  const [cleanupTemplate, setCleanupTemplate] = useState<any>(null);
  
  // Custom filters
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [recurrenceFilter, setRecurrenceFilter] = useState("All");

  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ["templates", search, activeTab],
    queryFn: () => fetchTemplates({ search, type: activeTab === "Tasks" ? "Task" : "Project" })
  });

  const usersQuery = useQuery({
    queryKey: ["users-all-list"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 1000, role: "ALL" })
  });
  const users = usersQuery.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setIsCreateOpen(false);
      setIsCopyOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: {id: string, payload: any}) => updateTemplate(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setEditTemplate(null);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to update template");
    }
  });

  const deleteTasksMutation = useMutation({
    mutationFn: (data: {id: string, option: string}) => deleteTemplateTasks(data.id, data.option),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setDeleteTasksTemplate(null);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to delete tasks");
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (data: {id: string, option: string}) => deleteTemplate(data.id, data.option),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setDeleteTemplateItem(null);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to delete template");
    }
  });

  const cleanupMutation = useMutation({
    mutationFn: (id: string) => cleanupTemplateDuplicates(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setCleanupTemplate(null);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to cleanup duplicates");
    }
  });

  const templates = templatesQuery.data ?? [];

  // Filter client-side
  const displayedTemplates = templates.filter(tpl => {
    const matchPriority = priorityFilter === "All" || tpl.priority === priorityFilter;
    const matchRecurrence = recurrenceFilter === "All" || (tpl.recurrence || "None") === recurrenceFilter;
    return matchPriority && matchRecurrence;
  });

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 text-left">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <History className="h-3 w-3" />
            <span>Home / Template Library</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Blueprint Repository
            <Badge variant="outline" className="h-6 px-2 rounded-lg border-blue-100 bg-blue-50/50 text-blue-600 font-bold">
              {displayedTemplates.length} Active
            </Badge>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
           <Dialog open={isCopyOpen} onOpenChange={setIsCopyOpen}>
             <DialogTrigger asChild>
                <Button variant="outline" className="h-12 rounded-2xl border-slate-200 font-bold text-slate-600 gap-2 px-6">
                   <Zap className="h-4 w-4 text-amber-500" /> Copy Template
                </Button>
             </DialogTrigger>
             <CopyTemplateDialog 
               templates={templates}
               onSubmit={(data: any) => createMutation.mutate(data)}
               isSubmitting={createMutation.isPending}
             />
           </Dialog>

           <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
             <DialogTrigger asChild>
               <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-emerald-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs">
                 <Plus className="h-5 w-5" /> Create
               </Button>
             </DialogTrigger>
             <CreateTemplateDialog 
               users={users}
               onSubmit={(data: any) => createMutation.mutate(data)}
               isSubmitting={createMutation.isPending}
             />
           </Dialog>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-6 bg-white p-4 rounded-[32px] border border-slate-200/60 shadow-sm flex-wrap md:flex-nowrap">
         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="bg-slate-100 p-1 rounded-2xl h-12">
               {["Tasks", "Projects"].map(tab => (
                  <TabsTrigger 
                  key={tab} 
                  value={tab} 
                  className="rounded-xl px-10 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
                  >
                     {tab}
                  </TabsTrigger>
               ))}
            </TabsList>
         </Tabs>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search templates..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-12 border-none bg-slate-50 rounded-2xl font-bold focus:bg-slate-100/50 transition-all text-xs" 
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Priority:</span>
           <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-12 w-28 rounded-2xl bg-slate-50 border-none font-bold text-xs text-left">
                 <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                 <SelectItem value="All">All Priorities</SelectItem>
                 <SelectItem value="Low">Low</SelectItem>
                 <SelectItem value="Medium">Medium</SelectItem>
                 <SelectItem value="High">High</SelectItem>
              </SelectContent>
           </Select>
        </div>

        {/* Recurrence Filter */}
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Recurrence:</span>
           <Select value={recurrenceFilter} onValueChange={setRecurrenceFilter}>
              <SelectTrigger className="h-12 w-32 rounded-2xl bg-slate-50 border-none font-bold text-xs text-left">
                 <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                 <SelectItem value="All">All Recurrences</SelectItem>
                 <SelectItem value="None">None</SelectItem>
                 <SelectItem value="Daily">Daily</SelectItem>
                 <SelectItem value="Weekly">Weekly</SelectItem>
                 <SelectItem value="Monthly">Monthly</SelectItem>
              </SelectContent>
           </Select>
        </div>
      </div>

      {/* Templates Table */}
      <Card className="rounded-[40px] border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
        <CardContent className="p-0">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Template Name</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Priority</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Start Time</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Due Time</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Recurrence</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Created By</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Created On</th>
                       <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {displayedTemplates.map(template => (
                       <tr key={template.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-3">
                                <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{template.name}</p>
                             </div>
                          </td>
                          <td className="py-6 text-center">
                             <Badge className={cn(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded border",
                                template.priority === 'High' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                                template.priority === 'Medium' ? 'bg-amber-55 text-amber-600 border-amber-100' :
                                'bg-slate-50 text-slate-500 border-slate-100'
                             )}>
                                {template.priority}
                             </Badge>
                          </td>
                          <td className="py-6 text-xs font-bold text-slate-500">{template.startTime || '06:00 PM'}</td>
                          <td className="py-6 text-xs font-bold text-slate-500">{template.dueTime || '07:30 PM'}</td>
                          <td className="py-6 text-xs font-bold text-slate-400">{template.recurrence || 'None'}</td>
                          <td className="py-6">
                             <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center text-[8px] font-black text-white">S</div>
                                <span className="text-xs font-bold text-slate-600">{template.createdBy?.name || "System"}</span>
                             </div>
                          </td>
                          <td className="py-6 text-xs font-bold text-slate-500">{dayjs(template.createdAt).format("DD-MM-YYYY")}</td>
                          <td className="px-8 py-6 text-right">
                               <div className="flex items-center justify-end gap-1">
                                 <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                       <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-400">
                                          <MoreHorizontal className="h-4 w-4" />
                                       </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 border-slate-100 shadow-xl">
                                       <DropdownMenuItem onClick={() => setAssignTemplate(template)} className="text-xs font-bold gap-2 cursor-pointer p-2 rounded-xl text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50">
                                          <Send className="h-4 w-4" /> Assign Blueprint
                                       </DropdownMenuItem>
                                       <DropdownMenuItem onClick={() => setViewTemplate(template)} className="text-xs font-bold gap-2 cursor-pointer p-2 rounded-xl text-slate-600 focus:text-slate-600 focus:bg-slate-50">
                                          <Eye className="h-4 w-4" /> View Details
                                       </DropdownMenuItem>
                                       <DropdownMenuItem onClick={() => setEditTemplate(template)} className="text-xs font-bold gap-2 cursor-pointer p-2 rounded-xl text-blue-600 focus:text-blue-600 focus:bg-blue-50">
                                          <Edit2 className="h-4 w-4" /> Edit Template
                                       </DropdownMenuItem>
                                       <DropdownMenuItem onClick={() => {
                                          const confirmCopy = confirm(`Do you want to duplicate "${template.name}"?`);
                                          if (confirmCopy) {
                                             createMutation.mutate({
                                                name: `${template.name} - Copy`,
                                                type: template.type || "Task",
                                                priority: template.priority || "Medium",
                                                recurrence: template.recurrence || "None",
                                                startTime: template.startTime || "06:00 PM",
                                                dueTime: template.dueTime || "07:30 PM",
                                                description: template.description || "",
                                                data: template.data || "{}"
                                             });
                                          }
                                       }} className="text-xs font-bold gap-2 cursor-pointer p-2 rounded-xl text-amber-600 focus:text-amber-600 focus:bg-amber-50">
                                          <Zap className="h-4 w-4" /> Clone Template
                                       </DropdownMenuItem>
                                       <DropdownMenuSeparator />
                                       <DropdownMenuItem onClick={() => setCleanupTemplate(template)} className="text-xs font-bold gap-2 cursor-pointer p-2 rounded-xl text-purple-600 focus:text-purple-600 focus:bg-purple-50">
                                          <Layers className="h-4 w-4" /> Cleanup Duplicates
                                       </DropdownMenuItem>
                                       <DropdownMenuItem onClick={() => setDeleteTasksTemplate(template)} className="text-xs font-bold gap-2 cursor-pointer p-2 rounded-xl text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                                          <CalendarOff className="h-4 w-4" /> Bulk Delete Tasks
                                       </DropdownMenuItem>
                                       <DropdownMenuItem onClick={() => setDeleteTemplateItem(template)} className="text-xs font-bold gap-2 cursor-pointer p-2 rounded-xl text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                                          <Trash2 className="h-4 w-4" /> Delete Template
                                       </DropdownMenuItem>
                                    </DropdownMenuContent>
                                 </DropdownMenu>
                              </div>
                           </td>
                       </tr>
                    ))}
                    {displayedTemplates.length === 0 && (
                       <tr>
                          <td colSpan={8} className="py-32 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                             No templates found in library
                          </td>
                       </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </CardContent>
        <div className="p-8 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing {displayedTemplates.length} Of {displayedTemplates.length} Result</p>
           <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-white"><ChevronLeft className="h-4 w-4" /></Button>
              <div className="h-8 w-8 rounded-lg bg-white border border-emerald-600 text-emerald-600 flex items-center justify-center text-xs font-black">1</div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-white"><ChevronRight className="h-4 w-4" /></Button>
           </div>
        </div>
      </Card>
      
      <ViewTemplateDialog
        template={viewTemplate}
        open={!!viewTemplate}
        onOpenChange={(open: boolean) => !open && setViewTemplate(null)}
      />
      
      <AssignTemplateDialog
        template={assignTemplate}
        open={!!assignTemplate}
        onOpenChange={(open: boolean) => !open && setAssignTemplate(null)}
      />
      <EditTemplateDialog
        template={editTemplate}
        users={users}
        open={!!editTemplate}
        onOpenChange={(open: boolean) => !open && setEditTemplate(null)}
        onSubmit={(data: any) => updateMutation.mutate({ id: editTemplate.id, payload: data })}
        isSubmitting={updateMutation.isPending}
      />

      <DeleteTasksDialog
        template={deleteTasksTemplate}
        open={!!deleteTasksTemplate}
        onOpenChange={(open: boolean) => !open && setDeleteTasksTemplate(null)}
        onSubmit={(option: string) => deleteTasksMutation.mutate({ id: deleteTasksTemplate.id, option })}
        isSubmitting={deleteTasksMutation.isPending}
      />

      <DeleteTemplateDialog
        template={deleteTemplateItem}
        open={!!deleteTemplateItem}
        onOpenChange={(open: boolean) => !open && setDeleteTemplateItem(null)}
        onSubmit={(option: string) => deleteTemplateMutation.mutate({ id: deleteTemplateItem.id, option })}
        isSubmitting={deleteTemplateMutation.isPending}
      />

      <CleanupDuplicatesDialog
        template={cleanupTemplate}
        open={!!cleanupTemplate}
        onOpenChange={(open: boolean) => !open && setCleanupTemplate(null)}
        onSubmit={() => cleanupMutation.mutate(cleanupTemplate.id)}
        isSubmitting={cleanupMutation.isPending}
      />
    </div>
  );
}

const TASK_VALIDATION_TYPES = [
  { label: "Video", val: "VIDEO" },
  { label: "Audio", val: "AUDIO" },
  { label: "Image", val: "IMAGE" },
  { label: "File", val: "FILE" },
  { label: "Text", val: "TEXT" },
  { label: "Dropdown", val: "DROPDOWN" },
  { label: "Geo Tag", val: "GEOTAG" }
];
// Checklist items must not offer the "Dropdown" validation.
const CHECKLIST_VALIDATION_TYPES = TASK_VALIDATION_TYPES.filter(v => v.val !== "DROPDOWN");

function emptyTemplateConfig() {
  return {
    points: 10,
    validations: [] as string[],
    checklist: [] as Array<{ id: string; title: string; required: boolean; validations: string[] }>,
    geofenceLat: "",
    geofenceLng: "",
    geofenceRadius: "",
    reminder: ""
  };
}

function parseTemplateConfig(raw: any) {
  let cfg: any = {};
  try {
    cfg = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw || {});
  } catch {
    cfg = {};
  }
  return {
    ...emptyTemplateConfig(),
    ...cfg,
    points: cfg.points ?? 10,
    validations: Array.isArray(cfg.validations) ? cfg.validations : [],
    checklist: Array.isArray(cfg.checklist) ? cfg.checklist : [],
    geofenceLat: cfg.geofenceLat ?? "",
    geofenceLng: cfg.geofenceLng ?? "",
    geofenceRadius: cfg.geofenceRadius ?? "",
    reminder: cfg.reminder ?? ""
  };
}

// Reusable task-config builder (points / validations / checklist) shared by the
// template Create and Edit dialogs so a template carries the same setup as a task.
function TemplateTaskConfig({ config, setConfig }: { config: any; setConfig: (updater: (c: any) => any) => void }) {
  const toggleValidation = (val: string) => {
    setConfig(c => ({
      ...c,
      validations: c.validations.includes(val)
        ? c.validations.filter((v: string) => v !== val)
        : [...c.validations, val]
    }));
  };
  const addItem = () => {
    setConfig(c => ({
      ...c,
      checklist: [...c.checklist, { id: Math.random().toString(36).slice(2), title: "", required: true, validations: [] }]
    }));
  };
  const removeItem = (id: string) => {
    setConfig(c => ({ ...c, checklist: c.checklist.filter((i: any) => i.id !== id) }));
  };
  const updateItem = (id: string, updates: any) => {
    setConfig(c => ({ ...c, checklist: c.checklist.map((i: any) => i.id === id ? { ...i, ...updates } : i) }));
  };
  const toggleItemValidation = (id: string, val: string) => {
    setConfig(c => ({
      ...c,
      checklist: c.checklist.map((i: any) => {
        if (i.id !== id) return i;
        const vals = (i.validations || []).includes(val)
          ? i.validations.filter((v: string) => v !== val)
          : [...(i.validations || []), val];
        return { ...i, validations: vals };
      })
    }));
  };

  return (
    <div className="space-y-4 border-t border-slate-100 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-slate-400">Points</Label>
          <Input
            type="number"
            className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs"
            value={config.points}
            onChange={e => setConfig(c => ({ ...c, points: parseInt(e.target.value) || 0 }))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-slate-400">Reminder (mins before)</Label>
          <Input
            type="number"
            placeholder="e.g. 30"
            className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs"
            value={config.reminder}
            onChange={e => setConfig(c => ({ ...c, reminder: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase text-slate-400">Ask Validations (completion proof)</Label>
        <div className="flex flex-wrap gap-3 bg-slate-50 rounded-2xl p-3 border border-slate-100">
          {TASK_VALIDATION_TYPES.map(v => (
            <label key={v.val} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={config.validations.includes(v.val)} onChange={() => toggleValidation(v.val)} className="rounded border-slate-300 text-emerald-600" />
              {v.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase text-slate-400">Checklist Items</Label>
          <button type="button" onClick={addItem} className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700">+ Add Checklist Item</button>
        </div>
        {config.checklist.length === 0 && (
          <p className="text-center text-[10px] font-bold text-slate-400 py-2">No checklist items. Click add to begin.</p>
        )}
        {config.checklist.map((item: any) => (
          <div key={item.id} className="p-3 bg-white border border-slate-100 rounded-xl space-y-3 relative">
            <button type="button" onClick={() => removeItem(item.id)} className="absolute right-2 top-2 text-slate-400 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-500 cursor-pointer shrink-0">
                <input type="checkbox" checked={item.required} onChange={e => updateItem(item.id, { required: e.target.checked })} className="rounded border-slate-300 text-emerald-600" />
                Required
              </label>
              <Input
                placeholder="Enter field title here"
                className="h-9 border-none bg-slate-50 font-bold text-xs rounded-lg flex-1"
                value={item.title}
                onChange={e => updateItem(item.id, { title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[8px] font-black uppercase text-slate-400">Validations</span>
              <div className="flex flex-wrap gap-3">
                {CHECKLIST_VALIDATION_TYPES.map(v => (
                  <label key={v.val} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={(item.validations || []).includes(v.val)} onChange={() => toggleItemValidation(item.id, v.val)} className="rounded border-slate-300 text-emerald-600" />
                    {v.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-[9px] font-black uppercase text-slate-400">Geofence Lat</Label>
          <Input className="h-10 rounded-xl bg-slate-50 border-none font-bold text-[11px]" value={config.geofenceLat} onChange={e => setConfig(c => ({ ...c, geofenceLat: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] font-black uppercase text-slate-400">Geofence Lng</Label>
          <Input className="h-10 rounded-xl bg-slate-50 border-none font-bold text-[11px]" value={config.geofenceLng} onChange={e => setConfig(c => ({ ...c, geofenceLng: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] font-black uppercase text-slate-400">Radius (m)</Label>
          <Input className="h-10 rounded-xl bg-slate-50 border-none font-bold text-[11px]" value={config.geofenceRadius} onChange={e => setConfig(c => ({ ...c, geofenceRadius: e.target.value }))} />
        </div>
      </div>
    </div>
  );
}

function CreateTemplateDialog({ onSubmit, isSubmitting, users }: any) {
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
    name: "",
    type: "Task",
    priority: "Medium",
    recurrence: "None",
    startTime: "09:00",
    dueTime: "18:00",
    description: "",
    points: 10,
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
          startDate: dayjs().format("YYYY-MM-DD"),
          endDate: dayjs().add(1, "day").format("YYYY-MM-DD"),
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

  const handleSubmit = () => {
    onSubmit({
      name: data.name,
      type: data.type,
      priority: data.priority,
      recurrence: data.recurrence,
      startTime: data.startTime,
      dueTime: data.dueTime,
      description: data.description,
      data: JSON.stringify({
        description: data.description,
        points: data.points,
        validations: data.validations,
        checklist: data.checklist,
        geofenceLat: data.geofenceLat,
        geofenceLng: data.geofenceLng,
        geofenceRadius: data.geofenceRadius,
        reminder: data.reminder,
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        repeatFrequency: data.recurrence === "None" ? "NONE" : data.recurrence.toUpperCase(),
        repeatDays: data.repeatDays,
        repeatDates: data.repeatDates,
        skipHolidays: data.skipHolidays,
        subtasks: data.subtasks
      })
    });
  };

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close max-h-[85vh] flex flex-col text-left">
      <DialogHeader className="p-6 bg-emerald-50/50 border-b border-emerald-100 relative shrink-0">
        <DialogClose className="absolute right-6 top-6 rounded-xl bg-slate-200/50 p-1.5 text-slate-600 hover:bg-slate-300 transition-all">
           <X className="h-4 w-4" />
        </DialogClose>
        <DialogTitle className="text-xl font-bold text-slate-800 flex items-center">New Template</DialogTitle>
        <p className="text-slate-500 text-xs font-semibold mt-0.5">Design a reusable blueprint with comprehensive task settings.</p>
      </DialogHeader>
      
      <div className="p-6 space-y-6 overflow-y-auto flex-1">
         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Type</Label>
                  <Select value={data.type} onValueChange={t => setData({...data, type: t})}>
                     <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                        <SelectItem value="Task">Task</SelectItem>
                        <SelectItem value="Project">Project</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Priority</Label>
                  <Select value={data.priority} onValueChange={p => setData({...data, priority: p})}>
                     <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Template Name*</Label>
               <div className="relative flex items-center">
                  <span className="absolute left-4 w-3.5 h-3.5 rounded bg-emerald-600 shrink-0" />
                  <Input 
                    placeholder="Enter template name" 
                    className="h-12 pl-10 rounded-2xl bg-slate-50 border-none font-bold" 
                    value={data.name}
                    onChange={e => setData({...data, name: e.target.value})}
                  />
               </div>
            </div>

            <div className="space-y-2">
               <button 
                 type="button" 
                 onClick={() => setShowDescription(!showDescription)}
                 className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
               >
                 {showDescription ? "- Remove Description" : "+ Add Description (optional)"}
               </button>
               {showDescription && (
                  <Textarea 
                    placeholder="Enter description here..." 
                    className="min-h-[80px] rounded-2xl bg-slate-50 border-none font-medium resize-none" 
                    value={data.description}
                    onChange={e => setData({...data, description: e.target.value})}
                  />
               )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-emerald-500" /> Default Task Attachment
              </Label>
              {data.attachmentUrl ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl animate-in fade-in duration-200">
                  <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-xs uppercase">
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
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                      Uploading Attachment...
                    </span>
                    <span>{fileUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-600 h-1.5 rounded-full transition-all duration-150" style={{ width: `${fileUploadProgress}%` }}></div>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer group transition-all duration-200">
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <div className="h-9 w-9 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:scale-110 transition-all mb-2">
                      <Paperclip className="h-4 w-4" />
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 group-hover:text-emerald-600 transition-colors">Click to attach document</p>
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
                  <Label className="text-[10px] font-black uppercase text-slate-400">Default Start Time</Label>
                  <Input 
                    type="time" 
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                    value={data.startTime}
                    onChange={e => setData({...data, startTime: e.target.value})}
                  />
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Default Due Time</Label>
                  <Input 
                    type="time" 
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                    value={data.dueTime}
                    onChange={e => setData({...data, dueTime: e.target.value})}
                  />
               </div>
            </div>

            <div className="flex gap-2 flex-wrap pt-2">
               <Button 
                 type="button"
                 variant="outline"
                 onClick={() => setShowValidations(!showValidations)}
                 className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showValidations && "bg-emerald-50/50 border-emerald-200 text-emerald-700")}
               >
                 <CheckCircle2 className="h-4 w-4" /> Ask Validations
               </Button>

               <Button 
                 type="button"
                 variant="outline"
                 onClick={() => setShowRepeat(!showRepeat)}
                 className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showRepeat && "bg-emerald-50/50 border-emerald-200 text-emerald-700")}
               >
                 <RefreshCw className="h-4 w-4" /> Repeat
               </Button>

               <Button 
                 type="button"
                 variant="outline"
                 onClick={() => setShowReminder(!showReminder)}
                 className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showReminder && "bg-emerald-50/50 border-emerald-200 text-emerald-700")}
               >
                 <Bell className="h-4 w-4" /> Reminder
               </Button>
            </div>

            {showValidations && (
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100 animate-in fade-in slide-in-from-top-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Require Completion Proof (Select Validations)</Label>
                <div className="flex flex-wrap gap-4">
                  {TASK_VALIDATION_TYPES.map(v => (
                    <label key={v.val} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={data.validations.includes(v.val)}
                        onChange={() => toggleValidation(v.val)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
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
                 <Select value={data.recurrence} onValueChange={v => setData({...data, recurrence: v})}>
                    <SelectTrigger className="h-10 bg-white border-slate-200 font-bold text-xs rounded-xl">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                       <SelectItem value="None">No Repeat</SelectItem>
                       <SelectItem value="Daily">Every Day</SelectItem>
                       <SelectItem value="Weekly">Every Week</SelectItem>
                       <SelectItem value="Monthly">Every Month</SelectItem>
                    </SelectContent>
                 </Select>

                 {data.recurrence === 'Weekly' && (
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
                             data.repeatDays.includes(i) ? "bg-emerald-600 text-white" : "bg-white text-slate-400 border border-slate-200"
                           )}
                         >
                           {name}
                         </button>
                       ))}
                     </div>
                   </div>
                 )}

                 {data.recurrence === 'Monthly' && (
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
                             data.repeatDates.includes(date) ? "bg-emerald-600 text-white" : "bg-white text-slate-400 border border-slate-200"
                           )}
                         >
                           {date}
                         </button>
                       ))}
                     </div>
                   </div>
                 )}

                 {data.recurrence !== 'None' && (
                   <div className="flex items-center gap-3 p-3 bg-emerald-50/30 rounded-xl border border-emerald-100/50">
                     <input 
                       type="checkbox" 
                       id="skipHolidays"
                       className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                       checked={data.skipHolidays}
                       onChange={e => setData({...data, skipHolidays: e.target.checked})}
                     />
                     <Label htmlFor="skipHolidays" className="text-[10px] font-black uppercase text-emerald-700 cursor-pointer">Skip Holidays</Label>
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
                <ListTodo className="h-4 w-4 text-emerald-600" />
                {showChecklist ? "Hide Checklist Setup" : "Build Checklist"}
              </button>

              {showChecklist && (
                <div className="mt-3 space-y-4 p-4 bg-[#fcfdfd] border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-1">
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                     <span className="text-[10px] font-black uppercase text-slate-400">Checklist Items</span>
                     <button 
                       type="button" 
                       onClick={addChecklistField} 
                       className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700"
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
                               className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
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
                              {CHECKLIST_VALIDATION_TYPES.map(v => (
                                 <label key={v.val} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer">
                                   <input
                                     type="checkbox"
                                     checked={item.validations.includes(v.val)}
                                     onChange={() => toggleChecklistItemValidation(item.id, v.val)}
                                     className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
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
                <Plus className="h-4 w-4 text-emerald-600" />
                {showSubtasks ? "Hide Sub Tasks" : "Add Sub Task"}
              </button>

              {showSubtasks && (
                <div className="mt-3 space-y-4 p-4 bg-[#fcfdfd] border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-1">
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                     <span className="text-[10px] font-black uppercase text-slate-400">Sub Tasks</span>
                     <button 
                       type="button" 
                       onClick={addSubtask} 
                       className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700"
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
                             <button type="button" onClick={() => { const newCl = [...(sub.checklist||[]),{id:Math.random().toString(36).slice(2),title:"",required:true,validations:[]}]; updateSubtask(sub.id,{checklist:newCl}); }} className="text-[9px] font-black uppercase text-emerald-600 hover:text-emerald-700">+ Add Question</button>
                           </div>
                           {(sub.checklist||[]).map((ci:any)=>(
                             <div key={ci.id} className="p-2 bg-slate-50 rounded-lg mb-2 space-y-2 relative border border-slate-100">
                               <button type="button" onClick={()=>updateSubtask(sub.id,{checklist:(sub.checklist||[]).filter((c:any)=>c.id!==ci.id)})} className="absolute right-2 top-2 text-slate-400 hover:text-rose-500"><X className="h-3 w-3"/></button>
                               <div className="flex items-center gap-3 pr-6">
                                 <label className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 cursor-pointer shrink-0"><input type="checkbox" checked={ci.required} onChange={e=>updateSubtask(sub.id,{checklist:(sub.checklist||[]).map((c:any)=>c.id===ci.id?{...c,required:e.target.checked}:c)})} className="rounded border-slate-300"/> Required</label>
                                 <Input placeholder="Question title" className="h-8 border-none bg-white font-bold text-xs rounded-lg flex-1" value={ci.title} onChange={e=>updateSubtask(sub.id,{checklist:(sub.checklist||[]).map((c:any)=>c.id===ci.id?{...c,title:e.target.value}:c)})}/>
                               </div>
                               <div className="flex flex-wrap gap-2">
                                 {CHECKLIST_VALIDATION_TYPES.map(v=>(<label key={v.val} className="flex items-center gap-1 text-[9px] font-bold text-slate-600 cursor-pointer"><input type="checkbox" checked={(ci.validations||[]).includes(v.val)} onChange={()=>{const nv=(ci.validations||[]).includes(v.val)?(ci.validations||[]).filter((x:string)=>x!==v.val):[...(ci.validations||[]),v.val];updateSubtask(sub.id,{checklist:(sub.checklist||[]).map((c:any)=>c.id===ci.id?{...c,validations:nv}:c)});}} className="rounded border-slate-300"/> {v.label}</label>))}
                               </div>
                             </div>
                           ))}
                           {(!sub.checklist||sub.checklist.length===0)&&<p className="text-[9px] text-slate-400 font-bold text-center py-1">No questions yet.</p>}
                         </div>
                        <div className="space-y-2">
                           <span className="text-[8px] font-black uppercase text-slate-400">Subtask Validations</span>
                           <div className="flex flex-wrap gap-3">
                              {TASK_VALIDATION_TYPES.map(v => (
                                 <label key={v.val} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer">
                                   <input 
                                     type="checkbox"
                                     checked={sub.validations.includes(v.val)}
                                     onChange={() => toggleSubtaskValidation(sub.id, v.val)}
                                     className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
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
                      {showPoints && (
                         <div className="space-y-1 animate-in fade-in duration-200 col-span-2">
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
          className="h-12 bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 rounded-xl font-bold uppercase tracking-wider text-xs px-6"
          onClick={handleSubmit}
          disabled={isSubmitting || !data.name}
         >
            {isSubmitting ? "Creating..." : "Create Template"}
         </Button>
      </div>
    </DialogContent>
  );
}

function CopyTemplateDialog({ templates, onSubmit, isSubmitting }: any) {
  const [selectedId, setSelectedId] = useState("");
  const [data, setData] = useState({ 
    name: "", 
    type: "Task", 
    priority: "Medium",
    recurrence: "None",
    startTime: "06:00 PM",
    dueTime: "07:30 PM",
    description: ""
  });

  const handleSelect = (id: string) => {
    const tpl = templates.find((t: any) => t.id === id);
    if (tpl) {
      setSelectedId(id);
      setData({
        name: `Copy of ${tpl.name}`,
        type: tpl.type || "Task",
        priority: tpl.priority || "Medium",
        recurrence: tpl.recurrence || "None",
        startTime: tpl.startTime || "06:00 PM",
        dueTime: tpl.dueTime || "07:30 PM",
        description: tpl.description || ""
      });
    }
  };

  return (
    <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close text-left">
      <DialogHeader className="p-8 bg-blue-600 text-white relative">
        <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
           <X className="h-4 w-4" />
        </DialogClose>
        <DialogTitle className="text-2xl font-black">Copy Blueprint</DialogTitle>
        <p className="text-blue-100 text-xs font-bold mt-1">Clone and adapt an existing template for tasks or projects.</p>
      </DialogHeader>
      <div className="p-8 space-y-6">
         <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400">Select Template to Copy</Label>
            <Select value={selectedId} onValueChange={handleSelect}>
               <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs">
                  <SelectValue placeholder="Choose a blueprint..." />
               </SelectTrigger>
               <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl max-h-56 overflow-y-auto">
                  {templates.map((t: any) => (
                     <SelectItem key={t.id} value={t.id} className="text-xs font-bold">
                        {t.name} ({t.type})
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>

         {selectedId && (
            <div className="space-y-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">New Template Name</Label>
                  <Input 
                    placeholder="e.g. Copy of Weekly Site Audit" 
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                    value={data.name}
                    onChange={e => setData({...data, name: e.target.value})}
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">Priority</Label>
                     <Select value={data.priority} onValueChange={p => setData({...data, priority: p})}>
                        <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                           <SelectItem value="Low">Low</SelectItem>
                           <SelectItem value="Medium">Medium</SelectItem>
                           <SelectItem value="High">High</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">Recurrence</Label>
                     <Select value={data.recurrence} onValueChange={r => setData({...data, recurrence: r})}>
                        <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                           <SelectItem value="None">None</SelectItem>
                           <SelectItem value="Daily">Daily</SelectItem>
                           <SelectItem value="Weekly">Weekly</SelectItem>
                           <SelectItem value="Monthly">Monthly</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               </div>
            </div>
         )}

         <Button 
          className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 rounded-2xl font-black uppercase tracking-widest text-xs"
          onClick={() => onSubmit(data)}
          disabled={isSubmitting || !selectedId || !data.name}
         >
            {isSubmitting ? "Cloning..." : "Clone Template"}
         </Button>
      </div>
    </DialogContent>
  );
}

function ViewTemplateDialog({ template, open, onOpenChange }: { template: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!template) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close text-left">
        <DialogHeader className="p-8 bg-blue-600 text-white relative">
          <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
             <X className="h-4 w-4" />
          </DialogClose>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">{template.name}</DialogTitle>
          <p className="text-blue-100 text-xs font-bold mt-1">Blueprint Specifications & Details</p>
        </DialogHeader>
        <div className="p-8 space-y-6">
           <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Blueprint Type</span>
                    <p className="text-sm font-bold text-slate-800">{template.type || "Task"}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Priority Level</span>
                    <p className="text-sm font-bold text-slate-800">{template.priority || "Medium"}</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Scheduled Time</span>
                    <p className="text-sm font-bold text-slate-800">{template.startTime || "06:00 PM"}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Due Time Limit</span>
                    <p className="text-sm font-bold text-slate-800">{template.dueTime || "07:30 PM"}</p>
                 </div>
              </div>
              <div className="space-y-1">
                 <span className="text-[10px] font-black uppercase text-slate-400">Recurrence Frequency</span>
                 <p className="text-sm font-bold text-slate-800">{template.recurrence || "None"}</p>
              </div>
              <div className="space-y-1 border-t border-slate-100 pt-4">
                 <span className="text-[10px] font-black uppercase text-slate-400">Description / Guidelines</span>
                 <p className="text-xs font-medium text-slate-600 whitespace-pre-wrap mt-1">{template.description || "No description provided."}</p>
              </div>
           </div>
           <DialogClose asChild>
             <Button className="w-full h-12 bg-slate-800 hover:bg-slate-900 shadow-xl rounded-2xl font-black uppercase tracking-widest text-xs text-white">
                Close View
             </Button>
           </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignTemplateDialog({ template, open, onOpenChange }: { template: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState("09:00");
  const [dueDate, setDueDate] = useState(dayjs().add(1, "day").format("YYYY-MM-DD"));
  const [dueTime, setDueTime] = useState("18:00");
  const [recurrence, setRecurrence] = useState("None");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  React.useEffect(() => {
    if (template) {
      setRecurrence(template.recurrence || "None");
      setStartDate(dayjs().format("YYYY-MM-DD"));
      setDueDate(dayjs().add(1, "day").format("YYYY-MM-DD"));
      setStartTime(template.startTime || "09:00");
      setDueTime(template.dueTime || "18:00");
    }
  }, [template]);

  const usersQuery = useQuery({
    queryKey: ["users-all-list"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 1000, role: "ALL" }),
    enabled: open
  });

  const users = usersQuery.data?.items ?? [];

  // Deduplicate users client-side to ensure unique list
  const uniqueUsers = useMemo(() => {
    return Array.from(new Map(users.map(u => [u.id, u])).values());
  }, [users]);

  const [roleFilter, setRoleFilter] = useState("ALL");
  const [workModeFilter, setWorkModeFilter] = useState("ALL");

  const filteredUsers = uniqueUsers.filter(user => {
    const matchSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = roleFilter === "ALL" || user.role === roleFilter;
    const matchWorkMode = workModeFilter === "ALL" || user.workMode === workModeFilter;
    return matchSearch && matchRole && matchWorkMode;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUserIds(prev => [...prev, userId]);
    } else {
      setSelectedUserIds(prev => prev.filter(id => id !== userId));
    }
  };

  const handleAssign = async () => {
    if (!template || selectedUserIds.length === 0 || submittingRef.current || isSubmitting) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const uniqueSelectedUserIds = Array.from(new Set(selectedUserIds));
      const isRepeating = recurrence !== "None";
      const startDateTimeStr = `${startDate}T${startTime || '09:00'}`;
      const dueDateTimeStr = `${dueDate}T${dueTime || '18:00'}`;
      // If repeating, the first occurrence is due on startDate, and the series ends on the user-selected dueDate.
      // If not repeating, the task starts on startDate and is due on dueDate.
      const taskDueDate = isRepeating ? startDateTimeStr : dueDateTimeStr;
      const taskEndDate = isRepeating ? dueDateTimeStr : undefined;

      // Parse the full task configuration stored on the template so the spawned
      // tasks behave exactly like the original task (checklist, validations, points, etc.).
      let cfg: any = {};
      try {
        cfg = typeof template.data === "string" ? JSON.parse(template.data || "{}") : (template.data || {});
      } catch {
        cfg = {};
      }
      const toNum = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));

      await Promise.all(
        uniqueSelectedUserIds.map(userId =>
          createTask({
            title: template.name,
            description: cfg.description || template.description || template.name,
            assignedToId: userId,
            dueDate: new Date(taskDueDate).toISOString(),
            startDate: startDateTimeStr ? new Date(startDateTimeStr).toISOString() : undefined,
            endDate: taskEndDate ? new Date(taskEndDate).toISOString() : undefined,
            priority: template.priority || "Medium",
            points: cfg.points !== undefined ? Number(cfg.points) : undefined,
            isRepeating: isRepeating,
            repeatFrequency: isRepeating ? recurrence : undefined,
            validations: cfg.validations && cfg.validations.length ? cfg.validations : undefined,
            checklist: cfg.checklist && cfg.checklist.length ? cfg.checklist : undefined,
            geofenceLat: toNum(cfg.geofenceLat),
            geofenceLng: toNum(cfg.geofenceLng),
            geofenceRadius: toNum(cfg.geofenceRadius),
            reminder: toNum(cfg.reminder),
            attachmentUrl: cfg.attachmentUrl || undefined,
            attachmentName: cfg.attachmentName || undefined,
            subtasks: cfg.subtasks && cfg.subtasks.length ? cfg.subtasks : undefined,
            templateId: template.id
          } as any)
        )
      );
      alert("Blueprint assigned successfully as live tasks to selected employees!");
      setSelectedUserIds([]);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || err?.message || "Failed to assign tasks from template");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close text-left">
        <DialogHeader className="p-8 bg-emerald-600 text-white relative">
          <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
             <X className="h-4 w-4" />
          </DialogClose>
          <DialogTitle className="text-2xl font-black">Assign Blueprint</DialogTitle>
          <p className="text-emerald-100 text-xs font-bold mt-1">
             Instantly spawn live tasks from: <span className="font-extrabold underline">{template.name}</span>
          </p>
        </DialogHeader>
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Start Date & Time</Label>
                <div className="flex gap-2">
                  <Input 
                    type="date"
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs flex-1" 
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                  <Input 
                    type="time"
                    className="h-12 w-28 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Due Date & Time</Label>
                <div className="flex gap-2">
                  <Input 
                    type="date"
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs flex-1" 
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                  />
                  <Input 
                    type="time"
                    className="h-12 w-28 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                    value={dueTime}
                    onChange={e => setDueTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Recurrence</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="Daily">Daily</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Select Employees</Label>
              <Input 
                placeholder="Search staff by name/email..."
                className="h-10 rounded-xl bg-slate-50 border-none font-bold text-xs mb-2" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3 my-2">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-slate-400">Filter Role</span>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-9 rounded-xl bg-slate-50 border-none font-bold text-[10px] text-left">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-white border border-slate-100 shadow-xl">
                      <SelectItem value="ALL">All Roles</SelectItem>
                      <SelectItem value="EMPLOYEE">Employees</SelectItem>
                      <SelectItem value="MANAGER">Managers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-slate-400">Filter Work Mode</span>
                  <Select value={workModeFilter} onValueChange={setWorkModeFilter}>
                    <SelectTrigger className="h-9 rounded-xl bg-slate-50 border-none font-bold text-[10px] text-left">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-white border border-slate-100 shadow-xl">
                      <SelectItem value="ALL">All Modes</SelectItem>
                      <SelectItem value="OFFICE">Office</SelectItem>
                      <SelectItem value="FIELD">Field</SelectItem>
                      <SelectItem value="BOTH">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <input 
                    type="checkbox"
                    checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                    onChange={e => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                  />
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Select All Staff ({filteredUsers.length})</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                  {usersQuery.isLoading ? (
                    <div className="p-4 text-center text-xs font-bold text-slate-400">Loading staff roster...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-xs font-bold text-slate-400">No matching staff found</div>
                  ) : (
                    filteredUsers.map(user => (
                      <label key={user.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 cursor-pointer transition-colors">
                        <input 
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={e => handleSelectUser(user.id, e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-800">{user.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold">{user.email} • {user.role}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button 
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 rounded-2xl font-black uppercase tracking-widest text-xs text-white"
            onClick={handleAssign}
            disabled={isSubmitting || selectedUserIds.length === 0}
          >
            {isSubmitting ? "Spawning Tasks..." : `Send Blueprint to ${selectedUserIds.length} Staff`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditTemplateDialog({ template, open, onOpenChange, onSubmit, isSubmitting, users }: any) {
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
    name: "",
    type: "Task",
    priority: "Medium",
    recurrence: "None",
    startTime: "09:00",
    dueTime: "18:00",
    description: "",
    points: 10,
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

  React.useEffect(() => {
    if (template) {
      let cfg: any = {};
      try {
        cfg = typeof template.data === "string" ? JSON.parse(template.data || "{}") : (template.data || {});
      } catch {
        cfg = {};
      }

      setData({
        name: template.name || "",
        type: template.type || "Task",
        priority: template.priority || "Medium",
        recurrence: template.recurrence || "None",
        startTime: template.startTime || "09:00",
        dueTime: template.dueTime || "18:00",
        description: template.description || cfg.description || "",
        points: cfg.points ?? 10,
        repeatDays: Array.isArray(cfg.repeatDays) ? cfg.repeatDays : [],
        repeatDates: Array.isArray(cfg.repeatDates) ? cfg.repeatDates : [],
        skipHolidays: !!cfg.skipHolidays,
        attachmentUrl: cfg.attachmentUrl || null,
        attachmentName: cfg.attachmentName || null,
        validations: Array.isArray(cfg.validations) ? cfg.validations : [],
        checklist: Array.isArray(cfg.checklist) ? cfg.checklist : [],
        geofenceLat: cfg.geofenceLat ?? "",
        geofenceLng: cfg.geofenceLng ?? "",
        geofenceRadius: cfg.geofenceRadius ?? "",
        reminder: cfg.reminder ?? "",
        subtasks: Array.isArray(cfg.subtasks) ? cfg.subtasks : []
      });

      setShowDescription(!!(template.description || cfg.description));
      setShowValidations(Array.isArray(cfg.validations) && cfg.validations.length > 0);
      setShowRepeat((template.recurrence && template.recurrence !== "None") || (cfg.repeatFrequency && cfg.repeatFrequency !== "NONE"));
      setShowReminder(!!cfg.reminder);
      setShowChecklist(Array.isArray(cfg.checklist) && cfg.checklist.length > 0);
      setShowSubtasks(Array.isArray(cfg.subtasks) && cfg.subtasks.length > 0);
      setShowPoints(cfg.points !== undefined && cfg.points !== 0);
      setShowGeofence(!!(cfg.geofenceLat || cfg.geofenceLng));
    }
  }, [template, open]);

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
          startDate: dayjs().format("YYYY-MM-DD"),
          endDate: dayjs().add(1, "day").format("YYYY-MM-DD"),
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

  const handleSubmit = () => {
    onSubmit({
      name: data.name,
      type: data.type,
      priority: data.priority,
      recurrence: data.recurrence,
      startTime: data.startTime,
      dueTime: data.dueTime,
      description: data.description,
      data: JSON.stringify({
        description: data.description,
        points: data.points,
        validations: data.validations,
        checklist: data.checklist,
        geofenceLat: data.geofenceLat,
        geofenceLng: data.geofenceLng,
        geofenceRadius: data.geofenceRadius,
        reminder: data.reminder,
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        repeatFrequency: data.recurrence === "None" ? "NONE" : data.recurrence.toUpperCase(),
        repeatDays: data.repeatDays,
        repeatDates: data.repeatDates,
        skipHolidays: data.skipHolidays,
        subtasks: data.subtasks
      })
    });
  };

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close max-h-[85vh] flex flex-col text-left">
        <DialogHeader className="p-6 bg-blue-50/50 border-b border-blue-100 relative shrink-0">
          <DialogClose className="absolute right-6 top-6 rounded-xl bg-slate-200/50 p-1.5 text-slate-600 hover:bg-slate-300 transition-all">
             <X className="h-4 w-4" />
          </DialogClose>
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center">Edit Template</DialogTitle>
          <p className="text-slate-500 text-xs font-semibold mt-0.5">Modify blueprint details. Changes will apply to future assignments.</p>
        </DialogHeader>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
           <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Type</Label>
                    <Select value={data.type} onValueChange={t => setData({...data, type: t})}>
                       <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs">
                          <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                          <SelectItem value="Task">Task</SelectItem>
                          <SelectItem value="Project">Project</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Priority</Label>
                    <Select value={data.priority} onValueChange={p => setData({...data, priority: p})}>
                       <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs">
                          <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">Template Name*</Label>
                 <div className="relative flex items-center">
                    <span className="absolute left-4 w-3.5 h-3.5 rounded bg-blue-600 shrink-0" />
                    <Input 
                      placeholder="Enter template name" 
                      className="h-12 pl-10 rounded-2xl bg-slate-50 border-none font-bold" 
                      value={data.name}
                      onChange={e => setData({...data, name: e.target.value})}
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
                      placeholder="Enter description here..." 
                      className="min-h-[80px] rounded-2xl bg-slate-50 border-none font-medium resize-none" 
                      value={data.description}
                      onChange={e => setData({...data, description: e.target.value})}
                    />
                 )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-blue-500" /> Default Task Attachment
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
                    <Label className="text-[10px] font-black uppercase text-slate-400">Default Start Time</Label>
                    <Input 
                      type="time" 
                      className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                      value={data.startTime}
                      onChange={e => setData({...data, startTime: e.target.value})}
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Default Due Time</Label>
                    <Input 
                      type="time" 
                      className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                      value={data.dueTime}
                      onChange={e => setData({...data, dueTime: e.target.value})}
                    />
                 </div>
              </div>

              <div className="flex gap-2 flex-wrap pt-2">
                 <Button 
                   type="button"
                   variant="outline"
                   onClick={() => setShowValidations(!showValidations)}
                   className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showValidations && "bg-blue-50/50 border-blue-200 text-blue-700")}
                 >
                   <CheckCircle2 className="h-4 w-4" /> Ask Validations
                 </Button>

                 <Button 
                   type="button"
                   variant="outline"
                   onClick={() => setShowRepeat(!showRepeat)}
                   className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showRepeat && "bg-blue-50/50 border-blue-200 text-blue-700")}
                 >
                   <RefreshCw className="h-4 w-4" /> Repeat
                 </Button>

                 <Button 
                   type="button"
                   variant="outline"
                   onClick={() => setShowReminder(!showReminder)}
                   className={cn("h-10 rounded-xl text-xs font-bold gap-2 border-slate-200", showReminder && "bg-blue-50/50 border-blue-200 text-blue-700")}
                 >
                   <Bell className="h-4 w-4" /> Reminder
                 </Button>
              </div>

              {showValidations && (
                <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100 animate-in fade-in slide-in-from-top-1">
                  <Label className="text-[9px] font-black uppercase text-slate-500">Require Completion Proof (Select Validations)</Label>
                  <div className="flex flex-wrap gap-4">
                    {TASK_VALIDATION_TYPES.map(v => (
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
                   <Select value={data.recurrence} onValueChange={v => setData({...data, recurrence: v})}>
                      <SelectTrigger className="h-10 bg-white border-slate-200 font-bold text-xs rounded-xl">
                         <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                         <SelectItem value="None">No Repeat</SelectItem>
                         <SelectItem value="Daily">Every Day</SelectItem>
                         <SelectItem value="Weekly">Every Week</SelectItem>
                         <SelectItem value="Monthly">Every Month</SelectItem>
                      </SelectContent>
                   </Select>

                   {data.recurrence === 'Weekly' && (
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

                   {data.recurrence === 'Monthly' && (
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

                   {data.recurrence !== 'None' && (
                     <div className="flex items-center gap-3 p-3 bg-blue-50/30 rounded-xl border border-blue-100/50">
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
                                {CHECKLIST_VALIDATION_TYPES.map(v => (
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
                                  {CHECKLIST_VALIDATION_TYPES.map(v=>(<label key={v.val} className="flex items-center gap-1 text-[9px] font-bold text-slate-600 cursor-pointer"><input type="checkbox" checked={(ci.validations||[]).includes(v.val)} onChange={()=>{const nv=(ci.validations||[]).includes(v.val)?(ci.validations||[]).filter((x:string)=>x!==v.val):[...(ci.validations||[]),v.val];updateSubtask(sub.id,{checklist:(sub.checklist||[]).map((c:any)=>c.id===ci.id?{...c,validations:nv}:c)});}} className="rounded border-slate-300"/> {v.label}</label>))}
                                </div>
                              </div>
                            ))}
                            {(!sub.checklist||sub.checklist.length===0)&&<p className="text-[9px] text-slate-400 font-bold text-center py-1">No questions yet.</p>}
                          </div>
                          <div className="space-y-2">
                             <span className="text-[8px] font-black uppercase text-slate-400">Subtask Validations</span>
                             <div className="flex flex-wrap gap-3">
                                {TASK_VALIDATION_TYPES.map(v => (
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
                        {showPoints && (
                           <div className="space-y-1 animate-in fade-in duration-200 col-span-2">
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
            onClick={handleSubmit}
            disabled={isSubmitting || !data.name}
           >
              {isSubmitting ? "Saving..." : "Save Changes"}
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTasksDialog({ template, open, onOpenChange, onSubmit, isSubmitting }: any) {
  const [option, setOption] = useState("future");
  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close text-left">
        <DialogHeader className="p-8 bg-rose-600 text-white relative">
          <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
             <X className="h-4 w-4" />
          </DialogClose>
          <DialogTitle className="text-2xl font-black">Bulk Delete Tasks</DialogTitle>
          <p className="text-rose-100 text-xs font-bold mt-1">Delete tasks assigned from blueprint: {template.name}</p>
        </DialogHeader>
        <div className="p-8 space-y-6">
           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Which tasks should be deleted?</Label>
              <Select value={option} onValueChange={setOption}>
                 <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs">
                    <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                    <SelectItem value="future">Future Dates Only</SelectItem>
                    <SelectItem value="past">Past Dates Only</SelectItem>
                    <SelectItem value="recent">Recent (Last 7 Days)</SelectItem>
                    <SelectItem value="all">All Dates</SelectItem>
                 </SelectContent>
              </Select>
           </div>
           <Button 
            className="w-full h-14 bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-100 rounded-2xl font-black uppercase tracking-widest text-xs"
            onClick={() => onSubmit(option)}
            disabled={isSubmitting}
           >
              {isSubmitting ? "Deleting..." : "Confirm Deletion"}
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTemplateDialog({ template, open, onOpenChange, onSubmit, isSubmitting }: any) {
  const [option, setOption] = useState("all");
  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close text-left">
        <DialogHeader className="p-8 bg-rose-600 text-white relative">
          <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
             <X className="h-4 w-4" />
          </DialogClose>
          <DialogTitle className="text-2xl font-black">Delete Blueprint</DialogTitle>
          <p className="text-rose-100 text-xs font-bold mt-1">This will permanently remove the blueprint: {template.name}</p>
        </DialogHeader>
        <div className="p-8 space-y-6">
           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Also delete assigned tasks?</Label>
              <Select value={option} onValueChange={setOption}>
                 <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs">
                    <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                    <SelectItem value="all">Delete all assigned tasks (recommended)</SelectItem>
                    <SelectItem value="future">Delete future tasks</SelectItem>
                    <SelectItem value="past">Delete past tasks</SelectItem>
                    <SelectItem value="recent">Delete recent (Last 7 Days) tasks</SelectItem>
                    <SelectItem value="none">No, keep all assigned tasks</SelectItem>
                 </SelectContent>
              </Select>
           </div>
           <Button 
            className="w-full h-14 bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-100 rounded-2xl font-black uppercase tracking-widest text-xs"
            onClick={() => onSubmit(option)}
            disabled={isSubmitting}
           >
              {isSubmitting ? "Deleting..." : "Confirm Blueprint Deletion"}
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CleanupDuplicatesDialog({ template, open, onOpenChange, onSubmit, isSubmitting }: any) {
  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close text-left">
        <DialogHeader className="p-8 bg-purple-600 text-white relative">
          <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
             <X className="h-4 w-4" />
          </DialogClose>
          <DialogTitle className="text-2xl font-black">Cleanup Duplicates</DialogTitle>
          <p className="text-purple-100 text-xs font-bold mt-1">Remove multiple task assignments for {template.name}</p>
        </DialogHeader>
        <div className="p-8 space-y-6">
           <p className="text-sm font-medium text-slate-600">
             If this blueprint was assigned to the same user multiple times on the same date, this action will keep one instance and delete the extra duplicates.
           </p>
           <div className="flex gap-4">
             <Button 
              variant="outline"
              className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs"
              onClick={() => onOpenChange(false)}
             >
                Cancel
             </Button>
             <Button 
              className="flex-1 h-14 bg-purple-600 hover:bg-purple-700 shadow-xl shadow-purple-100 rounded-2xl font-black uppercase tracking-widest text-xs text-white"
              onClick={onSubmit}
              disabled={isSubmitting}
             >
                {isSubmitting ? "Cleaning..." : "Proceed Cleanup"}
             </Button>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
