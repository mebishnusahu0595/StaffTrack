"use client";

import React, { useState, useRef } from "react";
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  FileText, 
  Send, 
  Eye,
  Filter,
  Users,
  Calendar,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
  History,
  Link as LinkIcon,
  Copy,
  Check,
  Download,
  MapPin,
  Printer
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchForms, createForm, updateForm, deleteForm, fetchFormResponses } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useReactToPrint } from "react-to-print";
import dayjs from "dayjs";

export default function FormsPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const queryClient = useQueryClient();

  const formsQuery = useQuery({
    queryKey: ["forms", search, activeTab],
    queryFn: () => fetchForms({ search, status: activeTab })
  });

  const createMutation = useMutation({
    mutationFn: createForm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      setIsCreateOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateForm(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      setIsEditOpen(false);
      setEditingForm(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteForm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    }
  });

  const copyLink = (id: string) => {
    const link = `${window.location.origin}/forms/fill/${id}`;
    navigator.clipboard.writeText(link);
    alert("Form link copied to clipboard!");
  };

  const forms = formsQuery.data ?? [];
  const categories = Array.from(new Set(forms.map((f: any) => f.category || "General")));

  const displayedForms = forms.filter((f: any) => 
    selectedCategory === "All" || (f.category || "General") === selectedCategory
  );

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <History className="h-3 w-3" />
            <span>Home / Forms</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Survey Engine
            <Badge variant="outline" className="h-6 px-2 rounded-lg border-blue-100 bg-blue-50/50 text-blue-600 font-bold">
              {displayedForms.length} Total
            </Badge>
          </h1>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-blue-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Plus className="h-5 w-5" /> Create Form
            </Button>
          </DialogTrigger>
          <CreateFormDialog 
            onSubmit={(data: any) => createMutation.mutate(data)}
            isSubmitting={createMutation.isPending}
          />
        </Dialog>
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-6 bg-white p-4 rounded-[32px] border border-slate-200/60 shadow-sm">
         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="bg-slate-100 p-1 rounded-2xl h-12">
               {["All", "Published", "Saved", "Trashed"].map(tab => (
                  <TabsTrigger 
                  key={tab} 
                  value={tab} 
                  className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
                  >
                     {tab}
                  </TabsTrigger>
               ))}
            </TabsList>
         </Tabs>

        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search forms..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-12 border-none bg-slate-50 rounded-2xl font-bold focus:bg-slate-100/50 transition-all" 
          />
        </div>
        
        <div className="flex items-center gap-2">
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                 <Button variant="outline" className="h-12 rounded-2xl border-slate-200 font-bold text-slate-600 gap-2 px-6">
                    <Filter className="h-4 w-4" /> Category: {selectedCategory}
                 </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl w-48 bg-white border border-slate-100 shadow-xl">
                 <DropdownMenuItem onClick={() => setSelectedCategory("All")} className="text-xs font-bold">
                    All Categories
                 </DropdownMenuItem>
                 {categories.map(cat => (
                    <DropdownMenuItem key={cat} onClick={() => setSelectedCategory(cat)} className="text-xs font-bold">
                       {cat}
                    </DropdownMenuItem>
                 ))}
              </DropdownMenuContent>
           </DropdownMenu>

           <Button 
             variant="outline" 
             className="h-12 rounded-2xl border-slate-200 font-bold text-slate-600 gap-2 px-6"
             onClick={() => setViewMode(prev => prev === "table" ? "grid" : "table")}
           >
              <Eye className="h-4 w-4" /> View: {viewMode === "table" ? "Table" : "Grid"}
           </Button>
        </div>
      </div>

      {/* Forms Table / Grid */}
      <Card className="rounded-[40px] border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
        <CardContent className="p-0">
           {viewMode === "table" ? (
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-slate-50/50">
                         <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Table Name</th>
                         <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                         <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Response</th>
                         <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Assigned To</th>
                         <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Team</th>
                         <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Created By</th>
                         <th className="py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Created On</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {displayedForms.map(form => (
                         <tr key={form.id} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-6">
                               <ViewResponsesDialog form={form} trigger={
                                  <button className="text-left font-black text-slate-900 hover:text-blue-600 transition-colors uppercase tracking-tight hover:underline cursor-pointer">
                                     {form.name}
                                  </button>
                               } />
                            </td>
                            <td className="py-6">
                               <Badge className={cn(
                                  "text-[9px] font-black uppercase px-2.5 py-0.5 rounded-md border",
                                  form.status === "Published" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                               )}>
                                  {form.status}
                               </Badge>
                            </td>
                             <td className="py-6 text-center">
                                <ViewResponsesDialog form={form} trigger={
                                   <button className="text-xs font-black text-slate-900 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 px-3 py-1 rounded-full cursor-pointer transition-colors">
                                      {form._count?.responses || 0}
                                   </button>
                                } />
                             </td>
                            <td className="py-6">
                               <div className="flex items-center gap-3">
                                  <div className="h-7 w-7 rounded-full bg-emerald-600 flex items-center justify-center text-[8px] font-black text-white">P</div>
                                  <span className="text-xs font-bold text-slate-600">{form.assignedTo?.name || "Unassigned"}</span>
                                </div>
                            </td>
                            <td className="py-6 text-xs font-bold text-slate-400">{form.team?.name || form.group?.name || "General"}</td>
                            <td className="py-6">
                               <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-[8px] font-black text-emerald-600">S</div>
                                  <span className="text-xs font-bold text-slate-600">{form.createdBy?.name || "System"}</span>
                                </div>
                            </td>
                            <td className="py-6 text-xs font-bold text-slate-500">{dayjs(form.createdAt).format("DD-MM-YYYY")}</td>
                            <td className="px-8 py-6 text-right">
                               <div className="flex items-center justify-end gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 rounded-xl hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-all"
                                    onClick={() => copyLink(form.id)}
                                    title="Copy Form Link"
                                  >
                                     <LinkIcon className="h-4 w-4" />
                                  </Button>
                                  <DropdownMenu>
                                     <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
                                           <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                     </DropdownMenuTrigger>
                                     <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                         <DropdownMenuItem 
                                           onClick={() => {
                                             setEditingForm(form);
                                             setIsEditOpen(true);
                                           }}
                                           className="text-xs font-bold gap-2"
                                         >
                                            Edit Form
                                         </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          className="text-xs font-bold gap-2 text-rose-500"
                                          onClick={() => {
                                            if (confirm("Are you sure you want to delete this form?")) {
                                              deleteMutation.mutate(form.id);
                                            }
                                          }}
                                        >
                                          Delete Form
                                        </DropdownMenuItem>
                                     </DropdownMenuContent>
                                  </DropdownMenu>
                               </div>
                            </td>
                         </tr>
                      ))}
                      {displayedForms.length === 0 && (
                         <tr>
                            <td colSpan={8} className="py-32 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                               No survey forms found
                            </td>
                         </tr>
                      )}
                   </tbody>
                </table>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8 bg-slate-50/10">
                {displayedForms.map(form => (
                   <Card key={form.id} className="rounded-3xl border border-slate-100 shadow-sm hover:ring-1 hover:ring-blue-500/20 hover:shadow-xl transition-all duration-300 overflow-hidden bg-white text-left">
                      <CardHeader className="p-6 pb-3 flex flex-row items-start justify-between">
                         <div className="space-y-1">
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block">{form.category || "General"}</span>
                            <h3 className="text-base font-black text-slate-900 transition-colors uppercase tracking-tight">{form.name}</h3>
                         </div>
                         <Badge className={cn(
                            "text-[9px] font-black uppercase px-2 py-0.5 rounded border",
                            form.status === "Published" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                         )}>
                            {form.status}
                         </Badge>
                      </CardHeader>
                      <CardContent className="p-6 pt-3 space-y-4">
                          <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-3">
                             <span className="text-slate-400 font-bold">Responses</span>
                             <ViewResponsesDialog form={form} trigger={
                                 <button className="text-sm font-black text-slate-800 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 px-3 py-1 rounded-full cursor-pointer transition-colors">
                                    {form._count?.responses || 0}
                                 </button>
                              } />
                          </div>
                         <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-3">
                            <span className="text-slate-400 font-bold">Assigned To</span>
                            <span className="font-extrabold text-slate-700">{form.assignedTo?.name || "Unassigned"}</span>
                         </div>
                         <div className="flex items-center justify-between text-xs text-slate-400 font-semibold pt-1">
                            <span>Created: {dayjs(form.createdAt).format("DD-MM-YYYY")}</span>
                         </div>
                         
                         <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-50">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-xl hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-all"
                              onClick={() => copyLink(form.id)}
                              title="Copy Form Link"
                            >
                               <LinkIcon className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
                                     <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                         <DropdownMenuItem 
                                           onClick={() => {
                                             setEditingForm(form);
                                             setIsEditOpen(true);
                                           }}
                                           className="text-xs font-bold gap-2"
                                         >
                                            Edit Form
                                         </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-xs font-bold gap-2 text-rose-500"
                                    onClick={() => {
                                      if (confirm("Are you sure you want to delete this form?")) {
                                        deleteMutation.mutate(form.id);
                                      }
                                    }}
                                  >
                                    Delete Form
                                  </DropdownMenuItem>
                               </DropdownMenuContent>
                            </DropdownMenu>
                         </div>
                      </CardContent>
                   </Card>
                ))}
                {displayedForms.length === 0 && (
                   <div className="col-span-full py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      No survey forms found
                   </div>
                )}
             </div>
           )}
        </CardContent>
        {/* Pagination placeholder */}
        <div className="p-8 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing {forms.length} Of {forms.length} Result</p>
           <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-white"><ChevronLeft className="h-4 w-4" /></Button>
              <div className="h-8 w-8 rounded-lg bg-white border border-blue-600 text-blue-600 flex items-center justify-center text-xs font-black">1</div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-white"><ChevronRight className="h-4 w-4" /></Button>
           </div>
        </div>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) setEditingForm(null);
      }}>
         {editingForm && (
            <CreateFormDialog 
               initialData={editingForm}
               onSubmit={(data: any) => updateMutation.mutate({ id: editingForm.id, data })}
               isSubmitting={updateMutation.isPending}
            />
         )}
      </Dialog>
    </div>
  );
}

