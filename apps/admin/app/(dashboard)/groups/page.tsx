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
import { fetchGroups, createGroup } from "@/lib/api";
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
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState({ name: "", baseSalary: "" });

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups
  });

  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsAddOpen(false);
      setFormData({ name: "", baseSalary: "" });
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
            <span>Organization / Groups</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Employee Groups
            <Badge variant="outline" className="h-6 px-2 rounded-lg border-blue-100 bg-blue-50/50 text-blue-600 font-bold">
              {groups.length} Total
            </Badge>
          </h1>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-blue-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Plus className="h-5 w-5" /> Create Group
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-3xl">
            <DialogHeader className="p-8 bg-blue-600 text-white">
              <DialogTitle className="text-2xl font-black">Launch New Group</DialogTitle>
              <CardDescription className="text-blue-100 text-sm font-medium mt-1">Define a salary structure for a specific department or region.</CardDescription>
            </DialogHeader>
            <div className="p-8 space-y-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Group Name</Label>
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
               <DialogFooter className="pt-4">
                 <Button 
                  onClick={() => createMutation.mutate({ name: formData.name, baseSalary: parseFloat(formData.baseSalary) })}
                  disabled={createMutation.isPending || !formData.name || !formData.baseSalary}
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 rounded-2xl font-black text-sm uppercase tracking-widest gap-2"
                 >
                   {createMutation.isPending ? "Configuring..." : "Launch Group"}
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
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Grouped Staff</p>
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
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Average Group Salary</p>
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
          placeholder="Search groups by name or department..." 
          className="h-16 pl-14 rounded-3xl bg-white border-none shadow-sm ring-1 ring-slate-200/60 focus:ring-blue-400 transition-all font-bold text-lg" 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {groupsQuery.isLoading ? (
          Array(6).fill(0).map((_, i) => <div key={i} className="h-[280px] bg-white ring-1 ring-slate-100 animate-pulse rounded-[40px]" />)
        ) : filteredGroups.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center gap-6">
             <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300">
                <Users className="h-10 w-10" />
             </div>
             <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900">No groups found</h3>
                <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto">Try adjusting your search or launch a new group to start organizing your team.</p>
             </div>
             <Button variant="outline" className="rounded-2xl h-14 px-10 border-slate-200 font-black uppercase tracking-widest text-xs gap-3">
                <UserPlus className="h-5 w-5" /> New Group
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
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <Edit2 className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
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
                
                <Button className="w-full h-14 bg-slate-50 hover:bg-blue-600 text-slate-600 hover:text-white rounded-2xl font-black uppercase tracking-widest text-xs gap-3 shadow-none transition-all duration-300">
                  Manage Group <ArrowRight className="h-4 w-4" />
                </Button>
             </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
