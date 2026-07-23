"use client";

import React, { useState } from "react";
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
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDealers, createDealer, updateDealer, deleteDealer } from "@/lib/api";
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
  const [selectedDealer, setSelectedDealer] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    gstin: ""
  });

  const { data: dealers = [], isLoading } = useQuery({
    queryKey: ["dealers"],
    queryFn: fetchDealers
  });

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
    mutationFn: (data: any) => updateDealer(selectedDealer.id, data),
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

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      gstin: ""
    });
  };

  const handleOpenEdit = (dealer: any) => {
    setSelectedDealer(dealer);
    setFormData({
      name: dealer.name || "",
      phone: dealer.phone || "",
      email: dealer.email || "",
      address: dealer.address || "",
      city: dealer.city || "",
      state: dealer.state || "",
      pincode: dealer.pincode || "",
      gstin: dealer.gstin || ""
    });
    setIsEditOpen(true);
  };

  const handleDelete = (dealer: any) => {
    if (confirm(`Are you sure you want to delete dealer "${dealer.name}"?`)) {
      deleteMutation.mutate(dealer.id);
    }
  };

  const filteredDealers = dealers.filter((d: any) => {
    const q = searchQuery.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.phone?.toLowerCase().includes(q) ||
      d.city?.toLowerCase().includes(q) ||
      d.gstin?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Store className="h-7 w-7 text-blue-600" /> Dealer Management
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Manage your network of registered dealers and assign them to staff tasks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search dealers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-white border-slate-200 text-xs font-bold"
            />
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
                    <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 font-black text-lg flex items-center justify-center border border-blue-100">
                      {dealer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base leading-tight group-hover:text-blue-600 transition-colors">
                        {dealer.name}
                      </h3>
                      {dealer.city && (
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-slate-400" /> {dealer.city}{dealer.state ? `, ${dealer.state}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleOpenEdit(dealer)}
                      className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(dealer)}
                      className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs font-semibold text-slate-600">
                  {dealer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-blue-500" />
                      <span>{dealer.phone}</span>
                    </div>
                  )}

                  {dealer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-emerald-500" />
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Dealer Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Store className="h-5 w-5 text-blue-600" /> Add New Dealer
            </DialogTitle>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4 pt-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Dealer / Firm Name *</Label>
              <Input 
                required
                placeholder="e.g. Acme Traders & Fertilizers"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Phone Number</Label>
                <Input 
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Email Address</Label>
                <Input 
                  type="email"
                  placeholder="dealer@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Address</Label>
              <Input 
                placeholder="Shop No., Market / Street Name"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">City</Label>
                <Input 
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
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
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Pincode</Label>
                <Input 
                  placeholder="Pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">GSTIN Number (Optional)</Label>
              <Input 
                placeholder="22AAAAA0000A1Z5"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs font-mono"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl h-10 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-5 text-xs font-bold"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Dealer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dealer Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" /> Edit Dealer
            </DialogTitle>
            <DialogClose className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); editMutation.mutate(formData); }} className="space-y-4 pt-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Dealer / Firm Name *</Label>
              <Input 
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Phone Number</Label>
                <Input 
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Email Address</Label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">Address</Label>
              <Input 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">City</Label>
                <Input 
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
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
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600">Pincode</Label>
                <Input 
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">GSTIN Number</Label>
              <Input 
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs font-mono"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl h-10 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={editMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-5 text-xs font-bold"
              >
                {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Dealer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
