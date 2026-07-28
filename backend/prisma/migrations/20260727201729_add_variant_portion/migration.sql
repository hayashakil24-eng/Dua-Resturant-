-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItemVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "cost" INTEGER,
    "costEstimated" BOOLEAN NOT NULL DEFAULT true,
    "portion" REAL NOT NULL DEFAULT 1,
    CONSTRAINT "MenuItemVariant_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MenuItemVariant" ("cost", "costEstimated", "id", "label", "menuItemId", "price") SELECT "cost", "costEstimated", "id", "label", "menuItemId", "price" FROM "MenuItemVariant";
DROP TABLE "MenuItemVariant";
ALTER TABLE "new_MenuItemVariant" RENAME TO "MenuItemVariant";
CREATE INDEX "MenuItemVariant_menuItemId_idx" ON "MenuItemVariant"("menuItemId");
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "variantLabel" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "addedAt" DATETIME,
    "cost" INTEGER,
    "costEstimated" BOOLEAN,
    "portion" REAL NOT NULL DEFAULT 1,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("addedAt", "cost", "costEstimated", "id", "menuItemId", "name", "orderId", "price", "qty", "ready", "variantLabel") SELECT "addedAt", "cost", "costEstimated", "id", "menuItemId", "name", "orderId", "price", "qty", "ready", "variantLabel" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
