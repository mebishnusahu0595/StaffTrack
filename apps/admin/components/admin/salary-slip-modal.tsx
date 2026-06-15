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
              {/* Company Header */}
              <div className="flex justify-between items-start mb-12">
                 <div className="space-y-2">
                    <div className="flex items-center gap-3">
                       <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white overflow-hidden shrink-0">
                          {logoToShow ? (
                             <img src={logoToShow} alt="Logo" className="h-full w-full object-contain" />
                          ) : (
                             <Building2 className="h-6 w-6" />
                          )}
                       </div>
                       <h2 className="text-2xl font-black tracking-tight text-slate-900">
                          {data.orgName || data.companyName || "STAFFTRACK"}
                       </h2>
                    </div>
                     {data.orgSubtitle ? (
                        <p className="text-xs font-bold text-slate-500 max-w-[250px]">
                           {data.orgSubtitle}
                           {data.orgCode ? <><br />{data.orgCode}</> : null}
                        </p>
                     ) : data.orgCode ? (
                        <p className="text-xs font-bold text-slate-500 max-w-[250px]">{data.orgCode}</p>
                     ) : null}
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
                    {data.traineeType ? <DetailRow icon={<Briefcase />} label="Trainee Type" value={data.traineeType} /> : null}
                    {data.aadhaarNumber ? <DetailRow icon={<CreditCard />} label="Aadhaar Number" value={data.aadhaarNumber} /> : null}
                 </div>
                 <div className="space-y-4">
                    <DetailRow icon={<Calendar />} label="Joining Date" value={data.joiningDate ? dayjs(data.joiningDate).format("DD MMM, YYYY") : "-"} />
                    <DetailRow icon={<CreditCard />} label="Payment Mode" value="Bank Transfer" />
                    <DetailRow icon={<CreditCard />} label="Bank Name" value={data.bankName || "Not set"} />
                    <DetailRow icon={<CreditCard />} label="Bank A/C No" value={data.bankAccountNo || "Not set"} />
                    {data.ifscCode ? <DetailRow icon={<CreditCard />} label="IFSC Code" value={data.ifscCode} /> : null}
                    {data.companyCode ? <DetailRow icon={<Building2 />} label="Company Code" value={data.companyCode} /> : null}
                    {data.divisionName ? <DetailRow icon={<Building2 />} label="Division Name" value={data.divisionName} /> : null}
                 </div>
              </div>

               {/* Attendance Summary */}
               <div className="mb-12 text-left">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 ml-2">Attendance Summary</h4>
                  <div className="grid grid-cols-5 gap-4">
                     <StatBox label="Working Days" value={data.monthDays || data.workingDays} />
                     <StatBox label="Present Days" value={data.presentDays} />
                     <StatBox label="Paid Leaves" value={data.paidLeaveDays} />
                     <StatBox label="Net Payable" value={data.payableDays} highlight />
                     <StatBox label="Total Travel" value={(data.totalKm || 0).toFixed(1) + " KM"} />
                  </div>
               </div>

               {/* Earnings & Deductions Table */}
               <div className="grid grid-cols-2 gap-0 border border-slate-200 rounded-3xl overflow-hidden mb-12 text-left">
                  {/* Earnings Column */}
                  <div className="border-r border-slate-200">
                     <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Earnings</p>
                     </div>
                     <div className="p-6 space-y-4">
                        {earningItems.map((earn: any, idx: number) => (
                           <AmountRow key={idx} label={earn.label} amount={earn.calculated ?? earn.actual ?? 0} />
                        ))}
                        <div className="pt-8 mt-8 border-t border-slate-100 flex justify-between items-center">
                           <p className="font-black text-slate-900">Total Earnings</p>
                           <p className="font-black text-slate-900">₹{totalEarnings.toLocaleString()}</p>
                        </div>
                     </div>
                  </div>

                  {/* Deductions Column */}
                  <div>
                     <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deductions</p>
                     </div>
                     <div className="p-6 space-y-4">
                        {deductionItems.map((ded: any, idx: number) => (
                           <AmountRow key={idx} label={ded.label} amount={ded.calculated ?? 0} isNegative />
                        ))}
                        <div className="pt-8 mt-8 border-t border-slate-100 flex justify-between items-center">
                           <p className="font-black text-slate-900">Total Deductions</p>
                           <p className="font-black text-rose-600">₹{totalDeductions.toLocaleString()}</p>
                        </div>
                     </div>
                  </div>
               </div>

              {/* Net Salary Summary */}
              <div className="bg-slate-900 rounded-[32px] p-8 flex justify-between items-center text-white shadow-xl shadow-slate-200">
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mb-1">Total Net Payout</p>
                    <p className="text-sm font-bold opacity-80">
                       Rupees {data.netPayWords || numberToWords(netPayout)}
                    </p>
                 </div>
                 <div className="text-right">
                    <p className="text-4xl font-black tracking-tight">₹{netPayout.toLocaleString()}</p>
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
