-- AlterTable
ALTER TABLE "Advance" ADD COLUMN "transactionId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "source" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "sourceId" TEXT;

-- CreateTable
CREATE TABLE "StockPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "supplier" TEXT,
    "date" DATETIME NOT NULL,
    "transactionId" TEXT,
    "createdBy" TEXT,
    "createdByRole" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "StockPurchase_date_idx" ON "StockPurchase"("date");

-- CreateIndex
CREATE INDEX "StockPurchase_inventoryItemId_idx" ON "StockPurchase"("inventoryItemId");

-- CreateIndex
CREATE INDEX "Transaction_source_sourceId_idx" ON "Transaction"("source", "sourceId");
