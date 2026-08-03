"use client";

import React, { useState, useMemo } from "react";
import { 
  FileText, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Printer,
  Calendar,
  Filter,
  ArrowRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchMusterReport } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

export default function MusterReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");

  const musterQuery = useQuery({
    queryKey: ["muster-report", selectedMonth.month() + 1, selectedMonth.year()],
    queryFn: () => fetchMusterReport({ 
      month: selectedMonth.month() + 1, 
      year: selectedMonth.year() 
    })
  });

  const { days = [], data = [] } = musterQuery.data ?? {};

  const departments = useMemo(() => {
    const deps = new Set<string>();
    data.forEach((item: any) => deps.add(item.group));
    return ["All", ...Array.from(deps)];
  }, [data]);

  const filteredData = data.filter((item: any) => 
    (item.userName.toLowerCase().includes(search.toLowerCase())) &&
    (department === "All" || item.group === department)
  ).sort((a: any, b: any) => (a.userName || "").localeCompare(b.userName || "", "en", { sensitivity: "base" }));

  function changeMonth(delta: number) {
    setSelectedMonth(prev => prev.add(delta, 'month'));
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "P": return "bg-emerald-500 text-white";
      case "HD": return "bg-amber-400 text-white";
      case "A": return "bg-rose-500 text-white";
      case "L": return "bg-indigo-500 text-white";
      case "H": return "bg-amber-200 text-amber-700";
      case "W": return "bg-slate-100 text-slate-400";
      default: return "bg-slate-50 text-slate-300";
    }
  };

  const exportToCSV = () => {
    const dayHeaders = days.map((day: string) => dayjs(day).format("DD"));
    const enrichedHeaders = ["Employee", "Group/Dept", "Monthly Points", "Total Leaves", "Total Holidays", "Total Absents", ...dayHeaders];

    const rowsData = filteredData.map((item: any) => {
      const attendanceValues = Object.values(item.attendance || {});
      const totalLeaves = attendanceValues.filter((v: any) => v === "L").length;
      const totalHolidays = attendanceValues.filter((v: any) => v === "H").length;
      const totalAbsents = attendanceValues.filter((v: any) => v === "A").length;

      const dayValues = days.map((day: string) => {
        const status = item.attendance[day] || "-";
        const points = Number(item.dailyPoints?.[day] ?? 0);
        return points > 0 ? `${status} (${points})` : status;
      });
      return [
        item.userName || "",
        item.group || "",
        item.monthlyPoints ?? 0,
        totalLeaves,
        totalHolidays,
        totalAbsents,
        ...dayValues
      ];
    });

    const csvContent = [
      enrichedHeaders.join(","),
      ...rowsData.map((row: any) => row.map((val: any) => `"${(val ?? "").toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `muster_report_${selectedMonth.format("MMM_YYYY")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <FileText className="h-3 w-3" />
            <span>Reports / Muster</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Muster Roll Report
            <Badge variant="outline" className="h-6 px-2 rounded-lg border-blue-100 bg-blue-50/50 text-blue-600 font-bold">
              {selectedMonth.format("MMMM YYYY")}
            </Badge>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-slate-200/60">
            <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} className="rounded-xl h-10 w-10">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="px-4 text-center min-w-[120px]">
              <p className="text-sm font-black text-slate-900">{selectedMonth.format("MMM YYYY")}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} className="rounded-xl h-10 w-10">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <Button 
            onClick={exportToCSV}
            variant="outline" 
            className="rounded-2xl h-12 px-6 gap-2 border-slate-200 font-black text-xs uppercase tracking-widest bg-white shadow-sm hover:bg-slate-50 transition-all"
          >
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <Card className="rounded-[40px] border-none shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-slate-50">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex flex-wrap items-center gap-3">
                 {departments.map((dep: string) => (
                    <button
                      key={dep}
                      onClick={() => setDepartment(dep)}
                      className={cn(
                        "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                        department === dep 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                      )}
                    >
                       {dep}
                    </button>
                 ))}
              </div>
              <div className="relative w-full md:w-80">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                 <Input 
                   placeholder="Search staff..." 
                   className="h-12 pl-12 rounded-2xl bg-slate-50 border-none focus:bg-white transition-all font-bold" 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                 />
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-max">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="sticky left-0 z-20 bg-slate-50/50 px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest border-r border-slate-100">Employee / Dept</th>
                       <th className="px-4 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center min-w-[80px] border-r border-slate-100/50">Points</th>
                       <th className="px-4 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center min-w-[80px] border-r border-slate-100/50">Leaves</th>
                       <th className="px-4 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center min-w-[80px] border-r border-slate-100/50">Holidays</th>
                       <th className="px-4 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center min-w-[80px] border-r border-slate-100/50">Absents</th>
                       {days.map((day: string) => (
                          <th key={day} className="px-2 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center min-w-[45px] border-r border-slate-100/50">
                             {dayjs(day).format("DD")}
                             <div className="text-[8px] opacity-60 font-bold">{dayjs(day).format("ddd")[0]}</div>
                          </th>
                       ))}
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {filteredData.map((item: any) => (
                       <tr key={item.userId} className="group hover:bg-blue-50/30 transition-colors">
                          <td className="sticky left-0 z-10 bg-white group-hover:bg-blue-50/30 px-8 py-4 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors">
                             <p className="text-sm font-black text-slate-900 leading-tight">{item.userName}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{item.group}</p>
                          </td>
                           <td className="px-4 py-4 border-r border-slate-50/50 text-center">
                             <div className="inline-flex min-w-[52px] items-center justify-center rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">
                               {item.monthlyPoints ?? 0}
                             </div>
                           </td>
                           <td className="px-4 py-4 border-r border-slate-50/50 text-center">
                             <div className="inline-flex min-w-[40px] items-center justify-center rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-black text-indigo-700">
                               {Object.values(item.attendance || {}).filter(v => v === "L").length}
                             </div>
                           </td>
                           <td className="px-4 py-4 border-r border-slate-50/50 text-center">
                             <div className="inline-flex min-w-[40px] items-center justify-center rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700">
                               {Object.values(item.attendance || {}).filter(v => v === "H").length}
                             </div>
                           </td>
                           <td className="px-4 py-4 border-r border-slate-50/50 text-center">
                             <div className="inline-flex min-w-[40px] items-center justify-center rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-black text-rose-700">
                               {Object.values(item.attendance || {}).filter(v => v === "A").length}
                             </div>
                           </td>
                          {days.map((day: string) => {
                             const status = item.attendance[day] || '-';
                             const points = Number(item.dailyPoints?.[day] ?? 0);
                             return (
                                <td key={day} className="px-1 py-4 border-r border-slate-50/50">
                                   <div className="mx-auto flex min-h-[52px] w-[46px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-100 bg-white px-1 py-1.5 shadow-sm">
                                      <div className={cn(
                                         "flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black transition-transform hover:scale-110 cursor-default",
                                         getStatusColor(status)
                                      )}>
                                         {status}
                                      </div>
                                      <span className="text-[9px] font-black text-slate-500">
                                        {points > 0 ? points : "-"}
                                      </span>
                                   </div>
                                </td>
                             );
                          })}
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
           
           <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-6">
                 <LegendItem color="bg-emerald-500" label="P: Present" />
                 <LegendItem color="bg-amber-400" label="HD: Half Day" />
                 <LegendItem color="bg-rose-500" label="A: Absent" />
                 <LegendItem color="bg-indigo-500" label="L: Leave" />
                 <LegendItem color="bg-amber-200" label="H: Holiday" />
                 <LegendItem color="bg-slate-100" label="W: Weekend" />
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
   return (
      <div className="flex items-center gap-2">
         <div className={cn("h-4 w-4 rounded-md shadow-sm", color)} />
         <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      </div>
   );
}
