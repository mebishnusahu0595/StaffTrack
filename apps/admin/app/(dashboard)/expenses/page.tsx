"use client";
 
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, FileText, ExternalLink, Wallet, ListChecks, Timer, Filter, Fuel, Utensils, Plane, Package, Download } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { approveExpense, fetchExpenses } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
 
function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "FUEL": return <Fuel className="h-4 w-4 text-slate-400" />;
    case "FOOD":
    case "MEALS": return <Utensils className="h-4 w-4 text-slate-400" />;
    case "TRAVEL": return <Plane className="h-4 w-4 text-slate-400" />;
    default: return <Package className="h-4 w-4 text-slate-400" />;
  }
}
 
function ExpenseTable({
  rows,
  onDecision,
  isUpdating
}: {
  rows: Awaited<ReturnType<typeof fetchExpenses>>;
  onDecision: (id: string, approved: boolean) => void;
  isUpdating: boolean;
}) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/50">
        <TableRow className="hover:bg-transparent border-slate-100">
          <TableHead className="py-4 px-8 text-[11px] font-bold tracking-wider text-slate-400 uppercase">Employee</TableHead>
          <TableHead className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Category</TableHead>
          <TableHead className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Date</TableHead>
          <TableHead className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Amount</TableHead>
          <TableHead className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Purpose</TableHead>
          <TableHead className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Receipt</TableHead>
          <TableHead className="text-right px-8 text-[11px] font-bold tracking-wider text-slate-400 uppercase">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length > 0 ? (
          rows.map((expense) => (
            <TableRow key={expense.id} className="border-slate-50 hover:bg-slate-50/30 transition-colors">
              <TableCell className="py-4 px-8">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 border border-slate-100 shadow-sm">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${expense.user.email}`} />
                    <AvatarFallback>{expense.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 text-sm">{expense.user.name}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Field Representative</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <CategoryIcon category={expense.category} />
                  <span className="text-xs font-semibold text-slate-600 capitalize">{expense.category.toLowerCase()}</span>
                </div>
              </TableCell>
              <TableCell className="font-semibold text-slate-500 text-xs">{formatDate(expense.date)}</TableCell>
              <TableCell className="font-black text-slate-900 text-sm">{formatCurrency(expense.amount)}</TableCell>
              <TableCell className="max-w-[200px]">
                <span className="text-[11px] font-semibold text-slate-500 line-clamp-2 leading-relaxed">
                  {expense.description}
                </span>
              </TableCell>
              <TableCell>
                <a 
                  href={expense.receiptUrl} 
                  className="block w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity" 
                  target="_blank" 
                  rel="noreferrer"
                >
                  <img src={expense.receiptUrl} alt="Receipt" className="w-full h-full object-cover grayscale opacity-60" />
                </a>
              </TableCell>
              <TableCell className="text-right px-8">
                <div className="flex justify-end gap-2">
                  {!expense.approved ? (
                    <>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="h-8 px-3 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-bold text-xs"
                        onClick={() => onDecision(expense.id, true)} 
                        disabled={isUpdating}
                      >
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="h-8 px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs"
                        onClick={() => onDecision(expense.id, false)} 
                        disabled={isUpdating}
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold text-[10px] uppercase px-3 py-1">
                      Approved
                    </Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={6} className="h-32 text-center text-slate-400 font-medium text-xs">
              No expenses found in this queue.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
 
export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const expensesQuery = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses() });
  const mutation = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) => approveExpense(id, approved),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    }
  });
 
  const pending = useMemo(() => (expensesQuery.data ?? []).filter((expense) => !expense.approved), [expensesQuery.data]);
  const allExpenses = expensesQuery.data ?? [];
  const totalAmount = useMemo(() => pending.reduce((sum, e) => sum + e.amount, 0), [pending]);

  const downloadCSV = () => {
    if (allExpenses.length === 0) return;
    const headers = ["Employee Name", "Category", "Date", "Amount", "Description", "Status"];
    const rows = allExpenses.map((e: any) => [
      e.user.name,
      e.category,
      formatDate(e.date),
      e.amount,
      e.description,
      e.approved ? "APPROVED" : "PENDING"
    ]);
    
    const csvString = [headers.join(","), ...rows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Expenses_Report.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
 
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Expenses Approval</h1>
          <p className="mt-1 text-slate-500">Review and manage field team expenses.</p>
        </div>
      </div>
 
      {/* Stat Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Pending</p>
                <p className="text-2xl font-black text-slate-900">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Requests</p>
                <p className="text-2xl font-black text-slate-900">{pending.length}</p>
              </div>
              <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <ListChecks className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Avg. Processing Time</p>
                <p className="text-2xl font-black text-slate-900">1.2 Days</p>
              </div>
              <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <Timer className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
 
      <Tabs defaultValue="pending" className="w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
             <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Pending Expenses</h2>
          </div>
          <div className="flex items-center gap-3">
            <TabsList className="bg-slate-100 p-1 rounded-xl h-10">
              <TabsTrigger value="pending" className="rounded-lg font-bold text-[10px] uppercase px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Pending Approval
              </TabsTrigger>
              <TabsTrigger value="all" className="rounded-lg font-bold text-[10px] uppercase px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                All Expenses
              </TabsTrigger>
            </TabsList>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-10 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm gap-2 text-[10px] font-bold uppercase hover:bg-slate-50 transition-all mr-2"
              onClick={downloadCSV}
              disabled={allExpenses.length === 0}
            >
              <Download className="h-4 w-4 text-slate-500" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 px-4 text-slate-400">
               <Filter className="h-4 w-4 mr-2" />
               <span className="text-[10px] font-bold uppercase text-slate-600">Filter</span>
            </Button>
          </div>
        </div>
        
        <TabsContent value="pending" className="mt-0">
          <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden">
            <ExpenseTable
              rows={pending}
              onDecision={(id, approved) => mutation.mutate({ id, approved })}
              isUpdating={mutation.isPending}
            />
          </Card>
        </TabsContent>
        
        <TabsContent value="all" className="mt-0">
          <Card className="border-none shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/50 overflow-hidden">
            <ExpenseTable
              rows={allExpenses}
              onDecision={(id, approved) => mutation.mutate({ id, approved })}
              isUpdating={mutation.isPending}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
