"use client";

import React, { useState } from "react";
import { 
  Users, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Wallet, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  UserPlus,
  Trash2,
  Edit2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchGroups, createGroup, updateGroup, deleteGroup, fetchUsers } from "@/lib/api";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function GroupsPage() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState<{ name: string; baseSalary: string; userIds: string[] }>({ name: "", baseSalary: "", userIds: [] });
  const [editFormData, setEditFormData] = useState<{ name: string; baseSalary: string; userIds: string[] }>({ name: "", baseSalary: "", userIds: [] });

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups
  });

  const usersQuery = useQuery({
    queryKey: ["users", "groups"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 100 })
  });
  const employees = usersQuery.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (data: { name: string; baseSalary: number; userIds: string[] }) => createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsAddOpen(false);
      setFormData({ name: "", baseSalary: "", userIds: [] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, baseSalary, userIds }: { id: string; name: string; baseSalary: number; userIds: string[] }) => 
      updateGroup(id, { name, baseSalary, userIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsEditOpen(false);
      setSelectedGroupId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    }
  });

  const groups = groupsQuery.data ?? [];
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <ShieldCheck className="h-3 w-3" />
            <span>Organization / Departments</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Departments
            <Badge variant="outline" className="h-6 px-2 rounded-lg border-blue-100 bg-blue-50/50 text-blue-600 font-bold">
              {groups.length} Total
            </Badge>
          </h1>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-blue-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Plus className="h-5 w-5" /> Create Department
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-3xl">
            <DialogHeader className="p-8 bg-blue-600 text-white">
              <DialogTitle className="text-2xl font-black">Launch New Department</DialogTitle>
              <CardDescription className="text-blue-100 text-sm font-medium mt-1">Define a salary structure for a specific department or region.</CardDescription>
            </DialogHeader>
            <div className="p-8 space-y-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Department Name</Label>
                  <Input 
                    placeholder="e.g. Sales Team - Raipur" 
                    className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Base Salary (Monthly INR)</Label>
                  <Input 
                    type="number"
                    placeholder="30000" 
                    className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold" 
                    value={formData.baseSalary}
                    onChange={e => setFormData({...formData, baseSalary: e.target.value})}
                  />
                  <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-blue-500" />
                    Salary is distributed across all members.
                  </p>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Assign Members</Label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
                      {employees.map((emp: any) => {
                        const assignedGroup = emp.groupId ? groups.find((g: any) => g.id === emp.groupId) : null;
                        return (
                          <label 
                            key={emp.id} 
                            className={`flex items-center gap-3 p-1 rounded-lg transition-colors ${
                              emp.groupId ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-100/55"
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              checked={formData.userIds.includes(emp.id)}
                              disabled={!!emp.groupId}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, userIds: [...formData.userIds, emp.id] });
                                } else {
                                  setFormData({ ...formData, userIds: formData.userIds.filter(id => id !== emp.id) });
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700">
                                {emp.name} {assignedGroup && (
                                  <span className="text-[9px] text-red-500 font-bold lowercase bg-red-50 px-1.5 py-0.5 rounded-md ml-1.5 border border-red-100 font-mono">
                                    (in: {assignedGroup.name})
                                  </span>
                                )}
                              </span>
                              <span className="text-[9px] text-slate-400 uppercase tracking-tight">{emp.role}</span>
                            </div>
                          </label>
                        );
                      })}
                  </div>
               </div>
               <DialogFooter className="pt-4">
                 <Button 
                  onClick={() => createMutation.mutate({ name: formData.name, baseSalary: parseFloat(formData.baseSalary), userIds: formData.userIds })}
                  disabled={createMutation.isPending || !formData.name || !formData.baseSalary}
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 rounded-2xl font-black text-sm uppercase tracking-widest gap-2"
                 >
                   {createMutation.isPending ? "Configuring..." : "Launch Department"}
                 </Button>
               </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 bg-white">
          <CardContent className="p-6 flex items-center gap-4">
             <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Users className="h-6 w-6" />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Department Staff</p>
                <h3 className="text-2xl font-black text-slate-900">{groups.reduce((acc, g) => acc + g._count.members, 0)}</h3>
             </div>
          </CardContent>
        </Card>
        <Card className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 bg-white">
          <CardContent className="p-6 flex items-center gap-4">
             <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Wallet className="h-6 w-6" />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Monthly Payroll Budget</p>
                <h3 className="text-2xl font-black text-slate-900">₹{groups.reduce((acc, g) => acc + g.baseSalary, 0).toLocaleString()}</h3>
             </div>
          </CardContent>
        </Card>
        <Card className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 bg-white">
          <CardContent className="p-6 flex items-center gap-4">
             <div className="h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                <TrendingUp className="h-6 w-6" />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Average Department Salary</p>
                <h3 className="text-2xl font-black text-slate-900">
                  ₹{groups.length > 0 ? Math.round(groups.reduce((acc, g) => acc + g.baseSalary, 0) / groups.length).toLocaleString() : 0}
                </h3>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
        <Input 
          placeholder="Search departments..." 
          className="h-16 pl-14 rounded-3xl bg-white border-none shadow-sm ring-1 ring-slate-200/60 focus:ring-blue-400 transition-all font-bold text-lg" 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {groupsQuery.isLoading ? (
          Array(6).fill(0).map((_, i) => <div key={i} className="h-[280px] bg-white ring-1 ring-slate-100 animate-pulse rounded-[40px]" />)
        ) : filteredGroups.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center gap-6">
             <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300">
                <Users className="h-10 w-10" />
             </div>
             <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900">No departments found</h3>
                <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto">Try adjusting your search or launch a new department to start organizing your team.</p>
             </div>
             <Button variant="outline" className="rounded-2xl h-14 px-10 border-slate-200 font-black uppercase tracking-widest text-xs gap-3">
                <UserPlus className="h-5 w-5" /> New Department
             </Button>
          </div>
        ) : filteredGroups.map((group: any) => (
          <Card key={group.id} className="rounded-[40px] border-none shadow-sm ring-1 ring-slate-200/60 hover:ring-blue-400 hover:shadow-2xl hover:shadow-blue-900/5 transition-all group overflow-hidden bg-white">
             <CardHeader className="p-8 pb-4">
                <div className="flex items-center justify-between mb-8">
                   <div className="h-16 w-16 rounded-[24px] bg-slate-50 flex items-center justify-center text-blue-600 border border-slate-100 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                      <ShieldCheck className="h-8 w-8" />
                   </div>
                   <div className="flex items-center gap-2">
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         onClick={() => {
                           setSelectedGroupId(group.id);
                           setEditFormData({
                             name: group.name,
                             baseSalary: String(group.baseSalary),
                             userIds: (group.members || []).map((m: any) => m.id)
                           });
                           setIsEditOpen(true);
                         }}
                         className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                       >
                         <Edit2 className="h-5 w-5" />
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         onClick={() => {
                           if (confirm(`Are you sure you want to delete the department "${group.name}"?`)) {
                             deleteMutation.mutate(group.id);
                           }
                         }}
                         disabled={deleteMutation.isPending}
                         className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                       >
                         <Trash2 className="h-5 w-5" />
                       </Button>
                    </div>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl font-black text-slate-900 leading-tight">{group.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-lg bg-blue-50/50 border-blue-100 text-blue-600 font-black text-[10px] uppercase tracking-wider py-1">
                      ₹{group.baseSalary.toLocaleString()} / mo
                    </Badge>
                    <Badge variant="outline" className="rounded-lg bg-slate-50 border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-wider py-1">
                      Auto-Calc
                    </Badge>
                  </div>
                </div>
             </CardHeader>
             <CardContent className="p-8 pt-6 space-y-8">
                <div className="flex items-center justify-between py-6 border-y border-slate-50">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Staff</p>
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-3">
                          {Array(Math.min(4, group._count.members)).fill(0).map((_, i) => (
                             <div key={i} className="h-10 w-10 rounded-2xl bg-white ring-4 ring-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 shadow-sm overflow-hidden">
                                <Users className="h-5 w-5 opacity-40" />
                             </div>
                          ))}
                          {group._count.members > 4 && (
                            <div className="h-10 w-10 rounded-2xl bg-blue-600 ring-4 ring-white border border-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm">
                              +{group._count.members - 4}
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-black text-slate-900">{group._count.members} Members</span>
                      </div>
                   </div>
                </div>
                
                 <Button 
                   onClick={() => {
                     setSelectedGroupId(group.id);
                     setEditFormData({
                       name: group.name,
                       baseSalary: String(group.baseSalary),
                       userIds: (group.members || []).map((m: any) => m.id)
                     });
                     setIsEditOpen(true);
                   }}
                   className="w-full h-14 bg-slate-50 hover:bg-blue-600 text-slate-600 hover:text-white rounded-2xl font-black uppercase tracking-widest text-xs gap-3 shadow-none transition-all duration-300"
                 >
                   Manage Department <ArrowRight className="h-4 w-4" />
                 </Button>
             </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-3xl">
          <DialogHeader className="p-8 bg-blue-600 text-white">
            <DialogTitle className="text-2xl font-black">Edit Department</DialogTitle>
            <CardDescription className="text-blue-100 text-sm font-medium mt-1">Modify department details and member assignments.</CardDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Department Name</Label>
                <Input 
                  placeholder="e.g. Sales Team - Raipur" 
                  className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold" 
                  value={editFormData.name}
                  onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                />
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Base Salary (Monthly INR)</Label>
                <Input 
                  type="number"
                  placeholder="30000" 
                  className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold" 
                  value={editFormData.baseSalary}
                  onChange={e => setEditFormData({...editFormData, baseSalary: e.target.value})}
                />
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Assign Members</Label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
                   {employees.map((emp: any) => {
                      const isAssignedElsewhere = emp.groupId && emp.groupId !== selectedGroupId;
                      const assignedGroup = isAssignedElsewhere ? groups.find((g: any) => g.id === emp.groupId) : null;
                      return (
                        <label 
                          key={emp.id} 
                          className={`flex items-center gap-3 p-1 rounded-lg transition-colors ${
                            isAssignedElsewhere ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-100/50"
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={editFormData.userIds.includes(emp.id)}
                            disabled={isAssignedElsewhere}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditFormData({ ...editFormData, userIds: [...editFormData.userIds, emp.id] });
                              } else {
                                setEditFormData({ ...editFormData, userIds: editFormData.userIds.filter(id => id !== emp.id) });
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">
                              {emp.name} {assignedGroup && (
                                <span className="text-[9px] text-red-500 font-bold lowercase bg-red-50 px-1.5 py-0.5 rounded-md ml-1.5 border border-red-100 font-mono">
                                  (in: {assignedGroup.name})
                                </span>
                              )}
                            </span>
                            <span className="text-[9px] text-slate-400 uppercase tracking-tight">{emp.role}</span>
                          </div>
                        </label>
                      );
                    })}
                </div>
             </div>
             <DialogFooter className="pt-4">
               <Button 
                onClick={() => updateMutation.mutate({ id: selectedGroupId!, name: editFormData.name, baseSalary: parseFloat(editFormData.baseSalary), userIds: editFormData.userIds })}
                disabled={updateMutation.isPending || !editFormData.name || !editFormData.baseSalary}
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 rounded-2xl font-black text-sm uppercase tracking-widest gap-2"
               >
                 {updateMutation.isPending ? "Saving..." : "Save Changes"}
               </Button>
             </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
