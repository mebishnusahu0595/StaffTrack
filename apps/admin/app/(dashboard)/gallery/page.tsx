"use client";

import { useAuth } from "@/components/auth-provider";
import { MediaGalleryTab } from "@/components/superadmin/media-gallery-tab";
import { AlertTriangle } from "lucide-react";

export default function GalleryPage() {
  const { user } = useAuth();

  if (user && user.role !== "SUPERADMIN") {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="h-16 w-16 bg-rose-50 text-rose-500 rounded-3xl mx-auto flex items-center justify-center shadow-lg border border-rose-100">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Super Admin Access Required</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          The Media Gallery is strictly restricted to Super Admin accounts. You do not have permissions to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Superadmin Media Gallery</h1>
        <p className="text-slate-500 text-sm">
          Centralized gallery of all uploaded selfies, odometer readings, expense receipts, and task attachments across all users.
        </p>
      </div>
      <MediaGalleryTab />
    </div>
  );
}
