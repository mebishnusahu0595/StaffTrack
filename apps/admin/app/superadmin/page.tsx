"use client";

import { useState } from "react";
import { AlertCircle, Loader2, ShieldCheck, Mail, Lock, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function SuperAdminLoginPage() {
  const { signIn, isBootstrapping } = useAuth();
  const [accessId, setAccessId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Map Access ID 0595 to the new superadmin email
      const finalEmail = accessId.trim() === "0595" ? "superadmin@gmail.com" : accessId.trim();
      await signIn({ email: finalEmail, password: password.trim() });
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data?.message || data?.error || "Connection Error";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse" />
      
      <div className="w-full max-w-[440px] z-10 px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-blue-600 shadow-2xl shadow-blue-500/30 mb-6 transform rotate-3 hover:rotate-0 transition-transform duration-500">
            <ShieldCheck className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">StaffTrack <span className="text-blue-500 italic">SuperAdmin</span></h1>
          <p className="text-slate-400 font-bold mt-2 text-xs uppercase tracking-[0.3em]">Global System Management</p>
        </div>

        <Card className="border-none shadow-3xl shadow-black/40 bg-slate-800/50 backdrop-blur-2xl ring-1 ring-white/10">
          <CardHeader className="space-y-1 pb-6 border-b border-white/5">
            <CardTitle className="text-2xl font-bold text-white">Console Access</CardTitle>
            <CardDescription className="text-slate-400">Authorization required for system-wide modifications</CardDescription>
          </CardHeader>
          <CardContent className="pt-8 pb-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="accessId" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Access ID / Email</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-4 h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <Input 
                    id="accessId" 
                    placeholder="0595 or admin@example.com"
                    value={accessId} 
                    onChange={(event) => setAccessId(event.target.value)} 
                    required 
                    className="h-12 pl-12 bg-slate-900/50 border-slate-700 text-white focus:border-blue-500 focus:ring-blue-500/20 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Security Key</Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-4 h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    value={password} 
                    onChange={(event) => setPassword(event.target.value)} 
                    required 
                    className="h-12 pl-12 pr-12 bg-slate-900/50 border-slate-700 text-white focus:border-blue-500 focus:ring-blue-500/20 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-4 text-slate-500 hover:text-blue-400 transition-colors focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="font-bold">{error}</span>
                </div>
              ) : null}

              <Button 
                type="submit" 
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 rounded-xl transition-all active:scale-[0.98]" 
                disabled={isSubmitting || isBootstrapping}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Launch Console"
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5">
               <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                 <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                 <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                   Level 5 Authorization Active. Access ID 0595 is reserved for global system overrides.
                 </p>
               </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center mt-8 text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em]">
          &copy; {new Date().getFullYear()} StaffTrack Global Security Channel 0595
        </p>
      </div>
    </div>
  );
}
