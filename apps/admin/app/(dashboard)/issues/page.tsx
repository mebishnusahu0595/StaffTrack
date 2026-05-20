"use client";

import React, { useState, useMemo } from "react";
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
  History
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
import { fetchIssues, fetchUsers, createIssue, updateIssue, addIssueUpdate, fetchIssue } from "@/lib/api";
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
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const issuesQuery = useQuery({
    queryKey: ["issues", search, activeTab],
    queryFn: () => fetchIssues({ search, status: activeTab })
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 100 })
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

  const issues = useMemo(() => issuesQuery.data ?? [], [issuesQuery.data]);

  const stats = useMemo(() => {
    return {
      total: issues.length,
      open: issues.filter(i => i.status === "Open").length,
      inProgress: issues.filter(i => i.status === "In Progress").length,
      resolved: issues.filter(i => i.status === "Resolved" || i.status === "Closed").length,
    };
  }, [issues]);

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
            onSubmit={(data: any) => createMutation.mutate(data)}
            isSubmitting={createMutation.isPending}
          />
        </Dialog>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Issues" value={stats.total} icon={<AlertTriangle className="h-6 w-6" />} color="blue" />
        <StatCard label="Open" value={stats.open} icon={<AlertCircle className="h-6 w-6" />} color="rose" />
        <StatCard label="In Progress" value={stats.inProgress} icon={<Clock className="h-6 w-6" />} color="amber" />
        <StatCard label="Resolved" value={stats.resolved} icon={<CheckCircle className="h-6 w-6" />} color="emerald" />
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
        </CardHeader>
        <CardContent className="p-0">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Issue Name</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Assigned To</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Team</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Status</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Priority</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Start Date</th>
                       <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Created By</th>
                       <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {issues.map(issue => (
                       <tr key={issue.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-3">
                                <div className={cn(
                                   "h-2 w-2 rounded-full",
                                   issue.status === "Open" ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                                )} />
                                <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{issue.title}</p>
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
                          <td className="py-6 text-xs font-bold text-slate-400">{issue.assignee?.group?.name || "General"}</td>
                          <td className="py-6 text-center">
                             <Badge className={cn(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-md border",
                                issue.status === "Open" ? "bg-orange-50 text-orange-600 border-orange-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                             )}>
                                {issue.status}
                             </Badge>
                          </td>
                          <td className="py-6 text-center">
                             <div className="flex items-center justify-center gap-1">
                                <div className={cn("h-0.5 w-4 rounded-full", issue.priority === 'Critical' ? 'bg-rose-500' : 'bg-blue-500')} />
                                <div className={cn("h-0.5 w-4 rounded-full", issue.priority === 'Critical' ? 'bg-rose-500' : 'bg-blue-100')} />
                             </div>
                          </td>
                          <td className="py-6 text-xs font-bold text-slate-500">{dayjs(issue.createdAt).format("DD-MM-YYYY, hh:mm A")}</td>
                          <td className="py-6">
                             <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-[8px] font-black text-emerald-600">R</div>
                                <span className="text-xs font-bold text-slate-600">{issue.reportedBy?.name}</span>
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
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
                                   <UserPlus className="h-4 w-4" />
                                </Button>
                             </div>
                          </td>
                       </tr>
                    ))}
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
    </div>
  );
}

function ReportIssueDialog({ users, onSubmit, isSubmitting }: any) {
  const [data, setData] = useState({ title: "", description: "", priority: "Medium", assigneeId: "" });

  return (
    <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] hide-close">
      <DialogHeader className="p-8 bg-blue-600 text-white relative">
        <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
           <X className="h-4 w-4" />
        </DialogClose>
        <DialogTitle className="text-2xl font-black">Report Issue</DialogTitle>
        <p className="text-blue-100 text-xs font-bold mt-1">Track system bugs or operational blockers.</p>
      </DialogHeader>
      <div className="p-8 space-y-6">
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
                 className="min-h-[100px] rounded-2xl bg-slate-50 border-none font-medium p-4" 
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
         </div>
         <Button 
          className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 rounded-2xl font-black uppercase tracking-widest text-xs"
          onClick={() => onSubmit(data)}
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

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
           {/* Action Grid */}
           <div className="grid grid-cols-1 gap-3">
              <UpdateAction icon={<Camera className="h-5 w-5" />} label="Photo" actionLabel="Add Photo" color="blue" />
              <UpdateAction icon={<Video className="h-5 w-5" />} label="Video" actionLabel="Add Video" color="blue" />
              <UpdateAction icon={<FileText className="h-5 w-5" />} label="Text" actionLabel="Add Text" color="blue" />
              <UpdateAction icon={<Mic className="h-5 w-5" />} label="Audio" actionLabel="Add Audio" color="blue" />
              <UpdateAction icon={<Paperclip className="h-5 w-5" />} label="Attachment" actionLabel="Add Files" color="blue" />
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
                          <div className="p-3 bg-slate-50 rounded-2xl text-xs font-medium text-slate-600 border border-slate-100/50">
                             {update.content}
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
              <Button variant="outline" className="flex-1 h-12 rounded-2xl border-slate-200 font-bold text-slate-600 hover:bg-white transition-all">Cancel</Button>
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

function UpdateAction({ icon, label, actionLabel, color }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50 group hover:border-blue-200 hover:bg-white transition-all cursor-pointer">
       <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
             {icon}
          </div>
          <span className="text-xs font-black text-slate-900">{label}</span>
       </div>
       <Button variant="outline" size="sm" className="h-8 rounded-lg border-blue-200 text-blue-600 text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
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
