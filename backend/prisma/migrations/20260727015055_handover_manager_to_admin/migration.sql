-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingHandover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT,
    "fromName" TEXT NOT NULL,
    "fromRole" TEXT,
    "toName" TEXT NOT NULL,
    "toRole" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "kind" TEXT NOT NULL DEFAULT 'mid_shift',
    "initiatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "rejectReason" TEXT,
    CONSTRAINT "PendingHandover_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "ShiftReconciliation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PendingHandover" ("amount", "fromName", "id", "initiatedAt", "kind", "reason", "rejectReason", "resolvedAt", "resolvedBy", "shiftId", "status", "toName", "toRole") SELECT "amount", "fromName", "id", "initiatedAt", "kind", "reason", "rejectReason", "resolvedAt", "resolvedBy", "shiftId", "status", "toName", "toRole" FROM "PendingHandover";
DROP TABLE "PendingHandover";
ALTER TABLE "new_PendingHandover" RENAME TO "PendingHandover";
CREATE INDEX "PendingHandover_shiftId_status_idx" ON "PendingHandover"("shiftId", "status");
CREATE INDEX "PendingHandover_toRole_status_idx" ON "PendingHandover"("toRole", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
