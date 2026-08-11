"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Image as ImageIcon,
  Search,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  User as UserIcon,
  Clock,
  Gauge,
  Receipt,
  ClipboardList,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Maximize2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";
import { fetchGalleryMedia, type GalleryMediaItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "ALL", label: "All Media", icon: Layers, color: "bg-slate-900 text-white" },
  { id: "ATTENDANCE", label: "Attendance Selfies", icon: UserIcon, color: "bg-blue-600 text-white" },
  { id: "ODOMETER", label: "Odometer Photos", icon: Gauge, color: "bg-amber-600 text-white" },
  { id: "EXPENSE", label: "Expense Receipts", icon: Receipt, color: "bg-emerald-600 text-white" },
  { id: "TASK", label: "Task Attachments", icon: ClipboardList, color: "bg-indigo-600 text-white" },
  { id: "ISSUE", label: "Issue Photos", icon: AlertTriangle, color: "bg-rose-600 text-white" }
];

export default function GalleryPage() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [selectedMedia, setSelectedMedia] = useState<GalleryMediaItem | null>(null);

  const queryKey = ["gallery", selectedCategory, searchQuery, startDate, endDate, page, pageSize];

  const { data: response, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      fetchGalleryMedia({
        page,
        pageSize,
        category: selectedCategory,
        search: searchQuery,
        startDate,
        endDate
      }),
    refetchOnWindowFocus: false
  });

  const mediaItems = response?.data ?? [];
  const pagination = response?.pagination ?? { page: 1, pageSize: 24, totalCount: 0, totalPages: 1 };

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedCategory("ALL");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const renderPaginationButtons = () => {
    const totalPages = pagination.totalPages;
    const current = pagination.page;
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    return (
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={current <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold gap-1 shadow-xs"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>

        {pages.map((p, idx) => {
          if (typeof p === "string") {
            return (
              <span key={`ellipsis-${idx}`} className="px-2 text-xs font-bold text-slate-400">
                ...
              </span>
            );
          }
          const isSelected = p === current;
          return (
            <Button
              key={`page-${p}`}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => setPage(p)}
              className={cn(
                "h-9 min-w-[36px] rounded-xl text-xs font-black transition-all shadow-xs",
                isSelected
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100"
              )}
            >
              {p}
            </Button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          disabled={current >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold gap-1 shadow-xs"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "ATTENDANCE":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "ODOMETER":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "EXPENSE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "TASK":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "ISSUE":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
    }
  };

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
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Media Gallery</h1>
            <Badge className="bg-blue-50 text-blue-600 border-blue-200 font-bold text-xs">
              {pagination.totalCount} Images
            </Badge>
          </div>
          <p className="mt-1 text-slate-500 text-sm">
            Centralized gallery of all uploaded selfies, odometer readings, expense receipts, and task attachments.
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border shadow-xs",
                isActive
                  ? `${cat.color} border-transparent shadow-md scale-102`
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <Card className="border-none shadow-sm ring-1 ring-slate-200/60 bg-white rounded-2xl overflow-hidden">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by employee, title or info..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-10 text-xs rounded-xl border-slate-200 bg-white"
              />
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <Calendar className="h-4 w-4 text-slate-400 ml-1" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none"
              />
            </div>

            {(startDate || endDate || searchQuery || selectedCategory !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-10 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                Reset Filters
              </Button>
            )}
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Show per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-9 px-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none shadow-xs cursor-pointer"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={36}>36</option>
              <option value={48}>48</option>
              <option value={60}>60</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Media Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: pageSize }).map((_, idx) => (
            <div key={idx} className="h-56 rounded-2xl bg-slate-200/60 animate-pulse" />
          ))}
        </div>
      ) : mediaItems.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 shadow-none bg-slate-50/50 py-16 text-center rounded-3xl">
          <CardContent className="flex flex-col items-center justify-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-white shadow-md flex items-center justify-center text-slate-300">
              <ImageIcon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mt-2">No Media Images Found</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              No images match your current filter criteria. Try changing category, date range or clearing search.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="mt-2 rounded-xl font-bold text-xs"
            >
              Clear All Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {mediaItems.map((item) => (
            <Card
              key={item.id}
              onClick={() => setSelectedMedia(item)}
              className="group border-none shadow-xs hover:shadow-xl ring-1 ring-slate-200/70 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 bg-white rounded-2xl flex flex-col justify-between"
            >
              {/* Image Container */}
              <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                <img
                  src={item.url}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://placehold.co/400x300/f1f5f9/64748b?text=Image+Unavailable";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3">
                  <span className="text-[10px] font-black text-white bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md uppercase">
                    Inspect
                  </span>
                  <div className="h-7 w-7 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </div>
                </div>

                <div className="absolute top-2 left-2">
                  <Badge
                    variant="outline"
                    className={cn("text-[9px] font-black uppercase px-2 py-0.5 border shadow-xs", getCategoryBadgeClass(item.category))}
                  >
                    {item.category}
                  </Badge>
                </div>
              </div>

              {/* Card Meta Footer */}
              <div className="p-3 bg-white flex flex-col gap-1">
                <h4 className="text-xs font-extrabold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h4>
                {item.subtitle && <p className="text-[10px] font-bold text-slate-500 truncate">{item.subtitle}</p>}

                <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-100 text-[10px] text-slate-400 font-semibold">
                  <span className="truncate max-w-[110px]">{item.userName || "System"}</span>
                  <span>{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200">
          <div className="text-xs font-bold text-slate-500">
            Showing Page <span className="text-slate-900 font-black">{pagination.page}</span> of{" "}
            <span className="text-slate-900 font-black">{pagination.totalPages}</span> ({pagination.totalCount} Total Images)
          </div>
          {renderPaginationButtons()}
        </div>
      )}

      {/* High-Res Image Inspector Modal */}
      <Dialog open={Boolean(selectedMedia)} onOpenChange={(open) => !open && setSelectedMedia(null)}>
        <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden border-none bg-slate-950 shadow-2xl rounded-3xl">
          {selectedMedia && (
            <div className="flex flex-col md:flex-row min-h-[480px]">
              {/* Image View Stage */}
              <div className="flex-1 bg-black flex items-center justify-center p-4 relative group">
                <img
                  src={selectedMedia.url}
                  alt={selectedMedia.title}
                  className="max-h-[550px] w-auto max-w-full object-contain rounded-xl shadow-2xl"
                />
                <button
                  onClick={() => setSelectedMedia(null)}
                  className="absolute top-4 right-4 h-9 w-9 rounded-full bg-black/60 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/90 transition-colors md:hidden"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Inspector Details Sidebar */}
              <div className="w-full md:w-80 bg-slate-900 p-6 flex flex-col justify-between text-slate-200 border-l border-slate-800">
                <div className="space-y-6">
                  <div>
                    <Badge className={cn("text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border", getCategoryBadgeClass(selectedMedia.category))}>
                      {selectedMedia.category}
                    </Badge>
                    <h3 className="text-lg font-black text-white mt-3 leading-snug">{selectedMedia.title}</h3>
                    {selectedMedia.subtitle && (
                      <p className="text-xs font-bold text-blue-400 mt-1">{selectedMedia.subtitle}</p>
                    )}
                  </div>

                  <div className="space-y-3 border-y border-slate-800/80 py-4 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">Uploaded By:</span>
                      <span className="font-extrabold text-slate-200">{selectedMedia.userName || "N/A"}</span>
                    </div>
                    {selectedMedia.userEmail && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold">Email:</span>
                        <span className="font-medium text-slate-300 text-[11px] truncate max-w-[150px]">
                          {selectedMedia.userEmail}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">Date & Time:</span>
                      <span className="font-semibold text-slate-300 text-[11px]">
                        {new Date(selectedMedia.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                    {selectedMedia.extraInfo && (
                      <div className="flex justify-between items-center pt-1 border-t border-slate-800/40">
                        <span className="text-slate-400 font-bold">Details:</span>
                        <span className="font-bold text-amber-400 text-[11px]">{selectedMedia.extraInfo}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <a
                    href={selectedMedia.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full h-11 rounded-xl bg-slate-800 border-slate-700 text-white font-bold text-xs hover:bg-slate-700 gap-2">
                      <ExternalLink className="h-4 w-4" /> Open Full
                    </Button>
                  </a>
                  <a
                    href={selectedMedia.url}
                    download
                    className="flex-1"
                  >
                    <Button className="w-full h-11 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 gap-2 shadow-lg shadow-blue-900/50">
                      <Download className="h-4 w-4" /> Download
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
