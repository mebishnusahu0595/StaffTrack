"use client";

import React, { useState, useMemo } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Search, 
  User as UserIcon,
  CalendarDays,
  MoreVertical,
  Calendar,
  Wallet,
  Building
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchSalaryMatrix, markAttendanceStatus, clearAttendanceStatus } from "@/lib/api";
import { SalarySlipModal } from "@/components/admin/salary-slip-modal";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FileText } from "lucide-react";

export default function SalaryMatrixPage() {
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [search, setSearch] = useState("");
  const [slipEmployee, setSlipEmployee] = useState<any>(null);
  const queryClient = useQueryClient();

  const salaryQuery = useQuery({
    queryKey: ["salary-matrix", selectedMonth.month() + 1, selectedMonth.year()],
    queryFn: () => fetchSalaryMatrix({ 
      month: selectedMonth.month() + 1, 
      year: selectedMonth.year() 
    })
  });

  const reports = salaryQuery.data ?? [];
  const filteredReports = reports.filter((r: any) => 
    r.userName.toLowerCase().includes(search.toLowerCase())
  );

  // Group by base salary
  const groupedReports = useMemo(() => {
    const groups: Record<number, any[]> = {};
    filteredReports.forEach((r: any) => {
      const bs = r.baseSalary || 0;
      if (!groups[bs]) groups[bs] = [];
      groups[bs].push(r);
    });
    return groups;
  }, [filteredReports]);

  function changeMonth(delta: number) {
    setSelectedMonth(prev => prev.add(delta, 'month'));
  }

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

      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200/60 shadow-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input 
            placeholder="Search employees..." 
            className="h-12 pl-12 rounded-2xl bg-slate-50 border-none focus:bg-white transition-all font-bold text-base" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Staff</p>
           <p className="text-2xl font-black text-slate-900">{filteredReports.length}</p>
        </div>
      </div>

      <div className="space-y-6">
        {salaryQuery.isLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : Object.keys(groupedReports).length === 0 ? (
          <Card className="rounded-[32px] border-none shadow-sm text-center py-24">
             <CalendarDays className="h-12 w-12 text-slate-300 mx-auto mb-4" />
             <h3 className="text-lg font-black text-slate-900">No Data Found</h3>
             <p className="text-slate-500 font-medium">No salary records available for {selectedMonth.format("MMMM YYYY")}</p>
          </Card>
        ) : (
          <Accordion type="multiple" defaultValue={Object.keys(groupedReports)}>
            {Object.entries(groupedReports).sort((a,b) => Number(b[0]) - Number(a[0])).map(([baseSalary, employees]) => (
              <AccordionItem key={baseSalary} value={baseSalary} className="border-none mb-6">
                <Card className="rounded-[32px] border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
                  <AccordionTrigger className="px-8 py-6 hover:no-underline hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center justify-between w-full pr-8">
                       <div className="flex items-center gap-4 text-left">
                         <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                            <Wallet className="h-5 w-5 text-emerald-600" />
                         </div>
                         <div>
                            <h3 className="text-2xl font-black text-slate-900">₹{Number(baseSalary).toLocaleString()} <span className="text-sm font-bold text-slate-400">/ month</span></h3>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mt-1">
                               {employees.length} Employee{employees.length !== 1 && 's'} in this bracket
                            </p>
                         </div>
                       </div>
                       {employees.length > 0 && (
                          <div className="text-right">
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Per Day Income</p>
                             <p className="text-lg font-black text-emerald-600">₹{Math.round(employees[0].dailyWage).toLocaleString()}</p>
                          </div>
                       )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-8 pt-2">
                    <div className="space-y-8">
                       {employees.map(emp => (
                         <EmployeeSalaryCard 
                           key={emp.userId} 
                           employee={emp} 
                           selectedMonth={selectedMonth} 
                           setSlipEmployee={setSlipEmployee}
                           onUpdate={() => queryClient.invalidateQueries({ queryKey: ["salary-matrix"] })}
                         />
                       ))}
                    </div>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      <SalarySlipModal 
        isOpen={Boolean(slipEmployee)} 
        onClose={() => setSlipEmployee(null)} 
        data={slipEmployee} 
        month={selectedMonth} 
      />
    </div>
  );
}

function EmployeeSalaryCard({ employee, selectedMonth, setSlipEmployee, onUpdate }: any) {
  const mutationMark = useMutation({
    mutationFn: markAttendanceStatus,
    onSuccess: onUpdate
  });

  const mutationClear = useMutation({
    mutationFn: clearAttendanceStatus,
    onSuccess: onUpdate
  });

  // Build calendar grid
  const startOfMonth = selectedMonth.startOf('month');
  const daysInMonth = selectedMonth.daysInMonth();
  const startDayOfWeek = startOfMonth.day(); // 0 is Sunday
  
  const calendarGrid = [];
  let dayCounter = 1;

  for (let i = 0; i < 6; i++) {
    const week = [];
    for (let j = 0; j < 7; j++) {
      if (i === 0 && j < startDayOfWeek) {
        week.push(null); // Empty slots before the 1st
      } else if (dayCounter > daysInMonth) {
        week.push(null); // Empty slots after the end
      } else {
        const currentDateStr = selectedMonth.date(dayCounter).format("YYYY-MM-DD");
        const dayData = employee.dailyBreakdown.find((d: any) => d.date === currentDateStr);
        week.push({
           dayNumber: dayCounter,
           dateStr: currentDateStr,
           data: dayData
        });
        dayCounter++;
      }
    }
    calendarGrid.push(week);
    if (dayCounter > daysInMonth) break;
  }

  const handleStatusChange = async (dateStr: string, status: string) => {
    if (status === "CLEAR") {
      await mutationClear.mutateAsync({ userId: employee.userId, date: dateStr });
    } else {
      await mutationMark.mutateAsync({ userId: employee.userId, date: dateStr, status: status as any });
    }
  };

  return (
    <div className="border border-slate-100 rounded-3xl p-6 bg-slate-50/30">
       <div className="flex flex-col xl:flex-row gap-8">
          {/* Employee Info & Stats */}
          <div className="xl:w-1/3 space-y-6">
             <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 rounded-2xl border-2 border-white shadow-sm ring-1 ring-slate-200">
                  <AvatarImage src={employee.avatarUrl || ''} />
                  <AvatarFallback className="bg-white text-slate-400 font-bold">
                    <UserIcon className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                <div>
                   <h4 className="text-lg font-black text-slate-900">{employee.userName}</h4>
                   <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{employee.designation || 'Staff'}</p>
                   <Button 
                       variant="link" 
                       className="p-0 h-auto text-blue-600 font-black text-[10px] uppercase tracking-widest mt-1 gap-1"
                       onClick={() => setSlipEmployee(employee)}
                    >
                       <FileText className="h-3 w-3" /> Salary Slip
                    </Button>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Payable Days</p>
                   <p className="text-2xl font-black text-slate-900">{employee.payableDays}</p>
                   <p className="text-[10px] font-bold text-slate-500 mt-1">out of {employee.workingDays} working days</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
                   <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 mb-1">Net Salary</p>
                   <p className="text-2xl font-black text-emerald-600">₹{employee.netSalary.toLocaleString()}</p>
                   <p className="text-[10px] font-bold text-emerald-600/80 mt-1">₹{Math.round(employee.dailyWage).toLocaleString()} / day</p>
                </div>
             </div>
             
             <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
                <div className="text-rose-500">Absences: {employee.absentDays}</div>
                <div className="text-blue-500">Holidays: {employee.holidayDays}</div>
                <div className="text-indigo-500">Leaves: {employee.paidLeaveDays}</div>
             </div>
          </div>

          {/* Interactive Calendar */}
          <div className="xl:w-2/3">
             <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-7 gap-2 mb-2">
                     {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-2">
                           {day}
                        </div>
                     ))}
                  </div>
                  <div className="space-y-2">
                     {calendarGrid.map((week, i) => (
                        <div key={i} className="grid grid-cols-7 gap-2">
                           {week.map((day, j) => {
                              if (!day) return <div key={j} className="aspect-square bg-transparent" />;
                              
                              const status = day.data?.status;
                              const isWeekend = status === "WEEKEND";
                              const isHoliday = status === "HOLIDAY";
                              
                              let bgClass = "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300";
                              if (status === "PRESENT") bgClass = "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold shadow-sm";
                              if (status === "ABSENT") bgClass = "bg-rose-50 border-rose-200 text-rose-700 font-bold shadow-sm";
                              if (status === "ON_LEAVE" || status === "PAID_LEAVE") bgClass = "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-sm";
                              if (isWeekend) bgClass = "bg-slate-100 border-slate-200 text-slate-400 opacity-60";
                              if (isHoliday) bgClass = "bg-amber-50 border-amber-200 text-amber-700 opacity-80";
                              
                              return (
                                 <DropdownMenu key={day.dateStr}>
                                    <DropdownMenuTrigger asChild>
                                       <button className={cn("aspect-square rounded-xl border flex flex-col items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-500", bgClass)}>
                                          <span className="text-sm">{day.dayNumber}</span>
                                          {status && !isWeekend && status !== "UPCOMING" && (
                                            <span className="text-[8px] mt-1 uppercase tracking-tighter opacity-80 font-black">
                                              {status === 'PRESENT' ? 'PRS' : status === 'ABSENT' ? 'ABS' : status === 'HOLIDAY' ? 'HOL' : 'LEV'}
                                            </span>
                                          )}
                                       </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-48 rounded-2xl shadow-xl p-2 font-bold">
                                       <DropdownMenuLabel className="text-xs text-slate-400 uppercase tracking-widest">{day.dateStr}</DropdownMenuLabel>
                                       <DropdownMenuSeparator />
                                       <DropdownMenuItem onClick={() => handleStatusChange(day.dateStr, "PRESENT")} className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer rounded-xl">Mark Present</DropdownMenuItem>
                                       <DropdownMenuItem onClick={() => handleStatusChange(day.dateStr, "ON_LEAVE")} className="text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50 cursor-pointer rounded-xl">Mark Leave (Paid)</DropdownMenuItem>
                                       <DropdownMenuItem onClick={() => handleStatusChange(day.dateStr, "ABSENT")} className="text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer rounded-xl">Mark Absent (Unpaid)</DropdownMenuItem>
                                       <DropdownMenuSeparator />
                                       <DropdownMenuItem onClick={() => handleStatusChange(day.dateStr, "CLEAR")} className="text-slate-600 focus:bg-slate-100 cursor-pointer rounded-xl">Clear Record</DropdownMenuItem>
                                    </DropdownMenuContent>
                                 </DropdownMenu>
                              );
                           })}
                        </div>
                     ))}
                  </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}
