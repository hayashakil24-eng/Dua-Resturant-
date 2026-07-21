-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "gstEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gstRate" REAL NOT NULL DEFAULT 0.05,
    "whatsappReportEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappReportHour" INTEGER NOT NULL DEFAULT 23,
    "whatsappReportRecipient" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppSettings" ("gstEnabled", "gstRate", "id", "updatedAt") SELECT "gstEnabled", "gstRate", "id", "updatedAt" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
