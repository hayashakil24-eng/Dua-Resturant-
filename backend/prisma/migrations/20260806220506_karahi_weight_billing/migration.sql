-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'pcs';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "variantLabel" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "addedAt" DATETIME,
    "cost" INTEGER,
    "costEstimated" BOOLEAN,
    "portion" REAL NOT NULL DEFAULT 1,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancellationReason" TEXT,
    "cancellationNotes" TEXT,
    "cancellationBy" TEXT,
    "cancellationRole" TEXT,
    "cancellationAt" DATETIME,
    "materialLoss" INTEGER,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("id", "orderId", "menuItemId", "variantLabel", "name", "price", "qty", "addedAt", "cost", "costEstimated", "portion", "ready", "cancelled", "cancellationReason", "cancellationNotes", "cancellationBy", "cancellationRole", "cancellationAt", "materialLoss") SELECT "id", "orderId", "menuItemId", "variantLabel", "name", "price", "qty", "addedAt", "cost", "costEstimated", "portion", "ready", "cancelled", "cancellationReason", "cancellationNotes", "cancellationBy", "cancellationRole", "cancellationAt", "materialLoss" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
