"use client";

import React, { useState, useMemo, useRef } from "react";
import { 
  AlertTriangle, 
  Plus, 
  Search, 
  MessageSquare, 
  User as UserIcon, 
  Filter, 
  AlertCircle,
  Clock,
  CheckCircle,
  MoreVertical,
  Flag,
  Calendar,
  X,
  Camera,
  Video,
  FileText,
  Mic,
  Paperclip,
  Send,
  Eye,
  History,
  FolderKanban,
  Building2,
  Tag,
  Loader2
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchIssues, fetchUsers, createIssue, updateIssue, addIssueUpdate, fetchIssue, fetchProjects, uploadFile, fetchGroups } from "@/lib/api";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

// --- Components ---

function StatCard({ label, value, icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  };

  return (
    <Card className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 bg-white group hover:ring-blue-400 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
           <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110", colors[color])}>
              {icon}
           </div>
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{label}</p>
              <h3 className={cn("text-2xl font-black tracking-tight", color === 'blue' ? 'text-slate-900' : colors[color].split(' ')[1])}>{value}</h3>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IssuesPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [assigningIssueId, setAssigningIssueId] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const issuesQuery = useQuery({
    queryKey: ["issues", search, activeTab],
    queryFn: () => {
      // Map "Close" tab to query "Resolved" status from the backend
      const statusParam = activeTab === "Close" ? "Resolved" : activeTab;
      return fetchIssues({ search, status: statusParam });
    }
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 100 })
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects()
  });

  const groupsQuery = useQuery({
    queryKey: ["groups-for-issues"],
    queryFn: fetchGroups
  });

  const createMutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      setIsReportOpen(false);
    }
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => updateIssue(id, { status: "Resolved" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issue"] });
    }
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, assigneeId }: { id: string, assigneeId: string }) => 
      updateIssue(id, { assigneeId: assigneeId === "unassigned" ? null : assigneeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issue"] });
      setAssigningIssueId(null);
    }
  });

  const issues = useMemo(() => issuesQuery.data ?? [], [issuesQuery.data]);
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);

  const filteredIssues = useMemo(() => {
    let filtered = issues;
    if (selectedDepartment !== "ALL") {
      filtered = filtered.filter(i => {
        const issueDept = (i.department || "").toLowerCase();
        const assigneeDept = (i.assignee?.group?.name || "").toLowerCase();
        
        const selectedGroup = groups.find((g: any) => g.id === selectedDepartment);
        const selectedName = (selectedGroup?.name || "").toLowerCase();
        
        return issueDept === selectedName || assigneeDept === selectedName;
      });
    }
    return filtered;
  }, [issues, selectedDepartment, groups]);

  const stats = useMemo(() => {
    return {
      total: filteredIssues.length,
      open: filteredIssues.filter(i => i.status === "Open" || i.status === "In Progress").length,
      inProgress: filteredIssues.filter(i => i.status === "In Progress").length,
      resolved: filteredIssues.filter(i => i.status === "Resolved" || i.status === "Closed").length,
    };
  }, [filteredIssues]);

  const currentAssigningIssue = useMemo(() => {
    return issues.find(i => i.id === assigningIssueId);
  }, [issues, assigningIssueId]);

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <History className="h-3 w-3" />
            <span>Home / Issues</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Issues Command Center
            <Badge variant="outline" className="h-6 px-2 rounded-lg border-blue-100 bg-blue-50/50 text-blue-600 font-bold">
              {stats.open} Active
            </Badge>
          </h1>
        </div>
        
        <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-blue-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Plus className="h-5 w-5" /> Report Issue
            </Button>
          </DialogTrigger>
          <ReportIssueDialog 
            users={usersQuery.data?.items ?? []} 
            projects={projectsQuery.data ?? []}
            onSubmit={(data: any) => createMutation.mutate(data)}
            isSubmitting={createMutation.isPending}
          />
        </Dialog>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Issues" value={stats.total} icon={<AlertTriangle className="h-6 w-6" />} color="blue" />
        <StatCard label="Open / Active" value={stats.open} icon={<AlertCircle className="h-6 w-6" />} color="rose" />
        <StatCard label="In Progress" value={stats.inProgress} icon={<Clock className="h-6 w-6" />} color="amber" />
        <StatCard label="Resolved / Closed" value={stats.resolved} icon={<CheckCircle className="h-6 w-6" />} color="emerald" />
      </div>

      {/* Main Content */}
      <Card className="rounded-[40px] border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-slate-50">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                 <TabsList className="bg-slate-100 p-1 rounded-2xl h-12">
                    {["All", "Open", "Close", "Ignore"].map(tab => (
                       <TabsTrigger 
                        key={tab} 
                        value={tab} 
                        className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
                       >
                          {tab}
                       </TabsTrigger>
                    ))}
                 </TabsList>
              </Tabs>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                 <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="h-12 w-48 rounded-2xl bg-slate-50 border-none font-bold">
                       <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                       <SelectItem value="ALL">All Departments</SelectItem>
                       {groups?.map((g: any) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                       ))}
                    </SelectContent>
                 </Select>

                 <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search issues..." 
                      className="h-12 pl-12 rounded-2xl bg-slate-50 border-none focus:bg-white transition-all font-bold" 
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                 </div>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Issue Name</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Assigned To</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Category</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Department</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Status</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Priority</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Start Date</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Created By</th>
                       <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {issuesQuery.isLoading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                          Loading issues...
                        </td>
                      </tr>
                    ) : filteredIssues.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                          No issues found
                        </td>
                      </tr>
                    ) : (
                      filteredIssues.map(issue => (
                        <tr key={issue.id} className="group hover:bg-slate-50/50 transition-colors">
                           <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                 <div className={cn(
                                    "h-2 w-2 rounded-full",
                                    issue.status === "Open" ? "bg-rose-500 animate-pulse" : 
                                    issue.status === "In Progress" ? "bg-amber-500" : "bg-emerald-500"
                                 )} />
                                 <div>
                                   <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{issue.title}</p>
                                   {issue.project && (
                                     <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1 mt-0.5">
                                       <FolderKanban className="h-2.5 w-2.5" /> {issue.project.name}
                                     </span>
                                   )}
                                 </div>
                              </div>
                           </td>
                           <td className="py-6">
                              <div className="flex items-center gap-3">
                                 <Avatar className="h-8 w-8 rounded-xl ring-2 ring-white shadow-sm">
                                    <AvatarFallback className="bg-blue-50 text-blue-600 font-black text-[10px]">{issue.assignee?.name?.[0] || '?'}</AvatarFallback>
                                 </Avatar>
                                 <span className="text-xs font-bold text-slate-600">{issue.assignee?.name || 'Unassigned'}</span>
                              </div>
                           </td>
                           <td className="py-6 text-xs font-bold text-slate-600">
                             <Badge variant="outline" className="border-slate-200 text-slate-600 font-bold bg-slate-50/50 text-[10px]">
                               {issue.category || "General"}
                             </Badge>
                           </td>
                           <td className="py-6 text-xs font-bold text-slate-500">{issue.department || "General"}</td>
                           <td className="py-6 text-center">
                              <Badge className={cn(
                                 "text-[9px] font-black uppercase px-2 py-0.5 rounded-md border",
                                 issue.status === "Open" ? "bg-rose-50 text-rose-600 border-rose-100" : 
                                 issue.status === "In Progress" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                 "bg-emerald-50 text-emerald-600 border-emerald-100"
                              )}>
                                 {issue.status}
                              </Badge>
                           </td>
                           <td className="py-6 text-center">
                              <div className="flex items-center justify-center gap-1">
                                 <div className={cn("h-0.5 w-4 rounded-full", issue.priority === 'Critical' || issue.priority === 'High' ? 'bg-rose-500' : 'bg-blue-500')} />
                                 <div className={cn("h-0.5 w-4 rounded-full", issue.priority === 'Critical' || issue.priority === 'High' ? 'bg-rose-500' : 'bg-blue-100')} />
                              </div>
                           </td>
                           <td className="py-6 text-xs font-bold text-slate-500">{dayjs(issue.createdAt).format("DD-MM-YYYY, hh:mm A")}</td>
                           <td className="py-6">
                              <div className="flex items-center gap-2">
                                 <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-[8px] font-black text-emerald-600">
                                   {issue.reportedBy?.name?.[0] || 'R'}
                                 </div>
                                 <span className="text-xs font-bold text-slate-600">{issue.reportedBy?.name || 'Reporter'}</span>
                              </div>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-9 w-9 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all"
                                   onClick={() => setSelectedIssueId(issue.id)}
                                 >
                                    <Eye className="h-4 w-4" />
                                 </Button>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-400 transition-all"
                                   onClick={() => setAssigningIssueId(issue.id)}
                                 >
                                    <UserPlus className="h-4 w-4" />
                                 </Button>
                              </div>
                           </td>
                        </tr>
                      ))
                    )}
                 </tbody>
              </table>
           </div>
        </CardContent>
      </Card>

      {/* Detailed Update Sheet */}
      <IssueUpdateSheet 
        issueId={selectedIssueId} 
        onClose={() => setSelectedIssueId(null)} 
        onResolve={(id) => resolveMutation.mutate(id)}
      />

      {/* Assign User Dialog */}
      <Dialog open={!!assigningIssueId} onOpenChange={open => !open && setAssigningIssueId(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close">
          <DialogHeader className="p-8 bg-blue-600 text-white relative">
            <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
               <X className="h-4 w-4" />
            </DialogClose>
            <DialogTitle className="text-2xl font-black">Assign Issue</DialogTitle>
            <p className="text-blue-100 text-xs font-bold mt-1">Select a staff member to resolve this issue.</p>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Assignee</Label>
              <Select 
                value={currentAssigningIssue?.assigneeId || "unassigned"} 
                onValueChange={(userId) => {
                  if (assigningIssueId) {
                    assignMutation.mutate({ id: assigningIssueId, assigneeId: userId });
                  }
                }}
              >
                <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {usersQuery.data?.items?.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-12 rounded-2xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50" 
                onClick={() => setAssigningIssueId(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportIssueDialog({ users, projects, onSubmit, isSubmitting }: any) {
  const [data, setData] = useState({ 
    title: "", 
    description: "", 
    priority: "Medium", 
    assigneeId: "",
    category: "General",
    department: "General",
    projectId: ""
  });

  return (
    <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close">
      <DialogHeader className="p-8 bg-blue-600 text-white relative">
        <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
           <X className="h-4 w-4" />
        </DialogClose>
        <DialogTitle className="text-2xl font-black">Report Issue</DialogTitle>
        <p className="text-blue-100 text-xs font-bold mt-1">Track system bugs or operational blockers.</p>
      </DialogHeader>
      <div className="p-8 space-y-5 max-h-[75vh] overflow-y-auto">
         <div className="space-y-4">
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Issue Name</Label>
               <Input 
                 placeholder="Short descriptive title" 
                 className="h-12 rounded-2xl bg-slate-50 border-none font-bold" 
                 value={data.title}
                 onChange={e => setData({...data, title: e.target.value})}
               />
            </div>
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Description</Label>
               <Textarea 
                 placeholder="What went wrong?" 
                 className="min-h-[90px] rounded-2xl bg-slate-50 border-none font-medium p-4" 
                 value={data.description}
                 onChange={e => setData({...data, description: e.target.value})}
               />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="Critical">Critical</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Assign To</Label>
                  <Select value={data.assigneeId} onValueChange={id => setData({...data, assigneeId: id})}>
                     <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                        <SelectValue placeholder="Select staff" />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl">
                        {users.map((u: any) => (
                           <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Category</Label>
                  <Select value={data.category} onValueChange={c => setData({...data, category: c})}>
                     <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl">
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Technical">Technical</SelectItem>
                        <SelectItem value="Operational">Operational</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="Billing">Billing</SelectItem>
                        <SelectItem value="Client">Client</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Department</Label>
                  <Select value={data.department} onValueChange={d => setData({...data, department: d})}>
                     <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl">
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="Customer Support">Customer Support</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Related Project</Label>
               <Select value={data.projectId} onValueChange={pId => setData({...data, projectId: pId})}>
                  <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                     <SelectValue placeholder="Select related project (optional)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                     <SelectItem value="none">No Project</SelectItem>
                     {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>
         </div>
         <Button 
          className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 rounded-2xl font-black uppercase tracking-widest text-xs"
          onClick={() => {
            const submitData = { ...data };
            if (submitData.projectId === "none" || submitData.projectId === "") {
              delete (submitData as any).projectId;
            }
            onSubmit(submitData);
          }}
          disabled={isSubmitting}
         >
            {isSubmitting ? "Creating..." : "Create Issue"}
         </Button>
      </div>
    </DialogContent>
  );
}

function IssueUpdateSheet({ issueId, onClose, onResolve }: { issueId: string | null, onClose: () => void, onResolve: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<"PHOTO" | "VIDEO" | "AUDIO" | "ATTACHMENT">("PHOTO");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const issueQuery = useQuery({
    queryKey: ["issue", issueId],
    queryFn: () => fetchIssue(issueId!),
    enabled: !!issueId
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => addIssueUpdate(issueId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
      setComment("");
    }
  });

  const issue = issueQuery.data;

  const triggerUpload = (type: "PHOTO" | "VIDEO" | "AUDIO" | "ATTACHMENT") => {
    setUploadType(type);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !issueId) return;

    setIsUploading(true);
    try {
      const fileUrl = await uploadFile(file);
      await updateMutation.mutateAsync({
        type: uploadType,
        content: fileUrl
      });
    } catch (err) {
      console.error("Failed to upload file", err);
    } finally {
      setIsUploading(false);
      if (e.target) {
        e.target.value = ""; // clear file input
      }
    }
  };

  const focusCommentBox = () => {
    if (commentTextareaRef.current) {
      commentTextareaRef.current.focus();
    }
  };

  const acceptTypes = useMemo(() => {
    if (uploadType === "PHOTO") return "image/*";
    if (uploadType === "VIDEO") return "video/*";
    if (uploadType === "AUDIO") return "audio/*";
    return "*";
  }, [uploadType]);

  return (
    <Sheet open={!!issueId} onOpenChange={open => !open && onClose()}>
      <SheetContent className="sm:max-w-md p-0 border-none shadow-2xl flex flex-col h-full bg-white">
        <SheetHeader className="p-8 bg-slate-50 border-b border-slate-100">
          <div className="space-y-1">
             <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 font-bold text-[8px] uppercase">Issue ID: {issueId?.slice(-6)}</Badge>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold text-[8px] uppercase">{issue?.status}</Badge>
             </div>
             <SheetTitle className="text-2xl font-black text-slate-900 tracking-tight">{issue?.title || "Issue details"}</SheetTitle>
             <SheetDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">{issue?.assignee?.group?.name || "General"}</SheetDescription>
          </div>
        </SheetHeader>

        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept={acceptTypes} 
          className="hidden" 
        />

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
           {/* Detailed Metadata Grid */}
           <div className="grid grid-cols-3 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
              <div className="flex flex-col items-center justify-center p-2 bg-white rounded-xl shadow-sm text-center">
                 <Tag className="h-4 w-4 text-blue-600 mb-1" />
                 <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Category</span>
                 <span className="text-[10px] font-bold text-slate-800 mt-0.5">{issue?.category || "General"}</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-white rounded-xl shadow-sm text-center">
                 <Building2 className="h-4 w-4 text-emerald-600 mb-1" />
                 <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Dept</span>
                 <span className="text-[10px] font-bold text-slate-800 mt-0.5">{issue?.department || "General"}</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-white rounded-xl shadow-sm text-center">
                 <FolderKanban className="h-4 w-4 text-indigo-600 mb-1" />
                 <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Project</span>
                 <span className="text-[10px] font-bold text-slate-800 mt-0.5 truncate max-w-full px-1">{issue?.project?.name || "None"}</span>
              </div>
           </div>

           {/* Issue description box */}
           {issue?.description && (
             <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-100/40">
                <span className="text-[8px] font-black uppercase text-blue-500 tracking-widest block mb-1">Issue Description</span>
                <p className="text-xs font-medium text-slate-700 leading-relaxed">{issue.description}</p>
             </div>
           )}

           {/* Action Grid */}
           <div className="grid grid-cols-1 gap-3 relative">
              {isUploading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-10">
                   <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black shadow-lg">
                      <Loader2 className="h-4 w-4 animate-spin" /> UPLOADING FILE...
                   </div>
                </div>
              )}
              <UpdateAction icon={<Camera className="h-5 w-5" />} label="Photo" actionLabel="Add Photo" onClick={() => triggerUpload("PHOTO")} />
              <UpdateAction icon={<Video className="h-5 w-5" />} label="Video" actionLabel="Add Video" onClick={() => triggerUpload("VIDEO")} />
              <UpdateAction icon={<FileText className="h-5 w-5" />} label="Text" actionLabel="Add Text" onClick={focusCommentBox} />
              <UpdateAction icon={<Mic className="h-5 w-5" />} label="Audio" actionLabel="Add Audio" onClick={() => triggerUpload("AUDIO")} />
              <UpdateAction icon={<Paperclip className="h-5 w-5" />} label="Attachment" actionLabel="Add Files" onClick={() => triggerUpload("ATTACHMENT")} />
           </div>

           {/* Updates Timeline */}
           <div className="space-y-6 pt-4 border-t border-slate-50">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Recent Activity</h3>
              <div className="space-y-6">
                 {issue?.updates?.map((update: any) => (
                    <div key={update.id} className="flex gap-4">
                       <Avatar className="h-8 w-8 rounded-xl">
                          <AvatarFallback className="bg-slate-100 text-slate-400 text-[10px] font-black">{update.user.name[0]}</AvatarFallback>
                       </Avatar>
                       <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between">
                             <p className="text-xs font-black text-slate-900">{update.user.name}</p>
                             <span className="text-[9px] font-bold text-slate-400">{dayjs(update.createdAt).fromNow()}</span>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-2xl text-xs font-medium text-slate-600 border border-slate-100/50 overflow-hidden break-words">
                             {update.type === "TEXT" && update.content}
                             {update.type === "PHOTO" && (
                                <img src={update.content} alt="Photo Update" className="max-w-full rounded-lg max-h-60 object-contain mx-auto" />
                             )}
                             {update.type === "VIDEO" && (
                                <video src={update.content} controls className="max-w-full rounded-lg max-h-60 mx-auto" />
                             )}
                             {update.type === "AUDIO" && (
                                <audio src={update.content} controls className="w-full mt-1" />
                             )}
                             {update.type === "ATTACHMENT" && (
                                <a href={update.content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 font-bold hover:underline">
                                   <Paperclip className="h-4 w-4 shrink-0" /> Download File Attachment
                                </a>
                             )}
                          </div>
                       </div>
                    </div>
                 ))}
                 {(!issue?.updates || issue.updates.length === 0) && (
                    <div className="text-center py-10 space-y-4">
                       <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto">
                          <MessageSquare className="h-8 w-8 text-slate-200" />
                       </div>
                       <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No comments yet</p>
                    </div>
                 )}
              </div>
           </div>
        </div>

        <div className="p-8 border-t border-slate-50 bg-slate-50/30">
           <div className="relative">
              <Textarea 
                ref={commentTextareaRef}
                placeholder="Type message..." 
                className="min-h-[100px] w-full rounded-[24px] bg-white border-slate-200/60 font-medium p-5 shadow-sm focus:shadow-md transition-all resize-none"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
              <Button 
                size="icon" 
                className="absolute right-4 bottom-4 h-10 w-10 bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-100 transition-transform active:scale-95"
                onClick={() => updateMutation.mutate({ type: 'TEXT', content: comment })}
                disabled={!comment.trim() || updateMutation.isPending}
              >
                 <Send className="h-4 w-4 text-white" />
              </Button>
           </div>
           <div className="mt-6 flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-12 rounded-2xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-100"
                onClick={() => {
                  onResolve(issueId!);
                  onClose();
                }}
                disabled={!issueId || issue?.status === 'Resolved'}
              >
                {issue?.status === 'Resolved' ? 'Resolved' : 'Resolve Issue'}
              </Button>
           </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function UpdateAction({ icon, label, actionLabel, onClick }: any) {
  return (
    <div 
      className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50 group hover:border-blue-200 hover:bg-white transition-all cursor-pointer"
      onClick={onClick}
    >
       <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
             {icon}
          </div>
          <span className="text-xs font-black text-slate-900">{label}</span>
       </div>
       <Button 
         variant="outline" 
         size="sm" 
         className="h-8 rounded-lg border-blue-200 text-blue-600 text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
       >
          {actionLabel}
       </Button>
    </div>
  );
}

function UserPlus(props: any) {
   return (
      <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
   )
}
