-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyClosing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "closedBy" TEXT NOT NULL,
    "closedByRole" TEXT NOT NULL,
    "closingTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalSales" INTEGER NOT NULL,
    "reportJson" TEXT NOT NULL,
    "carriedCash" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_DailyClosing" ("closedBy", "closedByRole", "closingTime", "date", "id", "reportJson", "totalSales") SELECT "closedBy", "closedByRole", "closingTime", "date", "id", "reportJson", "totalSales" FROM "DailyClosing";
DROP TABLE "DailyClosing";
ALTER TABLE "new_DailyClosing" RENAME TO "DailyClosing";
CREATE INDEX "DailyClosing_date_idx" ON "DailyClosing"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
