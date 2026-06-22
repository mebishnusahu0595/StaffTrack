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
  Pencil
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

function CreateTemplateDialog({ onSubmit, isSubmitting }: any) {
  const [data, setData] = useState({ 
    name: "", 
    type: "Task", 
    priority: "Medium",
    recurrence: "None",
    startTime: "06:00 PM",
    dueTime: "07:30 PM",
    description: ""
  });

  return (
    <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close text-left">
      <DialogHeader className="p-8 bg-emerald-600 text-white relative">
        <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
           <X className="h-4 w-4" />
        </DialogClose>
        <DialogTitle className="text-2xl font-black">New Template</DialogTitle>
        <p className="text-emerald-100 text-xs font-bold mt-1">Design a reusable blueprint for tasks or projects.</p>
      </DialogHeader>
      <div className="p-8 space-y-6">
         <div className="space-y-4">
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Template Name</Label>
               <Input 
                 placeholder="e.g. Weekly Site Audit" 
                 className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                 value={data.name}
                 onChange={e => setData({...data, name: e.target.value})}
               />
            </div>
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

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Start Time</Label>
                  <Input 
                    placeholder="e.g. 06:00 PM" 
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                    value={data.startTime}
                    onChange={e => setData({...data, startTime: e.target.value})}
                  />
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Due Time</Label>
                  <Input 
                    placeholder="e.g. 07:30 PM" 
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                    value={data.dueTime}
                    onChange={e => setData({...data, dueTime: e.target.value})}
                  />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Description</Label>
                  <Input 
                    placeholder="Description of blueprint..." 
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                    value={data.description}
                    onChange={e => setData({...data, description: e.target.value})}
                  />
               </div>
            </div>
         </div>
         <Button 
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 rounded-2xl font-black uppercase tracking-widest text-xs"
          onClick={() => onSubmit(data)}
          disabled={isSubmitting || !data.name}
         >
            {isSubmitting ? "Saving..." : "Create Template"}
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
  const [dueDate, setDueDate] = useState(dayjs().add(1, "day").format("YYYY-MM-DD"));
  const [recurrence, setRecurrence] = useState("None");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  React.useEffect(() => {
    if (template) {
      setRecurrence(template.recurrence || "None");
      setStartDate(dayjs().format("YYYY-MM-DD"));
      setDueDate(dayjs().add(1, "day").format("YYYY-MM-DD"));
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
      // If repeating, the first occurrence is due on startDate, and the series ends on the user-selected dueDate.
      // If not repeating, the task starts on startDate and is due on dueDate.
      const taskDueDate = isRepeating ? startDate : dueDate;
      const taskEndDate = isRepeating ? dueDate : undefined;

      await Promise.all(
        uniqueSelectedUserIds.map(userId => 
          createTask({
            title: template.name,
            description: template.description || template.name,
            assignedToId: userId,
            dueDate: new Date(taskDueDate).toISOString(),
            startDate: startDate ? new Date(startDate).toISOString() : undefined,
            endDate: taskEndDate ? new Date(taskEndDate).toISOString() : undefined,
            priority: template.priority || "Medium",
            isRepeating: isRepeating,
            repeatFrequency: isRepeating ? recurrence : undefined,
            templateId: template.id
          })
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
                <Label className="text-[10px] font-black uppercase text-slate-400">Start Date</Label>
                <Input 
                  type="date"
                  className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Due Date</Label>
                <Input 
                  type="date"
                  className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
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

function EditTemplateDialog({ template, open, onOpenChange, onSubmit, isSubmitting }: any) {
  const [data, setData] = useState({ 
    name: "", type: "Task", priority: "Medium", recurrence: "None", 
    startTime: "06:00 PM", dueTime: "07:30 PM", description: "" 
  });

  React.useEffect(() => {
    if (template) {
      setData({
        name: template.name || "",
        type: template.type || "Task",
        priority: template.priority || "Medium",
        recurrence: template.recurrence || "None",
        startTime: template.startTime || "06:00 PM",
        dueTime: template.dueTime || "07:30 PM",
        description: template.description || ""
      });
    }
  }, [template]);

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close text-left">
        <DialogHeader className="p-8 bg-blue-600 text-white relative">
          <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
             <X className="h-4 w-4" />
          </DialogClose>
          <DialogTitle className="text-2xl font-black">Edit Template</DialogTitle>
          <p className="text-blue-100 text-xs font-bold mt-1">Changes will automatically update future assigned tasks.</p>
        </DialogHeader>
        <div className="p-8 space-y-6">
           <div className="space-y-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">Template Name</Label>
                 <Input 
                   className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                   value={data.name}
                   onChange={e => setData({...data, name: e.target.value})}
                 />
              </div>
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

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Start Time</Label>
                    <Input 
                      placeholder="e.g. 06:00 PM" 
                      className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                      value={data.startTime}
                      onChange={e => setData({...data, startTime: e.target.value})}
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Due Time</Label>
                    <Input 
                      placeholder="e.g. 07:30 PM" 
                      className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                      value={data.dueTime}
                      onChange={e => setData({...data, dueTime: e.target.value})}
                    />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Description</Label>
                    <Input 
                      className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                      value={data.description}
                      onChange={e => setData({...data, description: e.target.value})}
                    />
                 </div>
              </div>
           </div>
           <Button 
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 rounded-2xl font-black uppercase tracking-widest text-xs"
            onClick={() => onSubmit(data)}
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
  const [option, setOption] = useState("none");
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
                    <SelectItem value="none">No, keep all assigned tasks</SelectItem>
                    <SelectItem value="future">Delete future tasks</SelectItem>
                    <SelectItem value="past">Delete past tasks</SelectItem>
                    <SelectItem value="recent">Delete recent (Last 7 Days) tasks</SelectItem>
                    <SelectItem value="all">Delete all assigned tasks</SelectItem>
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
