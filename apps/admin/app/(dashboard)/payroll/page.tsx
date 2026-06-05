"use client";

import React, { useState, useMemo } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Search, 
  User as UserIcon,
  Briefcase,
  Calendar,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  History,
  Users,
  Eye,
  FileText,
  DollarSign,
  X,
  Plus,
  Trash2,
  Printer
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchPayrollReport } from "@/lib/api";
import { SalarySlipCustomizerModal } from "@/components/admin/salary-slip-customizer-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function PayrollPage() {
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [customizingReport, setCustomizingReport] = useState<any>(null);
  const queryClient = useQueryClient();

  const payrollQuery = useQuery({
    queryKey: ["payroll", selectedMonth.month() + 1, selectedMonth.year()],
    queryFn: () => fetchPayrollReport({ 
      month: selectedMonth.month() + 1, 
      year: selectedMonth.year() 
    })
  });

  const reports = payrollQuery.data ?? [];
  const filteredReports = reports.filter((r: any) => 
    r.userName.toLowerCase().includes(search.toLowerCase())
  );

  function changeMonth(delta: number) {
    setSelectedMonth(prev => prev.add(delta, 'month'));
  }

  const exportToCSV = () => {
    const headers = [
      "Employee Name",
      "Designation",
      "Department",
      "Present Days",
      "Half Days",
      "Total Calendar Days",
      "Holidays",
      "Paid Leaves",
      "Unpaid Leaves",
      "Absences",
      "Monthly Points",
      "Base Salary",
      "Net Salary",
      "Approved Expenses",
      "Total Payout",
      "Total Payable Days"
    ];

    const rowsData = filteredReports.map((report: any) => [
      report.userName || "",
      report.designation || "Staff Member",
      report.departmentName || "-",
      report.presentDays,
      report.halfDays ?? 0,
      report.totalDays,
      report.holidayDays,
      report.paidLeaveDays,
      report.unpaidLeaveDays ?? 0,
      report.absentDays,
      report.monthlyPoints ?? 0,
      report.baseSalary,
      report.netSalary,
      report.approvedExpensesTotal ?? 0,
      report.totalPayout ?? report.netSalary,
      report.totalPayableDays
    ]);

    const csvContent = [
      headers.join(","),
      ...rowsData.map((row: any) => row.map((val: any) => `"${(val ?? "").toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `payroll_report_${selectedMonth.format("MMM_YYYY")}.csv`);
    link.style.visibility = "hidden";
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
            <DollarSign className="h-3 w-3" />
            <span>Finance / Payroll</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Payroll Console
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
          <Button 
            onClick={exportToCSV}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 h-12 font-bold shadow-lg shadow-blue-200 gap-2"
          >
            <Download className="h-5 w-5" /> Export All
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard 
          label="Total Net Salary" 
          value={`₹${reports.reduce((acc: number, r: any) => acc + r.netSalary, 0).toLocaleString()}`}
          description="Total payable for this month"
          icon={<TrendingUp className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard 
          label="Avg. Present" 
          value={`${reports.length > 0 ? (reports.reduce((acc: number, r: any) => acc + r.presentDays, 0) / reports.length).toFixed(1) : 0} Days`}
          description="Average attendance per staff"
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="emerald"
        />
        <StatsCard 
          label="Absences Total" 
          value={reports.reduce((acc: number, r: any) => acc + r.absentDays, 0)}
          description="Days deducted across team"
          icon={<AlertCircle className="h-5 w-5" />}
          color="rose"
        />
        <StatsCard 
          label="Active Staff" 
          value={reports.length}
          description="Employees in payroll loop"
          icon={<Users className="h-5 w-5" />}
          color="indigo"
        />
      </div>

      {/* Main Content Area */}
      <Card className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-slate-50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <CardTitle className="text-xl font-black text-slate-900">Monthly Salary Breakdown</CardTitle>
              <CardDescription className="text-xs font-bold text-slate-500 mt-1">Detailed calculation of daily wages, deductions, and holidays.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search employee..." 
                className="h-12 pl-12 rounded-2xl bg-slate-50 border-none focus:bg-white transition-all font-bold" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-none">
                <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Employee Name</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Department</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400 text-center">Present / Total</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400 text-center">Holidays</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400 text-center">Absences</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400 text-center">Points</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Base Salary</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Net Salary</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400">Expenses</TableHead>
                <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollQuery.isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={10} className="p-8"><div className="h-8 bg-slate-100 rounded-xl" /></TableCell>
                  </TableRow>
                ))
              ) : filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest">
                    No payroll data found for this period
                  </TableCell>
                </TableRow>
              ) : filteredReports.map((report: any) => (
                <TableRow key={report.userId} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <TableCell className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10 rounded-2xl border-2 border-white shadow-sm ring-1 ring-slate-100">
                        <AvatarFallback className="bg-slate-50 text-slate-400">
                          <UserIcon className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5">
                        <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{report.userName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{report.designation || 'Staff Member'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <span className="text-sm font-bold text-slate-600">{report.departmentName ?? "-"}</span>
                  </TableCell>
                  <TableCell className="py-5 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 font-black text-xs border border-emerald-100">
                      {report.presentDays} / {report.totalDays}
                    </div>
                  </TableCell>
                  <TableCell className="py-5 text-center">
                    <span className="text-sm font-black text-amber-600">{report.holidayDays + report.paidLeaveDays}</span>
                  </TableCell>
                  <TableCell className="py-5 text-center">
                    <span className="text-sm font-black text-rose-500">{report.absentDays}</span>
                  </TableCell>
                  <TableCell className="py-5 text-center">
                    <span className="text-sm font-black text-blue-600">{report.monthlyPoints ?? 0}</span>
                  </TableCell>
                  <TableCell className="py-5">
                    <span className="text-xs font-bold text-slate-500">₹{report.baseSalary.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="space-y-0.5">
                      <span className="text-base font-black text-blue-600 tracking-tight">₹{report.netSalary.toLocaleString()}</span>
                      <p className="text-[9px] font-bold text-emerald-500 uppercase">Paid Calculation</p>
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="space-y-0.5">
                      <span className="text-sm font-black text-emerald-600">₹{Number(report.approvedExpensesTotal ?? 0).toLocaleString()}</span>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Month-end reimbursement</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedReport(report)} 
                        className="h-9 rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-widest gap-2 text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                      >
                         <Eye className="h-3.5 w-3.5" /> Details
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedReport} onOpenChange={(open) => { if (!open) setSelectedReport(null); }}>
         {selectedReport && (
           <PayrollDetailModal 
             report={selectedReport} 
             month={selectedMonth} 
             onCustomize={(rep) => {
               setSelectedReport(null);
               setCustomizingReport(rep);
             }}
           />
         )}
      </Dialog>

      <Dialog open={!!customizingReport} onOpenChange={(open) => { if (!open) setCustomizingReport(null); }}>
         {customizingReport && (
            <SalarySlipCustomizerModal 
              report={customizingReport} 
              month={selectedMonth} 
              onClose={() => setCustomizingReport(null)}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ["payroll"] })}
            />
         )}
      </Dialog>
    </div>
  );
}

function StatsCard({ label, value, description, icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  };

  return (
    <Card className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 bg-white">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
           <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center ring-1", colors[color])}>
              {icon}
           </div>
           <Badge variant="outline" className="rounded-lg h-5 border-slate-100 bg-slate-50/50 text-[9px] font-black uppercase tracking-widest text-slate-400">Month</Badge>
        </div>
        <div className="space-y-1">
           <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</p>
           <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{value}</h3>
           <p className="text-[10px] font-bold text-slate-500">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PayrollDetailModal({ report, month, onCustomize }: { report: any, month: any, onCustomize: (report: any) => void }) {
  const printPayslip = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const monthName = month.format("MMMM YYYY");
    const html = `
      <html>
        <head>
          <title>Payslip - ${report.userName}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 24px; font-weight: 800; color: #2563eb; }
            .title { font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #475569; }
            .meta-grid { display: grid; grid-template-cols: 2fr 1fr; gap: 40px; margin-bottom: 40px; }
            .meta-block h3 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; }
            .meta-block p { margin: 0; font-size: 14px; font-weight: 600; }
            .breakdown-table { border-collapse: collapse; width: 100%; margin-bottom: 40px; }
            .breakdown-table th, .breakdown-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; }
            .breakdown-table th { background: #f8fafc; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .breakdown-table td { font-size: 13px; font-weight: 500; }
            .total-section { display: flex; justify-content: flex-end; padding-top: 20px; }
            .total-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 30px; text-align: right; }
            .total-box h4 { margin: 0 0 5px 0; font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
            .total-box p { margin: 0; font-size: 28px; font-weight: 800; color: #2563eb; }
            .footer-note { text-align: center; margin-top: 80px; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">Demo Corp</div>
            <div class="title">Salary Slip</div>
          </div>
          
          <div class="meta-grid">
            <div class="meta-block">
              <h3>Employee Information</h3>
              <p>${report.userName}</p>
              <p style="font-size: 12px; color: #64748b; font-weight: 500;">${report.designation || 'Staff Member'}</p>
            </div>
            <div class="meta-block" style="text-align: right;">
              <h3>Pay Period</h3>
              <p>${monthName}</p>
            </div>
          </div>
          
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Count / Value</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Monthly Calendar Days</td>
                <td style="text-align: right;">${report.totalDays} Days</td>
                <td style="text-align: right;">--</td>
              </tr>
              <tr>
                <td>Days Present</td>
                <td style="text-align: right;">${report.presentDays} Days</td>
                <td style="text-align: right;">--</td>
              </tr>
              <tr>
                <td>Paid Holidays / Leaves</td>
                <td style="text-align: right;">${report.holidayDays + report.paidLeaveDays} Days</td>
                <td style="text-align: right;">--</td>
              </tr>
              <tr>
                <td>Unpaid Absences</td>
                <td style="text-align: right; color: #ef4444;">${report.absentDays} Days</td>
                <td style="text-align: right; color: #ef4444;">- ₹${(report.absentDays * (report.baseSalary / report.totalDays)).toFixed(2)}</td>
              </tr>
              <tr style="font-weight: 700; border-top: 2px solid #e2e8f0;">
                <td>Basic Salary</td>
                <td style="text-align: right;">Base</td>
                <td style="text-align: right;">Basic: ₹${report.baseSalary.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="total-section">
            <div class="total-box">
              <h4>Net Take Home</h4>
              <p>₹${report.netSalary.toLocaleString()}</p>
            </div>
          </div>
          
          <div class="footer-note">
            This is a computer-generated document and does not require a physical signature.
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[40px] hide-close">
       <DialogHeader className="p-10 bg-slate-900 text-white relative">
          <DialogClose className="absolute right-8 top-8 z-50 rounded-2xl bg-white/10 p-2 text-white/50 hover:bg-white/20 hover:text-white transition-all outline-none">
             <X className="h-5 w-5" />
          </DialogClose>
          <div className="absolute top-0 right-0 p-12 opacity-10">
             <CreditCard className="h-32 w-32" />
          </div>
          <div className="relative z-10 space-y-6">
             <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 rounded-3xl border-4 border-white/10 shadow-xl">
                   <AvatarFallback className="bg-white/5 text-white/40"><UserIcon className="h-8 w-8" /></AvatarFallback>
                </Avatar>
                <div>
                   <h2 className="text-3xl font-black tracking-tight">{report.userName}</h2>
                   <p className="text-blue-400 text-xs font-black uppercase tracking-widest">{report.designation || 'Employee'}</p>
                </div>
             </div>
             <div className="grid grid-cols-3 gap-8 pt-4 border-t border-white/10">
                <div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Base Salary</p>
                   <p className="text-xl font-black">₹{report.baseSalary.toLocaleString()}</p>
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Calculation Period</p>
                   <p className="text-xl font-black">{month.format("MMMM YYYY")}</p>
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Daily Wage Rate</p>
                   <p className="text-xl font-black text-emerald-400">₹{(report.baseSalary / report.totalDays).toFixed(2)}</p>
                </div>
             </div>
          </div>
       </DialogHeader>
       <div className="p-10 space-y-10">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
             <DetailStat label="Present" value={report.presentDays} color="emerald" />
             <DetailStat label="Holidays" value={report.holidayDays} color="blue" />
             <DetailStat label="Leaves" value={report.paidLeaveDays} color="indigo" />
             <DetailStat label="Absences" value={report.absentDays} color="rose" />
          </div>

          <div className="space-y-6">
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <History className="h-4 w-4 text-blue-600" /> Daily Attendance Breakdown
             </h3>
             <div className="grid grid-cols-7 gap-2">
                {report.dailyBreakdown.map((day: any) => (
                   <div 
                    key={day.date} 
                    className={cn(
                      "aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all hover:scale-105",
                      day.status === "PRESENT" ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                      day.status === "HOLIDAY" ? "bg-amber-50 border-amber-100 text-amber-600" :
                      day.status === "WEEKEND" ? "bg-blue-50/50 border-blue-100 text-blue-400" :
                      day.status === "PAID_LEAVE" || day.status === "ON_LEAVE" ? "bg-indigo-50 border-indigo-100 text-indigo-600" :
                      day.status === "ABSENT" ? "bg-rose-50 border-rose-100 text-rose-500" :
                      day.status === "UPCOMING" ? "bg-slate-50 border-slate-200 text-slate-200 border-dashed" :
                      "bg-slate-50 border-slate-100 text-slate-300"
                    )}
                    title={`${day.date}: ${day.status}`}
                   >
                      <span className="text-[10px] font-black">{dayjs(day.date).format("D")}</span>
                      <div className="h-1 w-1 rounded-full bg-current mt-1 opacity-40" />
                   </div>
                ))}
             </div>
          </div>

          <div className="pt-10 border-t border-slate-50 flex items-center justify-between">
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Payable Days</p>
                <p className="text-2xl font-black text-slate-900">{report.totalPayableDays} / {report.totalDays}</p>
             </div>
             <div className="text-right space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Net Salary</p>
                <div className="flex items-center gap-4">
                   <h3 className="text-4xl font-black text-blue-600 tracking-tighter">₹{report.netSalary.toLocaleString()}</h3>
                    <Button 
                      variant="outline"
                      className="h-14 px-6 rounded-2xl border-slate-200 font-black uppercase tracking-widest text-xs gap-3 shadow-sm hover:bg-slate-50 transition-all"
                      onClick={() => onCustomize(report)}
                    >
                       <FileText className="h-4 w-4 text-slate-500" /> Print Payslip
                    </Button>
                   <Button className="h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 font-black uppercase tracking-widest text-xs gap-3 shadow-xl shadow-blue-200">
                      Process Payment <ArrowRight className="h-4 w-4" />
                   </Button>
                </div>
             </div>
          </div>
       </div>
    </DialogContent>
  );
}

function DetailStat({ label, value, color }: any) {
  const colors: any = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <div className={cn("p-4 rounded-3xl text-center border border-transparent", colors[color])}>
       <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-70">{label}</p>
       <p className="text-xl font-black">{value}</p>
    </div>
  );
}

function ArrowRight(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

