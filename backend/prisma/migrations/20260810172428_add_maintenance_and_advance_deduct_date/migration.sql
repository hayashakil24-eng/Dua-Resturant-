-- AlterTable
ALTER TABLE "Advance" ADD COLUMN "deductFromSalaryDate" DATETIME;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "subCategory" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "vendor" TEXT;
