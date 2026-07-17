"use client";
 
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, FileText, ExternalLink, Wallet, ListChecks, Timer, Filter, Fuel, Utensils, Plane, Package, Download, X, ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
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
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const groupedRows = useMemo(() => {
    const groups: Record<string, { user: any; expenses: any[]; totalAmount: number }> = {};
    rows.forEach((expense) => {
      const userId = expense.user.id;
      if (!groups[userId]) {
        groups[userId] = {
          user: expense.user,
          expenses: [],
          totalAmount: 0,
        };
      }
      groups[userId].expenses.push(expense);
      groups[userId].totalAmount += expense.amount;
    });
    return Object.values(groups);
  }, [rows]);

  return (
    <Table>
      <TableHeader className="bg-slate-50/50">
        <TableRow className="hover:bg-transparent border-slate-100">
          <TableHead className="py-4 px-8 text-[11px] font-bold tracking-wider text-slate-400 uppercase w-12"></TableHead>
          <TableHead className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Employee</TableHead>
          <TableHead className="text-[11px] font-bold tracking-wider text-slate-400 uppercase text-center">Requests</TableHead>
          <TableHead className="text-right px-8 text-[11px] font-bold tracking-wider text-slate-400 uppercase">Total Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groupedRows.length > 0 ? (
          groupedRows.map((group) => {
            const userId = group.user.id;
            const isExpanded = !!expandedUsers[userId];
            return (
              <React.Fragment key={userId}>
                {/* Main User Row */}
                <TableRow 
                  className="border-slate-50 hover:bg-slate-50/30 transition-colors cursor-pointer"
                  onClick={() => toggleUser(userId)}
                >
                  <TableCell className="py-4 px-8 text-center" onClick={(e) => { e.stopPropagation(); toggleUser(userId); }}>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-slate-100 shadow-sm">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${group.user.email}`} />
                        <AvatarFallback>{group.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-sm">{group.user.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Field Representative</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-slate-600 text-xs">
                    {group.expenses.length} request(s)
                  </TableCell>
                  <TableCell className="text-right px-8 font-black text-slate-900 text-sm">
                    {formatCurrency(group.totalAmount)}
                  </TableCell>
                </TableRow>

                {/* Expanded Details Row */}
                {isExpanded && (
                  <TableRow className="bg-slate-50/30 hover:bg-slate-50/30 border-none">
                    <TableCell colSpan={4} className="p-4 px-8 bg-slate-50/40">
                      <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden p-4 space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                          Expense Details for {group.user.name}
                        </h3>
                        <Table>
                          <TableHeader className="bg-slate-50/70 border-none">
                            <TableRow className="hover:bg-transparent border-slate-100">
                              <TableHead className="text-[10px] font-bold tracking-wider text-slate-400 uppercase py-2">Category</TableHead>
                              <TableHead className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Date</TableHead>
                              <TableHead className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Purpose</TableHead>
                              <TableHead className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Receipt</TableHead>
                              <TableHead className="text-[10px] font-bold tracking-wider text-slate-400 uppercase text-right">Amount</TableHead>
                              <TableHead className="text-[10px] font-bold tracking-wider text-slate-400 uppercase text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.expenses.map((expense) => (
                              <TableRow key={expense.id} className="border-slate-50 hover:bg-slate-50/10">
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-2">
                                    <CategoryIcon category={expense.category} />
                                    <span className="text-xs font-semibold text-slate-600 capitalize">
                                      {expense.category.toLowerCase()}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold text-slate-500 text-xs">
                                  {formatDate(expense.date)}
                                </TableCell>
                                <TableCell className="max-w-[200px]">
                                  <span className="text-[11px] font-semibold text-slate-500 line-clamp-2 leading-relaxed">
                                    {expense.description}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <button className="block w-9 h-9 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity cursor-pointer focus:outline-none">
                                        <img src={expense.receiptUrl} alt="Receipt" className="w-full h-full object-cover grayscale opacity-60" />
                                      </button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-3xl p-0 overflow-hidden border-none bg-slate-950 rounded-2xl shadow-2xl hide-close">
                                      <DialogClose className="absolute right-4 top-4 z-50 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 transition-all outline-none border border-white/10">
                                        <X className="h-5 w-5" />
                                      </DialogClose>
                                      <div className="w-full max-h-[80vh] flex items-center justify-center p-4">
                                        <img src={expense.receiptUrl} alt="Receipt" className="max-w-full max-h-[75vh] object-contain rounded-lg" />
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </TableCell>
                                <TableCell className="text-right font-bold text-slate-800 text-xs">
                                  {formatCurrency(expense.amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                                    {expense.approved ? (
                                      <div className="flex items-center gap-2">
                                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold text-[9px] uppercase px-2 py-0.5">
                                          Approved
                                        </Badge>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-1.5 text-slate-400 hover:text-slate-600 font-bold text-[10px]"
                                          onClick={() => onDecision(expense.id, null as any)}
                                          disabled={isUpdating}
                                          title="Revert to Pending"
                                        >
                                          Undo
                                        </Button>
                                      </div>
                                    ) : expense.approvedById ? (
                                      <div className="flex items-center gap-2">
                                        <Badge className="bg-rose-50 text-rose-600 border-rose-100 font-bold text-[9px] uppercase px-2 py-0.5">
                                          Rejected
                                        </Badge>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-1.5 text-slate-400 hover:text-slate-600 font-bold text-[10px]"
                                          onClick={() => onDecision(expense.id, null as any)}
                                          disabled={isUpdating}
                                          title="Revert to Pending"
                                        >
                                          Undo
                                        </Button>
                                      </div>
                                    ) : (
                                      <>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-bold text-[11px]"
                                          onClick={() => onDecision(expense.id, true)} 
                                          disabled={isUpdating}
                                        >
                                          Approve
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-[11px]"
                                          onClick={() => onDecision(expense.id, false)} 
                                          disabled={isUpdating}
                                        >
                                          Reject
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Sub-table footer with total of this user */}
                            <TableRow className="bg-slate-50/30 hover:bg-slate-50/30 border-t border-slate-100">
                              <TableCell colSpan={4} className="py-2.5 font-bold text-slate-600 text-xs">
                                Total Expenses
                              </TableCell>
                              <TableCell className="text-right py-2.5 font-black text-slate-900 text-sm">
                                {formatCurrency(group.totalAmount)}
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })
        ) : (
          <TableRow>
            <TableCell colSpan={4} className="h-32 text-center text-slate-400 font-medium text-xs">
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
    mutationFn: ({ id, approved }: { id: string; approved: boolean | null }) => approveExpense(id, approved),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      let statusMsg = "reverted to pending";
      if (variables.approved === true) statusMsg = "approved";
      else if (variables.approved === false) statusMsg = "rejected";
      alert(`Expense successfully ${statusMsg}!`);
    },
    onError: (error) => {
      alert(`Failed to update expense: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
 
  const pending = useMemo(() => (expensesQuery.data ?? []).filter((expense) => !expense.approved && !expense.approvedById), [expensesQuery.data]);
  const allExpenses = expensesQuery.data ?? [];
  const totalAmount = useMemo(() => pending.reduce((sum, e) => sum + e.amount, 0), [pending]);

  const downloadCSV = () => {
    if (allExpenses.length === 0) return;
    const headers = ["Employee Name", "Category", "Date", "Amount", "Description", "Status"];
    const rows = allExpenses.map((e: any) => [
      e.user?.name || "--",
      e.category || "",
      formatDate(e.date),
      e.amount,
      e.description || "",
      e.approved ? "APPROVED" : "PENDING"
    ]);
    
    const csvString = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${(val ?? "").toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");
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
