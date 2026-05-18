-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('OFFICE', 'FIELD');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "workMode" "WorkMode" NOT NULL DEFAULT 'FIELD';
