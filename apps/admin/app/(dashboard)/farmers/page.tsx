"use client";

import React, { useState, useMemo } from "react";
import {
  Sprout,
  Plus,
  Search,
  Pencil,
  Trash2,
  Phone,
  MapPin,
  Calendar,
  UserCheck,
  ClipboardList,
  Loader2,
  X,
  Layers,
  FileText,
  CheckCircle2,
  AlertCircle,
  User,
  Check,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  HelpCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchFarmers,
  fetchFarmerVisits,
  createFarmer,
  updateFarmer,
  deleteFarmer,
  fetchUsers,
  createTask,
  Farmer
} from "@/lib/api";

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

export default function FarmersPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);

  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);

  // Staff search state in assign modal
  const [staffSearchText, setStaffSearchText] = useState("");

  // Form State for Farmer CRUD
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    village: "",
    address: "",
    city: "",
    district: "",
    state: "",
    crop: "",
    landSize: "",
    notes: "",
    assignedUserId: "",
    assignedUserName: ""
  });

  // Form State for Assigning Visit Task
  const [taskForm, setTaskForm] = useState({
    assignedToId: "",
    assignedToName: "",
    title: "",
    description: "",
    dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  });

  // Queries
  const { data: farmers = [], isLoading } = useQuery({
    queryKey: ["farmers"],
    queryFn: fetchFarmers
  });

  const { data: usersData } = useQuery({
    queryKey: ["users", "farmer-assignment"],
    queryFn: () => fetchUsers({ pageSize: 100 })
  });

  const staffList: any[] = usersData?.items || [];

  const { data: visitsData, isLoading: isLoadingVisits } = useQuery({
    queryKey: ["farmer-visits", selectedFarmer?.id],
    queryFn: () => fetchFarmerVisits(selectedFarmer!.id),
    enabled: !!selectedFarmer && isDetailOpen
  });


  // Farmer Mutations
  const createMutation = useMutation({
    mutationFn: createFarmer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farmers"] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to add farmer");
    }
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => updateFarmer(selectedFarmer!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farmers"] });
      setIsEditOpen(false);
      setSelectedFarmer(null);
      resetForm();
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to update farmer");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFarmer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farmers"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to delete farmer");
    }
  });

  // Task Assignment Mutation
  const assignTaskMutation = useMutation({
    mutationFn: async (payload: {
      farmerId: string;
      assignedToId: string;
      assignedToName: string;
      title: string;
      description: string;
      dueDate: string;
      priority: string;
    }) => {
      // 1. Update farmer with assigned staff
      await updateFarmer(payload.farmerId, {
        assignedUserId: payload.assignedToId,
        assignedUserName: payload.assignedToName
      });

      // 2. Create the visit task in task manager
      await createTask({
        title: payload.title,
        description: payload.description,
        assignedToId: payload.assignedToId,
        dueDate: payload.dueDate,
        priority: payload.priority,
        taskType: "FARMER_VISIT"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farmers"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setIsAssignTaskOpen(false);
      setSelectedFarmer(null);
      alert("Farmer visit task successfully assigned to staff member!");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to assign task");
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      village: "",
      address: "",
      city: "",
      district: "",
      state: "",
      crop: "",
      landSize: "",
      notes: "",
      assignedUserId: "",
      assignedUserName: ""
    });
  };

  const handleOpenEdit = (farmer: Farmer) => {
    setSelectedFarmer(farmer);
    setFormData({
      name: farmer.name || "",
      phone: farmer.phone || "",
      village: farmer.village || "",
      address: farmer.address || "",
      city: farmer.city || "",
      district: farmer.district || "",
      state: farmer.state || "",
      crop: farmer.crop || "",
      landSize: farmer.landSize || "",
      notes: farmer.notes || "",
      assignedUserId: farmer.assignedUserId || "",
      assignedUserName: farmer.assignedUserName || ""
    });
    setIsEditOpen(true);
  };

  const handleOpenDetail = (farmer: Farmer) => {
    setSelectedFarmer(farmer);
    setIsDetailOpen(true);
  };

  const handleOpenAssignTask = (farmer: Farmer) => {
    setSelectedFarmer(farmer);
    setStaffSearchText("");
    const defaultStaff = farmer.assignedUserId
      ? staffList.find((s: any) => s.id === farmer.assignedUserId) || staffList[0]
      : staffList[0];

    setTaskForm({
      assignedToId: defaultStaff?.id || "",
      assignedToName: defaultStaff?.name || "",
      title: `Farmer Visit: ${farmer.name} (${farmer.village || farmer.city || "Field"})`,
      description: `Farmer: ${farmer.name}\nContact: ${farmer.phone || "N/A"}\nVillage/Address: ${farmer.village || farmer.address || "N/A"}\nCrop: ${farmer.crop || "N/A"} | Land: ${farmer.landSize || "N/A"}\nNotes: ${farmer.notes || "Inspect crop health, product feedback and provide field assistance."}`,
      dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      priority: "MEDIUM"
    });
    setIsAssignTaskOpen(true);
  };

  const handleDelete = (farmer: Farmer) => {
    if (confirm(`Are you sure you want to delete farmer "${farmer.name}"?`)) {
      deleteMutation.mutate(farmer.id);
    }
  };

  const filteredFarmers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return farmers;
    return farmers.filter((f) => {
      return (
        f.name.toLowerCase().includes(q) ||
        (f.phone && f.phone.toLowerCase().includes(q)) ||
        (f.village && f.village.toLowerCase().includes(q)) ||
        (f.city && f.city.toLowerCase().includes(q)) ||
        (f.crop && f.crop.toLowerCase().includes(q)) ||
        (f.assignedUserName && f.assignedUserName.toLowerCase().includes(q))
      );
    });
  }, [farmers, searchQuery]);

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

  const uniqueVillages = new Set(farmers.map((f) => f.village).filter(Boolean)).size;
  const uniqueCrops = new Set(farmers.map((f) => f.crop).filter(Boolean)).size;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto p-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Sprout className="h-6 w-6" />
            </span>
            Farmers Management
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Directory of registered farmers, land details, and field officer assignments
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search farmer, village, crop, staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-white border-slate-200 text-xs font-bold shadow-sm"
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
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4 font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" /> Add Farmer
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-150 shadow-sm flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <Sprout className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Farmers</p>
            <p className="text-2xl font-black text-slate-900">{farmers.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-150 shadow-sm flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Villages Covered</p>
            <p className="text-2xl font-black text-slate-900">{uniqueVillages}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-150 shadow-sm flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Crops Cultivated</p>
            <p className="text-2xl font-black text-slate-900">{uniqueCrops}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-150 shadow-sm flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Staff</p>
            <p className="text-2xl font-black text-slate-900">{staffList.length}</p>
          </div>
        </div>
      </div>

      {/* Farmers Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
        </div>
      ) : filteredFarmers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
          <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
            <Sprout className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No farmers found</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto">
            {searchQuery
              ? "No farmers match your search query."
              : "Register farmers to maintain field profiles and assign visit tasks to field officers."}
          </p>
          <Button
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 px-4 text-xs font-bold"
          >
            + Add First Farmer
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFarmers.map((farmer) => (
            <div
              key={farmer.id}
              className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 font-black text-lg flex items-center justify-center border border-emerald-100 shrink-0">
                      {farmer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <button
                        onClick={() => handleOpenDetail(farmer)}
                        className="text-left font-extrabold text-slate-800 text-base leading-tight group-hover:text-emerald-600 transition-colors hover:underline truncate block"
                      >
                        {farmer.name}
                      </button>
                      {(farmer.village || farmer.city) && (
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
                          {farmer.village ? `${farmer.village}` : ""}
                          {farmer.city ? `, ${farmer.city}` : ""}
                          {farmer.district ? ` (${farmer.district})` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(farmer)}
                      className="h-8 w-8 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                      title="Edit Farmer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(farmer)}
                      className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Delete Farmer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs font-semibold text-slate-600">
                  {farmer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <a href={`tel:${farmer.phone}`} className="hover:text-emerald-600 font-mono">
                        {farmer.phone}
                      </a>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {farmer.crop && (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-bold">
                        🌾 {farmer.crop}
                      </Badge>
                    )}
                    {farmer.landSize && (
                      <Badge variant="outline" className="text-slate-600 border-slate-200 text-[11px] font-medium">
                        📐 {farmer.landSize}
                      </Badge>
                    )}
                  </div>

                  {farmer.address && (
                    <p className="text-slate-500 text-[11px] line-clamp-2 mt-1">
                      {farmer.address}
                    </p>
                  )}

                  {farmer.notes && (
                    <p className="text-slate-400 text-[11px] italic line-clamp-2 bg-slate-50 p-2 rounded-lg mt-1 border border-slate-100">
                      &quot;{farmer.notes}&quot;
                    </p>
                  )}
                </div>

                {/* Assigned Staff Member Tag */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    {farmer.assignedUserName ? (
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg truncate">
                        Staff: {farmer.assignedUserName}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400 italic">
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <Button
                  onClick={() => handleOpenAssignTask(farmer)}
                  className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-none transition-all"
                >
                  <ClipboardList className="h-4 w-4 text-emerald-600" />
                  Assign Visit Task
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOpenDetail(farmer)}
                  className="text-xs font-bold h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Add Farmer Dialog (Wider max-w-3xl, 2 Columns) ─── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Sprout className="h-6 w-6 text-emerald-600" /> Add New Farmer
            </DialogTitle>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (createMutation.isPending) return;
              createMutation.mutate(formData);
            }}
            className="space-y-4 pt-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Farmer Name *</Label>
                  <Input
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Mobile Number</Label>
                  <Input
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Primary Crop</Label>
                  <Input
                    placeholder="e.g. Paddy, Wheat, Cotton, Soybean"
                    value={formData.crop}
                    onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Land Holding / Acre</Label>
                  <Input
                    placeholder="e.g. 5 Acres, 10 Bigha"
                    value={formData.landSize}
                    onChange={(e) => setFormData({ ...formData, landSize: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Village / Gaon</Label>
                  <Input
                    placeholder="e.g. Khairi"
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">City / Tehsil</Label>
                    <Input
                      placeholder="e.g. Dhamtari"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">District</Label>
                    <Input
                      placeholder="e.g. Raipur"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">State</Label>
                  <Input
                    placeholder="e.g. Chhattisgarh"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
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
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-medium text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Full Address</Label>
              <Input
                placeholder="House No, Landmark, Village post..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Field Notes / Observations</Label>
              <Input
                placeholder="e.g. Interested in bio-fertilizers, pest issue in crop..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-6 text-xs font-bold shadow-sm"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Farmer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Farmer Dialog (Wider max-w-3xl, 2 Columns) ─── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600" /> Edit Farmer Profile
            </DialogTitle>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              editMutation.mutate(formData);
            }}
            className="space-y-4 pt-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Farmer Name *</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Mobile Number</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Primary Crop</Label>
                  <Input
                    value={formData.crop}
                    onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Land Holding</Label>
                  <Input
                    value={formData.landSize}
                    onChange={(e) => setFormData({ ...formData, landSize: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Village / Gaon</Label>
                  <Input
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">City / Tehsil</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">District</Label>
                    <Input
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">State</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
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
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-medium text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Full Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Notes / Remarks</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-6 text-xs font-bold shadow-sm"
              >
                {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Farmer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Farmer Detail Profile Dialog (Wider max-w-4xl with Visit Logs & Q/A) ─── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Sprout className="h-6 w-6 text-emerald-600" /> Farmer Profile & Field Visits
            </DialogTitle>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          {selectedFarmer && (
            <div className="space-y-5 pt-3">
              <div className="flex items-center gap-4 bg-emerald-50/80 p-4 rounded-2xl border border-emerald-100">
                <div className="h-14 w-14 rounded-2xl bg-emerald-600 text-white font-black text-2xl flex items-center justify-center shadow-md shrink-0">
                  {selectedFarmer.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-black text-slate-900 truncate">{selectedFarmer.name}</h2>
                  {selectedFarmer.phone && (
                    <a
                      href={`tel:${selectedFarmer.phone}`}
                      className="text-emerald-700 font-bold text-xs flex items-center gap-1 mt-0.5"
                    >
                      <Phone className="h-3.5 w-3.5" /> {selectedFarmer.phone}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDetailOpen(false);
                      handleOpenEdit(selectedFarmer);
                    }}
                    className="rounded-xl text-xs font-bold"
                  >
                    Edit Profile
                  </Button>
                  <Button
                    onClick={() => {
                      setIsDetailOpen(false);
                      handleOpenAssignTask(selectedFarmer);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold px-4 flex items-center gap-1.5 shadow-sm"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Assign Visit Task
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Village / Gaon</span>
                  <p className="font-bold text-slate-800 text-sm truncate">{selectedFarmer.village || "Not specified"}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Primary Crop</span>
                  <p className="font-bold text-emerald-700 text-sm truncate">{selectedFarmer.crop || "Not specified"}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Land Holding</span>
                  <p className="font-bold text-slate-800 text-sm truncate">{selectedFarmer.landSize || "Not specified"}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Location</span>
                  <p className="font-bold text-slate-800 text-sm truncate">
                    {[selectedFarmer.city, selectedFarmer.district, selectedFarmer.state].filter(Boolean).join(", ") || "N/A"}
                  </p>
                </div>
              </div>

              {/* Dedicated Assigned Staff & Address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-center gap-2">
                  <User className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block">Assigned Staff Officer</span>
                    <span className="font-bold text-emerald-800">
                      {selectedFarmer.assignedUserName || "No officer currently assigned"}
                    </span>
                  </div>
                </div>
                {selectedFarmer.address && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Address Details</span>
                    <p className="font-semibold text-slate-700 truncate">{selectedFarmer.address}</p>
                  </div>
                )}
              </div>

              {selectedFarmer.notes && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs">
                  <span className="text-amber-800 font-bold uppercase tracking-wider text-[10px]">Notes / Field Requirements</span>
                  <p className="font-medium text-amber-900 mt-1">{selectedFarmer.notes}</p>
                </div>
              )}

              {/* ─── Field Staff Visits & Question-Answers Section ─── */}
              <div className="pt-4 border-t border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-emerald-600" /> Staff Visits & Filled Question-Answers
                    </span>
                    <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 font-bold text-xs">
                      {visitsData?.tasks?.length || 0} Visits
                    </Badge>
                  </div>
                </div>

                {isLoadingVisits ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 bg-slate-50 rounded-2xl border border-slate-100">
                    <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
                    <p className="text-xs font-semibold text-slate-500">Loading visit logs & submitted questions...</p>
                  </div>
                ) : !visitsData?.tasks || visitsData.tasks.length === 0 ? (
                  <div className="text-center py-8 space-y-2 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-700">No Staff Visits Recorded Yet</h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      When staff visit this farmer and complete tasks with checklist questions & photos, all details will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visitsData.tasks.map((task: any) => {
                      const isCompleted = task.status === "COMPLETED";
                      const staff = task.assignedTo;
                      const hasResponses = task.checklistResponses && (
                        Array.isArray(task.checklistResponses) ? task.checklistResponses.length > 0 : Object.keys(task.checklistResponses).length > 0
                      );

                      let responsesList: any[] = [];
                      if (Array.isArray(task.checklistResponses)) {
                        responsesList = task.checklistResponses;
                      } else if (task.checklistResponses && typeof task.checklistResponses === "object") {
                        responsesList = Object.entries(task.checklistResponses).map(([key, val]: [string, any]) => ({
                          id: key,
                          title: key,
                          value: typeof val === "object" ? (val.text || val.dropdown || val.value || JSON.stringify(val)) : String(val),
                          type: val?.image ? "IMAGE" : "TEXT",
                          fileUrl: val?.image || val?.file?.url
                        }));
                      }

                      return (
                        <div
                          key={task.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isCompleted ? "bg-emerald-50/30 border-emerald-200" : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          {/* Visit Task Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-black text-slate-800 text-sm">{task.title}</h4>
                                <Badge className={isCompleted ? "bg-emerald-600 text-white font-bold text-[10px]" : "bg-amber-500 text-white font-bold text-[10px]"}>
                                  {task.status}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                <span>Scheduled: {task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}</span>
                                {task.completedAt && (
                                  <span className="text-emerald-700 font-bold">
                                    • Completed: {new Date(task.completedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Staff Member Info */}
                            {staff && (
                              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                                <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                                  {staff.name?.charAt(0).toUpperCase() || "S"}
                                </div>
                                <div className="text-left">
                                  <span className="text-[11px] font-bold text-slate-800 block leading-tight">{staff.name}</span>
                                  <span className="text-[9px] font-medium text-slate-400 block">{staff.phone || staff.email || staff.role || "Staff"}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Completion Photo & Remarks */}
                          {(task.completionPhotoUrl || task.completionRemarks) && (
                            <div className="mt-3 p-3 bg-white rounded-xl border border-slate-150 flex flex-col sm:flex-row gap-3 items-start">
                              {task.completionPhotoUrl && (
                                <a href={task.completionPhotoUrl} target="_blank" rel="noreferrer" className="shrink-0 group relative">
                                  <img
                                    src={task.completionPhotoUrl}
                                    alt="Visit Proof"
                                    className="w-24 h-24 object-cover rounded-lg border border-slate-200 group-hover:opacity-90 transition-opacity"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded-lg transition-opacity">
                                    <ExternalLink className="h-4 w-4 text-white" />
                                  </div>
                                </a>
                              )}
                              <div className="flex-1 space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Staff Visit Remarks:</span>
                                <p className="text-xs font-semibold text-slate-700 whitespace-pre-wrap">{task.completionRemarks || "No written remarks."}</p>
                                {task.completionLat && (
                                  <a
                                    href={`https://maps.google.com/?q=${task.completionLat},${task.completionLng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline pt-1"
                                  >
                                    <MapPin className="h-3 w-3" /> Location: {task.completionLat.toFixed(5)}, {task.completionLng.toFixed(5)} (Open Map)
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Submitted Checklist Responses (Q&A) */}
                          {hasResponses && (
                            <div className="mt-3 space-y-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Submitted Questions & Answers:
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {responsesList.map((item: any, idx: number) => {
                                  const questionText = item.title || item.question || `Question #${idx + 1}`;
                                  const ansValue = item.value !== undefined ? item.value : (item.text || item.dropdown || item.response || "");
                                  const imgUrl = item.fileUrl || item.image || (item.type === "IMAGE" ? item.value : null);

                                  return (
                                    <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
                                      <div className="flex items-start gap-1.5">
                                        <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                                        <span className="text-xs font-bold text-slate-600 leading-snug">{questionText}</span>
                                      </div>
                                      {imgUrl ? (
                                        <a href={imgUrl} target="_blank" rel="noreferrer" className="block mt-1">
                                          <img src={imgUrl} alt={questionText} className="w-20 h-20 object-cover rounded-lg border border-slate-200 hover:opacity-90" />
                                        </a>
                                      ) : (
                                        <p className="text-xs font-black text-slate-900 pl-5">
                                          {ansValue ? String(ansValue) : <span className="text-slate-400 font-normal italic">No response</span>}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* ─── Assign Visit Task Dialog (Wider max-w-2xl with Searchable Staff Picker) ─── */}
      <Dialog open={isAssignTaskOpen} onOpenChange={setIsAssignTaskOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" /> Assign Farmer Visit Task to Staff
            </DialogTitle>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          {selectedFarmer && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!taskForm.assignedToId) {
                  alert("Please select a staff member to assign the task");
                  return;
                }
                assignTaskMutation.mutate({
                  farmerId: selectedFarmer.id,
                  assignedToId: taskForm.assignedToId,
                  assignedToName: taskForm.assignedToName,
                  title: taskForm.title,
                  description: taskForm.description,
                  dueDate: taskForm.dueDate,
                  priority: taskForm.priority
                });
              }}
              className="space-y-4 pt-3"
            >
              {/* Farmer Snapshot Info */}
              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                  <Sprout className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">{selectedFarmer.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {[selectedFarmer.village, selectedFarmer.city, selectedFarmer.district].filter(Boolean).join(", ") || "Field Area"}
                    {selectedFarmer.phone && ` • ${selectedFarmer.phone}`}
                    {selectedFarmer.crop && ` • Crop: ${selectedFarmer.crop}`}
                  </p>
                </div>
              </div>

              {/* Searchable Staff Selection */}
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
                      const isSelected = taskForm.assignedToId === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setTaskForm({
                              ...taskForm,
                              assignedToId: s.id,
                              assignedToName: s.name
                            });
                          }}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                            isSelected ? "bg-emerald-50/80 border-l-4 border-emerald-600" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
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
                            <Badge className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Check className="h-3 w-3" /> Selected
                            </Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Task Title *</Label>
                <Input
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Visit Due Date *</Label>
                  <Input
                    type="date"
                    required
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Priority</Label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Instructions / Description</Label>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-medium text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAssignTaskOpen(false)}
                  className="rounded-xl text-xs font-bold text-slate-500"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={assignTaskMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-10 px-5 shadow-sm flex items-center gap-1.5"
                >
                  {assignTaskMutation.isPending ? (
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
    </div>
  );
}
