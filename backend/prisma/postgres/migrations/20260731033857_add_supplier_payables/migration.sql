-- CreateTable
CREATE TABLE "Payable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayableLedgerEntry" (
    "id" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "notes" TEXT,
    "purchaseId" TEXT,
    "by" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayableLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payable_status_idx" ON "Payable"("status");

-- CreateIndex
CREATE INDEX "PayableLedgerEntry_payableId_type_idx" ON "PayableLedgerEntry"("payableId", "type");

-- AlterTable
ALTER TABLE "StockPurchase" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE "StockPurchase" ADD COLUMN "payableId" TEXT;

-- AddForeignKey
ALTER TABLE "PayableLedgerEntry" ADD CONSTRAINT "PayableLedgerEntry_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "Payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
