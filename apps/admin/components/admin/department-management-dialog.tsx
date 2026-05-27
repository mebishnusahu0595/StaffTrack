"use client";

import React, { useState } from "react";
import { 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchGroups, createGroup, updateGroup, deleteGroup } from "@/lib/api";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DepartmentManagementDialogProps {
  trigger: React.ReactNode;
}

export function DepartmentManagementDialog({ trigger }: DepartmentManagementDialogProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  const [formData, setFormData] = useState<{ name: string; baseSalary: string; userIds: string[] }>({
    name: "",
    baseSalary: "0",
    userIds: []
  });

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
    enabled: isOpen
  });

  const groups = groupsQuery.data ?? [];
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  const createMutation = useMutation({
    mutationFn: (data: { name: string; baseSalary: number; userIds: string[] }) => createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsAddMode(false);
      setFormData({ name: "", baseSalary: "0", userIds: [] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, baseSalary, userIds }: { id: string; name: string; baseSalary: number; userIds: string[] }) => 
      updateGroup(id, { name, baseSalary, userIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingGroupId(null);
      setFormData({ name: "", baseSalary: "0", userIds: [] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const handleEditClick = (group: any) => {
    setEditingGroupId(group.id);
    setIsAddMode(false);
    setFormData({
      name: group.name,
      baseSalary: String(group.baseSalary || "0"),
      userIds: (group.members || []).map((m: any) => m.id)
    });
  };

  const handleCancelForm = () => {
    setIsAddMode(false);
    setEditingGroupId(null);
    setFormData({ name: "", baseSalary: "0", userIds: [] });
  };

  const handleFormSubmit = () => {
    const payload = {
      name: formData.name,
      baseSalary: parseFloat(formData.baseSalary),
      userIds: formData.userIds
    };

    if (editingGroupId) {
      updateMutation.mutate({ id: editingGroupId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isFormValid = formData.name.trim() !== "";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] md:max-h-[90vh] flex flex-col">
        <DialogHeader className="p-8 bg-slate-900 text-white flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <Users className="h-6 w-6 text-blue-500" />
              Manage Departments
            </DialogTitle>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Add, edit, or delete organization departments</p>
          </div>
          <DialogClose className="rounded-2xl bg-white/10 p-2 text-white/50 hover:bg-white/20 hover:text-white transition-all outline-none">
             <X className="h-5 w-5" />
          </DialogClose>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Create or Edit Form */}
          {(isAddMode || editingGroupId) ? (
            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-6 animate-in slide-in-from-top duration-300">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  {editingGroupId ? "Edit Department" : "Create Department"}
                </h3>
                <Button variant="ghost" size="sm" onClick={handleCancelForm} className="h-8 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-600">
                  Cancel
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Department Name *</Label>
                  <Input 
                    placeholder="e.g. Sales Raipur" 
                    className="h-11 rounded-xl bg-white border-slate-200" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <Button 
                onClick={handleFormSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || !isFormValid}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-100 text-xs uppercase tracking-widest gap-2"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingGroupId ? "Save Changes" : "Launch Department"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search departments..." 
                  className="h-10 pl-10 rounded-xl bg-slate-50 border-none focus:bg-white transition-all font-bold text-sm" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => setIsAddMode(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 h-10 font-bold gap-1 text-xs shadow-md shadow-blue-100"
              >
                <Plus className="h-4 w-4" /> Create
              </Button>
            </div>
          )}

          {/* Department List */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Available Departments ({filteredGroups.length})</h4>
            
            {groupsQuery.isLoading ? (
              <div className="space-y-2">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-6 text-slate-400">
                <Users className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm font-bold">No departments match your search</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {filteredGroups.map((group: any) => (
                  <div 
                    key={group.id} 
                    className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-200 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="text-sm font-black text-slate-900">{group.name}</h5>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEditClick(group)}
                        className="h-8 w-8 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Edit2 className="h-4 w-4" />
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
                        className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
