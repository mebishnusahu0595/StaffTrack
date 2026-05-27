"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchForm } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  Camera, 
  Calendar as CalendarIcon,
  ChevronLeft,
  AlertCircle,
  Loader2,
  Image as ImageIcon
} from "lucide-react";
import dayjs from "dayjs";
import axios from "axios";
import { ACCESS_COOKIE } from "@/lib/constants";
import Cookies from "js-cookie";

export default function FillFormPage() {
  const { id } = useParams();
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const { data: form, isLoading, error } = useQuery({
    queryKey: ["forms", id],
    queryFn: () => fetchForm(id as string)
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => axios.post(`/api/forms/${id}/submit`, data, {
      headers: {
        Authorization: `Bearer ${Cookies.get(ACCESS_COOKIE)}`
      }
    }),
    onSuccess: () => {
      setIsSubmitted(true);
    }
  });

  const handleInputChange = (label: string, value: any) => {
    setFormData(prev => ({ ...prev, [label]: value }));
  };

  const handlePhotoUpload = async (label: string, file: File) => {
    setIsUploading(label);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      handleInputChange(label, response.data.url);
    } catch (err) {
      alert("Photo upload failed. Please try again.");
    } finally {
      setIsUploading(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if logged in
    if (!Cookies.get(ACCESS_COOKIE)) {
      alert("Please login to submit this form.");
      router.push(`/login?redirect=/forms/fill/${id}`);
      return;
    }

    // Validate required fields
    for (const field of form.fields) {
      if (field.required && !formData[field.label]) {
        alert(`${field.label} is required`);
        return;
      }
    }

    submitMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex justify-center items-start">
        <Card className="w-full max-w-2xl rounded-[32px] border-none shadow-xl overflow-hidden">
          <div className="h-32 bg-slate-200 animate-pulse" />
          <CardContent className="p-8 space-y-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <div className="space-y-8 pt-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <h1 className="text-xl font-black text-slate-900">Form Not Found</h1>
        <p className="text-slate-500 font-bold">This form may have been deleted or moved.</p>
        <Button onClick={() => router.push("/")} variant="outline" className="rounded-2xl font-bold">Back to Dashboard</Button>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl shadow-blue-100 p-12 text-center space-y-6 animate-in zoom-in duration-500">
          <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-900">Submitted!</h1>
          <p className="text-slate-500 font-bold leading-relaxed">
            Your response for <span className="text-blue-600">&quot;{form.name}&quot;</span> has been successfully recorded.
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs"
          >
            Submit Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex justify-center items-start">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl">
        <Card className="rounded-[40px] border-none shadow-2xl shadow-blue-100 overflow-hidden bg-white animate-in slide-in-from-bottom duration-700">
          <div className="h-3 bg-blue-600" />
          <CardHeader className="p-8 md:p-12 bg-slate-50/50 border-b border-slate-100 relative">
             <div className="flex items-center gap-2 mb-4">
               <Badge className="bg-blue-100 text-blue-600 border-none font-black uppercase text-[10px] tracking-widest px-3 py-1">
                 {form.category || "General"}
               </Badge>
             </div>
             <CardTitle className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">
               {form.name}
             </CardTitle>
             <CardDescription className="text-slate-500 font-bold mt-2 text-sm md:text-base">
               Please fill out the details below accurately. Fields marked with * are required.
             </CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 md:p-12 space-y-10">
            {form.fields.map((field: any) => (
              <div key={field.id} className="space-y-3 group">
                <Label className="text-xs font-black uppercase text-slate-400 tracking-widest group-focus-within:text-blue-600 transition-colors">
                  {field.label} {field.required && <span className="text-rose-500 ml-1">*</span>}
                </Label>
                
                {field.type === "text" && (
                  <Input 
                    placeholder={`Your ${field.label.toLowerCase()}...`}
                    required={field.required}
                    className="h-14 rounded-2xl bg-slate-50 border-none font-bold focus-visible:ring-2 focus-visible:ring-blue-600/20 text-slate-900 transition-all"
                    value={formData[field.label] || ""}
                    onChange={e => handleInputChange(field.label, e.target.value)}
                  />
                )}

                {field.type === "textarea" && (
                  <textarea 
                    placeholder={`Your ${field.label.toLowerCase()}...`}
                    required={field.required}
                    className="w-full min-h-[120px] p-4 rounded-2xl bg-slate-50 border-none font-bold focus-visible:ring-2 focus-visible:ring-blue-600/20 text-slate-900 transition-all focus:outline-none resize-y"
                    value={formData[field.label] || ""}
                    onChange={e => handleInputChange(field.label, e.target.value)}
                  />
                )}

                {field.type === "number" && (
                  <Input 
                    type="number"
                    placeholder="0"
                    required={field.required}
                    className="h-14 rounded-2xl bg-slate-50 border-none font-bold focus-visible:ring-2 focus-visible:ring-blue-600/20 text-slate-900 transition-all"
                    value={formData[field.label] || ""}
                    onChange={e => handleInputChange(field.label, e.target.value)}
                  />
                )}

                {field.type === "select" && (
                  <Select 
                    required={field.required}
                    value={formData[field.label]}
                    onValueChange={val => handleInputChange(field.label, val)}
                  >
                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-blue-600/20 text-slate-900 transition-all">
                      <SelectValue placeholder={`Select ${field.label}...`} />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-xl bg-white border border-slate-100">
                      {JSON.parse(field.options || "[]").map((opt: string) => (
                        <SelectItem key={opt} value={opt} className="font-bold py-3 rounded-xl focus:bg-blue-50 focus:text-blue-600">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {field.type === "checkbox" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    {JSON.parse(field.options || "[]").map((opt: string) => {
                      const currentValues: string[] = formData[field.label] || [];
                      const isChecked = currentValues.includes(opt);
                      
                      const handleCheckboxChange = (checked: boolean) => {
                        let newValues = [...currentValues];
                        if (checked) {
                          newValues.push(opt);
                        } else {
                          newValues = newValues.filter(v => v !== opt);
                        }
                        handleInputChange(field.label, newValues);
                      };

                      return (
                        <label key={opt} className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl cursor-pointer transition-all">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={e => handleCheckboxChange(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600/20"
                          />
                          <span className="text-sm font-bold text-slate-700">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {field.type === "radio" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    {JSON.parse(field.options || "[]").map((opt: string) => {
                      const isSelected = formData[field.label] === opt;
                      return (
                        <label key={opt} className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl cursor-pointer transition-all">
                          <input 
                            type="radio" 
                            name={`radio-${field.id}`}
                            checked={isSelected}
                            onChange={() => handleInputChange(field.label, opt)}
                            className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-600/20"
                          />
                          <span className="text-sm font-bold text-slate-700">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {field.type === "email" && (
                  <Input 
                    type="email"
                    placeholder={`e.g. name@example.com`}
                    required={field.required}
                    className="h-14 rounded-2xl bg-slate-50 border-none font-bold focus-visible:ring-2 focus-visible:ring-blue-600/20 text-slate-900 transition-all"
                    value={formData[field.label] || ""}
                    onChange={e => handleInputChange(field.label, e.target.value)}
                  />
                )}

                {field.type === "phone" && (
                  <Input 
                    type="tel"
                    placeholder={`e.g. +91 9999999999`}
                    required={field.required}
                    className="h-14 rounded-2xl bg-slate-50 border-none font-bold focus-visible:ring-2 focus-visible:ring-blue-600/20 text-slate-900 transition-all"
                    value={formData[field.label] || ""}
                    onChange={e => handleInputChange(field.label, e.target.value)}
                  />
                )}

                {field.type === "photo" && (
                  <div className="space-y-4">
                    {formData[field.label] ? (
                      <div className="relative h-48 w-full rounded-[32px] overflow-hidden border-4 border-white shadow-xl group">
                        <img src={formData[field.label]} className="h-full w-full object-cover" alt={field.label} />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <Button 
                            type="button" 
                            variant="ghost" 
                            className="text-white font-black uppercase text-xs"
                            onClick={() => handleInputChange(field.label, null)}
                           >
                             Retake Photo
                           </Button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-48 w-full border-4 border-dashed border-slate-100 rounded-[32px] bg-slate-50/50 hover:bg-slate-50 hover:border-blue-200 transition-all cursor-pointer group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {isUploading === field.label ? (
                            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                          ) : (
                            <>
                              <div className="h-12 w-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all mb-3">
                                <Camera className="h-6 w-6" />
                              </div>
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tap to capture photo</p>
                            </>
                          )}
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          className="hidden" 
                          onChange={e => e.target.files?.[0] && handlePhotoUpload(field.label, e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
                )}

                {field.type === "date" && (
                  <div className="relative">
                    <CalendarIcon className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input 
                      type="date"
                      required={field.required}
                      className="h-14 pl-14 rounded-2xl bg-slate-50 border-none font-bold focus-visible:ring-2 focus-visible:ring-blue-600/20 text-slate-900 transition-all"
                      value={formData[field.label] || ""}
                      onChange={e => handleInputChange(field.label, e.target.value)}
                    />
                  </div>
                )}
              </div>
            ))}

            <div className="pt-8">
              <Button 
                type="submit" 
                disabled={submitMutation.isPending || !!isUploading}
                className="w-full h-16 bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-200 text-white rounded-3xl font-black uppercase tracking-widest text-sm transition-all hover:scale-[1.01] active:scale-[0.98]"
              >
                {submitMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  "Submit Form Response"
                )}
              </Button>
            </div>
          </CardContent>
          <div className="p-8 bg-slate-50/50 text-center border-t border-slate-100">
             <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-center gap-2">
               <FileSpreadsheet className="h-3 w-3" /> Powered by StaffTrack Engine
             </p>
          </div>
        </Card>
      </form>
    </div>
  );
}
