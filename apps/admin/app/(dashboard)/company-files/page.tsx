"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UploadCloud,
  Search,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  FilePlus,
  Trash2,
  Download,
  Eye,
  File,
  Loader2,
  Filter,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fetchDocuments, createDocument, deleteDocument, uploadFile } from "@/lib/api";
import { formatTime } from "@/lib/format";

const CATEGORIES = ["ALL", "General", "Policy", "Notice", "Training", "Form", "Other"];

function getFileIcon(fileType?: string, fileName?: string) {
  const ext = fileName?.split(".").pop()?.toLowerCase() || "";
  if (fileType === "PDF" || ext === "pdf") {
    return <FileText className="h-6 w-6 text-rose-500" />;
  }
  if (fileType === "IMAGE" || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
    return <ImageIcon className="h-6 w-6 text-emerald-500" />;
  }
  if (fileType === "SPREADSHEET" || ["xls", "xlsx", "csv"].includes(ext)) {
    return <FileSpreadsheet className="h-6 w-6 text-emerald-600" />;
  }
  if (fileType === "DOC" || ["doc", "docx", "txt"].includes(ext)) {
    return <FileCode className="h-6 w-6 text-blue-500" />;
  }
  return <File className="h-6 w-6 text-slate-500" />;
}

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes === 0) return "--";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function UploadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");

  // Upload modal states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("General");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const documentsQuery = useQuery({
    queryKey: ["documents", search, category],
    queryFn: () => fetchDocuments({ search, category: category === "ALL" ? undefined : category })
  });

  const documents = documentsQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to delete file.");
    }
  });

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Please enter a title for the file.");
      return;
    }
    if (!selectedFile) {
      alert("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Upload file binary via /api/upload
      const url = await uploadFile(selectedFile);

      // 2. Save metadata to /api/documents
      await createDocument({
        title: title.trim(),
        description: description.trim() || undefined,
        fileUrl: url,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        category: selectedCategory
      });

      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsUploadOpen(false);
      setTitle("");
      setDescription("");
      setSelectedCategory("General");
      setSelectedFile(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "File upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Company Files & Uploads</h1>
          <p className="mt-1 text-slate-500 text-sm">
            Upload PDFs, documents, images, and notices for all staff members to view & download in the Staff App.
          </p>
        </div>

        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 rounded-xl bg-blue-600 px-5 font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 gap-2">
              <UploadCloud className="h-5 w-5" />
              Upload New File
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">Upload File for Staff</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Uploaded files will immediately be available to all staff members on their mobile app.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUploadSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="doc-title" className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Document Title *
                </Label>
                <Input
                  id="doc-title"
                  placeholder="e.g. Employee Safety Guidelines 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 rounded-xl border-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="doc-category" className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Category
                  </Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="doc-category" className="h-11 rounded-xl border-slate-200">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter((c) => c !== "ALL").map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Choose File *
                  </Label>
                  <label className="flex items-center justify-center h-11 px-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-600 truncate">
                    {selectedFile ? selectedFile.name : "Browse File..."}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      required
                    />
                  </label>
                </div>
              </div>

              {selectedFile && (
                <div className="text-[11px] font-semibold text-slate-500 bg-blue-50 p-2.5 rounded-xl border border-blue-100 flex items-center justify-between">
                  <span className="truncate">{selectedFile.name}</span>
                  <span className="shrink-0 font-bold text-blue-600">{formatBytes(selectedFile.size)}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="doc-desc" className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Description (Optional)
                </Label>
                <Input
                  id="doc-desc"
                  placeholder="Brief note or instructions about this document"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                  className="rounded-xl font-bold text-slate-500"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUploading}
                  className="rounded-xl bg-blue-600 font-bold hover:bg-blue-700 gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" /> Upload File
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter and Search Card */}
      <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search file name, title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg border-slate-200 bg-white"
              />
            </div>

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[160px] h-9 rounded-lg border-slate-200 bg-white text-xs font-semibold shadow-sm">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <SelectValue placeholder="All Categories" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "ALL" ? "All Categories" : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Showing {documents.length} Files
          </div>
        </div>

        {/* Table View */}
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400">
                Document
              </TableHead>
              <TableHead className="py-4 px-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                Category
              </TableHead>
              <TableHead className="py-4 px-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                File Size
              </TableHead>
              <TableHead className="py-4 px-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                Uploaded By
              </TableHead>
              <TableHead className="py-4 px-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                Date
              </TableHead>
              <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-slate-400 text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Loading files...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-300">
                    <UploadCloud className="h-10 w-10 opacity-30" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      No files uploaded yet.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc: any) => (
                <TableRow key={doc.id} className="group hover:bg-blue-50/30 border-slate-50 transition-colors">
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0">
                        {getFileIcon(doc.fileType, doc.fileName)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 text-sm leading-tight group-hover:text-blue-600 transition-colors truncate">
                          {doc.title}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {doc.fileName} {doc.description ? `• ${doc.description}` : ""}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-4">
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200/80 font-bold text-[10px] uppercase tracking-wider">
                      {doc.category || "General"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4 px-4 text-xs font-semibold text-slate-600">
                    {formatBytes(doc.fileSize)}
                  </TableCell>
                  <TableCell className="py-4 px-4 text-xs font-semibold text-slate-700">
                    {doc.uploadedBy?.name || "Admin"}
                  </TableCell>
                  <TableCell className="py-4 px-4 text-xs font-medium text-slate-500">
                    {new Date(doc.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    })}
                  </TableCell>
                  <TableCell className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        title="View / Open File"
                        onClick={() => window.open(doc.fileUrl, "_blank")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                        title="Download File"
                        onClick={() => handleDownload(doc.fileUrl, doc.fileName)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete File"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
                            deleteMutation.mutate(doc.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