function CreateFormDialog({ onSubmit, isSubmitting, initialData }: any) {
  const [data, setData] = useState(initialData ? {
    ...initialData,
    fields: initialData.fields || []
  } : { 
    name: "", 
    category: "Operations", 
    status: "Published",
    fields: [] as any[]
  });

  const addField = () => {
    setData({
      ...data,
      fields: [...data.fields, { label: "", type: "text", required: false, options: [] }]
    });
  };

  const removeField = (index: number) => {
    setData({
      ...data,
      fields: data.fields.filter((_: any, i: number) => i !== index)
    });
  };

  const updateField = (index: number, updates: any) => {
    const newFields = [...data.fields];
    newFields[index] = { ...newFields[index], ...updates };
    setData({ ...data, fields: newFields });
  };

  return (
    <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[32px] max-h-[90vh] overflow-y-auto hide-close">
      <DialogHeader className="p-8 bg-blue-600 text-white relative">
        <DialogClose className="absolute right-6 top-6 rounded-xl bg-white/10 p-1.5 text-white/50 hover:bg-white/20 transition-all">
           <X className="h-4 w-4" />
        </DialogClose>
        <DialogTitle className="text-2xl font-black">{initialData ? "Edit Form" : "Create New Form"}</DialogTitle>
        <p className="text-blue-100 text-xs font-bold mt-1">Design a data collection survey for the field team.</p>
      </DialogHeader>
      <div className="p-8 space-y-6">
         <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Form Name</Label>
               <Input 
                 placeholder="e.g. Sales Inquiry Form" 
                 className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                 value={data.name}
                 onChange={e => setData({...data, name: e.target.value})}
               />
            </div>
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Category</Label>
               <Input 
                 placeholder="e.g. Operations" 
                 className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                 value={data.category}
                 onChange={e => setData({...data, category: e.target.value})}
               />
            </div>
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400">Status</Label>
               <Select value={data.status} onValueChange={s => setData({...data, status: s})}>
                  <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs">
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white border border-slate-100 shadow-xl">
                     <SelectItem value="Published">Published</SelectItem>
                     <SelectItem value="Draft">Draft</SelectItem>
                     <SelectItem value="Trashed">Trashed</SelectItem>
                  </SelectContent>
               </Select>
            </div>
         </div>

         <div className="space-y-4">
            <div className="flex items-center justify-between">
               <Label className="text-[10px] font-black uppercase text-slate-400">Form Fields</Label>
               <Button type="button" onClick={addField} variant="outline" size="sm" className="rounded-xl font-bold text-blue-600 border-blue-100 bg-blue-50">
                  <Plus className="h-3 w-3 mr-2" /> Add Field
               </Button>
            </div>

            <div className="space-y-3">
               {data.fields.map((field: any, index: number) => (
                  <div key={index} className="p-4 bg-slate-50 rounded-2xl space-y-4 relative group">
                     <button 
                       type="button" 
                       onClick={() => removeField(index)}
                       className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                     >
                        <X className="h-3 w-3" />
                     </button>
                     <div className="grid grid-cols-2 gap-4">
                        <Input 
                          placeholder="Field Label (e.g. Shop Name)" 
                          className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs" 
                          value={field.label}
                          onChange={e => updateField(index, { label: e.target.value })}
                        />
                        <Select value={field.type} onValueChange={v => updateField(index, { type: v })}>
                           <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="rounded-xl bg-white border border-slate-150 shadow-md">
                              <SelectItem value="text">Text Input</SelectItem>
                              <SelectItem value="textarea">Long Text (Textarea)</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="select">Dropdown (Select)</SelectItem>
                              <SelectItem value="checkbox">Checkbox (Multi-Select)</SelectItem>
                              <SelectItem value="radio">Radio Group (Single-Select)</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="phone">Phone Number</SelectItem>
                              <SelectItem value="photo">Photo Upload</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                     {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                        <div className="space-y-2">
                           <Label className="text-[9px] font-bold text-slate-400">Options (comma separated)</Label>
                           <Input 
                             placeholder="Option 1, Option 2, Option 3" 
                             className="h-9 rounded-xl bg-white border-slate-200 text-xs font-medium" 
                             value={Array.isArray(field.options) ? field.options.join(", ") : field.options}
                             onChange={e => updateField(index, { options: e.target.value.split(",").map((s: string) => s.trim()) })}
                           />
                        </div>
                     )}
                     <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id={`req-${index}`}
                          checked={field.required}
                          onChange={e => updateField(index, { required: e.target.checked })}
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                        <Label htmlFor={`req-${index}`} className="text-[10px] font-bold text-slate-500">Required Field</Label>
                     </div>
                  </div>
               ))}
               {data.fields.length === 0 && (
                  <div className="py-12 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center text-slate-400">
                     <FileSpreadsheet className="h-8 w-8 mb-2 opacity-20" />
                     <p className="text-xs font-bold">No fields added yet</p>
                  </div>
               )}
            </div>
         </div>

         <Button 
          className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 rounded-2xl font-black uppercase tracking-widest text-xs"
          onClick={() => {
            const cleanData = {
              name: data.name,
              category: data.category,
              status: data.status,
              fields: data.fields
            };
            onSubmit(cleanData);
          }}
          disabled={isSubmitting || !data.name || data.fields.length === 0}
         >
            {isSubmitting ? "Processing..." : initialData ? "Save Changes" : "Create Form"}
         </Button>
      </div>
    </DialogContent>
  );
}

