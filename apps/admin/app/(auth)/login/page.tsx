"use client";
 
import { useState } from "react";
import { AlertCircle, Loader2, Lock, Mail, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
 
export default function LoginPage() {
  const { signIn, isBootstrapping } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
 
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
 
    try {
      await signIn({ email: email.trim(), password });
    } catch (err: any) {
      const data = err?.response?.data;
      setError((data?.message ?? "Unable to sign in") + (data?.error ? ": " + data.error : ""));
    } finally {
      setIsSubmitting(false);
    }
  }
 
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-60 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-60 animate-pulse" />
      
      <div className="w-full max-w-[440px] z-10 px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-xl shadow-blue-200 mb-4">
            <Lock className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">StaffTrack</h1>
          <p className="text-slate-500 font-medium mt-2">Field Tracking System Operations Console</p>
        </div>
 
        <Card className="border-none shadow-2xl shadow-slate-200/60 ring-1 ring-slate-200/50 bg-white/80 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold">Sign In</CardTitle>
            <CardDescription>Enter your administrator credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="admin@example.com"
                    value={email} 
                    onChange={(event) => setEmail(event.target.value)} 
                    required 
                    className="h-11 pl-11 bg-slate-50/50 border-slate-200 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</Label>
                  <a href="#" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">Forgot?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    value={password} 
                    onChange={(event) => setPassword(event.target.value)} 
                    required 
                    className="h-11 pl-11 pr-11 bg-slate-50/50 border-slate-200 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
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
                <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm text-red-600 animate-in fade-in zoom-in duration-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              ) : null}
 
              <Button 
                type="submit" 
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 font-bold transition-all active:scale-[0.98]" 
                disabled={isSubmitting || isBootstrapping}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Continue to Dashboard"
                )}
              </Button>
            </form>
 
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Secure access for authorized administrators only. Activity is monitored for security purposes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
 
        <p className="text-center mt-8 text-xs text-slate-400 font-medium">
          &copy; {new Date().getFullYear()} StaffTrack Systems. All rights reserved.
        </p>
      </div>
    </div>
  );
}
