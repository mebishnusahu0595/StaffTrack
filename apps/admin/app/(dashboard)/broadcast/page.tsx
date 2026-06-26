"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Send, 
  Users, 
  User, 
  Search, 
  Megaphone, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fetchUsers, sendBroadcast } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function BroadcastPage() {
  const [targetAudience, setTargetAudience] = useState<"ALL" | "SELECT">("ALL");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch all active users (staffs/managers) to select from
  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ["users", "broadcast-list"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 1000 })
  });

  const staffList = useMemo(() => {
    return (usersData?.items ?? []).filter(
      (u: any) => u.role === "EMPLOYEE" || u.role === "MANAGER"
    );
  }, [usersData]);

  // Filter staff by search query
  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staffList;
    const term = search.toLowerCase();
    return staffList.filter(
      (u: any) => 
        u.name?.toLowerCase().includes(term) || 
        u.email?.toLowerCase().includes(term) ||
        u.designation?.toLowerCase().includes(term)
    );
  }, [staffList, search]);

  const selectedCount = useMemo(() => {
    return Object.values(selectedUserIds).filter(Boolean).length;
  }, [selectedUserIds]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const selectAllFiltered = () => {
    const nextSelections = { ...selectedUserIds };
    filteredStaff.forEach((u: any) => {
      nextSelections[u.id] = true;
    });
    setSelectedUserIds(nextSelections);
  };

  const deselectAllFiltered = () => {
    const nextSelections = { ...selectedUserIds };
    filteredStaff.forEach((u: any) => {
      nextSelections[u.id] = false;
    });
    setSelectedUserIds(nextSelections);
  };

  // Broadcast Mutation
  const broadcastMutation = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: (res: any) => {
      if (res.success) {
        setSuccessMsg(`Notification successfully broadcasted to ${res.count} staff members!`);
        setTitle("");
        setMessage("");
        setSelectedUserIds({});
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(res.message || "Failed to send notification.");
        setTimeout(() => setErrorMsg(null), 5000);
      }
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error ?? err.message ?? "An error occurred.");
      setTimeout(() => setErrorMsg(null), 5000);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    if (targetAudience === "SELECT" && selectedCount === 0) {
      setErrorMsg("Please select at least one staff member to send the broadcast to.");
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    const payload = {
      title: title.trim(),
      message: message.trim(),
      allSelected: targetAudience === "ALL",
      userIds: targetAudience === "SELECT" ? Object.keys(selectedUserIds).filter(id => selectedUserIds[id]) : undefined
    };

    broadcastMutation.mutate(payload);
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Megaphone className="h-3 w-3" />
            <span>Home / Notifications</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Push Notification Broadcast
            <Badge variant="outline" className="h-6 px-2 rounded-lg border-blue-100 bg-blue-50/50 text-blue-600 font-bold">
              Live Push
            </Badge>
          </h1>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 font-bold text-sm flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 font-bold text-sm flex items-center gap-3 animate-in fade-in duration-300">
          <AlertCircle className="h-5 w-5 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form and Selection Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form Card */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">Notification Details</CardTitle>
              <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-wider">Compose a push notification to send to device tray.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Target Audience Switcher */}
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Target Audience</Label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setTargetAudience("ALL")}
                      className={cn(
                        "py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                        targetAudience === "ALL" 
                          ? "bg-white text-blue-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      All Staffs
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetAudience("SELECT")}
                      className={cn(
                        "py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                        targetAudience === "SELECT" 
                          ? "bg-white text-blue-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Select Staffs {selectedCount > 0 && `(${selectedCount})`}
                    </button>
                  </div>
                </div>

                {/* Notification Title */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-[10px] font-black uppercase text-slate-400">Notification Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g. System Maintenance Notice"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs"
                    required
                  />
                </div>

                {/* Notification Message */}
                <div className="space-y-2">
                  <Label htmlFor="message" className="text-[10px] font-black uppercase text-slate-400">Message Body</Label>
                  <textarea
                    id="message"
                    placeholder="Describe what you want to broadcast to staff devices..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={5}
                    className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 placeholder-slate-400 text-slate-700 resize-none"
                    required
                  />
                </div>

                {/* Send Button */}
                <Button
                  type="submit"
                  disabled={broadcastMutation.isPending || !title.trim() || !message.trim()}
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 rounded-2xl font-black uppercase tracking-widest text-xs gap-2"
                >
                  {broadcastMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Send Broadcast Notification
                    </>
                  )}
                </Button>

              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: User Selection Panel */}
        <div className="lg:col-span-7 space-y-6">
          {targetAudience === "ALL" ? (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-[32px] bg-white/50 min-h-[400px] text-center">
              <Megaphone className="h-12 w-12 text-blue-500/20 mb-4 animate-bounce" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Broadcasting to All Staffs</h3>
              <p className="text-xs font-bold text-slate-400 mt-2 max-w-sm">This alert will trigger real-time push notifications on all active employee and manager devices logged into the StaffTrack mobile application.</p>
            </div>
          ) : (
            <Card className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white flex flex-col h-[600px]">
              
              {/* Card Header & Controls */}
              <CardHeader className="p-8 pb-4 shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">Select Audience</CardTitle>
                    <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-wider">Choose specific team members to receive this alert.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={selectAllFiltered}
                      className="rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-slate-50"
                    >
                      Select All
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={deselectAllFiltered}
                      className="rounded-xl font-black text-[9px] uppercase tracking-wider text-rose-500 hover:bg-rose-50"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Selection Search Bar */}
                <div className="relative mt-4">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search staffs by name, email, or designation..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-11 h-11 border-slate-200 bg-slate-50/50 rounded-xl text-xs font-semibold"
                  />
                </div>
              </CardHeader>

              {/* Scrollable User List */}
              <CardContent className="p-8 pt-0 overflow-y-auto flex-1 custom-scrollbar">
                {isUsersLoading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
                ) : filteredStaff.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No active staff members found</div>
                ) : (
                  <div className="space-y-2 mt-1">
                    {filteredStaff.map((staff: any) => {
                      const isSelected = Boolean(selectedUserIds[staff.id]);
                      return (
                        <div
                          key={staff.id}
                          onClick={() => toggleUser(staff.id)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer",
                            isSelected 
                              ? "bg-blue-50/60 border-blue-200 shadow-sm"
                              : "bg-white border-slate-100 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <Avatar className="h-10 w-10 border border-slate-150 shadow-inner">
                                {staff.avatarUrl ? (
                                  <img src={staff.avatarUrl} alt={staff.name} className="h-full w-full object-cover" />
                                ) : (
                                  <AvatarFallback className="bg-slate-100 text-slate-400">
                                    <User className="h-5 w-5" />
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              {staff.expoPushToken ? (
                                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" title="Device token registered" />
                              ) : (
                                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-slate-350 ring-2 ring-white" title="No device token" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{staff.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                {staff.designation || "Staff"} • {staff.group?.name || "General"}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Badge className={cn(
                              "text-[8px] font-black uppercase px-2 py-0.5 rounded border shadow-sm",
                              staff.role === "MANAGER"
                                ? "bg-amber-50 text-amber-600 border-amber-100"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            )}>
                              {staff.role}
                            </Badge>
                            
                            <div className={cn(
                              "h-6 w-6 rounded-full border flex items-center justify-center transition-all",
                              isSelected 
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-100"
                                : "border-slate-200 bg-white"
                            )}>
                              {isSelected && <Check className="h-3.5 w-3.5" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>

              {/* Status footer inside selection panel */}
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 shrink-0 text-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Showing {filteredStaff.length} of {staffList.length} staff members | {selectedCount} Selected
                </span>
              </div>

            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
