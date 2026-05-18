"use client";

import React, { useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Printer, 
  Download, 
  Mail, 
  Building2, 
  User, 
  Calendar, 
  CreditCard,
  Briefcase
} from "lucide-react";
import dayjs from "dayjs";
import { useReactToPrint } from "react-to-print";
import { cn } from "@/lib/utils";

interface SalarySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  month: dayjs.Dayjs;
}

export function SalarySlipModal({ isOpen, onClose, data, month }: SalarySlipModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-100 rounded-[32px] border-none">
        <div className="p-6 bg-white border-b flex items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-black text-slate-900">Salary Slip</DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {month.format("MMMM YYYY")}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl font-bold gap-2">
                <Printer className="h-4 w-4" /> Print
             </Button>
             <Button size="sm" className="rounded-xl font-bold gap-2 bg-blue-600 hover:bg-blue-700">
                <Download className="h-4 w-4" /> Download
             </Button>
          </div>
        </div>

        <div className="p-8 max-h-[80vh] overflow-y-auto">
           {/* Printable Area */}
           <div ref={printRef} className="bg-white p-12 rounded-[24px] shadow-sm border border-slate-200 min-h-[1000px] text-slate-800">
              {/* Company Header */}
              <div className="flex justify-between items-start mb-12">
                 <div className="space-y-2">
                    <div className="flex items-center gap-3">
                       <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                          <Building2 className="h-6 w-6" />
                       </div>
                       <h2 className="text-2xl font-black tracking-tight text-slate-900">STAFFTRACK</h2>
                    </div>
                    <p className="text-xs font-bold text-slate-500 max-w-[200px]">
                       123 Business Avenue, Suite 500<br />
                       Tech Park, City - 400001
                    </p>
                 </div>
                 <div className="text-right">
                    <h3 className="text-3xl font-black text-slate-300 uppercase tracking-tighter">Payslip</h3>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">
                       Month: {month.format("MMMM YYYY")}
                    </p>
                 </div>
              </div>

              {/* Employee Details Grid */}
              <div className="grid grid-cols-2 gap-8 mb-12 p-8 bg-slate-50 rounded-3xl border border-slate-100">
                 <div className="space-y-4">
                    <DetailRow icon={<User />} label="Employee Name" value={data.userName} />
                    <DetailRow icon={<Briefcase />} label="Designation" value={data.designation || "Staff"} />
                    <DetailRow icon={<CreditCard />} label="Employee ID" value={data.userId.slice(-6).toUpperCase()} />
                 </div>
                 <div className="space-y-4">
                    <DetailRow icon={<Calendar />} label="Joining Date" value={dayjs(data.joiningDate).format("DD MMM, YYYY")} />
                    <DetailRow icon={<CreditCard />} label="Payment Mode" value="Bank Transfer" />
                    <DetailRow icon={<CreditCard />} label="Bank A/C No" value="XXXX-XXXX-1234" />
                 </div>
              </div>

              {/* Attendance Summary */}
              <div className="mb-12">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 ml-2">Attendance Summary</h4>
                 <div className="grid grid-cols-4 gap-4">
                    <StatBox label="Working Days" value={data.workingDays} />
                    <StatBox label="Present Days" value={data.presentDays} />
                    <StatBox label="Paid Leaves" value={data.paidLeaveDays} />
                    <StatBox label="Net Payable" value={data.payableDays} highlight />
                 </div>
              </div>

              {/* Earnings & Deductions Table */}
              <div className="grid grid-cols-2 gap-0 border border-slate-200 rounded-3xl overflow-hidden mb-12">
                 {/* Earnings Column */}
                 <div className="border-r border-slate-200">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Earnings</p>
                    </div>
                    <div className="p-6 space-y-4">
                       <AmountRow label="Basic Salary" amount={data.baseSalary} />
                       <AmountRow label="Daily Wage Rate" amount={data.dailyWage} isInfo />
                       <AmountRow label="Allowances" amount={0} />
                       <div className="pt-8 mt-8 border-t border-slate-100 flex justify-between items-center">
                          <p className="font-black text-slate-900">Total Earnings</p>
                          <p className="font-black text-slate-900">₹{data.baseSalary.toLocaleString()}</p>
                       </div>
                    </div>
                 </div>

                 {/* Deductions Column */}
                 <div>
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deductions</p>
                    </div>
                    <div className="p-6 space-y-4">
                       <AmountRow label="Absence Deductions" amount={data.deductionAmount} isNegative />
                       <AmountRow label="Professional Tax" amount={0} />
                       <AmountRow label="TDS" amount={0} />
                       <div className="pt-8 mt-8 border-t border-slate-100 flex justify-between items-center">
                          <p className="font-black text-slate-900">Total Deductions</p>
                          <p className="font-black text-rose-600">₹{data.deductionAmount.toLocaleString()}</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Net Salary Summary */}
              <div className="bg-slate-900 rounded-[32px] p-8 flex justify-between items-center text-white shadow-xl shadow-slate-200">
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mb-1">Total Net Payable</p>
                    <p className="text-sm font-bold opacity-80">Rupees {numberToWords(data.netSalary)} Only</p>
                 </div>
                 <div className="text-right">
                    <p className="text-4xl font-black tracking-tight">₹{data.netSalary.toLocaleString()}</p>
                 </div>
              </div>

              {/* Footer */}
              <div className="mt-24 grid grid-cols-2 gap-24">
                 <div className="text-center space-y-4">
                    <div className="h-px bg-slate-200 w-full"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Signature</p>
                 </div>
                 <div className="text-center space-y-4">
                    <div className="h-px bg-slate-200 w-full"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Director Signature</p>
                 </div>
              </div>

              <div className="mt-24 pt-8 border-t border-slate-50 text-center">
                 <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                    This is a computer generated document and does not require a physical signature.
                 </p>
              </div>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
   return (
      <div className="flex items-center gap-4">
         <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
            {React.cloneElement(icon as React.ReactElement, { className: "h-4 w-4" })}
         </div>
         <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">{label}</p>
            <p className="text-xs font-black text-slate-700">{value}</p>
         </div>
      </div>
   );
}

function StatBox({ label, value, highlight }: { label: string, value: number, highlight?: boolean }) {
   return (
      <div className={cn(
         "p-4 rounded-2xl border text-center transition-all",
         highlight ? "bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-100" : "bg-white border-slate-100 text-slate-600"
      )}>
         <p className={cn("text-[9px] font-black uppercase tracking-widest mb-1", highlight ? "text-blue-100" : "text-slate-400")}>{label}</p>
         <p className="text-xl font-black">{value}</p>
      </div>
   );
}

function AmountRow({ label, amount, isNegative, isInfo }: { label: string, amount: number, isNegative?: boolean, isInfo?: boolean }) {
   return (
      <div className="flex justify-between items-center">
         <p className={cn("text-xs font-bold", isInfo ? "text-slate-400" : "text-slate-600")}>{label}</p>
         <p className={cn(
            "text-xs font-black",
            isNegative ? "text-rose-600" : isInfo ? "text-slate-400" : "text-slate-900"
         )}>
            {isNegative ? '-' : ''}₹{amount.toLocaleString()}
         </p>
      </div>
   );
}

function numberToWords(num: number): string {
   const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
   const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
   
   const numStr = num.toString();
   if (numStr.length > 9) return 'Overflow';
   const n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
   if (!n) return ''; 
   let str = '';
   str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
   str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
   str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
   str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
   str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
   return str.trim();
}
