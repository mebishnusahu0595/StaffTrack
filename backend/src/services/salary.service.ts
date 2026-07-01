import { Prisma, SalarySlipStatus, UserRole } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { forbidden, notFound } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { ensureCanAccessUser } from "./access.service";

export interface EarningItem {
  label: string;
  actual?: number;
  calculated?: number;
}

export interface DeductionItem {
  label: string;
  calculated?: number;
}

export interface SalarySlipInput {
  userId: string;
  month: number;
  year: number;
  status?: SalarySlipStatus;
  orgName?: string;
  orgSubtitle?: string;
  orgCode?: string;
  companyCode?: string;
  bankName?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  departmentName?: string;
  divisionName?: string;
  designation?: string;
  traineeType?: string;
  aadhaarNumber?: string;
  monthDays?: number;
  payableDays?: number;
  earnings?: EarningItem[];
  deductions?: DeductionItem[];
  remarks?: string;
  logoUrl?: string;
}

const slipInclude = {
  user: { select: { id: true, name: true, email: true, designation: true, managerId: true } },
  company: { select: { id: true, name: true } }
} satisfies Prisma.SalarySlipInclude;

function netFromItems(earnings: EarningItem[], deductions: DeductionItem[]) {
  const earn = earnings.reduce((s, e) => s + Number(e.calculated ?? e.actual ?? 0), 0);
  const ded = deductions.reduce((s, d) => s + Number(d.calculated ?? 0), 0);
  return Math.round((earn - ded) * 100) / 100;
}

/** Only admins and a manager (for their own team) may build/edit slips. */
async function ensureCanManageSlipFor(actor: AuthUser, userId: string) {
  if (actor.role === UserRole.EMPLOYEE) {
    forbidden("Employees cannot create salary slips");
  }
  await ensureCanAccessUser(actor, userId);
}

export async function upsertSalarySlip(actor: AuthUser, input: SalarySlipInput) {
  await ensureCanManageSlipFor(actor, input.userId);

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { companyId: true }
  });
  if (!target) notFound("Employee not found");

  const earnings = input.earnings ?? [];
  const deductions = input.deductions ?? [];
  const netPay = netFromItems(earnings, deductions);

  const data = {
    companyId: target.companyId,
    status: input.status ?? SalarySlipStatus.DRAFT,
    orgName: input.orgName,
    orgSubtitle: input.orgSubtitle,
    orgCode: input.orgCode,
    logoUrl: input.logoUrl,
    companyCode: input.companyCode,
    bankName: input.bankName,
    bankAccountNo: input.bankAccountNo,
    ifscCode: input.ifscCode,
    departmentName: input.departmentName,
    divisionName: input.divisionName,
    designation: input.designation,
    traineeType: input.traineeType,
    aadhaarNumber: input.aadhaarNumber,
    monthDays: input.monthDays,
    payableDays: input.payableDays,
    earnings: earnings as unknown as Prisma.InputJsonValue,
    deductions: deductions as unknown as Prisma.InputJsonValue,
    netPay,
    netPayWords: amountInWords(netPay),
    remarks: input.remarks,
    createdById: actor.id
  };

  const result = await prisma.salarySlip.upsert({
    where: { userId_month_year: { userId: input.userId, month: input.month, year: input.year } },
    create: { userId: input.userId, month: input.month, year: input.year, ...data },
    update: data,
    include: slipInclude
  });

  return ensureDefaultFields(result);
}

export async function listSalarySlips(actor: AuthUser, filter: { userId?: string; month?: number; year?: number }) {
  const where: Prisma.SalarySlipWhereInput = {
    ...(filter.month && { month: filter.month }),
    ...(filter.year && { year: filter.year })
  };

  if (actor.role === UserRole.EMPLOYEE) {
    // Employees only ever see their own PUBLISHED slips.
    where.userId = actor.id;
    where.status = SalarySlipStatus.PUBLISHED;
  } else if (actor.role === UserRole.MANAGER) {
    const scope: Prisma.SalarySlipWhereInput = {
      companyId: actor.companyId,
      user: { OR: [{ id: actor.id }, { managerId: actor.id }] }
    };
    where.AND = filter.userId ? [scope, { userId: filter.userId }] : [scope];
  } else {
    where.companyId = actor.companyId;
    if (filter.userId) where.userId = filter.userId;
  }

  const slips = await prisma.salarySlip.findMany({
    where,
    include: slipInclude,
    orderBy: [{ year: "desc" }, { month: "desc" }]
  });

  return slips.map(s => ensureDefaultFields(s));
}

