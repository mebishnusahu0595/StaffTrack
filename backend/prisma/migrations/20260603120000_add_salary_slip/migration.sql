-- CreateEnum
CREATE TYPE "SalarySlipStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "SalarySlip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "SalarySlipStatus" NOT NULL DEFAULT 'DRAFT',
    "orgName" TEXT,
    "orgSubtitle" TEXT,
    "orgCode" TEXT,
    "companyCode" TEXT,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "ifscCode" TEXT,
    "departmentName" TEXT,
    "divisionName" TEXT,
    "designation" TEXT,
    "traineeType" TEXT,
    "aadhaarNumber" TEXT,
    "monthDays" DOUBLE PRECISION,
    "payableDays" DOUBLE PRECISION,
    "earnings" JSONB,
    "deductions" JSONB,
    "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPayWords" TEXT,
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalarySlip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalarySlip_companyId_idx" ON "SalarySlip"("companyId");

-- CreateIndex
CREATE INDEX "SalarySlip_userId_idx" ON "SalarySlip"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SalarySlip_userId_month_year_key" ON "SalarySlip"("userId", "month", "year");

-- AddForeignKey
ALTER TABLE "SalarySlip" ADD CONSTRAINT "SalarySlip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalarySlip" ADD CONSTRAINT "SalarySlip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
