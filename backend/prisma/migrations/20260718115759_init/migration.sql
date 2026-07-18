-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "shift" TEXT,
    "shiftStartTime" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "baseSalary" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "checkIn" DATETIME,
    "checkOut" DATETIME,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'machine',
    "manualBy" TEXT,
    "manualByRole" TEXT,
    "manualReason" TEXT,
    "manualNotes" TEXT,
    "manualAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Advance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cost" INTEGER,
    "costEstimated" BOOLEAN NOT NULL DEFAULT true,
    "reusable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "departmentId" TEXT,
    CONSTRAINT "MenuItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItemVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "cost" INTEGER,
    "costEstimated" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "MenuItemVariant_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameUrdu" TEXT,
    "description" TEXT,
    "manager" TEXT,
    "managerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MostOrderedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "addedBy" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MostOrderedItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameUr" TEXT,
    "category" TEXT NOT NULL,
    "stock" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "threshold" REAL NOT NULL DEFAULT 0,
    "costPerUnit" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "menuItemName" TEXT NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdBy" TEXT,
    "createdByRole" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "rejectedBy" TEXT,
    "rejectedAt" DATETIME,
    "rejectReason" TEXT,
    CONSTRAINT "Recipe_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "costPerUnit" INTEGER NOT NULL,
    "lineCost" INTEGER NOT NULL,
    CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeIngredient_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IngredientRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "baseUnit" TEXT,
    "initialStock" REAL,
    "threshold" REAL,
    "rejectedBy" TEXT,
    "rejectedAt" DATETIME,
    "rejectReason" TEXT,
    "inventoryItemId" TEXT
);

-- CreateTable
CREATE TABLE "Table" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 0,
    "orderType" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Sequence" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" INTEGER NOT NULL,
    "table" INTEGER NOT NULL,
    "waiter" TEXT,
    "payment" TEXT NOT NULL DEFAULT 'Unpaid',
    "method" TEXT NOT NULL DEFAULT '—',
    "onlineAccountId" TEXT,
    "onlineAccountName" TEXT,
    "onlineAccountType" TEXT,
    "gstRate" REAL NOT NULL DEFAULT 0,
    "kitchen" TEXT NOT NULL DEFAULT 'Pending',
    "shiftId" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancellationReason" TEXT,
    "cancellationNotes" TEXT,
    "cancellationBy" TEXT,
    "cancellationRole" TEXT,
    "cancellationAt" DATETIME,
    "materialLoss" INTEGER,
    "discountAmount" INTEGER,
    "discountReason" TEXT,
    "discountNotes" TEXT,
    "discountBy" TEXT,
    "discountRole" TEXT,
    "discountAt" DATETIME,
    "udhaarCustomerName" TEXT,
    "udhaarAccountId" TEXT,
    "udhaarAt" DATETIME,
    "udhaarBy" TEXT,
    "complimentaryReason" TEXT,
    "complimentaryOrderedBy" TEXT,
    "complimentaryOrderedByRole" TEXT,
    "complimentaryApprovedBy" TEXT,
    "complimentaryAt" DATETIME,
    "complimentaryBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "ShiftReconciliation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
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
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftReconciliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cashierName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "shiftStartTime" DATETIME NOT NULL,
    "shiftEndTime" DATETIME,
    "openingCash" INTEGER NOT NULL,
    "totalCashSales" INTEGER NOT NULL DEFAULT 0,
    "totalCardSales" INTEGER NOT NULL DEFAULT 0,
    "expectedCash" INTEGER NOT NULL,
    "actualCash" INTEGER,
    "difference" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "pausedAt" DATETIME,
    "resumedAt" DATETIME,
    "resumeCount" INTEGER NOT NULL DEFAULT 0,
    "handedTo" TEXT,
    "handedToName" TEXT,
    "handoverReason" TEXT,
    "staffId" TEXT,
    CONSTRAINT "ShiftReconciliation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingHandover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "toName" TEXT NOT NULL,
    "toRole" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "initiatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "rejectReason" TEXT,
    CONSTRAINT "PendingHandover_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "ShiftReconciliation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "txnNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Receivable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'customer',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReceivableLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receivableId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "notes" TEXT,
    "orderId" TEXT,
    "by" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReceivableLedgerEntry_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "gstEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gstRate" REAL NOT NULL DEFAULT 0.05,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OnlineAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "DailyClosing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "closedBy" TEXT NOT NULL,
    "closedByRole" TEXT NOT NULL,
    "closingTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalSales" INTEGER NOT NULL,
    "reportJson" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "role" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffId" TEXT,
    "detailsJson" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "AuditLogEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Staff_active_idx" ON "Staff"("active");

-- CreateIndex
CREATE INDEX "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_staffId_date_key" ON "AttendanceRecord"("staffId", "date");

-- CreateIndex
CREATE INDEX "Advance_staffId_status_idx" ON "Advance"("staffId", "status");

-- CreateIndex
CREATE INDEX "MenuItem_category_idx" ON "MenuItem"("category");

-- CreateIndex
CREATE INDEX "MenuItem_departmentId_idx" ON "MenuItem"("departmentId");

-- CreateIndex
CREATE INDEX "MenuItemVariant_menuItemId_idx" ON "MenuItemVariant"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MostOrderedItem_menuItemId_key" ON "MostOrderedItem"("menuItemId");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE INDEX "Recipe_menuItemId_status_idx" ON "Recipe"("menuItemId", "status");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "IngredientRequest_status_idx" ON "IngredientRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_payment_cancelled_idx" ON "Order"("payment", "cancelled");

-- CreateIndex
CREATE INDEX "Order_shiftId_idx" ON "Order"("shiftId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- CreateIndex
CREATE INDEX "ShiftReconciliation_status_idx" ON "ShiftReconciliation"("status");

-- CreateIndex
CREATE INDEX "PendingHandover_shiftId_status_idx" ON "PendingHandover"("shiftId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txnNumber_key" ON "Transaction"("txnNumber");

-- CreateIndex
CREATE INDEX "Transaction_type_date_idx" ON "Transaction"("type", "date");

-- CreateIndex
CREATE INDEX "Receivable_status_idx" ON "Receivable"("status");

-- CreateIndex
CREATE INDEX "ReceivableLedgerEntry_receivableId_type_idx" ON "ReceivableLedgerEntry"("receivableId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineAccount_name_key" ON "OnlineAccount"("name");

-- CreateIndex
CREATE INDEX "DailyClosing_date_idx" ON "DailyClosing"("date");

-- CreateIndex
CREATE INDEX "AuditLogEntry_action_idx" ON "AuditLogEntry"("action");

-- CreateIndex
CREATE INDEX "AuditLogEntry_at_idx" ON "AuditLogEntry"("at");
