-- AlterTable
ALTER TABLE "Advance" ADD COLUMN     "deductFromSalaryDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "subCategory" TEXT,
ADD COLUMN     "vendor" TEXT;
