-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "hireDate" DATETIME;

-- CreateTable
CREATE TABLE "SalaryPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL,
    "paidBy" TEXT NOT NULL,
    "paidByRole" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryPayment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPayment_staffId_year_month_key" ON "SalaryPayment"("staffId", "year", "month");