export async function getSalarySlip(actor: AuthUser, id: string) {
  const slip = await prisma.salarySlip.findUnique({ where: { id }, include: slipInclude });
  if (!slip) notFound("Salary slip not found");

  if (actor.role === UserRole.EMPLOYEE) {
    if (slip.userId !== actor.id || slip.status !== SalarySlipStatus.PUBLISHED) {
      forbidden("You can only view your own published salary slips");
    }
  } else {
    await ensureCanAccessUser(actor, slip.userId);
  }
  return ensureDefaultFields(slip);
}

export async function setSalarySlipStatus(actor: AuthUser, id: string, status: SalarySlipStatus) {
  const slip = await prisma.salarySlip.findUnique({ where: { id }, select: { userId: true } });
  if (!slip) notFound("Salary slip not found");
  await ensureCanManageSlipFor(actor, slip.userId);
  const result = await prisma.salarySlip.update({ where: { id }, data: { status }, include: slipInclude });
  return ensureDefaultFields(result);
}

export async function deleteSalarySlip(actor: AuthUser, id: string) {
  const slip = await prisma.salarySlip.findUnique({ where: { id }, select: { userId: true } });
  if (!slip) notFound("Salary slip not found");
  await ensureCanManageSlipFor(actor, slip.userId);
  return prisma.salarySlip.delete({ where: { id } });
}

/** Indian-style amount in words, e.g. 25133 -> "Twenty Five Thousand One Hundred And Thirty Three Only". */
export function amountInWords(value: number): string {
  const num = Math.floor(Math.abs(value));
  if (num === 0) return "Zero Only";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const twoDigits = (n: number): string => {
    if (n < 20) return a[n];
    return `${b[Math.floor(n / 10)]}${n % 10 ? " " + a[n % 10] : ""}`;
  };
  const threeDigits = (n: number): string => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let str = "";
    if (hundred) str += `${a[hundred]} Hundred`;
    if (rest) str += `${hundred ? " And " : ""}${twoDigits(rest)}`;
    return str;
  };

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));

  return `${parts.join(" ").trim()} Only`;
}

export function ensureDefaultFields<T>(slip: T): T {
  if (!slip) return slip;
  
  const defaultEarnings = [
    "Basic Salary",
    "HR Allowance",
    "Special Allowance",
    "Medical Allowance",
    "Daily Allowance",
    "Incentive"
  ];

  const defaultDeductions = [
    "PF Contribution",
    "LWP/Leave"
  ];

  const s = slip as any;
  let currentEarnings: any[] = [];
  if (s.earnings && Array.isArray(s.earnings)) {
    currentEarnings = [...s.earnings];
  } else {
    currentEarnings = [{ label: "Basic Salary", actual: s.netPay || 0, calculated: s.netPay || 0 }];
  }

  const completedEarnings: any[] = [];
  for (const label of defaultEarnings) {
    const existing = currentEarnings.find(e => e.label?.toLowerCase() === label.toLowerCase());
    if (existing) {
      completedEarnings.push(existing);
    } else {
      completedEarnings.push({ label, actual: 0, calculated: 0 });
    }
  }

  for (const e of currentEarnings) {
    const isDefault = defaultEarnings.some(d => d.toLowerCase() === e.label?.toLowerCase());
    if (!isDefault) {
      completedEarnings.push(e);
    }
  }

  let currentDeductions: any[] = [];
  if (s.deductions && Array.isArray(s.deductions)) {
    currentDeductions = [...s.deductions];
  }

  const completedDeductions: any[] = [];
  for (const label of defaultDeductions) {
    const existing = currentDeductions.find(d => 
      d.label?.toLowerCase() === label.toLowerCase() || 
      (label === "LWP/Leave" && d.label?.toLowerCase() === "absence deduction") || 
      (label === "LWP/Leave" && d.label?.toLowerCase() === "absence deductions")
    );
    if (existing) {
      completedDeductions.push({ label: existing.label, calculated: existing.calculated || 0 });
    } else {
      completedDeductions.push({ label, calculated: 0 });
    }
  }

  for (const d of currentDeductions) {
    const isDefault = defaultDeductions.some(def => 
      def.toLowerCase() === d.label?.toLowerCase() || 
      (def === "LWP/Leave" && d.label?.toLowerCase() === "absence deduction") ||
      (def === "LWP/Leave" && d.label?.toLowerCase() === "absence deductions")
    );
    if (!isDefault) {
      completedDeductions.push(d);
    }
  }

  s.earnings = completedEarnings;
  s.deductions = completedDeductions;
  return s;
}
