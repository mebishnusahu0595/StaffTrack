"use client";

import { useState, useEffect } from "react";
import { Settings, User, Bell, Shield, Keyboard, Globe, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";
import { updateUser } from "@/lib/api";
import { USER_COOKIE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setSuccess(false);

    try {
      const data: any = { name, email, phone };
      if (password) {
        if (password.length < 8) {
          alert("Password must be at least 8 characters long.");
          setIsSubmitting(false);
          return;
        }
        data.password = password;
      }

      const updated = await updateUser(user.id, data);
      
      if (updated) {
        // Update auth context
        const mergedUser = { ...user, ...updated };
        setUser(mergedUser);

        // Update cookie to persist across page reloads
        document.cookie = `${USER_COOKIE}=${encodeURIComponent(JSON.stringify(mergedUser))}; path=/; max-age=604800;`;

        setSuccess(true);
        setPassword(""); // Clear password field
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      console.error("Failed to update profile settings:", err);
      alert(err?.response?.data?.message || err?.response?.data?.error || err.message || "Failed to save profile settings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Manage your account settings and preferences.</p>
      </div>

      <div className="grid gap-8">
        {/* Profile Settings */}
        <form onSubmit={handleSaveChanges}>
          <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
            <CardHeader className="bg-slate-50/50">
              <div className="flex items-center gap-3">
                 <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center ring-1 ring-blue-100">
                    <User className="h-5 w-5" />
                 </div>
                 <div>
                    <CardTitle className="text-base font-black text-slate-900">Profile Information</CardTitle>
                    <CardDescription className="text-xs font-medium">Update your personal details and public profile.</CardDescription>
                 </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-black text-slate-500 uppercase tracking-wider">Full Name</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="John Doe" 
                    className="rounded-xl border-slate-200 bg-slate-50/50 font-medium" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-black text-slate-500 uppercase tracking-wider">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="john@example.com" 
                    className="rounded-xl border-slate-200 bg-slate-50/50 font-medium" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-black text-slate-500 uppercase tracking-wider">Phone Number</Label>
                  <Input 
                    id="phone" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="9876543210" 
                    className="rounded-xl border-slate-200 bg-slate-50/50 font-medium" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-black text-slate-500 uppercase tracking-wider">New Password (Optional)</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="rounded-xl border-slate-200 bg-slate-50/50 font-medium" 
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  className={cn(
                    "h-11 px-8 rounded-xl font-bold transition-all text-white",
                    success ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
                  )}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : success ? (
                    <span className="flex items-center gap-2"><Check className="h-4 w-4" /> Updated</span>
                  ) : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* Notifications */}
        <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
          <CardHeader className="bg-slate-50/50">
            <div className="flex items-center gap-3">
               <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center ring-1 ring-amber-100">
                  <Bell className="h-5 w-5" />
               </div>
               <div>
                  <CardTitle className="text-base font-black text-slate-900">Notifications</CardTitle>
                  <CardDescription className="text-xs font-medium">Choose how you want to be notified.</CardDescription>
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-black text-slate-900">Email Notifications</p>
                <p className="text-xs text-slate-500 font-medium">Receive weekly reports and critical alerts via email.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator className="bg-slate-100" />
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-black text-slate-900">Desktop Push</p>
                <p className="text-xs text-slate-500 font-medium">Get real-time browser notifications for new tasks.</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
          <CardHeader className="bg-slate-50/50">
            <div className="flex items-center gap-3">
               <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-100">
                  <Shield className="h-5 w-5" />
               </div>
               <div>
                  <CardTitle className="text-base font-black text-slate-900">Security</CardTitle>
                  <CardDescription className="text-xs font-medium">Keep your account safe and secure.</CardDescription>
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
               <Button variant="outline" className="w-full justify-between rounded-xl border-slate-200 text-slate-600 font-bold h-12">
                  <span className="flex items-center gap-3"><Keyboard className="h-4 w-4" /> Change Password</span>
                  <span className="text-[10px] text-slate-400">Last changed 3 months ago</span>
               </Button>
               <Button variant="outline" className="w-full justify-between rounded-xl border-slate-200 text-slate-600 font-bold h-12">
                  <span className="flex items-center gap-3"><Globe className="h-4 w-4" /> Two-Factor Authentication</span>
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 uppercase text-[9px]">Enabled</Badge>
               </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
