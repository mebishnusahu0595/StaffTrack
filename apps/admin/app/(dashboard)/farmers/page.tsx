"use client";

import React, { useState } from "react";
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
  AlertCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchFarmers,
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

  // Form State for Farmer
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
    notes: ""
  });

  // Form State for Assigning Visit Task
  const [taskForm, setTaskForm] = useState({
    assignedToId: "",
    title: "",
    description: "",
    dueDate: new Date().toISOString().split("T")[0],
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  });

  // Queries
  const { data: farmers = [], isLoading } = useQuery({
    queryKey: ["farmers"],
    queryFn: fetchFarmers
  });

  const { data: usersData } = useQuery({
    queryKey: ["users", "farmer-assignment"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 100 })
  });

  const staffList = usersData?.items || [];

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
    mutationFn: createTask,
    onSuccess: () => {
      alert("Farmer visit task successfully assigned to staff!");
      setIsAssignTaskOpen(false);
      setSelectedFarmer(null);
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
      notes: ""
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
      notes: farmer.notes || ""
    });
    setIsEditOpen(true);
  };

  const handleOpenDetail = (farmer: Farmer) => {
    setSelectedFarmer(farmer);
    setIsDetailOpen(true);
  };

  const handleOpenAssignTask = (farmer: Farmer) => {
    setSelectedFarmer(farmer);
    setTaskForm({
      assignedToId: staffList[0]?.id || "",
      title: `Farmer Visit: ${farmer.name} (${farmer.village || farmer.city || "Field"})`,
      description: `Visit Farmer: ${farmer.name}\nContact: ${farmer.phone || "N/A"}\nVillage/Address: ${farmer.village || farmer.address || "N/A"}\nCrop: ${farmer.crop || "N/A"} | Land: ${farmer.landSize || "N/A"}\nNotes: ${farmer.notes || "Check crop health, product feedback and requirements."}`,
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

  const filteredFarmers = farmers.filter((f) => {
    const q = searchQuery.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      (f.phone && f.phone.toLowerCase().includes(q)) ||
      (f.village && f.village.toLowerCase().includes(q)) ||
      (f.city && f.city.toLowerCase().includes(q)) ||
      (f.crop && f.crop.toLowerCase().includes(q))
    );
  });

  const uniqueVillages = new Set(farmers.map((f) => f.village).filter(Boolean)).size;
  const uniqueCrops = new Set(farmers.map((f) => f.crop).filter(Boolean)).size;

  return (
    <div className="space-y-6 pb-12">
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
            Directory of registered farmers, land details, and field visit task assignments
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, village, crop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-white border-slate-200 text-xs font-bold shadow-sm"
            />
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
                    <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 font-black text-lg flex items-center justify-center border border-emerald-100">
                      {farmer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <button
                        onClick={() => handleOpenDetail(farmer)}
                        className="text-left font-extrabold text-slate-800 text-base leading-tight group-hover:text-emerald-600 transition-colors hover:underline"
                      >
                        {farmer.name}
                      </button>
                      {(farmer.village || farmer.city) && (
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-emerald-500" />
                          {farmer.village ? `${farmer.village}` : ""}
                          {farmer.city ? `, ${farmer.city}` : ""}
                          {farmer.district ? ` (${farmer.district})` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
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
                      <Phone className="h-3.5 w-3.5 text-emerald-500" />
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

      {/* ─── Add Farmer Dialog ─── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sprout className="h-5 w-5 text-emerald-600" /> Add New Farmer
            </DialogTitle>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(formData);
            }}
            className="space-y-3.5 pt-3"
          >
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Farmer Name *</Label>
              <Input
                required
                placeholder="e.g. Ramesh Patel"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Mobile Number</Label>
                <Input
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Village / Gaon</Label>
                <Input
                  placeholder="e.g. Khairi"
                  value={formData.village}
                  onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Primary Crop</Label>
                <Input
                  placeholder="e.g. Paddy, Wheat, Cotton"
                  value={formData.crop}
                  onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Land Size</Label>
                <Input
                  placeholder="e.g. 5 Acres, 10 Bigha"
                  value={formData.landSize}
                  onChange={(e) => setFormData({ ...formData, landSize: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">City / Tehsil</Label>
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">District</Label>
                <Input
                  placeholder="District"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">State</Label>
                <Input
                  placeholder="State"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Full Address</Label>
              <Input
                placeholder="Landmark, road, or full address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Notes / Remarks</Label>
              <Input
                placeholder="Product feedback, special instructions..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl text-xs font-bold text-slate-500"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-10 px-5 shadow-sm"
              >
                {createMutation.isPending ? "Saving..." : "Save Farmer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Farmer Dialog ─── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600" /> Edit Farmer
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
            className="space-y-3.5 pt-3"
          >
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Farmer Name *</Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Mobile Number</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Village / Gaon</Label>
                <Input
                  value={formData.village}
                  onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Primary Crop</Label>
                <Input
                  value={formData.crop}
                  onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Land Size</Label>
                <Input
                  value={formData.landSize}
                  onChange={(e) => setFormData({ ...formData, landSize: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">City / Tehsil</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">District</Label>
                <Input
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">State</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Full Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Notes / Remarks</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl text-xs font-bold text-slate-500"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-10 px-5 shadow-sm"
              >
                {editMutation.isPending ? "Updating..." : "Update Farmer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Farmer Detail Profile Dialog ─── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg p-6 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sprout className="h-5 w-5 text-emerald-600" /> Farmer Profile
            </DialogTitle>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          {selectedFarmer && (
            <div className="space-y-4 pt-3">
              <div className="flex items-center gap-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <div className="h-14 w-14 rounded-2xl bg-emerald-600 text-white font-black text-2xl flex items-center justify-center shadow-md">
                  {selectedFarmer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{selectedFarmer.name}</h2>
                  {selectedFarmer.phone && (
                    <a
                      href={`tel:${selectedFarmer.phone}`}
                      className="text-emerald-700 font-bold text-sm flex items-center gap-1 mt-0.5"
                    >
                      <Phone className="h-3.5 w-3.5" /> {selectedFarmer.phone}
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Village</span>
                  <p className="font-bold text-slate-800 text-sm">{selectedFarmer.village || "Not specified"}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Primary Crop</span>
                  <p className="font-bold text-emerald-700 text-sm">{selectedFarmer.crop || "Not specified"}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Land Holding</span>
                  <p className="font-bold text-slate-800 text-sm">{selectedFarmer.landSize || "Not specified"}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Location</span>
                  <p className="font-bold text-slate-800 text-sm">
                    {[selectedFarmer.city, selectedFarmer.district, selectedFarmer.state].filter(Boolean).join(", ") || "N/A"}
                  </p>
                </div>
              </div>

              {selectedFarmer.address && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Address Details</span>
                  <p className="font-semibold text-slate-700 mt-1">{selectedFarmer.address}</p>
                </div>
              )}

              {selectedFarmer.notes && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs">
                  <span className="text-amber-800 font-bold uppercase tracking-wider text-[10px]">Notes / Field Requirements</span>
                  <p className="font-medium text-amber-900 mt-1">{selectedFarmer.notes}</p>
                </div>
              )}

              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
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
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Assign Visit Task Dialog ─── */}
      <Dialog open={isAssignTaskOpen} onOpenChange={setIsAssignTaskOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" /> Assign Farmer Visit Task
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
                  title: taskForm.title,
                  description: taskForm.description,
                  assignedToId: taskForm.assignedToId,
                  dueDate: taskForm.dueDate,
                  priority: taskForm.priority,
                  taskType: "FARMER_VISIT"
                });
              }}
              className="space-y-3.5 pt-3"
            >
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-2.5">
                <Sprout className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-emerald-900">{selectedFarmer.name}</span>
                  <span className="text-emerald-700 ml-1.5">
                    ({selectedFarmer.village || selectedFarmer.city || "Field Area"})
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Assign To Staff Member *</Label>
                <select
                  required
                  value={taskForm.assignedToId}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Select Staff Officer --</option>
                  {staffList.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role || "Staff"}) - {u.email || u.phone || ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Task Title *</Label>
                <Input
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-600">Due Date *</Label>
                  <Input
                    type="date"
                    required
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-600">Priority</Label>
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
                <Label className="text-xs font-bold text-slate-600">Instructions / Description</Label>
                <textarea
                  rows={4}
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-10 px-5 shadow-sm"
                >
                  {assignTaskMutation.isPending ? "Assigning..." : "Assign Task"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
