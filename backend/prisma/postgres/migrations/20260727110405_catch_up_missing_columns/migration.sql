-- AlterTable
ALTER TABLE "Advance" ADD COLUMN     "transactionId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountPercent" INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "ready" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PendingHandover" ADD COLUMN     "fromRole" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'mid_shift',
ALTER COLUMN "shiftId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "source" TEXT,
ADD COLUMN     "sourceId" TEXT;

-- CreateTable
CREATE TABLE "StockPurchase" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "supplier" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "transactionId" TEXT,
    "createdBy" TEXT,
    "createdByRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockPurchase_date_idx" ON "StockPurchase"("date");

-- CreateIndex
CREATE INDEX "StockPurchase_inventoryItemId_idx" ON "StockPurchase"("inventoryItemId");

-- CreateIndex
CREATE INDEX "PendingHandover_toRole_status_idx" ON "PendingHandover"("toRole", "status");

-- CreateIndex
CREATE INDEX "Transaction_source_sourceId_idx" ON "Transaction"("source", "sourceId");
