"use client";

import React, { useState } from "react";
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
  FileText
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
import { fetchTemplates, createTemplate } from "@/lib/api";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Tasks");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ["templates", search, activeTab],
    queryFn: () => fetchTemplates({ search, type: activeTab })
  });

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setIsCreateOpen(false);
    }
  });

  const templates = templatesQuery.data ?? [];

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <History className="h-3 w-3" />
            <span>Home / Template Library</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Blueprint Repository
            <Badge variant="outline" className="h-6 px-2 rounded-lg border-blue-100 bg-blue-50/50 text-blue-600 font-bold">
              {templates.length} Active
            </Badge>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
           <Button variant="outline" className="h-12 rounded-2xl border-slate-200 font-bold text-slate-600 gap-2 px-6">
              <Zap className="h-4 w-4 text-amber-500" /> Copy Template
           </Button>
           <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
             <DialogTrigger asChild>
               <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-emerald-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
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
      <div className="flex items-center gap-6 bg-white p-4 rounded-[32px] border border-slate-200/60 shadow-sm">
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

        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search templates..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-12 border-none bg-slate-50 rounded-2xl font-bold focus:bg-slate-100/50 transition-all" 
          />
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
                    {templates.map(template => (
                       <tr key={template.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-3">
                                {template.hasSubtasks && <Plus className="h-3.5 w-3.5 text-emerald-600" />}
                                <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{template.name}</p>
                                {template.subtaskCount && <span className="text-[10px] font-bold text-emerald-600">({template.subtaskCount} Subtasks)</span>}
                             </div>
                          </td>
                          <td className="py-6 text-center">
                             <div className="flex items-center justify-center gap-1">
                                <div className={cn("h-0.5 w-4 rounded-full", template.priority === 'High' ? 'bg-rose-500' : 'bg-slate-300')} />
                             </div>
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
                             <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all">
                                   <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
                                   <MoreHorizontal className="h-4 w-4" />
                                </Button>
                             </div>
                          </td>
                       </tr>
                    ))}
                    {templates.length === 0 && (
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
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing {templates.length} Of {templates.length} Result</p>
           <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-white"><ChevronLeft className="h-4 w-4" /></Button>
              <div className="h-8 w-8 rounded-lg bg-white border border-emerald-600 text-emerald-600 flex items-center justify-center text-xs font-black">1</div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-white"><ChevronRight className="h-4 w-4" /></Button>
           </div>
        </div>
      </Card>
    </div>
  );
}

function CreateTemplateDialog({ onSubmit, isSubmitting }: any) {
  const [data, setData] = useState({ name: "", type: "Task", priority: "Medium" });

  return (
    <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px]">
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
                 className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                 value={data.name}
                 onChange={e => setData({...data, name: e.target.value})}
               />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Type</Label>
                  <Select value={data.type} onValueChange={t => setData({...data, type: t})}>
                     <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl">
                        <SelectItem value="Task">Task</SelectItem>
                        <SelectItem value="Project">Project</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Priority</Label>
                  <Select value={data.priority} onValueChange={p => setData({...data, priority: p})}>
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
            </div>
         </div>
         <Button 
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 rounded-2xl font-black uppercase tracking-widest text-xs"
          onClick={() => onSubmit(data)}
          disabled={isSubmitting}
         >
            {isSubmitting ? "Saving..." : "Create Template"}
         </Button>
      </div>
    </DialogContent>
  );
}
