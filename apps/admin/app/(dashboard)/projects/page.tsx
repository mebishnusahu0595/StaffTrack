"use client";

import React, { useState, useMemo } from "react";
import { 
  Folder, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Target, 
  LayoutGrid, 
  List, 
  KanbanSquare, 
  Filter, 
  ChevronDown, 
  Eye,
  MoreVertical,
  CheckCircle,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProjects, createProject } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

// --- Internal Components ---

const StatsCard = ({ label, value, subValue, icon: Icon, color }: any) => {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100 ring-blue-500/20",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 ring-emerald-500/20",
    amber: "bg-amber-50 text-amber-600 border-amber-100 ring-amber-500/20",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100 ring-indigo-500/20",
  };

  return (
    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-200/60 bg-white group hover:ring-blue-400 transition-all duration-300">
      <CardContent className="p-8">
        <div className="flex items-start justify-between">
          <div className="space-y-4">
            <div className={cn("p-3.5 rounded-2xl w-fit transition-transform group-hover:scale-110 duration-300", colorMap[color])}>
              {Icon && <Icon className="h-6 w-6" />}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</p>
              <div className="flex items-baseline gap-2">
                 <h3 className="text-3xl font-black text-slate-900">{value}</h3>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{subValue.split(' ')[0]}</span>
              </div>
              <p className="text-xs font-bold text-slate-500">{subValue}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ProjectCard = ({ project }: { project: any }) => {
  return (
    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-200/60 bg-white overflow-hidden group hover:ring-blue-400 hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300">
      <div className="p-8 space-y-6">
        <div className="flex items-start justify-between">
           <div className="space-y-1">
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-slate-400">ID #{project.id?.slice(-4).toUpperCase() || "NEW"}</span>
                 <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[9px] font-black uppercase tracking-wider rounded-lg h-5">
                    {project.status || "Ongoing"}
                 </Badge>
              </div>
              <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">{project.name}</h3>
           </div>
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-slate-400 hover:bg-slate-50"><MoreHorizontal className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="rounded-2xl p-1.5 min-w-[140px]">
                 <DropdownMenuItem className="rounded-xl font-bold text-xs focus:bg-slate-50">Edit Details</DropdownMenuItem>
                 <DropdownMenuItem className="rounded-xl font-bold text-xs text-red-600 focus:bg-red-50">Delete</DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
        </div>

        <p className="text-xs font-medium text-slate-500 line-clamp-2 leading-relaxed h-8">
          {project.description || "No description available for this project initiative."}
        </p>

        <div className="pt-2 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-50 pt-4">
           <span>Admin Console</span>
           <span className="text-slate-900">{project.createdAt ? new Date(project.createdAt).toLocaleDateString() : "Today"}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Single Task</p>
            <p className="text-xl font-black text-slate-900">{project._count?.tasks || 0}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 group-hover:bg-emerald-50/50 group-hover:border-emerald-100 transition-colors">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Group Task</p>
            <p className="text-xl font-black text-slate-900">0</p>
          </div>
        </div>

        <div className="space-y-3">
           <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Progress</span>
              <span className="text-slate-900">0%</span>
           </div>
           <Progress value={0} className="h-2 bg-slate-100" />
        </div>

        <div className="pt-2 flex items-center justify-between">
           <Button variant="outline" className="rounded-xl h-10 px-4 border-slate-200 text-xs font-bold gap-2 text-slate-600 hover:bg-slate-50">
              <Eye className="h-4 w-4" /> View Progress
           </Button>
           <div className="flex -space-x-2">
              <Avatar className="h-8 w-8 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-100">
                 <AvatarFallback className="bg-blue-50 text-[10px] font-black text-blue-600">R</AvatarFallback>
              </Avatar>
              <Avatar className="h-8 w-8 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-100">
                 <AvatarFallback className="bg-emerald-50 text-[10px] font-black text-emerald-600">A</AvatarFallback>
              </Avatar>
           </div>
        </div>
      </div>
    </Card>
  );
};

const BoardColumn = ({ title, projects, count, onAddClick }: any) => {
  return (
    <div className="min-w-[320px] max-w-[320px] flex flex-col gap-6 snap-start">
      <div className="flex items-center justify-between px-2">
         <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-blue-600 shadow-sm shadow-blue-200" />
            <h3 className="font-black text-slate-900 tracking-tight">{title}</h3>
            <span className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
               {count}
            </span>
         </div>
         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-50">
            <MoreHorizontal className="h-4 w-4" />
         </Button>
      </div>

      <div className="flex flex-col gap-6">
         {projects.map((p: any) => (
           <ProjectCard key={p.id} project={p} />
         ))}
         <Button 
           variant="outline" 
           onClick={onAddClick}
           className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 text-xs font-black text-slate-400 hover:bg-white hover:text-blue-600 hover:border-blue-200 transition-all gap-2"
         >
            <Plus className="h-4 w-4" /> Add Project
         </Button>
      </div>
    </div>
  );
};

const CreateProjectDialogContent = ({ onSuccess }: { onSuccess: () => void }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Ongoing");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createProject({ name, description, status });
      onSuccess();
    } catch (error) {
      alert("Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-3xl">
      <DialogHeader className="p-8 bg-blue-600 text-white">
        <DialogTitle className="text-2xl font-black">Create New Project</DialogTitle>
        <DialogDescription className="text-blue-100 text-sm font-medium mt-1">Initiate a new high-level business objective.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Project Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Q4 Sales Strategy" 
              className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold" 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Description</Label>
            <Input 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Objective and goals..." 
              className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Initial Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 font-bold">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl p-1.5 bg-white border border-slate-200">
                <SelectItem value="Ongoing" className="rounded-xl font-bold">Ongoing</SelectItem>
                <SelectItem value="Scheduled" className="rounded-xl font-bold">Scheduled</SelectItem>
                <SelectItem value="Completed" className="rounded-xl font-bold">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="pt-4">
          <Button type="submit" className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 rounded-2xl font-black text-sm uppercase tracking-widest gap-2" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Launch Project"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

// --- Main Page Component ---

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const projectsQuery = useQuery({
    queryKey: ["projects", search],
    queryFn: () => fetchProjects({ search })
  });

  const projects = projectsQuery.data ?? [];

  const stats = useMemo(() => {
    const total = projects.length;
    const tasks = projects.reduce((acc, p) => acc + (p._count?.tasks || 0), 0);
    const ongoing = projects.filter(p => p.status === "Ongoing").length;
    const completed = projects.filter(p => p.status === "Completed").length;
    return { total, tasks, ongoing, completed };
  }, [projects]);

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Folder className="h-3 w-3" />
            <span>Home / Project</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Projects
            <Badge variant="outline" className="h-6 px-2 rounded-lg border-blue-100 bg-blue-50/50 text-blue-600 font-bold">
              {stats.total} Active
            </Badge>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-4 h-12 rounded-2xl bg-white border border-slate-200/60 shadow-sm text-xs font-bold text-slate-600">
             <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
             {"STAFFTRACK GROUPS"}
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-blue-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
                <Plus className="h-5 w-5" /> Create Project
              </Button>
            </DialogTrigger>
            <CreateProjectDialogContent onSuccess={() => {
              setIsCreateOpen(false);
              queryClient.invalidateQueries({ queryKey: ["projects"] });
            }} />
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <TabsList className="bg-white p-1 rounded-2xl border border-slate-200/60 shadow-sm h-14 w-fit">
            <TabsTrigger value="overview" className="rounded-xl px-8 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-bold text-slate-500 gap-2">
              <LayoutGrid className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="board" className="rounded-xl px-8 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-bold text-slate-500 gap-2">
              <KanbanSquare className="h-4 w-4" /> Board
            </TabsTrigger>
            <TabsTrigger value="list" className="rounded-xl px-8 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-bold text-slate-500 gap-2">
              <List className="h-4 w-4" /> List
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-200/60 shadow-sm w-full md:w-96">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search project name..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 h-11 border-none bg-transparent shadow-none font-medium focus-visible:ring-0" 
              />
            </div>
            <Button variant="outline" className="h-11 w-11 p-0 rounded-xl border-slate-200/60 text-slate-400 hover:bg-slate-50">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard 
              label="Active Projects" 
              value={stats.ongoing} 
              subValue={`${stats.total} total projects`}
              icon={Folder}
              color="blue"
            />
            <StatsCard 
              label="Total Tasks" 
              value={stats.tasks} 
              subValue="Across all projects"
              icon={Target}
              color="emerald"
            />
            <StatsCard 
              label="Ongoing" 
              value={stats.ongoing} 
              subValue="Tasks in progress"
              icon={Clock}
              color="amber"
            />
            <StatsCard 
              label="Completed" 
              value={stats.completed} 
              subValue="Successfully delivered"
              icon={CheckCircle}
              color="indigo"
            />
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900">All Projects</h2>
              <Button variant="ghost" className="text-xs font-bold text-blue-600 hover:bg-blue-50 gap-2">
                View All Projects <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {projects.map((project: any) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              {projects.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <Folder className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">No projects found</p>
                    <p className="text-xs text-slate-500">Get started by creating your first project initiative.</p>
                  </div>
                  <Button variant="outline" className="rounded-xl font-bold gap-2" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4" /> New Project
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Task Progress Table */}
          <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
            <CardHeader className="p-8 border-b border-slate-100 bg-white">
               <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black text-slate-900">Task Progress</CardTitle>
                    <CardDescription className="text-xs font-medium text-slate-500 mt-1">Real-time status of user task assignments.</CardDescription>
                  </div>
                  <Tabs defaultValue="user-wise">
                    <TabsList className="bg-slate-50 rounded-xl h-10 p-1">
                      <TabsTrigger value="user-wise" className="rounded-lg px-4 h-full text-[10px] font-black uppercase data-[state=active]:bg-white data-[state=active]:text-blue-600">User Wise</TabsTrigger>
                      <TabsTrigger value="task-wise" className="rounded-lg px-4 h-full text-[10px] font-black uppercase data-[state=active]:bg-white data-[state=active]:text-blue-600">Task Wise</TabsTrigger>
                      <TabsTrigger value="team-wise" className="rounded-lg px-4 h-full text-[10px] font-black uppercase data-[state=active]:bg-white data-[state=active]:text-blue-600">Team Wise</TabsTrigger>
                    </TabsList>
                  </Tabs>
               </div>
            </CardHeader>
            <CardContent className="p-0 bg-white">
               <Table>
                 <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-none">
                      <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">User Name</TableHead>
                      <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Project</TableHead>
                      <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400 text-center">Total Tasks</TableHead>
                      <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Team</TableHead>
                      <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Progress</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {projects.flatMap((p: any) => p.tasks?.map((t: any) => ({ ...t, project: p })) || []).map((task: any, idx: number) => (
                      <TableRow key={idx} className="border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer group">
                        <TableCell className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 rounded-xl border-2 border-white shadow-sm ring-1 ring-slate-100">
                               <AvatarImage src={task.assignedTo?.avatarUrl} />
                               <AvatarFallback className="bg-blue-50 text-blue-600 font-black text-xs">
                                 {task.assignedTo?.name?.charAt(0) || "U"}
                               </AvatarFallback>
                            </Avatar>
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{task.assignedTo?.name || "Unassigned"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-700 text-xs">{task.project.name}</span>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{task.title}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-5 text-center font-black text-slate-900">1</TableCell>
                        <TableCell className="py-5">
                           <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50/50 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                              {task.project.department || "General"}
                           </Badge>
                        </TableCell>
                        <TableCell className="px-8 py-5">
                          <div className="flex items-center gap-4 w-48">
                            <Progress value={task.status === "COMPLETED" ? 100 : 0} className="h-2 flex-1 bg-slate-100" />
                            <span className="text-xs font-black text-slate-900">{task.status === "COMPLETED" ? 100 : 0}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {projects.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                          No task performance data available
                        </TableCell>
                      </TableRow>
                    )}
                 </TableBody>
               </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="board" className="animate-in slide-in-from-bottom-4 duration-500">
           <div className="flex gap-6 overflow-x-auto pb-8 snap-x">
             <BoardColumn title="Ongoing Projects" projects={projects.filter((p: any) => p.status === "Ongoing")} count={projects.filter((p: any) => p.status === "Ongoing").length} onAddClick={() => setIsCreateOpen(true)} />
             <BoardColumn title="Scheduled Projects" projects={projects.filter((p: any) => p.status === "Scheduled")} count={projects.filter((p: any) => p.status === "Scheduled").length} onAddClick={() => setIsCreateOpen(true)} />
             <BoardColumn title="Completed Projects" projects={projects.filter((p: any) => p.status === "Completed")} count={projects.filter((p: any) => p.status === "Completed").length} onAddClick={() => setIsCreateOpen(true)} />
             <div className="min-w-[320px] h-[500px] rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 bg-white/50">
                <Button variant="outline" className="rounded-2xl h-14 px-8 border-slate-200 font-black text-slate-500 hover:bg-white hover:text-blue-600 hover:border-blue-200 transition-all gap-2" onClick={() => setIsCreateOpen(true)}>
                   <Plus className="h-5 w-5" /> New Project
                </Button>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Add more categories</p>
             </div>
           </div>
        </TabsContent>

        <TabsContent value="list" className="animate-in slide-in-from-bottom-4 duration-500">
           <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
              <CardContent className="p-0 bg-white">
                 <Table>
                    <TableHeader className="bg-slate-50/50">
                       <TableRow className="border-none">
                          <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Project Name</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Assigned To</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400 text-center">Total Tasks</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Department</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Tag</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Created By</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Created On</TableHead>
                          <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Actions</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {projects.map((project: any) => (
                          <TableRow key={project.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors group">
                             <TableCell className="px-8 py-5">
                                <div className="space-y-1">
                                   <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{project.name}</span>
                                   <p className="text-[10px] font-medium text-slate-400">ID #{project.id.slice(-4).toUpperCase()}</p>
                                </div>
                             </TableCell>
                             <TableCell className="py-5">
                                <div className="flex -space-x-3">
                                   {project.tasks?.slice(0, 3).map((t: any, i: number) => (
                                      <Avatar key={i} className="h-8 w-8 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-100">
                                         <AvatarImage src={t.assignedTo?.avatarUrl} />
                                         <AvatarFallback className="bg-slate-100 text-[10px] font-black">{t.assignedTo?.name?.charAt(0)}</AvatarFallback>
                                      </Avatar>
                                   ))}
                                   {project._count?.tasks > 3 && (
                                      <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-[10px] font-black text-blue-600 ring-2 ring-white shadow-sm border border-blue-100">
                                         +{project._count.tasks - 3}
                                      </div>
                                   )}
                                </div>
                             </TableCell>
                             <TableCell className="py-5 text-center font-black text-slate-900">{project._count?.tasks || 0}</TableCell>
                             <TableCell className="py-5">
                                <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50/50 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                   {project.department || "Agrotech"}
                                </Badge>
                             </TableCell>
                             <TableCell className="py-5">
                                <Badge className="rounded-lg bg-blue-50 text-blue-600 border-blue-100 text-[10px] font-bold">
                                   {project.status}
                                </Badge>
                             </TableCell>
                             <TableCell className="py-5">
                                <div className="flex items-center gap-2">
                                   <div className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center text-[10px] font-black text-emerald-600 border border-emerald-100">S</div>
                                   <span className="text-xs font-bold text-slate-700">Admin</span>
                                </div>
                             </TableCell>
                             <TableCell className="py-5">
                                <span className="text-xs font-bold text-slate-500">{new Date(project.createdAt).toLocaleDateString()}</span>
                             </TableCell>
                             <TableCell className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                   <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all">
                                      <Eye className="h-4 w-4" />
                                   </Button>
                                   <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                         <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-slate-200 text-slate-400">
                                            <MoreVertical className="h-4 w-4" />
                                         </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="rounded-2xl p-1.5 border-slate-200/60 shadow-xl min-w-[160px] bg-white">
                                         <DropdownMenuItem className="rounded-xl font-bold text-slate-600 focus:bg-blue-50 focus:text-blue-600 cursor-pointer">Edit Project</DropdownMenuItem>
                                         <DropdownMenuItem className="rounded-xl font-bold text-slate-600 focus:bg-blue-50 focus:text-blue-600 cursor-pointer">Archive</DropdownMenuItem>
                                         <DropdownMenuItem className="rounded-xl font-bold text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer">Delete Project</DropdownMenuItem>
                                      </DropdownMenuContent>
                                   </DropdownMenu>
                                </div>
                             </TableCell>
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
