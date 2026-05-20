"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Folder, Plus, Search, MoreHorizontal, Target, LayoutGrid,
  List, KanbanSquare, Filter, ChevronDown, Eye, MoreVertical,
  CheckCircle, Clock, X, Pencil, Trash2, TrendingUp, Calendar,
  Tag, Building2, DollarSign, AlertCircle, Users, ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProjects, createProject, updateProject, deleteProject, fetchUsers } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

// ── Status color maps ────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Ongoing:   "bg-amber-50 text-amber-600 border-amber-200",
  Scheduled: "bg-blue-50 text-blue-600 border-blue-200",
  Completed: "bg-emerald-50 text-emerald-600 border-emerald-200",
};
const PRIORITY_COLORS: Record<string, string> = {
  Low:      "bg-slate-50 text-slate-500 border-slate-200",
  Medium:   "bg-yellow-50 text-yellow-600 border-yellow-200",
  High:     "bg-orange-50 text-orange-600 border-orange-200",
  Critical: "bg-rose-50 text-rose-600 border-rose-200",
};

// ── Outside click hook ───────────────────────────────────────────────────────
function useOutsideClick(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, cb]);
}

// ── Dot Menu ─────────────────────────────────────────────────────────────────
function DotMenu({ onEdit, onDelete, align = "right" }: {
  onEdit: () => void;
  onDelete: () => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null!);
  useOutsideClick(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost" size="icon"
        className="h-8 w-8 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
      >
        <MoreHorizontal className="h-5 w-5" />
      </Button>
      {open && (
        <div className={cn(
          "absolute top-9 z-50 min-w-[150px] rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/60 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150",
          align === "right" ? "right-0" : "left-0"
        )}>
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5 text-blue-500" /> Edit Details
          </button>
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Project Progress Modal ────────────────────────────────────────────────────
function ViewProgressModal({ project, onClose }: { project: any; onClose: () => void }) {
  const completedTasks = project.tasks?.filter((t: any) => t.status === "COMPLETED").length ?? 0;
  const totalTasks = project.tasks?.length ?? 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-0 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative">
          <button onClick={onClose} className="absolute top-5 right-5 text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">
              ID #{project.id?.slice(-6).toUpperCase()}
            </span>
            <Badge className={cn("text-[9px] font-black rounded-lg h-5 border", STATUS_COLORS[project.status] || STATUS_COLORS.Ongoing)}>
              {project.status}
            </Badge>
          </div>
          <h2 className="text-xl font-black">{project.name}</h2>
          <p className="text-blue-100 text-xs font-medium mt-1 line-clamp-2">{project.description || "No description provided."}</p>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Progress bar */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Overall Progress</span>
              <span className="text-xl font-black text-slate-900">{progress}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Tasks", value: totalTasks, color: "blue" },
              { label: "Completed",   value: completedTasks, color: "emerald" },
              { label: "Pending",     value: totalTasks - completedTasks, color: "amber" },
            ].map(stat => (
              <div key={stat.label} className={cn(
                "p-4 rounded-2xl text-center",
                stat.color === "blue" ? "bg-blue-50" : stat.color === "emerald" ? "bg-emerald-50" : "bg-amber-50"
              )}>
                <p className={cn("text-2xl font-black",
                  stat.color === "blue" ? "text-blue-700" : stat.color === "emerald" ? "text-emerald-700" : "text-amber-700"
                )}>{stat.value}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Task list */}
          {project.tasks?.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Task Breakdown</p>
              {project.tasks.map((task: any) => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-2 w-2 rounded-full flex-shrink-0",
                      task.status === "COMPLETED" ? "bg-emerald-500" :
                      task.status === "IN_PROGRESS" ? "bg-amber-500" : "bg-slate-300"
                    )} />
                    <span className="text-xs font-bold text-slate-700 line-clamp-1">{task.title}</span>
                  </div>
                  <Badge className={cn("text-[9px] font-black rounded-lg border",
                    task.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                    task.status === "IN_PROGRESS" ? "bg-amber-50 text-amber-600 border-amber-200" :
                    "bg-slate-50 text-slate-500 border-slate-200"
                  )}>
                    {task.status?.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Created date + extra info */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            {[
              { label: "Created", value: project.createdAt ? new Date(project.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "—" },
              { label: "Priority", value: project.priority || "Medium" },
              { label: "Department", value: project.department || "General" },
              { label: "Budget", value: project.budget ? `₹${Number(project.budget).toLocaleString()}` : "—" },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                <p className="text-xs font-bold text-slate-700 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Project Form (Create / Edit) ─────────────────────────────────────────────
function ProjectFormModal({
  mode, project, onClose, onSuccess
}: {
  mode: "create" | "edit";
  project?: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name:        project?.name        ?? "",
    description: project?.description ?? "",
    status:      project?.status      ?? "Ongoing",
    priority:    project?.priority    ?? "Medium",
    department:  project?.department  ?? "",
    budget:      project?.budget      ?? "",
    deadline:    project?.deadline    ? new Date(project.deadline).toISOString().split("T")[0] : "",
    tags:        project?.tags        ?? "",
    clientName:  project?.clientName  ?? "",
    objectives:  project?.objectives  ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Project name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, budget: form.budget ? Number(form.budget) : undefined };
      if (mode === "create") await createProject(payload);
      else await updateProject(project.id, payload);
      onSuccess();
    } catch {
      setError(mode === "create" ? "Failed to create project" : "Failed to update project");
    } finally {
      setSaving(false);
    }
  }

  const FIELD_CLS = "h-11 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-medium text-sm";
  const LABEL_CLS = "text-[10px] font-black uppercase tracking-wider text-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white relative">
          <button onClick={onClose} className="absolute top-5 right-5 text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-black">{mode === "create" ? "Create New Project" : "Edit Project"}</h2>
          <p className="text-blue-100 text-sm font-medium mt-1">
            {mode === "create" ? "Initiate a new high-level business objective." : "Update the project details below."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Row 1: Name */}
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Project Name *</Label>
            <Input value={form.name} onChange={set("name")} placeholder="e.g. Q4 Sales Strategy" className={FIELD_CLS} required />
          </div>

          {/* Row 2: Description */}
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Description</Label>
            <textarea
              value={form.description} onChange={set("description")}
              placeholder="Describe the project objective and goals..."
              rows={3}
              className="w-full rounded-2xl bg-slate-50 border border-slate-200/60 focus:bg-white transition-all font-medium text-sm px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Row 3: Objectives */}
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Key Objectives</Label>
            <textarea
              value={form.objectives} onChange={set("objectives")}
              placeholder="List the key goals or deliverables..."
              rows={2}
              className="w-full rounded-2xl bg-slate-50 border border-slate-200/60 focus:bg-white transition-all font-medium text-sm px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Row 4: Status + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className={LABEL_CLS}>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className={FIELD_CLS}><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl p-1.5">
                  <SelectItem value="Ongoing" className="rounded-xl font-bold">Ongoing</SelectItem>
                  <SelectItem value="Scheduled" className="rounded-xl font-bold">Scheduled</SelectItem>
                  <SelectItem value="Completed" className="rounded-xl font-bold">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL_CLS}>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className={FIELD_CLS}><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl p-1.5">
                  <SelectItem value="Low" className="rounded-xl font-bold">Low</SelectItem>
                  <SelectItem value="Medium" className="rounded-xl font-bold">Medium</SelectItem>
                  <SelectItem value="High" className="rounded-xl font-bold">High</SelectItem>
                  <SelectItem value="Critical" className="rounded-xl font-bold">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 5: Department + Client */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className={LABEL_CLS}>Department</Label>
              <Input value={form.department} onChange={set("department")} placeholder="e.g. Engineering" className={FIELD_CLS} />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL_CLS}>Client Name</Label>
              <Input value={form.clientName} onChange={set("clientName")} placeholder="e.g. Acme Corp" className={FIELD_CLS} />
            </div>
          </div>

          {/* Row 6: Budget + Deadline */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className={LABEL_CLS}>Budget (₹)</Label>
              <Input type="number" value={form.budget} onChange={set("budget")} placeholder="e.g. 500000" className={FIELD_CLS} />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL_CLS}>Deadline</Label>
              <Input type="date" value={form.deadline} onChange={set("deadline")} className={FIELD_CLS} />
            </div>
          </div>

          {/* Row 7: Tags */}
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Tags (comma separated)</Label>
            <Input value={form.tags} onChange={set("tags")} placeholder="e.g. marketing, q4, priority" className={FIELD_CLS} />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 rounded-2xl font-bold border-slate-200">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 rounded-2xl font-black text-sm uppercase tracking-widest"
              disabled={saving}
            >
              {saving ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "🚀 Launch Project" : "✓ Save Changes")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirmation ───────────────────────────────────────────────────────
function DeleteConfirmModal({ project, onClose, onConfirm, loading }: {
  project: any;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-200">
        <div className="h-16 w-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="h-8 w-8 text-rose-500" />
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-2">Delete Project?</h3>
        <p className="text-sm text-slate-500 font-medium mb-6">
          Are you sure you want to delete <strong className="text-slate-800">{project.name}</strong>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11 rounded-2xl font-bold border-slate-200">Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 font-black text-white"
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Stats Card ────────────────────────────────────────────────────────────────
function StatsCard({ label, value, subValue, icon: Icon, color }: any) {
  const colorMap: Record<string, string> = {
    blue:    "bg-blue-50 text-blue-600 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber:   "bg-amber-50 text-amber-600 ring-amber-100",
    indigo:  "bg-indigo-50 text-indigo-600 ring-indigo-100",
  };
  return (
    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-200/60 bg-white group hover:ring-blue-400 transition-all duration-300">
      <CardContent className="p-8">
        <div className="flex items-start justify-between">
          <div className="space-y-4">
            <div className={cn("p-3.5 rounded-2xl w-fit ring-1 transition-transform group-hover:scale-110 duration-300", colorMap[color])}>
              {Icon && <Icon className="h-6 w-6" />}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</p>
              <h3 className="text-3xl font-black text-slate-900">{value}</h3>
              <p className="text-xs font-bold text-slate-500">{subValue}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, onEdit, onDelete, onViewProgress }: {
  project: any;
  onEdit: () => void;
  onDelete: () => void;
  onViewProgress: () => void;
}) {
  const completed = project.tasks?.filter((t: any) => t.status === "COMPLETED").length ?? 0;
  const total = project.tasks?.length ?? 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-200/60 bg-white overflow-hidden group hover:ring-blue-400 hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-slate-400">ID #{project.id?.slice(-4).toUpperCase()}</span>
              <Badge className={cn("text-[9px] font-black uppercase rounded-lg h-5 border", STATUS_COLORS[project.status] || STATUS_COLORS.Ongoing)}>
                {project.status || "Ongoing"}
              </Badge>
              {project.priority && (
                <Badge className={cn("text-[9px] font-black uppercase rounded-lg h-5 border", PRIORITY_COLORS[project.priority] || PRIORITY_COLORS.Medium)}>
                  {project.priority}
                </Badge>
              )}
            </div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-tight line-clamp-1">
              {project.name}
            </h3>
          </div>
          <DotMenu onEdit={onEdit} onDelete={onDelete} />
        </div>

        {/* Description */}
        <p className="text-xs font-medium text-slate-500 line-clamp-2 leading-relaxed">
          {project.description || "No description provided."}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-50 pt-3">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3" />
            {project.department || "General"}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {project.createdAt ? new Date(project.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "Today"}
          </span>
        </div>

        {/* Task counts */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100 group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tasks</p>
            <p className="text-xl font-black text-slate-900">{project._count?.tasks || 0}</p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100 group-hover:bg-emerald-50/50 group-hover:border-emerald-100 transition-colors text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Done</p>
            <p className="text-xl font-black text-slate-900">{completed}</p>
          </div>
        </div>

        {/* Budget & Deadline */}
        {(project.budget || project.deadline) && (
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
            {project.budget && (
              <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> ₹{Number(project.budget).toLocaleString()}</span>
            )}
            {project.deadline && (
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />
                {new Date(project.deadline).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}
              </span>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span>Progress</span>
            <span className="text-slate-900">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Tags */}
        {project.tags && (
          <div className="flex flex-wrap gap-1.5">
            {String(project.tags).split(",").map((tag: string) => tag.trim()).filter(Boolean).map((tag: string) => (
              <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="pt-1 flex items-center justify-between border-t border-slate-50">
          <Button
            variant="outline"
            className="rounded-xl h-9 px-4 border-slate-200 text-xs font-bold gap-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
            onClick={onViewProgress}
          >
            <Eye className="h-3.5 w-3.5" /> View Progress
          </Button>
          <div className="flex -space-x-2">
            {project.tasks?.slice(0, 3).map((t: any, i: number) => (
              <Avatar key={i} className="h-7 w-7 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-100">
                <AvatarFallback className="bg-blue-50 text-[10px] font-black text-blue-600">
                  {t.assignedTo?.name?.[0] ?? "?"}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Modals state
  const [createOpen,   setCreateOpen]   = useState(false);
  const [editProject,  setEditProject]  = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [progressProject, setProgressProject] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ["projects", search],
    queryFn: () => fetchProjects({ search }),
  });

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const stats = useMemo(() => {
    const total = projects.length;
    const tasks = projects.reduce((a: number, p: any) => a + (p._count?.tasks || 0), 0);
    const ongoing   = projects.filter((p: any) => p.status === "Ongoing").length;
    const completed = projects.filter((p: any) => p.status === "Completed").length;
    return { total, tasks, ongoing, completed };
  }, [projects]);

  // Refresh after any mutation
  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeletingId(true);
    try {
      await deleteProject(deleteTarget.id);
      refresh();
      setDeleteTarget(null);
    } catch {
      alert("Failed to delete project");
    } finally {
      setDeletingId(false);
    }
  }

  const displayedProjects = showAll ? projects : projects.slice(0, 8);

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-700">

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {createOpen && (
        <ProjectFormModal
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { setCreateOpen(false); refresh(); }}
        />
      )}
      {editProject && (
        <ProjectFormModal
          mode="edit"
          project={editProject}
          onClose={() => setEditProject(null)}
          onSuccess={() => { setEditProject(null); refresh(); }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deletingId}
        />
      )}
      {progressProject && (
        <ViewProgressModal
          project={progressProject}
          onClose={() => setProgressProject(null)}
        />
      )}

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Folder className="h-3 w-3" /><span>Home / Projects</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Projects
            <Badge variant="outline" className="h-6 px-2 rounded-lg border-blue-100 bg-blue-50/50 text-blue-600 font-bold">
              {stats.total} Total
            </Badge>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-4 h-12 rounded-2xl bg-white border border-slate-200/60 shadow-sm text-xs font-bold text-slate-600">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            {user?.companyId ? "Company Workspace" : "StaffTrack Workspace"}
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-blue-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-5 w-5" /> Create Project
          </Button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
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
                placeholder="Search projects..."
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

        {/* ── Overview Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard label="Total Projects"  value={stats.total}     subValue={`${stats.ongoing} ongoing`}       icon={Folder}       color="blue" />
            <StatsCard label="Total Tasks"     value={stats.tasks}     subValue="Across all projects"               icon={Target}       color="emerald" />
            <StatsCard label="In Progress"     value={stats.ongoing}   subValue="Active projects"                   icon={Clock}        color="amber" />
            <StatsCard label="Completed"       value={stats.completed} subValue="Successfully delivered"            icon={CheckCircle}  color="indigo" />
          </div>

          {/* Project Cards */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900">All Projects</h2>
              {projects.length > 8 && (
                <Button
                  variant="ghost"
                  className="text-xs font-bold text-blue-600 hover:bg-blue-50 gap-2"
                  onClick={() => setShowAll(v => !v)}
                >
                  {showAll ? "Show Less" : `View All ${projects.length} Projects`}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")} />
                </Button>
              )}
            </div>

            {projectsQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-72 rounded-3xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : displayedProjects.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <Folder className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">No projects found</p>
                  <p className="text-xs text-slate-500">Get started by creating your first project.</p>
                </div>
                <Button variant="outline" className="rounded-xl font-bold gap-2" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> New Project
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {displayedProjects.map((project: any) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onEdit={() => setEditProject(project)}
                    onDelete={() => setDeleteTarget(project)}
                    onViewProgress={() => setProgressProject(project)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Task Progress Table */}
          <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
            <CardHeader className="p-8 border-b border-slate-100 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black text-slate-900">Task Progress</CardTitle>
                  <CardDescription className="text-xs font-medium text-slate-500 mt-1">Real-time status of task assignments per project.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-white">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-none">
                    <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">User Name</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Project</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Task</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400 text-center">Status</TableHead>
                    <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.flatMap((p: any) => p.tasks?.map((t: any) => ({ ...t, project: p })) || []).slice(0, 10).map((task: any, idx: number) => (
                    <TableRow key={idx} className="border-slate-100 hover:bg-slate-50/50 transition-colors group">
                      <TableCell className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-xl border-2 border-white shadow-sm ring-1 ring-slate-100">
                            <AvatarFallback className="bg-blue-50 text-blue-600 font-black text-xs">
                              {task.assignedTo?.name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {task.assignedTo?.name || "Unassigned"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-5 font-bold text-slate-700 text-xs">{task.project.name}</TableCell>
                      <TableCell className="py-5 text-xs text-slate-500 font-medium max-w-[160px] truncate">{task.title}</TableCell>
                      <TableCell className="py-5 text-center">
                        <Badge className={cn("text-[9px] font-black rounded-lg border",
                          task.status === "COMPLETED"  ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                          task.status === "IN_PROGRESS" ? "bg-amber-50 text-amber-600 border-amber-200" :
                          "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {task.status?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-8 py-5">
                        <div className="flex items-center gap-3 w-36">
                          <Progress value={task.status === "COMPLETED" ? 100 : task.status === "IN_PROGRESS" ? 50 : 0} className="h-2 flex-1 bg-slate-100" />
                          <span className="text-xs font-black text-slate-900">
                            {task.status === "COMPLETED" ? 100 : task.status === "IN_PROGRESS" ? 50 : 0}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {projects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-slate-400 font-bold text-xs">
                        No task data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Board Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="board" className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex gap-6 overflow-x-auto pb-8 snap-x">
            {[
              { title: "Ongoing Projects",   status: "Ongoing" },
              { title: "Scheduled Projects", status: "Scheduled" },
              { title: "Completed Projects", status: "Completed" },
            ].map(col => {
              const colProjects = projects.filter((p: any) => p.status === col.status);
              return (
                <div key={col.status} className="min-w-[320px] max-w-[320px] flex flex-col gap-5 snap-start">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-600 shadow-sm shadow-blue-200" />
                      <h3 className="font-black text-slate-900 tracking-tight">{col.title}</h3>
                      <span className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                        {colProjects.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-5">
                    {colProjects.map((p: any) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        onEdit={() => setEditProject(p)}
                        onDelete={() => setDeleteTarget(p)}
                        onViewProgress={() => setProgressProject(p)}
                      />
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => setCreateOpen(true)}
                      className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 text-xs font-black text-slate-400 hover:bg-white hover:text-blue-600 hover:border-blue-200 transition-all gap-2"
                    >
                      <Plus className="h-4 w-4" /> Add Project
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── List Tab ──────────────────────────────────────────────────────── */}
        <TabsContent value="list" className="animate-in slide-in-from-bottom-4 duration-500">
          <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
            <CardContent className="p-0 bg-white">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-none">
                    <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Project Name</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Status</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Priority</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400 text-center">Tasks</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Department</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Budget</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Created</TableHead>
                    <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project: any) => (
                    <TableRow key={project.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors group">
                      <TableCell className="px-8 py-5">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{project.name}</span>
                          <p className="text-[10px] font-medium text-slate-400">ID #{project.id.slice(-4).toUpperCase()}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <Badge className={cn("text-[9px] font-black rounded-lg border", STATUS_COLORS[project.status] || STATUS_COLORS.Ongoing)}>
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5">
                        <Badge className={cn("text-[9px] font-black rounded-lg border", PRIORITY_COLORS[project.priority] || PRIORITY_COLORS.Medium)}>
                          {project.priority || "Medium"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 text-center font-black text-slate-900">{project._count?.tasks || 0}</TableCell>
                      <TableCell className="py-5">
                        <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50/50 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          {project.department || "General"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 text-xs font-bold text-slate-600">
                        {project.budget ? `₹${Number(project.budget).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="py-5 text-xs font-bold text-slate-500">
                        {new Date(project.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"2-digit" })}
                      </TableCell>
                      <TableCell className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline" size="icon"
                            className="h-9 w-9 rounded-xl border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all"
                            onClick={() => setProgressProject(project)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline" size="icon"
                            className="h-9 w-9 rounded-xl border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all"
                            onClick={() => setEditProject(project)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline" size="icon"
                            className="h-9 w-9 rounded-xl border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all"
                            onClick={() => setDeleteTarget(project)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {projects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-slate-400 font-bold text-xs">
                        No projects found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
