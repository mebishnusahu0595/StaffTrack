"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User as UserIcon, Mail, Phone, Lock, Camera, Check, Shield } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { updateUser } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!user) return;
      return updateUser(user.id, data);
    },
    onSuccess: (updatedUser) => {
      if (updatedUser) {
        setUser(updatedUser);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    }
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setAvatarUrl(data.url);
        // Auto-save avatar
        updateMutation.mutate({ avatarUrl: data.url });
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { name, email, phone };
    if (password) data.password = password;
    updateMutation.mutate(data);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Profile</h1>
        <p className="mt-1 text-slate-500">Manage your account settings and preferences.</p>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4">
          <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50">
            <CardContent className="pt-10 pb-8 flex flex-col items-center">
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-white shadow-xl ring-1 ring-slate-100">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <AvatarFallback className="bg-slate-50 text-slate-400">
                      <UserIcon className="h-12 w-12" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <label 
                  htmlFor="avatar-upload" 
                  className={cn(
                    "absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
                    isUploading && "opacity-100 bg-black/20"
                  )}
                >
                  <Camera className="h-6 w-6 text-white" />
                </label>
                <input id="avatar-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
              </div>
              <h2 className="mt-6 text-xl font-bold text-slate-900">{user?.name}</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Super Admin</p>
              
              <div className="mt-8 w-full space-y-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">Secure Account</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <form onSubmit={handleSave}>
            <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50">
              <CardHeader className="border-b border-slate-50">
                <CardTitle className="text-lg font-bold">Account Information</CardTitle>
                <CardDescription className="text-xs font-medium">Update your name, email and contact details.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="pl-10 h-11 rounded-xl bg-slate-50/50" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11 rounded-xl bg-slate-50/50" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-10 h-11 rounded-xl bg-slate-50/50" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Change Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="••••••••"
                        className="pl-10 h-11 rounded-xl bg-slate-50/50" 
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last updated: {user ? new Date(user.createdAt).toLocaleDateString() : "N/A"}</p>
                  <Button 
                    type="submit" 
                    className={cn(
                      "h-11 px-8 rounded-xl font-bold transition-all",
                      success ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100"
                    )}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Saving..." : success ? (
                      <span className="flex items-center gap-2"><Check className="h-4 w-4" /> Updated</span>
                    ) : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
}
