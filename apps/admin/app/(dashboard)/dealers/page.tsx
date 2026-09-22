"use client";

import React, { useState, useMemo } from "react";
import { 
  Store, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  Building2,
  Loader2, 
  X,
  Clock,
  User,
  CheckCircle2,
  ExternalLink,
  Calendar,
  ShoppingBag,
  FileText,
  ClipboardList,
  Users,
  Check,
  Sparkles,
  CreditCard,
  Package
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchDealers, 
  createDealer, 
  updateDealer, 
  deleteDealer,
  fetchVanikiActivities,
  fetchUsers,
  createTask,
  type Dealer
} from "@/lib/api";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function DealersPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAssignStaffOpen, setIsAssignStaffOpen] = useState(false);

  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [selectedDealerForHistory, setSelectedDealerForHistory] = useState<Dealer | null>(null);
  const [selectedDealerForAssign, setSelectedDealerForAssign] = useState<Dealer | null>(null);

  // Staff search state in assign modal
  const [staffSearchText, setStaffSearchText] = useState("");

  // Form State for Dealer CRUD
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    gstin: "",
    assignedUserId: "",
    assignedUserName: ""
  });

  // Form State for Task Assignment
  const [assignForm, setAssignForm] = useState({
    assignedToId: "",
    assignedToName: "",
    title: "",
    dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    priority: "MEDIUM",
    description: ""
  });

  // Queries
  const { data: dealers = [], isLoading } = useQuery({
    queryKey: ["dealers"],
    queryFn: fetchDealers
  });

  const { data: usersData } = useQuery({
    queryKey: ["users", "staff-list"],
    queryFn: () => fetchUsers({ pageSize: 100 })
  });
  const staffList: any[] = usersData?.items || [];

  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["dealer-history", selectedDealerForHistory?.name],
    queryFn: () => fetchVanikiActivities({ search: selectedDealerForHistory?.name }),
    enabled: !!selectedDealerForHistory && isHistoryOpen
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createDealer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealers"] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to add dealer");
    }
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => updateDealer(selectedDealer!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealers"] });
      setIsEditOpen(false);
      setSelectedDealer(null);
      resetForm();
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to update dealer");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDealer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealers"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to delete dealer");
    }
  });

  const assignStaffMutation = useMutation({
    mutationFn: async (payload: {
      dealerId: string;
      assignedUserId: string;
      assignedUserName: string;
      title: string;
      description: string;
      dueDate: string;
      priority: string;
    }) => {
      // 1. Update dealer with assigned staff
      await updateDealer(payload.dealerId, {
        assignedUserId: payload.assignedUserId,
        assignedUserName: payload.assignedUserName
      });

      // 2. Create visit task for staff
      await createTask({
        title: payload.title,
        description: payload.description,
        assignedToId: payload.assignedUserId,
        dueDate: payload.dueDate,
        priority: payload.priority,
        taskType: "DEALER_VISIT",
        dealerIds: [payload.dealerId]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealers"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setIsAssignStaffOpen(false);
      setSelectedDealerForAssign(null);
      alert("Staff successfully assigned and dealer visit task created!");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to assign staff to dealer");
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      gstin: "",
      assignedUserId: "",
      assignedUserName: ""
    });
  };

  const handleOpenEdit = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setFormData({
      name: dealer.name || "",
      phone: dealer.phone || "",
      email: dealer.email || "",
      address: dealer.address || "",
      city: dealer.city || "",
      state: dealer.state || "",
      pincode: dealer.pincode || "",
      gstin: dealer.gstin || "",
      assignedUserId: dealer.assignedUserId || "",
      assignedUserName: dealer.assignedUserName || ""
    });
    setIsEditOpen(true);
  };

  const handleOpenAssignStaff = (dealer: Dealer) => {
    setSelectedDealerForAssign(dealer);
    setStaffSearchText("");
    const defaultStaff = dealer.assignedUserId 
      ? staffList.find((s: any) => s.id === dealer.assignedUserId) || staffList[0]
      : staffList[0];

    setAssignForm({
      assignedToId: defaultStaff?.id || "",
      assignedToName: defaultStaff?.name || "",
      title: `Dealer Visit: ${dealer.name} (${dealer.city || "Store"})`,
      dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      priority: "MEDIUM",
      description: `Dealer / Store: ${dealer.name}\nContact: ${dealer.phone || "N/A"}\nLocation: ${[dealer.address, dealer.city, dealer.state].filter(Boolean).join(", ") || "N/A"}\nGSTIN: ${dealer.gstin || "N/A"}\nInstructions: Visit dealer to discuss wholesale orders, stock requirements and collect outstanding payments.`
    });
    setIsAssignStaffOpen(true);
  };

  const handleDelete = (dealer: Dealer) => {
    if (confirm(`Are you sure you want to delete dealer "${dealer.name}"?`)) {
      deleteMutation.mutate(dealer.id);
    }
  };

  // Filtered dealers
  const filteredDealers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return dealers;
    return dealers.filter((d: any) => 
      d.name?.toLowerCase().includes(q) ||
      d.phone?.toLowerCase().includes(q) ||
      d.city?.toLowerCase().includes(q) ||
      d.gstin?.toLowerCase().includes(q) ||
      d.assignedUserName?.toLowerCase().includes(q)
    );
  }, [dealers, searchQuery]);

  // Filtered staff list for assignment modal
  const filteredStaffList = useMemo(() => {
    const q = staffSearchText.toLowerCase().trim();
    if (!q) return staffList;
    return staffList.filter((s: any) => 
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q) ||
      s.role?.toLowerCase().includes(q)
    );
  }, [staffList, staffSearchText]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            <Store className="h-7 w-7 text-blue-600" /> Dealer Management
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Manage your registered wholesale dealers, assign dedicated staff, and track field visits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search dealer, city, GSTIN, staff..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-white border-slate-200 text-xs font-bold"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button 
            onClick={() => { resetForm(); setIsCreateOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-4 font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" /> Add Dealer
          </Button>
        </div>
      </div>

      {/* Dealer Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : filteredDealers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
          <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <Store className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No dealers found</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto">
            {searchQuery ? "No dealers match your search query." : "Add dealers to assign tasks to field officers."}
          </p>
          <Button 
            onClick={() => { resetForm(); setIsCreateOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 px-4 text-xs font-bold"
          >
            + Add First Dealer
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDealers.map((dealer: any) => (
            <div 
              key={dealer.id}
              className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 font-black text-lg flex items-center justify-center border border-blue-100 shrink-0">
                      {dealer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <button
                        onClick={() => {
                          setSelectedDealerForHistory(dealer);
                          setIsHistoryOpen(true);
                        }}
                        className="text-left font-extrabold text-slate-800 text-base leading-tight group-hover:text-blue-600 transition-colors hover:underline truncate block"
                        title="Click to view staff visit history"
                      >
                        {dealer.name}
                      </button>
                      {dealer.city && (
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" /> {dealer.city}{dealer.state ? `, ${dealer.state}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleOpenEdit(dealer)}
                      className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      title="Edit Dealer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(dealer)}
                      className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Delete Dealer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Contact & Address Details */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs font-semibold text-slate-600">
                  {dealer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span>{dealer.phone}</span>
                    </div>
                  )}

                  {dealer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">{dealer.email}</span>
                    </div>
                  )}

                  {dealer.address && (
                    <div className="flex items-start gap-2">
                      <Building2 className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-slate-500 line-clamp-2">{dealer.address}</span>
                    </div>
                  )}

                  {dealer.gstin && (
                    <div className="pt-1">
                      <Badge variant="outline" className="text-[10px] font-mono bg-slate-50 text-slate-600 border-slate-200">
                        GSTIN: {dealer.gstin}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Assigned Staff Tag */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    {dealer.assignedUserName ? (
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-lg truncate">
                        Staff: {dealer.assignedUserName}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400 italic">
                        No staff assigned
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenAssignStaff(dealer)}
                    className="h-7 text-[11px] font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50 rounded-lg px-2 flex items-center gap-1 shrink-0"
                  >
                    <ClipboardList className="h-3 w-3" /> Assign Staff
                  </Button>
                </div>

                {/* Visit History Action */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedDealerForHistory(dealer);
                      setIsHistoryOpen(true);
                    }}
                    className="h-8 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 flex items-center gap-1.5"
                  >
                    <Clock className="h-3.5 w-3.5" /> Staff Visit History
                  </Button>
                  <span className="text-[10px] font-semibold text-slate-400">Click name for logs</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Add Dealer Dialog (Wider max-w-3xl, 2 Columns) ─── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Store className="h-6 w-6 text-blue-600" /> Add New Dealer
            </DialogTitle>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Core Details */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Dealer / Firm Name *</Label>
                  <Input 
                    required
                    placeholder="e.g. Acme Traders & Fertilizers"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Phone Number</Label>
                  <Input 
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Email Address</Label>
                  <Input 
                    type="email"
                    placeholder="dealer@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">GSTIN Number (Optional)</Label>
                  <Input 
                    placeholder="22AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs font-mono"
                  />
                </div>
              </div>

              {/* Right Column: Location Details */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Address / Shop Location</Label>
                  <Input 
                    placeholder="Shop No., Market / Street Name"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">City</Label>
                    <Input 
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">State</Label>
                    <Input 
                      placeholder="State"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Pincode</Label>
                  <Input 
                    placeholder="Pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                {/* Primary Staff Assignment */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Assign Dedicated Field Staff (Optional)</Label>
                  <select
                    value={formData.assignedUserId}
                    onChange={(e) => {
                      const sel = staffList.find((s: any) => s.id === e.target.value);
                      setFormData({
                        ...formData,
                        assignedUserId: e.target.value,
                        assignedUserName: sel?.name || ""
                      });
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-medium text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- No dedicated staff assigned --</option>
                    {staffList.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role || "Staff"}) - {u.phone || u.email || ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl h-10 text-xs font-bold text-slate-500"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-6 text-xs font-bold shadow-sm"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Dealer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dealer Dialog (Wider max-w-3xl, 2 Columns) ─── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" /> Edit Dealer
            </DialogTitle>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); editMutation.mutate(formData); }} className="space-y-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Dealer / Firm Name *</Label>
                  <Input 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Phone Number</Label>
                  <Input 
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Email Address</Label>
                  <Input 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">GSTIN Number</Label>
                  <Input 
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs font-mono"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Address / Shop Location</Label>
                  <Input 
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">City</Label>
                    <Input 
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">State</Label>
                    <Input 
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Pincode</Label>
                  <Input 
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                {/* Primary Staff Assignment */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Assign Dedicated Field Staff</Label>
                  <select
                    value={formData.assignedUserId}
                    onChange={(e) => {
                      const sel = staffList.find((s: any) => s.id === e.target.value);
                      setFormData({
                        ...formData,
                        assignedUserId: e.target.value,
                        assignedUserName: sel?.name || ""
                      });
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-medium text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- No dedicated staff assigned --</option>
                    {staffList.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role || "Staff"}) - {u.phone || u.email || ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl h-10 text-xs font-bold text-slate-500"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={editMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-6 text-xs font-bold shadow-sm"
              >
                {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Dealer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Assign Staff & Visit Task Dialog (max-w-2xl) ─── */}
      <Dialog open={isAssignStaffOpen} onOpenChange={setIsAssignStaffOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-indigo-600" /> Assign Staff to Dealer
            </DialogTitle>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          {selectedDealerForAssign && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!assignForm.assignedToId) {
                  alert("Please select a staff member to assign");
                  return;
                }
                assignStaffMutation.mutate({
                  dealerId: selectedDealerForAssign.id,
                  assignedUserId: assignForm.assignedToId,
                  assignedUserName: assignForm.assignedToName,
                  title: assignForm.title,
                  description: assignForm.description,
                  dueDate: assignForm.dueDate,
                  priority: assignForm.priority
                });
              }}
              className="space-y-4 pt-3"
            >
              {/* Dealer Snapshot Header */}
              <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">{selectedDealerForAssign.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {[selectedDealerForAssign.city, selectedDealerForAssign.state].filter(Boolean).join(", ") || "Field Area"} 
                    {selectedDealerForAssign.phone && ` • ${selectedDealerForAssign.phone}`}
                  </p>
                </div>
              </div>

              {/* Search Staff */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Search & Select Staff Member *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search staff name, role, email or phone..."
                    value={staffSearchText}
                    onChange={(e) => setStaffSearchText(e.target.value)}
                    className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
                  />
                  {staffSearchText && (
                    <button
                      type="button"
                      onClick={() => setStaffSearchText("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Staff List Box */}
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 mt-1 bg-white">
                  {filteredStaffList.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No staff found matching &quot;{staffSearchText}&quot;</div>
                  ) : (
                    filteredStaffList.map((s: any) => {
                      const isSelected = assignForm.assignedToId === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setAssignForm({
                              ...assignForm,
                              assignedToId: s.id,
                              assignedToName: s.name
                            });
                          }}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                            isSelected ? "bg-indigo-50/80 border-l-4 border-indigo-600" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {s.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{s.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {s.role || "Staff"} • {s.phone || s.email || ""}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <Badge className="bg-indigo-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Check className="h-3 w-3" /> Selected
                            </Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Task Details */}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Task Title *</Label>
                <Input
                  required
                  value={assignForm.title}
                  onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Visit Due Date *</Label>
                  <Input
                    type="date"
                    required
                    value={assignForm.dueDate}
                    onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Priority</Label>
                  <select
                    value={assignForm.priority}
                    onChange={(e) => setAssignForm({ ...assignForm, priority: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Instructions / Notes</Label>
                <textarea
                  rows={3}
                  value={assignForm.description}
                  onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-medium text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAssignStaffOpen(false)}
                  className="rounded-xl text-xs font-bold text-slate-500"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={assignStaffMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold h-10 px-5 shadow-sm flex items-center gap-1.5"
                >
                  {assignStaffMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ClipboardList className="h-4 w-4" /> Assign Staff & Visit Task
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Staff Visit History Dialog (Wider max-w-4xl) ─── */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  {selectedDealerForHistory?.name || "Dealer"} - Staff Visit History
                </DialogTitle>
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  {[selectedDealerForHistory?.city, selectedDealerForHistory?.state].filter(Boolean).join(", ") || "Location"}
                  {selectedDealerForHistory?.phone && ` • Phone: ${selectedDealerForHistory.phone}`}
                </p>
              </div>
            </div>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          <div className="pt-4 space-y-4">
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-500">Loading visit history...</p>
              </div>
            ) : !historyData?.activities || historyData.activities.length === 0 ? (
              <div className="text-center py-16 space-y-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Clock className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-700">No Staff Visits Recorded Yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When field staff enter this dealer code in the mobile app or place orders, their visits and timestamps will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-500">
                    Total Logs Recorded: {historyData.activities.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {historyData.activities.map((activity: any) => {
                    const isOrder = activity.action === "ORDER_PLACED";
                    return (
                      <div
                        key={activity.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isOrder
                            ? "bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300"
                            : "bg-blue-50/40 border-blue-200/80 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={isOrder ? "bg-emerald-600 text-white font-bold text-xs" : "bg-blue-600 text-white font-bold text-xs"}>
                              {isOrder ? "Wholesale Order Placed" : "Shop Visit / Code Lookup"}
                            </Badge>
                            {activity.invoiceNumber && (
                              <Badge variant="outline" className="font-mono text-xs font-bold text-slate-700 bg-white">
                                #{activity.invoiceNumber}
                              </Badge>
                            )}
                            {activity.paymentMode && (
                              <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px]">
                                💳 {activity.paymentMode}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {dayjs(activity.createdAt).format("DD MMM YYYY, hh:mm A")}
                          </span>
                        </div>

                        {/* Staff officer info */}
                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-700">
                          <div className="h-6 w-6 rounded-full bg-slate-200 font-bold flex items-center justify-center text-[10px]">
                            {activity.staffName?.charAt(0).toUpperCase() || "S"}
                          </div>
                          <span className="font-bold">{activity.staffName}</span>
                          {activity.staffPhone && (
                            <span className="text-slate-400">({activity.staffPhone})</span>
                          )}
                        </div>

                        {/* Financial snapshot if order placed */}
                        {isOrder && (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-emerald-100 text-xs">
                            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Grand Total</span>
                              <span className="font-black text-slate-800 text-sm">₹{Number(activity.totalAmount || 0).toLocaleString("en-IN")}</span>
                            </div>
                            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                              <span className="text-[10px] font-bold text-emerald-600 uppercase block">Paid Amount</span>
                              <span className="font-black text-emerald-700 text-sm">₹{Number(activity.paidAmount || 0).toLocaleString("en-IN")}</span>
                            </div>
                            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                              <span className="text-[10px] font-bold text-rose-500 uppercase block">Balance Udhaar</span>
                              <span className="font-black text-rose-600 text-sm">₹{Number(activity.outstandingAmount || 0).toLocaleString("en-IN")}</span>
                            </div>
                            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                              <span className="text-[10px] font-bold text-indigo-600 uppercase block">Payment Mode</span>
                              <span className="font-black text-indigo-700 text-xs uppercase">{activity.paymentMode || "CASH"}</span>
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {activity.notes && (
                          <p className="mt-2.5 text-xs text-slate-600 bg-white/70 p-2.5 rounded-xl border border-slate-100">
                            <strong>Notes:</strong> {activity.notes}
                          </p>
                        )}

                        {/* Proof Link if exists */}
                        {activity.proofUrl && (
                          <div className="mt-2.5">
                            <a
                              href={activity.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                            >
                              <FileText className="h-3.5 w-3.5" /> View Attached Payment Slip / Document
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setIsHistoryOpen(false)}
                className="rounded-xl text-xs font-bold px-5"
              >
                Close History
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
