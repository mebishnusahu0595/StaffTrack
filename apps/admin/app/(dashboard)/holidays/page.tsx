"use client";

import React, { useState } from "react";
import { 
  CalendarDays, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Sun, 
  Umbrella, 
  User, 
  Users,
  Trash2,
  Coffee,
  Heart,
  ShieldCheck,
  CheckSquare,
  ListFilter,
  UserPlus2,
  Trash,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ClipboardList
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchHolidays, 
  createHoliday, 
  fetchEmployees,
  fetchHolidayTemplates,
  createHolidayTemplate,
  assignHolidayTemplate
} from "@/lib/api";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

export default function HolidaysPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"templates" | "assign" | "calendar">("templates");
  
  // Custom Special Day Dialog State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    name: "", 
    date: "", 
    type: "HOLIDAY",
    targetType: "COMPANY", 
    userIds: [] as string[]
  });

  // Holiday Templates Create Modal state
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [newHolidays, setNewHolidays] = useState<{ date: string; name: string; description?: string }[]>([
    { date: "", name: "", description: "" }
  ]);

  // Holiday Assignment state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Search filter states
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");

  // Queries
  const holidaysQuery = useQuery({ queryKey: ["holidays"], queryFn: fetchHolidays });
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => fetchEmployees() });
  const templatesQuery = useQuery({ queryKey: ["holidayTemplates"], queryFn: fetchHolidayTemplates });

  // Mutations
  const createSpecialDayMutation = useMutation({
    mutationFn: createHoliday,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["holidays"] });
      setIsAddOpen(false);
      setFormData({ name: "", date: "", type: "HOLIDAY", targetType: "COMPANY", userIds: [] });
    }
  });

  const createTemplateMutation = useMutation({
    mutationFn: createHolidayTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["holidayTemplates"] });
      setIsCreateTemplateOpen(false);
      setTemplateName("");
      setNewHolidays([{ date: "", name: "", description: "" }]);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to create holiday template.");
    }
  });

  const assignTemplateMutation = useMutation({
    mutationFn: assignHolidayTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
      void queryClient.invalidateQueries({ queryKey: ["holidayTemplates"] });
      setIsAssignModalOpen(false);
      setSelectedUserIds([]);
      setSelectedTemplateId("");
      alert("Holiday template successfully assigned!");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || "Failed to assign holiday template.");
    }
  });

  // Action Handlers
  const handleAddHolidayRow = () => {
    setNewHolidays([...newHolidays, { date: "", name: "", description: "" }]);
  };

  const handleRemoveHolidayRow = (index: number) => {
    setNewHolidays(newHolidays.filter((_, i) => i !== index));
  };

  const handleTemplateHolidayChange = (index: number, field: string, value: string) => {
    const updated = [...newHolidays];
    updated[index] = { ...updated[index], [field]: value };
    setNewHolidays(updated);
  };

  const handleCreateTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName) {
      alert("Please fill in the template name.");
      return;
    }
    const validHolidays = newHolidays.filter(h => h.date && h.name);
    if (validHolidays.length === 0) {
      alert("Please configure at least one holiday occasion.");
      return;
    }
    createTemplateMutation.mutate({
      name: templateName,
      holidays: validHolidays
    });
  };

  const handleAssignSubmit = () => {
    if (!selectedTemplateId) {
      alert("Please choose a template to assign.");
      return;
    }
    assignTemplateMutation.mutate({
      templateId: selectedTemplateId,
      userIds: selectedUserIds
    });
  };

  const handleSelectAllEmployees = (e: React.ChangeEvent<HTMLInputElement>, filteredEmployees: any[]) => {
    if (e.target.checked) {
      setSelectedUserIds(filteredEmployees.map(emp => emp.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleSelectEmployee = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  // Computes
  const templates = templatesQuery.data ?? [];
  const filteredTemplates = templates.filter((t: any) => 
    t.name.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const employees = employeesQuery.data ?? [];
  const filteredEmployees = employees.filter((emp: any) => 
    emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    (emp.designation && emp.designation.toLowerCase().includes(employeeSearch.toLowerCase()))
  );

  const holidays = holidaysQuery.data ?? [];

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-500">
      
      {/* Header bar switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <CalendarDays className="h-3 w-3 text-blue-500" />
            <span>Time Off / Holiday Setup</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
            Holiday Configuration Panel
          </h1>
        </div>

        {/* Tab switcher */}
        <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center self-start md:self-auto shadow-inner border border-slate-200/40">
          <button
            onClick={() => setActiveTab("templates")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all",
              activeTab === "templates" 
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            Holiday Create
          </button>
          <button
            onClick={() => setActiveTab("assign")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all",
              activeTab === "assign" 
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            Holiday Assign
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all",
              activeTab === "calendar" 
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            Special Days Calendar
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: HOLIDAY CREATE (TEMPLATES) ==================== */}
      {activeTab === "templates" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Action Row */}
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white p-6 rounded-[32px] border border-slate-200/60 shadow-sm">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search templates..." 
                className="h-12 pl-12 rounded-2xl bg-slate-50 border-none focus:bg-white transition-all font-bold text-xs" 
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <Button 
                onClick={() => setActiveTab("assign")}
                variant="outline" 
                className="rounded-2xl border-slate-200 bg-white font-bold text-slate-700 gap-2 h-12 shadow-sm px-6 text-xs"
              >
                <UserPlus2 className="h-4.5 w-4.5 text-slate-500" /> Assign Holiday
              </Button>

              {/* Create Template dialog */}
              <Dialog open={isCreateTemplateOpen} onOpenChange={setIsCreateTemplateOpen}>
                <DialogTrigger asChild>
                  <Button className="h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-extrabold gap-2 px-6 shadow-lg shadow-blue-100 text-xs uppercase tracking-wider">
                    <Plus className="h-5 w-5" />
                    Create Template
                  </Button>
                </DialogTrigger>
                
                <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-3xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
                  <DialogHeader className="p-8 bg-blue-600 text-white flex-shrink-0">
                    <DialogTitle className="text-2xl font-black">Create Holiday Template</DialogTitle>
                    <p className="text-blue-100 text-xs font-semibold mt-1">Configure standard yearly holiday calendar groups for employees.</p>
                  </DialogHeader>

                  <div className="p-8 space-y-6 overflow-y-auto flex-grow">
                    
                    {/* Template Name */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Template Name *</Label>
                      <Input 
                        placeholder="e.g. National Holidays 2026" 
                        required
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold text-xs" 
                      />
                    </div>

                    {/* Occasion List builder */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Configure Holidays *</Label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          onClick={handleAddHolidayRow}
                          className="h-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-xs font-extrabold"
                        >
                          + Add Row
                        </Button>
                      </div>

                      <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                        {newHolidays.map((holiday, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="col-span-4">
                              <Input 
                                type="date"
                                required
                                value={holiday.date}
                                onChange={e => handleTemplateHolidayChange(idx, "date", e.target.value)}
                                className="h-10 rounded-xl bg-white border-slate-200 focus:bg-white font-semibold text-xs"
                              />
                            </div>
                            <div className="col-span-7">
                              <Input 
                                placeholder="Occasion Name (e.g. Christmas)"
                                required
                                value={holiday.name}
                                onChange={e => handleTemplateHolidayChange(idx, "name", e.target.value)}
                                className="h-10 rounded-xl bg-white border-slate-200 focus:bg-white font-semibold text-xs"
                              />
                            </div>
                            <div className="col-span-1 flex justify-center">
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleRemoveHolidayRow(idx)}
                                disabled={newHolidays.length <= 1}
                                className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  <DialogFooter className="p-8 border-t border-slate-50 flex-shrink-0">
                    <Button 
                      onClick={handleCreateTemplateSubmit}
                      disabled={createTemplateMutation.isPending}
                      className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-widest text-[10px]"
                    >
                      {createTemplateMutation.isPending ? "Creating..." : "Save Template"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Grid list of templates */}
          {templatesQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-44 bg-white rounded-[32px] animate-pulse border border-slate-100" />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-24 text-center space-y-4 bg-white rounded-[40px] border-none shadow-sm ring-1 ring-slate-200/60">
               <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                  <ClipboardList className="h-10 w-10" />
               </div>
               <div>
                  <p className="text-xl font-black text-slate-900">No Holiday Templates Found</p>
                  <p className="text-slate-400 font-bold text-sm">Create standard Holiday Templates and assign them to your team.</p>
               </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template: any) => (
                <Card key={template.id} className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 hover:ring-blue-400 hover:shadow-xl hover:shadow-slate-100 transition-all duration-300 overflow-hidden bg-white">
                  <CardHeader className="p-6 pb-4 flex flex-row items-start justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{template.name}</h3>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0.5">Custom Calendar template</p>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-600 font-bold text-[9px] px-2 py-0.5 rounded border border-emerald-100">
                      Standard
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-5">
                    
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Holiday Count</span>
                        <span className="text-sm font-black text-slate-800">{template.holidayCount} Protected Days</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Assigned Employees</span>
                        <span className="text-sm font-black text-slate-800">{template.assignedCount} Staff</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold border-t border-slate-50 pt-3">
                      <span>Created: {dayjs(template.createdAt).format("MMM DD, YYYY")}</span>
                      <span>Modified: {dayjs(template.updatedAt).format("MMM DD, YYYY")}</span>
                    </div>

                  </CardContent>
                </Card>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ==================== TAB 2: HOLIDAY ASSIGN ==================== */}
      {activeTab === "assign" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Assignments panel */}
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white p-6 rounded-[32px] border border-slate-200/60 shadow-sm">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search employees or designation..." 
                className="h-12 pl-12 rounded-2xl bg-slate-50 border-none focus:bg-white transition-all font-bold text-xs" 
                value={employeeSearch}
                onChange={e => setEmployeeSearch(e.target.value)}
              />
            </div>

            {/* Assign template trigger dialog */}
            <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
              <DialogTrigger asChild>
                <Button 
                  disabled={selectedUserIds.length === 0}
                  className="h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-extrabold gap-2 px-6 shadow-lg shadow-blue-100 text-xs uppercase tracking-wider disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                >
                  <UserPlus2 className="h-5 w-5" />
                  Assign Template ({selectedUserIds.length} Selected)
                </Button>
              </DialogTrigger>
              
              <DialogContent className="max-w-md p-8 overflow-hidden border-none shadow-2xl bg-white rounded-3xl">
                <DialogHeader className="p-0 text-left">
                  <DialogTitle className="text-xl font-black text-slate-900">Assign Holiday Template</DialogTitle>
                  <p className="text-slate-500 text-xs font-bold leading-normal mt-1">
                    Select a holiday template to apply to the selected {selectedUserIds.length} employees.
                  </p>
                </DialogHeader>

                <div className="space-y-4 pt-6">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Choose Template *</Label>
                  <Select onValueChange={setSelectedTemplateId} value={selectedTemplateId}>
                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 font-bold text-xs">
                      <SelectValue placeholder="Select holiday template..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 shadow-xl bg-white">
                      {templates.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} ({t.holidayCount} Holidays)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter className="pt-8">
                  <Button 
                    onClick={handleAssignSubmit}
                    disabled={assignTemplateMutation.isPending || !selectedTemplateId}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-widest text-[10px]"
                  >
                    {assignTemplateMutation.isPending ? "Assigning..." : "Assign & Confirm"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Checklist table grid */}
          <div className="bg-white rounded-[32px] border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-4.5 px-6 w-12 text-center">
                      <input 
                        type="checkbox"
                        checked={filteredEmployees.length > 0 && selectedUserIds.length === filteredEmployees.length}
                        onChange={e => handleSelectAllEmployees(e, filteredEmployees)}
                        className="h-4.5 w-4.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-4.5 px-6">Employee ID</th>
                    <th className="py-4.5 px-6">Employee Name</th>
                    <th className="py-4.5 px-6">Department</th>
                    <th className="py-4.5 px-6">Designation</th>
                    <th className="py-4.5 px-6">Template Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {employeesQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={6} className="py-6 px-6 bg-slate-50/20" />
                      </tr>
                    ))
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 px-6 text-center text-slate-400 font-semibold">
                        No employees found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp: any) => (
                      <tr key={emp.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 px-6 text-center">
                          <input 
                            type="checkbox"
                            checked={selectedUserIds.includes(emp.id)}
                            onChange={() => handleSelectEmployee(emp.id)}
                            className="h-4.5 w-4.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-4 px-6 text-slate-500 font-extrabold uppercase">{emp.id.slice(-6)}</td>
                        <td className="py-4 px-6 flex items-center gap-3">
                          <Avatar className="h-8 w-8 rounded-xl border border-slate-200">
                            <AvatarImage src={emp.avatarUrl} />
                            <AvatarFallback className="text-[10px] font-black bg-slate-100 text-slate-500">{emp.name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="font-extrabold text-slate-800">{emp.name}</span>
                        </td>
                        <td className="py-4 px-6 text-slate-500">{emp.group?.name || "Corporate"}</td>
                        <td className="py-4 px-6">
                          <Badge variant="outline" className="border-slate-200 text-slate-600 font-bold text-[10px] rounded-md">
                            {emp.designation || "Staff"}
                          </Badge>
                        </td>
                        <td className="py-4 px-6">
                          {emp.holidayTemplate ? (
                            <Badge className="bg-blue-50 hover:bg-blue-50 text-blue-600 font-black border-none text-[9px] px-2.5 py-1 rounded-md">
                              {emp.holidayTemplate.name}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 font-semibold italic text-[11px]">No template assigned</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer (Screenshot #5 mockup style) */}
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between text-xs text-slate-400 font-bold">
              <span>Showing 1 to {filteredEmployees.length} of {filteredEmployees.length} employees</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" disabled className="h-8 w-8 p-0 rounded-lg"><ChevronLeft className="h-4 w-4" /></Button>
                <Badge className="bg-white text-blue-600 border border-slate-200 hover:bg-white h-7 px-2.5 font-bold rounded-lg">1</Badge>
                <Button variant="ghost" disabled className="h-8 w-8 p-0 rounded-lg"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ==================== TAB 3: CALENDAR (SPECIAL DAYS) ==================== */}
      {activeTab === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-300">
          
          {/* Info Side Panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 bg-white overflow-hidden">
               <div className="p-8 bg-blue-600 text-white space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500 flex items-center justify-center">
                     <Umbrella className="h-6 w-6" />
                  </div>
                  <div>
                     <h3 className="text-xl font-black">Calendar Insights</h3>
                     <p className="text-blue-100 text-xs font-medium">Automatic payroll adjustments applied for all marked days.</p>
                  </div>
               </div>
               <CardContent className="p-8 space-y-6">
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">Public Holidays</span>
                        <span className="text-sm font-black text-slate-900">{holidays.filter(h => h.type === 'HOLIDAY').length}</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">Paid Leaves</span>
                        <span className="text-sm font-black text-slate-900">{holidays.filter(h => h.type === 'PAID_LEAVE').length}</span>
                     </div>
                     <div className="pt-4 border-t border-slate-50">
                        <div className="flex items-center justify-between">
                           <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Total Protected Days</span>
                           <span className="text-lg font-black text-blue-600">{holidays.length}</span>
                        </div>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <div className="p-6 rounded-[32px] bg-amber-50 border border-amber-100 space-y-3 text-left">
               <div className="flex items-center gap-2 text-amber-700">
                  <Coffee className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest font-extrabold">Administrator Tip</span>
               </div>
               <p className="text-xs font-bold text-amber-800 leading-relaxed">
                  Marking a day as &quot;Holiday&quot; ensures that no salary is deducted even if the employee doesn&apos;t punch in.
               </p>
            </div>
          </div>

          {/* List of Special Days */}
          <div className="lg:col-span-3 space-y-6">
            
            <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-6 rounded-[32px] border border-slate-200/60 shadow-sm">
              <div>
                <h3 className="text-base font-black text-slate-800">Special Days & Holiday Offs</h3>
                <p className="text-slate-400 text-xs font-bold mt-0.5">List of custom manual public holidays registered in the database.</p>
              </div>

              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 h-12 font-extrabold shadow-lg shadow-blue-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs">
                    <Plus className="h-5 w-5" /> Mark Holiday
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white rounded-3xl">
                  <DialogHeader className="p-8 bg-blue-600 text-white">
                    <DialogTitle className="text-2xl font-black">Mark Special Day</DialogTitle>
                    <CardDescription className="text-blue-100 text-sm font-medium mt-1">Schedule public holidays or approved paid leaves.</CardDescription>
                  </DialogHeader>
                  <div className="p-8 space-y-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Occasion Name</Label>
                        <Input 
                          placeholder="e.g. Independence Day" 
                          className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold text-xs" 
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Date</Label>
                           <Input 
                             type="date"
                             className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 focus:bg-white transition-all font-bold text-xs" 
                             value={formData.date}
                             onChange={e => setFormData({...formData, date: e.target.value})}
                           />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Type</Label>
                           <Select onValueChange={v => setFormData({...formData, type: v})} defaultValue="HOLIDAY">
                              <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 font-bold text-xs">
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl border-slate-200 shadow-xl bg-white">
                                 <SelectItem value="HOLIDAY">Public Holiday</SelectItem>
                                 <SelectItem value="PAID_LEAVE">Paid Leave</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                     </div>

                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Assign To</Label>
                        <Select 
                          value={formData.targetType} 
                          onValueChange={v => setFormData({...formData, targetType: v, userIds: []})}
                        >
                           <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-200/60 font-bold text-xs">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="rounded-2xl border-slate-200 shadow-xl bg-white">
                              <SelectItem value="COMPANY">All Employees</SelectItem>
                              <SelectItem value="USER">Specific Employees</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>

                     {formData.targetType === "USER" && (
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Employees *</Label>
                           <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50 max-h-44 overflow-y-auto space-y-2">
                              {employees.map((emp: any) => (
                                 <div key={emp.id} className="flex items-center gap-2">
                                    <input 
                                      type="checkbox"
                                      id={`holiday-emp-${emp.id}`}
                                      checked={formData.userIds.includes(emp.id)}
                                      onChange={e => {
                                         if (e.target.checked) {
                                            setFormData({...formData, userIds: [...formData.userIds, emp.id]});
                                         } else {
                                            setFormData({...formData, userIds: formData.userIds.filter(id => id !== emp.id)});
                                         }
                                      }}
                                      className="h-4 w-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                                    />
                                    <Label htmlFor={`holiday-emp-${emp.id}`} className="text-xs font-bold text-slate-700 cursor-pointer">
                                       {emp.name} ({emp.designation || "Staff"})
                                    </Label>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}
 
                     <DialogFooter className="pt-4">
                       <Button 
                        onClick={() => createSpecialDayMutation.mutate({
                          name: formData.name,
                          date: new Date(formData.date),
                          type: formData.type,
                          userIds: formData.targetType === "USER" ? formData.userIds : undefined
                        })}
                        disabled={createSpecialDayMutation.isPending || !formData.name || !formData.date || (formData.targetType === "USER" && formData.userIds.length === 0)}
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 rounded-2xl font-black text-sm uppercase tracking-widest gap-2"
                       >
                         {createSpecialDayMutation.isPending ? "Syncing..." : "Save Special Day"}
                       </Button>
                     </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
 
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {holidaysQuery.isLoading ? (
                Array(4).fill(0).map((_, i) => <div key={i} className="h-40 bg-white ring-1 ring-slate-100 animate-pulse rounded-[32px]" />)
              ) : holidays.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center gap-4">
                   <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                      <Sun className="h-6 w-6" />
                   </div>
                   <p className="text-sm font-bold text-slate-500">No special days marked in the calendar yet.</p>
                </div>
              ) : holidays.map((holiday: any) => (
                <Card key={holiday.id} className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 hover:ring-blue-400 hover:shadow-xl hover:shadow-blue-900/5 transition-all group overflow-hidden bg-white text-left">
                   <CardHeader className="p-6">
                      <div className="flex items-center justify-between mb-4">
                         <div className={cn(
                           "h-12 w-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
                           holiday.type === "HOLIDAY" ? "bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-500 group-hover:text-white" : "bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-500 group-hover:text-white"
                         )}>
                            {holiday.type === "HOLIDAY" ? <Sun className="h-6 w-6" /> : <Heart className="h-6 w-6" />}
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(holiday.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                            <p className="text-xs font-black text-slate-900">{new Date(holiday.date).getFullYear()}</p>
                         </div>
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-black text-slate-900">{holiday.name}</CardTitle>
                        <CardDescription className="text-[10px] font-bold text-blue-600 flex items-center gap-1.5 uppercase tracking-tight">
                           {holiday.groupId ? <><Users className="h-3 w-3" /> Specific Group Only</> : 
                            holiday.userId ? <><User className="h-3 w-3" /> Assigned to: {employees.find((e: any) => e.id === holiday.userId)?.name || holiday.userId}</> : 
                            <><ShieldCheck className="h-3 w-3" /> All Employees</>}
                        </CardDescription>
                      </div>
                   </CardHeader>
                   <CardContent className="px-6 pb-6 pt-2 flex items-center justify-between">
                      <Badge className={cn(
                        "rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
                        holiday.type === "HOLIDAY" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {holiday.type.replace("_", " ")}
                      </Badge>
                   </CardContent>
                </Card>
              ))}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