function ViewResponsesDialog({ form, trigger }: { form: any; trigger?: React.ReactNode }) {
  const [respSearch, setRespSearch] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["responses", form.id],
    queryFn: () => fetchFormResponses(form.id)
  });

  const downloadCSV = () => {
    if (responses.length === 0) return;
    const fieldsList = form.fields || [];
    const headers = ["Submitter", "Date Submitted", ...fieldsList.map((f: any) => f.label)];
    
    const rows = responses.map((resp: any) => {
      let respData = {} as any;
      try {
        respData = typeof resp.data === "string" ? JSON.parse(resp.data) : (resp.data || {});
      } catch (e) {}
      return [
        resp.user?.name || "System",
        dayjs(resp.submittedAt).format("YYYY-MM-DD HH:mm"),
        ...fieldsList.map((f: any) => {
          const val = respData[f.label];
          if (val && typeof val === "object" && val.url) {
            return `${val.url} (Lat: ${val.latitude ?? "N/A"}, Lng: ${val.longitude ?? "N/A"}, Time: ${val.timestamp ? dayjs(val.timestamp).format("YYYY-MM-DD HH:mm") : "N/A"})`;
          }
          return val || "";
        })
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${(val ?? "").toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Responses_${form.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredResponses = responses.filter((resp: any) => {
    const q = respSearch.toLowerCase().trim();
    if (!q) return true;
    const userMatch = resp.user?.name?.toLowerCase().includes(q);
    // search across all parsed data values
    let dataMatch = false;
    try {
      const d = typeof resp.data === "string" ? JSON.parse(resp.data) : (resp.data || {});
      dataMatch = Object.values(d).some((v: any) => {
        if (!v) return false;
        if (typeof v === "object" && v.url) return false; // skip photo objects
        return String(v).toLowerCase().includes(q);
      });
    } catch (e) {}
    return userMatch || dataMatch;
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="ghost" size="sm" className="h-9 px-3 rounded-xl hover:bg-blue-50 text-blue-600 font-bold text-xs gap-1.5 transition-all">
            <Eye className="h-4 w-4" /> View Responses
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="!fixed !inset-4 !max-w-none !w-auto !h-auto !max-h-none !translate-x-0 !translate-y-0 !left-4 !right-4 !top-4 !bottom-4 p-0 overflow-hidden border-none shadow-2xl bg-white rounded-2xl flex flex-col hide-close">
        {/* Header */}
        <DialogHeader className="px-5 py-3 bg-slate-900 text-white relative flex-shrink-0">
          <DialogClose className="absolute right-4 top-3 rounded-lg bg-white/10 p-1 text-white/50 hover:bg-white/20 transition-all">
             <X className="h-4 w-4" />
          </DialogClose>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-white/20 text-white/60 text-[9px] font-black uppercase tracking-widest">{form.category}</Badge>
          </div>
          <DialogTitle className="text-base font-black">{form.name} — {filteredResponses.length} response{filteredResponses.length !== 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-slate-100 flex-shrink-0 bg-slate-50">
           <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <Input 
                 placeholder="Search by name, dealer, address, district…" 
                 value={respSearch}
                 onChange={e => setRespSearch(e.target.value)}
                 className="h-8 pl-7 rounded-lg bg-white border-slate-200 font-bold text-[11px]" 
              />
           </div>
           <div className="flex items-center gap-1.5">
              <Button 
                 onClick={downloadCSV}
                 disabled={responses.length === 0}
                 className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] gap-1.5 px-3 shadow-sm"
              >
                 <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button 
                 onClick={handlePrint}
                 disabled={responses.length === 0}
                 className="h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] gap-1.5 px-3 shadow-sm"
              >
                 <Printer className="h-3.5 w-3.5" /> PDF
              </Button>
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
           {isLoading ? (
              <div className="py-16 flex justify-center"><div className="h-6 w-6 animate-spin border-4 border-blue-600 border-t-transparent rounded-full" /></div>
           ) : filteredResponses.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No responses found</div>
           ) : (
              <div className="space-y-3">
                 {filteredResponses.map((resp: any, idx: number) => {
                    let data = {};
                    try {
                      data = typeof resp.data === "string" ? JSON.parse(resp.data) : (resp.data || {});
                    } catch (e) {}
                    return (
                     <div key={resp.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden text-left shadow-sm">
                        {/* Submission Header */}
                        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <span className="h-6 w-6 rounded-full bg-slate-800 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                              <Avatar className="h-7 w-7 border border-slate-200">
                                 <AvatarImage src={resp.user?.avatarUrl} />
                                 <AvatarFallback className="bg-blue-600 text-white text-[10px] font-black">{resp.user?.name?.slice(0, 1) || "U"}</AvatarFallback>
                              </Avatar>
                              <div>
                                 <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-tight">{resp.user?.name || "Unknown Staff"}</p>
                                 <p className="text-[9px] font-bold text-slate-400">{dayjs(resp.submittedAt).format("DD MMM YYYY, hh:mm A")}</p>
                              </div>
                           </div>
                           <Badge variant="outline" className="text-[9px] font-black border-slate-200 bg-white text-slate-500">#{resp.id.slice(-6)}</Badge>
                        </div>
                        {/* Fields Grid — compact */}
                        <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                           {Object.entries(data).map(([key, value]: [string, any]) => {
                               const isPhotoObj = typeof value === 'object' && value && 'url' in value;
                               const imageUrl = isPhotoObj ? value.url : (typeof value === 'string' ? value : '');
                               const hasImage = imageUrl && (imageUrl.startsWith('http') || imageUrl.includes('data:') || imageUrl.startsWith('/uploads/'));
                               
                               return (
                                <div key={key} className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                   <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{key}</p>
                                   {hasImage ? (
                                      <div className="flex items-center gap-2">
                                        <div className="h-10 w-10 rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 bg-slate-100">
                                          <img src={imageUrl} className="h-full w-full object-cover" alt={key} />
                                        </div>
                                        <a 
                                          href={imageUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-300 text-slate-600 hover:text-blue-600 font-bold text-[10px] transition-all"
                                        >
                                          <Eye className="h-3 w-3" />
                                          View
                                        </a>
                                      </div>
                                   ) : (
                                      <p className="text-xs font-extrabold text-slate-800 break-words">
                                        {Array.isArray(value) ? value.join(", ") : String(value ?? "—")}
                                      </p>
                                   )}
                                   {isPhotoObj && value.latitude && (
                                     <div className="flex items-center justify-between gap-1 p-1 bg-white border border-slate-100 rounded-lg mt-1 text-[9px] font-bold text-slate-500">
                                       <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />GPS: {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}</span>
                                       <a href={`https://www.google.com/maps/search/?api=1&query=${value.latitude},${value.longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />Map</a>
                                     </div>
                                   )}
                                </div>
                               );
                           })}
                        </div>
                     </div>
                    )
                 })}
              </div>
           )}
        </div>


        {/* Hidden Printable Area */}
        <div style={{ position: 'absolute', top: -9999, left: -9999, width: '1050px' }}>
           <div ref={printRef} className="p-8 text-slate-900 bg-white font-sans text-[10px]">
              <div className="border-b-2 border-slate-300 pb-4 mb-6">
                 <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">{form.name}</h1>
                 <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px] mt-1">
                    Category: {form.category || "General"} | Total Submissions: {filteredResponses.length}
                 </p>
                 <p className="text-slate-400 text-[8px] mt-1">
                    Exported on: {dayjs().format("DD MMM YYYY, hh:mm A")}
                 </p>
              </div>

              <table className="w-full border-collapse border border-slate-300">
                 <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                       <th className="border border-slate-300 px-3 py-2 text-left font-bold uppercase tracking-wider text-[9px]">Submitter</th>
                       <th className="border border-slate-300 px-3 py-2 text-left font-bold uppercase tracking-wider text-[9px]">Date Submitted</th>
                       {form.fields?.map((f: any) => (
                          <th key={f.label} className="border border-slate-300 px-3 py-2 text-left font-bold uppercase tracking-wider text-[9px]">
                             {f.label}
                          </th>
                       ))}
                    </tr>
                 </thead>
                 <tbody>
                    {filteredResponses.map((resp: any) => {
                       let data: any = {};
                       try {
                          data = typeof resp.data === "string" ? JSON.parse(resp.data) : (resp.data || {});
                       } catch (e) {}

                       return (
                          <tr key={resp.id} className="border-b border-slate-200 even:bg-slate-50/50">
                             <td className="border border-slate-300 px-3 py-2 font-bold text-slate-900">{resp.user?.name || "System"}</td>
                             <td className="border border-slate-300 px-3 py-2 text-slate-500 whitespace-nowrap">
                                {dayjs(resp.submittedAt).format("DD-MM-YYYY HH:mm")}
                             </td>
                             {form.fields?.map((f: any) => {
                                const value = data[f.label];
                                const isPhotoObj = typeof value === 'object' && value && 'url' in value;
                                const imageUrl = isPhotoObj ? value.url : (typeof value === 'string' ? value : '');
                                const hasImage = imageUrl && (imageUrl.startsWith('http') || imageUrl.includes('data:image') || imageUrl.startsWith('/uploads/'));

                                return (
                                   <td key={f.label} className="border border-slate-300 px-3 py-2 max-w-xs break-words">
                                      {hasImage ? (
                                         <div className="space-y-1">
                                            <img 
                                               src={imageUrl} 
                                               className="h-16 w-24 object-cover rounded border border-slate-200" 
                                               alt={f.label} 
                                            />
                                            {isPhotoObj && value.latitude && (
                                               <div className="text-[8px] text-slate-500 font-bold leading-tight">
                                                  GPS: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
                                                  <br />
                                                  {dayjs(value.timestamp).format("hh:mm:ss A")}
                                               </div>
                                            )}
                                         </div>
                                      ) : (
                                         <span className="font-medium text-slate-700">
                                            {Array.isArray(value) ? value.join(", ") : String(value ?? "")}
                                         </span>
                                      )}
                                   </td>
                                );
                             })}
                          </tr>
                       );
                    })}
                 </tbody>
              </table>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
