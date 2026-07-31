-- CreateTable
CREATE TABLE "Payable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PayableLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payableId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "notes" TEXT,
    "purchaseId" TEXT,
    "by" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayableLedgerEntry_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "Payable" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockPurchase" (
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
    "paymentStatus" TEXT NOT NULL DEFAULT 'paid',
    "payableId" TEXT,
    "createdBy" TEXT,
    "createdByRole" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_StockPurchase" ("createdAt", "createdBy", "createdByRole", "date", "id", "inventoryItemId", "itemName", "quantity", "supplier", "totalCost", "transactionId", "unit", "unitCost") SELECT "createdAt", "createdBy", "createdByRole", "date", "id", "inventoryItemId", "itemName", "quantity", "supplier", "totalCost", "transactionId", "unit", "unitCost" FROM "StockPurchase";
DROP TABLE "StockPurchase";
ALTER TABLE "new_StockPurchase" RENAME TO "StockPurchase";
CREATE INDEX "StockPurchase_date_idx" ON "StockPurchase"("date");
CREATE INDEX "StockPurchase_inventoryItemId_idx" ON "StockPurchase"("inventoryItemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Payable_status_idx" ON "Payable"("status");

-- CreateIndex
CREATE INDEX "PayableLedgerEntry_payableId_type_idx" ON "PayableLedgerEntry"("payableId", "type");
