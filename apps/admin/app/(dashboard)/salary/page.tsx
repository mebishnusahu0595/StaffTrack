"use client";

import React, { useState, useMemo } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  User as UserIcon,
  CalendarDays,
  MoreVertical,
  Calendar,
  Wallet,
  Building,
  TrendingUp,
  FileText,
  Download,
  Settings,
  Calculator
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchSalaryMatrix } from "@/lib/api";
import { SalarySlipModal } from "@/components/admin/salary-slip-modal";
import { SalarySlipCustomizerModal } from "@/components/admin/salary-slip-customizer-modal";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { EmployeeDetailDrawer } from "@/components/admin/employee-detail-drawer";

export default function SalaryMatrixPage() {
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [search, setSearch] = useState("");
  const [ratePerKm, setRatePerKm] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("salary_rate_per_km");
      if (saved && !isNaN(Number(saved))) return Number(saved);
    }
    return 5;
  });
  const [slipEmployee, setSlipEmployee] = useState<any>(null);
  const [customizingEmployee, setCustomizingEmployee] = useState<any>(null);
  const [drawerEmployeeId, setDrawerEmployeeId] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const handleRateChange = (val: number) => {
    const nextRate = isNaN(val) ? 0 : val;
    setRatePerKm(nextRate);
    if (typeof window !== "undefined") {
      localStorage.setItem("salary_rate_per_km", String(nextRate));
    }
  };

  const salaryQuery = useQuery({
    queryKey: ["salary-matrix", selectedMonth.month() + 1, selectedMonth.year(), ratePerKm],
    queryFn: () => fetchSalaryMatrix({ 
      month: selectedMonth.month() + 1, 
      year: selectedMonth.year(),
      ratePerKm
    })
  });

  const reports = useMemo(() => salaryQuery.data ?? [], [salaryQuery.data]);
  
  const filteredReports = useMemo(() => {
    return reports.filter((r: any) => 
      r.userName.toLowerCase().includes(search.toLowerCase())
    );
  }, [reports, search]);

  const selectedDrawerEmployee = useMemo(() => {
    return reports.find((r: any) => r.userId === drawerEmployeeId);
  }, [reports, drawerEmployeeId]);

  function changeMonth(delta: number) {
    setSelectedMonth(prev => prev.add(delta, 'month'));
  }

  const exportSalaryCSV = () => {
    if (filteredReports.length === 0) return;
    const headers = [
      "Employee Name", "Designation", "Department", "Base Salary", 
      "Payable Days", "Absences", "Holidays", "Leaves", "Total KM", 
      "Travel Rate (Per KM)", "Travel Payout", "Points", "Net Salary", "Total Payout"
    ];
    const rows = filteredReports.map(e => [
      e.userName || "",
      e.designation || "Staff",
      e.departmentName || "Unassigned",
      e.baseSalary || 0,
      `${e.payableDays} / ${e.totalDays}`,
      e.absentDays || 0,
      e.holidayDays || 0,
      e.paidLeaveDays || 0,
      (e.totalKm || 0).toFixed(1),
      `₹${e.travelRate ?? ratePerKm}`,
      e.travelAllowance || 0,
      e.monthlyPoints || 0,
      e.netSalary || 0,
      e.totalPayout || 0
    ]);
    
    const csvString = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Salary_Matrix_${selectedMonth.format("MMM_YYYY")}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Wallet className="h-3 w-3" />
            <span>Finance / Salary Matrix</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Salary Matrix
            <Badge variant="outline" className="h-6 px-2 rounded-lg border-blue-100 bg-blue-50/50 text-blue-600 font-bold">
              {selectedMonth.format("MMMM YYYY")}
            </Badge>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-slate-200/60">
            <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} className="rounded-xl h-10 w-10 hover:bg-slate-50 text-slate-400">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="px-4 text-center min-w-[120px]">
              <p className="text-sm font-black text-slate-900">{selectedMonth.format("MMM YYYY")}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} className="rounded-xl h-10 w-10 hover:bg-slate-50 text-slate-400">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filter and Overview Stats Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/60 shadow-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input 
            placeholder="Search employees..." 
            className="h-12 pl-12 rounded-2xl bg-slate-50 border-none focus:bg-white transition-all font-bold text-base" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-2xl">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">Travel Rate</span>
              <span className="text-[10px] font-black text-blue-600">Per KM</span>
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-inner">
              <span className="text-xs font-black text-slate-500">₹</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={ratePerKm}
                onChange={(e) => handleRateChange(Number(e.target.value))}
                className="w-12 text-center text-xs font-black text-slate-900 focus:outline-none"
              />
              <span className="text-[10px] font-bold text-slate-400">/ KM</span>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={exportSalaryCSV}
            disabled={filteredReports.length === 0}
            className="h-12 rounded-2xl font-bold border-slate-200 gap-2 px-5 hover:bg-slate-50 text-slate-700 transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Export CSV
          </Button>
          <div className="text-right border-l border-slate-100 pl-4">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Staff</p>
             <p className="text-2xl font-black text-slate-900">{filteredReports.length}</p>
          </div>
        </div>
      </div>

      {/* Table matrix */}
      <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden rounded-[32px] bg-white">
        <div className="overflow-x-auto">
          {salaryQuery.isLoading ? (
            <div className="flex justify-center p-16">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-20">
              <CalendarDays className="h-12 w-12 text-slate-350 mx-auto mb-4" />
              <h3 className="text-lg font-black text-slate-900">No Payroll Data</h3>
              <p className="text-slate-500 font-medium mt-1">No calculations available for the selected parameters.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Employee Name</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Department</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Base Salary</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Payable Days</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Abs / Holiday / Lvs</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center font-mono">Travel KM</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Travel Payout</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Points</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Net Salary</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Total Payout</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((emp) => (
                  <tr key={emp.userId} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-slate-100 shadow-sm ring-2 ring-white rounded-xl">
                          <AvatarImage src={emp.avatarUrl || ''} />
                          <AvatarFallback className="bg-slate-50 text-slate-450 font-bold">
                            <UserIcon className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span 
                            onClick={() => setDrawerEmployeeId(emp.userId)}
                            className="font-black text-slate-900 text-sm leading-none hover:text-blue-600 hover:underline cursor-pointer"
                          >
                            {emp.userName}
                          </span>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">{emp.designation || 'Staff'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs font-semibold text-slate-600">
                      {emp.departmentName || "Unassigned"}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs font-black text-slate-800">
                      ₹{Number(emp.baseSalary || 0).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-xs font-black text-slate-700">
                      {emp.payableDays} <span className="text-[10px] font-normal text-slate-400">/ {emp.totalDays}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase">
                        <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50 border border-rose-200/50 rounded-md font-bold px-1.5 py-0.5">Abs: {emp.absentDays}</Badge>
                        <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border border-blue-200/50 rounded-md font-bold px-1.5 py-0.5">Hol: {emp.holidayDays}</Badge>
                        <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-200/50 rounded-md font-bold px-1.5 py-0.5">Lvs: {emp.paidLeaveDays}</Badge>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center text-xs font-bold text-slate-600 font-mono">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-xl text-slate-800 font-black">
                        {(emp.totalKm || 0).toFixed(1)} KM
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs font-bold text-slate-800">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-emerald-700">₹{Number(emp.travelAllowance || 0).toLocaleString()}</span>
                        <span className="text-[9px] font-extrabold text-slate-400">{(emp.totalKm || 0).toFixed(1)} km × ₹{emp.travelRate ?? ratePerKm}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg border border-amber-200/40 text-[10px] font-black">
                        <TrendingUp className="h-3 w-3 text-amber-500" />
                        <span>{emp.monthlyPoints ?? 0}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-xs font-black text-slate-800">
                      ₹{Number(emp.netSalary || 0).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-sm font-black text-emerald-600">
                      ₹{Number(emp.totalPayout || 0).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border border-slate-200 p-1">
                          <DropdownMenuItem 
                            onClick={() => setSlipEmployee(emp)} 
                            className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-bold text-slate-700 focus:bg-blue-50 focus:text-blue-700 rounded-lg"
                          >
                            <FileText className="h-4 w-4 text-blue-500" />
                            View Salary Slip
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setCustomizingEmployee(emp)} 
                            className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-bold text-slate-700 focus:bg-blue-50 focus:text-blue-700 rounded-lg"
                          >
                            <Settings className="h-4 w-4 text-slate-500" />
                            Customize Slip
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDrawerEmployeeId(emp.userId)}
                            className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-bold text-slate-700 focus:bg-blue-50 focus:text-blue-700 rounded-lg"
                          >
                            <Calculator className="h-4 w-4 text-emerald-555" />
                            Calculation breakdown
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <SalarySlipModal 
        isOpen={Boolean(slipEmployee)} 
        onClose={() => setSlipEmployee(null)} 
        data={slipEmployee} 
        month={selectedMonth} 
      />

      <Dialog open={!!customizingEmployee} onOpenChange={(open) => { if (!open) setCustomizingEmployee(null); }}>
         {customizingEmployee && (
            <SalarySlipCustomizerModal 
              report={customizingEmployee} 
              month={selectedMonth} 
              onClose={() => setCustomizingEmployee(null)}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ["salary-matrix"] })}
            />
         )}
      </Dialog>

      {/* Unified Employee Detail Drawer */}
      <EmployeeDetailDrawer
        employeeId={drawerEmployeeId}
        employee={selectedDrawerEmployee}
        isOpen={!!drawerEmployeeId}
        onClose={() => setDrawerEmployeeId(null)}
      />
    </div>
  );
}
