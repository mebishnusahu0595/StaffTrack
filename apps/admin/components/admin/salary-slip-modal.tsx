"use client";

import React, { useRef, useState, useEffect } from "react";
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
import { uploadFile } from "@/lib/api";

interface SalarySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  month: dayjs.Dayjs;
}

export function SalarySlipModal({ isOpen, onClose, data, month }: SalarySlipModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [localLogo, setLocalLogo] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLocalLogo(localStorage.getItem("payslip_logo"));
    }
  }, [isOpen]);

  const logoToShow = data?.logoUrl || localLogo;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  if (!data) return null;

  const earningItems = data.earnings || [
    { label: "Basic Salary", actual: data.baseSalary, calculated: data.netSalary },
    ...(data.travelAllowance > 0 ? [{ label: "Travel Allowance", actual: data.travelAllowance, calculated: data.travelAllowance }] : []),
    ...(data.approvedExpensesTotal > 0 ? [{ label: "Reimbursed Expenses", actual: data.approvedExpensesTotal, calculated: data.approvedExpensesTotal }] : [])
  ];
  const totalEarnings = earningItems.reduce((sum: number, item: any) => sum + Number(item.calculated ?? item.actual ?? 0), 0);

  const deductionItems = data.deductions || [
    ...(data.deductionAmount > 0 ? [{ label: "Absence Deduction", calculated: data.deductionAmount }] : [])
  ];
  const totalDeductions = deductionItems.reduce((sum: number, item: any) => sum + Number(item.calculated ?? 0), 0);
  const netPayout = Math.round(totalEarnings - totalDeductions);

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
             <input
                type="file"
                accept="image/*"
                id="payslip-logo-upload"
                className="hidden"
                onChange={async (e) => {
                   const file = e.target.files?.[0];
                   if (file) {
                      try {
                         const url = await uploadFile(file);
                         localStorage.setItem("payslip_logo", url);
                         setLocalLogo(url);
                      } catch (err) {
                         alert("Failed to upload logo");
                      }
                   }
                }}
             />
             <Button variant="outline" size="sm" asChild className="rounded-xl font-bold cursor-pointer">
                <label htmlFor="payslip-logo-upload">
                   Upload Logo
                </label>
             </Button>
             {localLogo && (
                <Button variant="ghost" size="sm" onClick={() => {
                   localStorage.removeItem("payslip_logo");
                   setLocalLogo(null);
                }} className="rounded-xl font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                   Clear Logo
                </Button>
             )}
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
               {/* Company Header matching sketch */}
               <div className="flex items-center gap-6 pb-6 border-b border-slate-300 mb-6">
                  <div className="h-16 w-16 rounded-full border-2 border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                     {logoToShow ? (
                        <img src={logoToShow} alt="Logo" className="h-full w-full object-contain" />
                     ) : (
                        <Building2 className="h-8 w-8 text-slate-400" />
                     )}
                  </div>
                  <div className="flex-grow space-y-1 text-left">
                     <h2 className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                        {data.orgName || data.companyName || "Vaniki Crop Science Pvt Ltd."}
                     </h2>
                     {data.orgSubtitle ? (
                        <p className="text-xs font-bold text-slate-600">
                           {data.orgSubtitle}
                        </p>
                     ) : (
                        <p className="text-xs font-bold text-slate-600">
                           Durg office - Shop no. 37, Krishi Upaj Mandi, Dhamdha Road, Durg 491001 (C.G.)
                        </p>
                     )}
                     <p className="text-[10px] font-bold text-slate-500">
                        Website: vanikicrop.com &nbsp;|&nbsp; Email: vanikicrop@gmail.com &nbsp;|&nbsp; Ph.No: +91 9406160135
                     </p>
                  </div>
               </div>

               {/* PAY SLIP Centered Title */}
               <div className="text-center mb-6">
                  <h3 className="text-xl font-extrabold uppercase tracking-widest text-slate-900 underline">PAY SLIP</h3>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">
                     For {month.format("MMMM YYYY")}
                  </p>
               </div>

               {/* Employee Details Table matching sketch */}
               <table className="w-full border-collapse border border-slate-300 text-xs text-left mb-6">
                  <tbody>
                     <tr>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Employee Name</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.userName}</td>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Bank Name</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.bankName || "-"}</td>
                     </tr>
                     <tr>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Company Code</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.companyCode || "-"}</td>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Bank A/c No</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.bankAccountNo || "-"}</td>
                     </tr>
                     <tr>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Department Name</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.departmentName || "-"}</td>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">IFSC Code</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.ifscCode || "-"}</td>
                     </tr>
                     <tr>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Designation</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.designation || "-"}</td>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Adhar No</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.aadhaarNumber || "-"}</td>
                     </tr>
                     <tr>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Division Name</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.divisionName || "-"}</td>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Holiday</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.holidayDays || data.holidayCount || "0"}</td>
                     </tr>
                     <tr>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Trainee Type</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.traineeType || "-"}</td>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Leave</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.absentDays || "0"}</td>
                     </tr>
                     <tr>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Month Days</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.monthDays || data.workingDays || "0"}</td>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Paid Leave</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.paidLeaveDays || "0"}</td>
                     </tr>
                     <tr>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Payable Days</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.payableDays || "0"}</td>
                        <td className="border border-slate-300 px-4 py-2 font-bold bg-slate-50/50 w-1/4">Date of Joining</td>
                        <td className="border border-slate-300 px-4 py-2 w-1/4">{data.joiningDate ? dayjs(data.joiningDate).format("DD MMM, YYYY") : "-"}</td>
                     </tr>
                  </tbody>
               </table>

               {/* Earnings & Deductions Table matching sketch */}
               <table className="w-full border-collapse border border-slate-300 text-xs text-left mb-6">
                  <thead>
                     <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-4 py-2 w-[35%] font-bold">Earnings</th>
                        <th className="border border-slate-300 px-4 py-2 w-[15%] text-right font-bold">Amount (Monthly)</th>
                        <th className="border border-slate-300 px-4 py-2 w-[35%] font-bold">Deductions</th>
                        <th className="border border-slate-300 px-4 py-2 w-[15%] text-right font-bold">Amount</th>
                     </tr>
                  </thead>
                  <tbody>
                     {(() => {
                        const maxRows = Math.max(earningItems.length, deductionItems.length, 6);
                        const rows = [];
                        for (let i = 0; i < maxRows; i++) {
                           const earn = earningItems[i];
                           const ded = deductionItems[i];
                           rows.push(
                              <tr key={i}>
                                 <td className="border border-slate-300 px-4 py-2">{earn?.label || ""}</td>
                                 <td className="border border-slate-300 px-4 py-2 text-right font-mono">
                                    {earn ? `₹${Number(earn.calculated ?? earn.actual ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
                                 </td>
                                 <td className="border border-slate-300 px-4 py-2">{ded?.label || ""}</td>
                                 <td className="border border-slate-300 px-4 py-2 text-right font-mono">
                                    {ded ? `₹${Number(ded.calculated ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
                                 </td>
                              </tr>
                           );
                        }
                        return rows;
                     })()}
                     <tr className="bg-slate-50 font-bold">
                        <td className="border border-slate-300 px-4 py-2">Total Earnings</td>
                        <td className="border border-slate-300 px-4 py-2 text-right font-mono">
                           ₹{totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="border border-slate-300 px-4 py-2">Total Deductions</td>
                        <td className="border border-slate-300 px-4 py-2 text-right font-mono">
                           ₹{totalDeductions.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                     </tr>
                  </tbody>
               </table>

               {/* Net Salary Summary matching formula in sketch */}
               <div className="border border-slate-300 rounded-2xl p-6 bg-slate-50/50 space-y-2 text-left">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-800">
                     <p>
                        NET PAY = Total Earnings (₹{totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) - Total Deductions (₹{totalDeductions.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                     </p>
                     <p className="text-xl font-black text-slate-900">
                        ₹{netPayout.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                     </p>
                  </div>
                  <p className="text-xs font-bold text-slate-500 italic mt-2">
                     Total Amount (In Words: {data.netPayWords || numberToWords(netPayout)} Only)
                  </p>
               </div>

               {/* Footer with Signatures */}
               <div className="mt-16 grid grid-cols-2 gap-24">
                  <div className="text-center space-y-8">
                     <div className="h-px bg-slate-300 w-full"></div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Signature</p>
                  </div>
                  <div className="text-center space-y-8">
                     <div className="h-px bg-slate-300 w-full"></div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Authorised Signatory <br />
                        <span className="text-[10px] font-black text-slate-600 mt-1 block">
                           {data.orgName || data.companyName || "Vaniki Crop Science Pvt Ltd."}
                        </span>
                     </p>
                  </div>
               </div>

               <div className="mt-16 pt-6 border-t border-slate-100 text-center">
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

function StatBox({ label, value, highlight }: { label: string, value: number | string, highlight?: boolean }) {
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
