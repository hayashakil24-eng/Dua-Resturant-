-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT,
    "systemRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "rejectedBy" TEXT,
    "rejectedAt" DATETIME,
    "rejectReason" TEXT,
    "shift" TEXT,
    "shiftStartTime" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "baseSalary" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Staff" ("active", "baseSalary", "createdAt", "email", "id", "name", "passwordHash", "phone", "role", "shift", "shiftStartTime", "systemRole", "updatedAt", "username") SELECT "active", "baseSalary", "createdAt", "email", "id", "name", "passwordHash", "phone", "role", "shift", "shiftStartTime", "systemRole", "updatedAt", "username" FROM "Staff";
DROP TABLE "Staff";
ALTER TABLE "new_Staff" RENAME TO "Staff";
CREATE UNIQUE INDEX "Staff_username_key" ON "Staff"("username");
CREATE INDEX "Staff_active_idx" ON "Staff"("active");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
