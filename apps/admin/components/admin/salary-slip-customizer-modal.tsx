"use client";

import React, { useState, useMemo } from "react";
import { 
  X, 
  Plus, 
  Trash2, 
  Printer, 
  CheckCircle2 
} from "lucide-react";
import dayjs from "dayjs";
import { saveSalarySlip } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DialogContent, 
  DialogHeader, 
  DialogClose,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

interface CustomItem {
  id: string;
  name: string;
  amount: number;
}

interface SalarySlipCustomizerModalProps {
  report: any;
  month: dayjs.Dayjs;
  onClose: () => void;
  onSuccess?: () => void;
}

// Indian-style amount in words
function amountInWords(value: number): string {
  const num = Math.floor(Math.abs(value));
  if (num === 0) return "Zero Only";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number): string => (n < 20 ? a[n] : `${b[Math.floor(n / 10)]}${n % 10 ? " " + a[n % 10] : ""}`);
  const three = (n: number): string => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return `${h ? a[h] + " Hundred" : ""}${r ? (h ? " And " : "") + two(r) : ""}`;
  };
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return `${parts.join(" ").trim()} Only`;
}

export function SalarySlipCustomizerModal({ report, month, onClose, onSuccess }: SalarySlipCustomizerModalProps) {
  const [empName, setEmpName] = useState(report.userName || "");
  const [designation, setDesignation] = useState(report.designation || "Staff Member");
  const [baseSalary, setBaseSalary] = useState<number>(report.baseSalary || 0);
  const [totalDays, setTotalDays] = useState<number>(report.totalDays || 30);
  const [presentDays, setPresentDays] = useState<number>(report.presentDays || 0);
  const [halfDays, setHalfDays] = useState<number>(report.halfDays || 0);
  const [holidayDays, setHolidayDays] = useState<number>(report.holidayDays || 0);
  const [paidLeaveDays, setPaidLeaveDays] = useState<number>(report.paidLeaveDays || 0);
  const [absentDays, setAbsentDays] = useState<number>(report.absentDays || 0);
  
  const [expenses, setExpenses] = useState<number>(report.approvedExpensesTotal || 0);
  const [travelAllowance, setTravelAllowance] = useState<number>(report.travelAllowance || 0);
  
  const [waiveLeaveDeduction, setWaiveLeaveDeduction] = useState(false);
  
  // Custom Earnings & Deductions
  const [customEarnings, setCustomEarnings] = useState<CustomItem[]>([]);
  const [customDeductions, setCustomDeductions] = useState<CustomItem[]>([]);
  
  // Inputs for adding custom items
  const [newEarningName, setNewEarningName] = useState("");
  const [newEarningAmount, setNewEarningAmount] = useState("");

  const [newDeductionName, setNewDeductionName] = useState("");
  const [newDeductionAmount, setNewDeductionAmount] = useState("");

  // Organisation header + bank / trainee details (saved with the slip)
  const [orgName, setOrgName] = useState(report.orgName || report.companyName || "");
  const [orgSubtitle, setOrgSubtitle] = useState(report.orgSubtitle || "");
  const [orgCode, setOrgCode] = useState(report.orgCode || "");
  const [companyCode, setCompanyCode] = useState(report.companyCode || "");
  const [bankName, setBankName] = useState(report.bankName || "");
  const [bankAccountNo, setBankAccountNo] = useState(report.bankAccountNo || "");
  const [ifscCode, setIfscCode] = useState(report.ifscCode || "");
  const [departmentName, setDepartmentName] = useState(report.departmentName || "");
  const [divisionName, setDivisionName] = useState(report.divisionName || "");
  const [traineeType, setTraineeType] = useState(report.traineeType || "");
  const [aadhaarNumber, setAadhaarNumber] = useState(report.aadhaarNumber || "");

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Load existing values if they are stored in the report object (passed from backend)
  React.useEffect(() => {
    if (report.earnings && Array.isArray(report.earnings)) {
      // Parse custom earnings (excluding standard ones)
      const standardLabels = ["Basic Salary", "Travel Allowance", "Reimbursed Expenses"];
      const customEarns = report.earnings
        .filter((e: any) => !standardLabels.includes(e.label))
        .map((e: any) => ({
          id: Math.random().toString(),
          name: e.label,
          amount: Number(e.actual ?? e.calculated ?? 0)
        }));
      setCustomEarnings(customEarns);
      
      const basicSalaryObj = report.earnings.find((e: any) => e.label === "Basic Salary");
      if (basicSalaryObj) {
        setBaseSalary(basicSalaryObj.actual || report.baseSalary);
      }
    }
    if (report.deductions && Array.isArray(report.deductions)) {
      const standardLabels = ["Absence Deduction", "Absence Deductions"];
      const customDeds = report.deductions
        .filter((d: any) => !standardLabels.includes(d.label))
        .map((d: any) => ({
          id: Math.random().toString(),
          name: d.label,
          amount: Number(d.calculated ?? 0)
        }));
      setCustomDeductions(customDeds);
    }
  }, [report]);

  // Live calculations
  const dailySalary = totalDays > 0 ? baseSalary / totalDays : 0;
  
  const calculatedPayableDays = useMemo(() => {
    if (waiveLeaveDeduction) {
      return totalDays;
    }
    return presentDays + (halfDays * 0.5) + holidayDays + paidLeaveDays;
  }, [waiveLeaveDeduction, totalDays, presentDays, halfDays, holidayDays, paidLeaveDays]);

  const netSalary = useMemo(() => {
    return Math.round(calculatedPayableDays * dailySalary);
  }, [calculatedPayableDays, dailySalary]);

  const deductionAmount = useMemo(() => {
    return Math.max(0, baseSalary - netSalary);
  }, [baseSalary, netSalary]);

  const totalEarningsSum = useMemo(() => {
    return customEarnings.reduce((sum, item) => sum + item.amount, 0);
  }, [customEarnings]);

  const totalDeductionsSum = useMemo(() => {
    return customDeductions.reduce((sum, item) => sum + item.amount, 0);
  }, [customDeductions]);

  const totalPayout = useMemo(() => {
    return netSalary + expenses + travelAllowance + totalEarningsSum - totalDeductionsSum;
  }, [netSalary, expenses, travelAllowance, totalEarningsSum, totalDeductionsSum]);

  const addCustomEarning = () => {
    if (!newEarningName.trim() || !newEarningAmount) return;
    const amount = parseFloat(newEarningAmount);
    if (isNaN(amount)) return;
    setCustomEarnings(prev => [...prev, { id: Math.random().toString(), name: newEarningName.trim(), amount }]);
    setNewEarningName("");
    setNewEarningAmount("");
  };

  const deleteCustomEarning = (id: string) => {
    setCustomEarnings(prev => prev.filter(item => item.id !== id));
  };

  const addCustomDeduction = () => {
    if (!newDeductionName.trim() || !newDeductionAmount) return;
    const amount = parseFloat(newDeductionAmount);
    if (isNaN(amount)) return;
    setCustomDeductions(prev => [...prev, { id: Math.random().toString(), name: newDeductionName.trim(), amount }]);
    setNewDeductionName("");
    setNewDeductionAmount("");
  };

  const deleteCustomDeduction = (id: string) => {
    setCustomDeductions(prev => prev.filter(item => item.id !== id));
  };

  const buildEarnings = () => {
    const items: { label: string; actual: number; calculated: number }[] = [];
    items.push({ label: "Basic Salary", actual: baseSalary, calculated: netSalary });
    if (travelAllowance > 0) items.push({ label: "Travel Allowance", actual: travelAllowance, calculated: travelAllowance });
    if (expenses > 0) items.push({ label: "Reimbursed Expenses", actual: expenses, calculated: expenses });
    customEarnings.forEach((e) => items.push({ label: e.name, actual: e.amount, calculated: e.amount }));
    return items;
  };

  const buildDeductions = () => {
    const items: { label: string; calculated: number }[] = [];
    if (!waiveLeaveDeduction && deductionAmount > 0) items.push({ label: "Absence Deduction", calculated: deductionAmount });
    customDeductions.forEach((d) => items.push({ label: d.name, calculated: d.amount }));
    return items;
  };

  const persistSlip = async (status: "DRAFT" | "PUBLISHED") => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveSalarySlip({
        userId: report.userId,
        month: month.month() + 1,
        year: month.year(),
        status,
        orgName,
        orgSubtitle,
        orgCode,
        companyCode,
        bankName,
        bankAccountNo,
        ifscCode,
        departmentName,
        divisionName,
        designation,
        traineeType,
        aadhaarNumber,
        monthDays: totalDays,
        payableDays: calculatedPayableDays,
        earnings: buildEarnings(),
        deductions: buildDeductions()
      });
      setSaveMsg(status === "PUBLISHED" ? "Saved & published to employee" : "Saved as draft");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setSaveMsg(err?.response?.data?.message || "Failed to save salary slip");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const monthName = month.format("MMMM YYYY");
    const earningItems = buildEarnings();
    const deductionItems = buildDeductions();
    const totalEarn = earningItems.reduce((s, e) => s + e.calculated, 0);
    const totalActual = earningItems.reduce((s, e) => s + e.actual, 0);
    const totalDed = deductionItems.reduce((s, d) => s + d.calculated, 0);
    const netPay = Math.round(totalEarn - totalDed);
    const detailRow = (l: string, v: string, l2: string, v2: string) =>
      `<tr><td class="dk">${l}</td><td class="dv">${v || "-"}</td><td class="dk">${l2}</td><td class="dv">${v2 || "-"}</td></tr>`;

    const earnRows = earningItems
      .map(
        (e) =>
          `<tr><td>${e.label}</td><td class="amt">${e.actual.toLocaleString()}</td><td class="amt">${e.calculated.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`
      )
      .join("");
    const dedRows = deductionItems.length
      ? deductionItems
          .map((d) => `<tr><td>${d.label}</td><td class="amt">${d.calculated.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`)
          .join("")
      : `<tr><td>-</td><td class="amt">0.00</td></tr>`;

    const html = `
      <html>
        <head>
          <title>Salary Slip - ${empName}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, 'Inter', sans-serif; padding: 32px; color: #1e293b; line-height: 1.45; font-size: 12px; }
            .org { text-align: center; margin-bottom: 4px; }
            .org h1 { margin: 0; font-size: 18px; font-weight: 800; }
            .org .sub { font-size: 12px; color: #475569; margin-top: 2px; }
            .org .period { font-size: 13px; font-weight: 700; margin-top: 8px; }
            .org .code { font-size: 11px; color: #64748b; margin-top: 2px; }
            .sheet { border: 1px solid #1e293b; margin-top: 14px; }
            .details { width: 100%; border-collapse: collapse; }
            .details td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 11px; }
            .details .dk { background: #f1f5f9; font-weight: 700; width: 18%; text-transform: capitalize; }
            .details .dv { width: 32%; }
            .cols { display: flex; border-top: 2px solid #1e293b; }
            .col { flex: 1; }
            .col + .col { border-left: 1px solid #1e293b; }
            .tbl { width: 100%; border-collapse: collapse; }
            .tbl th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; padding: 6px 10px; border-bottom: 1px solid #cbd5e1; text-align: left; }
            .tbl th.amt, .tbl td.amt { text-align: right; }
            .tbl td { padding: 6px 10px; border-bottom: 1px solid #eef2f6; font-size: 12px; }
            .tbl tr.total td { font-weight: 800; border-top: 2px solid #1e293b; background: #f8fafc; }
            .net { border-top: 2px solid #1e293b; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; }
            .net .lbl { font-size: 14px; font-weight: 800; }
            .net .words { font-size: 11px; color: #475569; font-style: italic; }
            .sysnote { text-align: center; margin-top: 16px; font-size: 10px; color: #64748b; letter-spacing: 0.5px; }
          </style>
        </head>
        <body>
          <div class="org">
            <h1>${orgName || "Company"}</h1>
            ${orgSubtitle ? `<div class="sub">${orgSubtitle}</div>` : ""}
            <div class="period">Salary slip for the month of ${monthName}</div>
            ${orgCode ? `<div class="code">${orgCode}</div>` : ""}
          </div>

          <div class="sheet">
            <table class="details">
              ${detailRow("Company Code", companyCode, "Bank Name", bankName)}
              ${detailRow("Employee Name", empName, "Bank A/C No", bankAccountNo)}
              ${detailRow("Department Name", departmentName, "IFSC Code", ifscCode)}
              ${detailRow("Designation", designation, "Month Days", String(totalDays))}
              ${detailRow("Division Name", divisionName, "Payable Days", String(calculatedPayableDays))}
              ${detailRow("Trainee Type", traineeType, "Aadhaar Number", aadhaarNumber)}
            </table>

            <div class="cols">
              <div class="col">
                <table class="tbl">
                  <thead><tr><th>Earnings</th><th class="amt">Actual</th><th class="amt">Calculated</th></tr></thead>
                  <tbody>
                    ${earnRows}
                    <tr class="total"><td>Total</td><td class="amt">${totalActual.toLocaleString()}</td><td class="amt">${totalEarn.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="col">
                <table class="tbl">
                  <thead><tr><th>Deduction</th><th class="amt">Calculated</th></tr></thead>
                  <tbody>
                    ${dedRows}
                    <tr class="total"><td>Total</td><td class="amt">${totalDed.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="net">
              <div>
                <div class="lbl">Total Net Pay Rs.${netPay.toLocaleString()}/-</div>
                <div class="words">( In Words: ${amountInWords(netPay)} )</div>
              </div>
            </div>
          </div>

          <div class="sysnote">THIS IS SYSTEM GENERATED DOCUMENT, HENCE SIGNATURE IS NOT REQUIRED.</div>

          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[40px] hide-close max-h-[90vh] flex flex-col">
       <DialogHeader className="p-8 bg-slate-900 text-white relative flex-shrink-0">
          <DialogClose className="absolute right-6 top-6 z-50 rounded-2xl bg-white/10 p-2 text-white/50 hover:bg-white/20 hover:text-white transition-all outline-none">
             <X className="h-5 w-5" />
          </DialogClose>
          <div className="relative z-10 flex items-center justify-between">
             <div>
                <h2 className="text-2xl font-black tracking-tight">Salary Slip Customizer</h2>
                <p className="text-slate-400 text-xs font-bold mt-1">
                   Customize earnings, leaves, deductions, and print a custom payslip for {report.userName}.
                </p>
             </div>
          </div>
       </DialogHeader>

       <div className="p-8 space-y-6 overflow-y-auto flex-grow">
          {/* Section 1: Employee and Basic Salary Details */}
          <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
             <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Base Salary & Employee Profile</h3>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Employee Name</label>
                   <Input 
                      value={empName}
                      onChange={e => setEmpName(e.target.value)}
                      className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800"
                   />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Designation</label>
                   <Input 
                      value={designation}
                      onChange={e => setDesignation(e.target.value)}
                      className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800"
                   />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Base Salary (₹)</label>
                   <Input 
                      type="number"
                      value={baseSalary || ""}
                      onChange={e => setBaseSalary(Number(e.target.value))}
                      className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800"
                   />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Month Calendar Days</label>
                   <Input 
                      type="number"
                      value={totalDays || ""}
                      onChange={e => setTotalDays(Number(e.target.value))}
                      className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800"
                   />
                </div>
             </div>
          </div>

          {/* Section 1b: Organisation header + Bank / Trainee details (saved with slip) */}
          <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
             <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Organisation & Bank / Trainee Details</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <DetailInput label="Company / Org Name" value={orgName} onChange={setOrgName} placeholder="e.g. Vaniki Crop Science" />
                <DetailInput label="Org Subtitle" value={orgSubtitle} onChange={setOrgSubtitle} placeholder="e.g. Chemical Crop Care" />
                <DetailInput label="Org Code" value={orgCode} onChange={setOrgCode} placeholder="e.g. Yashaswi Code : 100175394" />
                <DetailInput label="Company Code" value={companyCode} onChange={setCompanyCode} />
                <DetailInput label="Bank Name" value={bankName} onChange={setBankName} />
                <DetailInput label="Bank A/C No" value={bankAccountNo} onChange={setBankAccountNo} />
                <DetailInput label="IFSC Code" value={ifscCode} onChange={setIfscCode} />
                <DetailInput label="Department Name" value={departmentName} onChange={setDepartmentName} />
                <DetailInput label="Division Name" value={divisionName} onChange={setDivisionName} placeholder="e.g. Retail_Chhatisgarh" />
                <DetailInput label="Trainee Type" value={traineeType} onChange={setTraineeType} placeholder="e.g. NAPS" />
                <DetailInput label="Aadhaar Number" value={aadhaarNumber} onChange={setAadhaarNumber} />
             </div>
          </div>

          {/* Section 2: Attendance, Leaves & Absences Override */}
          <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Attendance, Leaves & Absences</h3>
                <label className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-2xl border border-blue-100 cursor-pointer select-none">
                   <input 
                      type="checkbox"
                      checked={waiveLeaveDeduction}
                      onChange={e => setWaiveLeaveDeduction(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                   />
                   <span className="text-xs font-black uppercase tracking-wider">Waive Leave Deductions (Full Pay)</span>
                </label>
             </div>

             <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Present Days</label>
                   <Input 
                      type="number"
                      disabled={waiveLeaveDeduction}
                      value={presentDays || ""}
                      onChange={e => setPresentDays(Number(e.target.value))}
                      className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800 disabled:opacity-50"
                   />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Half Days</label>
                   <Input 
                      type="number"
                      disabled={waiveLeaveDeduction}
                      value={halfDays || ""}
                      onChange={e => setHalfDays(Number(e.target.value))}
                      className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800 disabled:opacity-50"
                   />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Holidays</label>
                   <Input 
                      type="number"
                      disabled={waiveLeaveDeduction}
                      value={holidayDays || ""}
                      onChange={e => setHolidayDays(Number(e.target.value))}
                      className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800 disabled:opacity-50"
                   />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Paid Leaves</label>
                   <Input 
                      type="number"
                      disabled={waiveLeaveDeduction}
                      value={paidLeaveDays || ""}
                      onChange={e => setPaidLeaveDays(Number(e.target.value))}
                      className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800 disabled:opacity-50"
                   />
                </div>
                <div className="col-span-2 sm:col-span-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Unpaid Absences</label>
                   <Input 
                      type="number"
                      disabled={waiveLeaveDeduction}
                      value={absentDays || ""}
                      onChange={e => setAbsentDays(Number(e.target.value))}
                      className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800 disabled:opacity-50"
                   />
                </div>
             </div>
          </div>

          {/* Section 3: Expenses, Travel & Custom Earnings/Deductions CRUD */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Left Column: Earnings & Reimbursements */}
             <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100 flex flex-col">
                <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest">Earnings & Reimbursements</h3>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Approved Expenses (₹)</label>
                      <Input 
                         type="number"
                         value={expenses || ""}
                         onChange={e => setExpenses(Number(e.target.value))}
                         className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Travel Allowance (₹)</label>
                      <Input 
                         type="number"
                         value={travelAllowance || ""}
                         onChange={e => setTravelAllowance(Number(e.target.value))}
                         className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800"
                      />
                   </div>
                 </div>

                 <div className="border-t border-slate-200/60 pt-4 flex-grow flex flex-col space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Add Custom Earnings</p>
                    <div className="flex gap-2">
                       <Input 
                          placeholder="Earning Name (e.g. Bonus)" 
                          value={newEarningName}
                          onChange={e => setNewEarningName(e.target.value)}
                          className="bg-white border-slate-200/80 rounded-xl font-bold text-xs"
                       />
                       <Input 
                          type="number" 
                          placeholder="Amount (₹)" 
                          value={newEarningAmount}
                          onChange={e => setNewEarningAmount(e.target.value)}
                          className="bg-white border-slate-200/80 rounded-xl font-bold text-xs w-28"
                       />
                       <Button onClick={addCustomEarning} variant="secondary" className="rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                          <Plus className="h-4 w-4" />
                       </Button>
                    </div>

                    {/* List of Custom Earnings */}
                    <div className="flex-grow overflow-y-auto max-h-[150px] space-y-2 pt-2">
                       {customEarnings.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">No custom earnings added.</p>
                       ) : (
                          customEarnings.map(item => (
                             <div key={item.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm">
                                <div>
                                   <p className="text-xs font-black text-slate-800">{item.name}</p>
                                   <p className="text-[9px] text-emerald-600 font-bold">+ ₹{item.amount.toLocaleString()}</p>
                                </div>
                                <Button onClick={() => deleteCustomEarning(item.id)} variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg">
                                   <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                             </div>
                          ))
                       )}
                    </div>
                 </div>
              </div>

              {/* Right Column: Deductions */}
              <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100 flex flex-col">
                 <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest">Deductions</h3>
                 <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Leave Absence Deduction</p>
                    <div className="h-10 flex items-center">
                       <span className="text-sm font-black text-rose-500">
                          {waiveLeaveDeduction ? "₹0 (Waived)" : `₹${deductionAmount.toLocaleString()}`}
                       </span>
                    </div>
                 </div>

                 <div className="border-t border-slate-200/60 pt-4 flex-grow flex flex-col space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Add Custom Deductions</p>
                    <div className="flex gap-2">
                       <Input 
                          placeholder="Deduction Name (e.g. Penalty)" 
                          value={newDeductionName}
                          onChange={e => setNewDeductionName(e.target.value)}
                          className="bg-white border-slate-200/80 rounded-xl font-bold text-xs"
                       />
                       <Input 
                          type="number" 
                          placeholder="Amount (₹)" 
                          value={newDeductionAmount}
                          onChange={e => setNewDeductionAmount(e.target.value)}
                          className="bg-white border-slate-200/80 rounded-xl font-bold text-xs w-28"
                       />
                       <Button onClick={addCustomDeduction} variant="secondary" className="rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100">
                          <Plus className="h-4 w-4" />
                       </Button>
                    </div>

                    {/* List of Custom Deductions */}
                    <div className="flex-grow overflow-y-auto max-h-[150px] space-y-2 pt-2">
                       {customDeductions.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">No custom deductions added.</p>
                       ) : (
                          customDeductions.map(item => (
                             <div key={item.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm">
                                <div>
                                   <p className="text-xs font-black text-slate-800">{item.name}</p>
                                   <p className="text-[9px] text-rose-500 font-bold">- ₹{item.amount.toLocaleString()}</p>
                                </div>
                                <Button onClick={() => deleteCustomDeduction(item.id)} variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg">
                                   <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                             </div>
                          ))
                       )}
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Footer Section with Live Payout and Print Trigger */}
        <div className="p-8 bg-slate-900 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6 flex-shrink-0">
           <div className="space-y-1 text-center sm:text-left">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Calculated Payout</p>
              <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                 <span className="text-3xl font-black text-white">₹{totalPayout.toLocaleString()}</span>
                 <span className="text-xs text-blue-400 font-bold">
                    ({calculatedPayableDays} Payable Days)
                 </span>
              </div>
           </div>
           <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
              {saveMsg && (
                 <span className="text-[11px] font-bold text-emerald-400">{saveMsg}</span>
              )}
              <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap justify-end">
                 <Button
                    variant="outline"
                    onClick={onClose}
                    className="h-12 rounded-2xl border-white/10 text-white bg-transparent hover:bg-white/5 font-black uppercase tracking-widest text-xs"
                 >
                    Cancel
                 </Button>
                 <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => persistSlip("DRAFT")}
                    className="h-12 rounded-2xl border-white/10 text-white bg-transparent hover:bg-white/5 font-black uppercase tracking-widest text-xs"
                 >
                    Save Draft
                 </Button>
                 <Button
                    disabled={saving}
                    onClick={() => persistSlip("PUBLISHED")}
                    className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs gap-2"
                 >
                    <CheckCircle2 className="h-4 w-4" /> {saving ? "Saving..." : "Save & Publish"}
                 </Button>
                 <Button
                    onClick={handlePrint}
                    className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs gap-3 shadow-xl shadow-blue-200"
                 >
                    <Printer className="h-4 w-4" /> Print / PDF
                 </Button>
              </div>
           </div>
        </div>
     </DialogContent>
  );
}

function DetailInput({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white border-slate-200/80 rounded-xl font-bold text-slate-800 text-xs"
      />
    </div>
  );
}
