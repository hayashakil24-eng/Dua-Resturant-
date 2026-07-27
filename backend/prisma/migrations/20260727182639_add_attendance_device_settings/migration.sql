PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "gstEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gstRate" REAL NOT NULL DEFAULT 0.05,
    "whatsappReportEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappReportHour" INTEGER NOT NULL DEFAULT 23,
    "whatsappReportRecipient" TEXT,
    "whatsappReportLastSentClosingId" TEXT,
    "attendanceDeviceIp" TEXT,
    "attendanceDevicePort" INTEGER NOT NULL DEFAULT 4370,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppSettings" ("gstEnabled", "gstRate", "id", "updatedAt", "whatsappReportEnabled", "whatsappReportHour", "whatsappReportLastSentClosingId", "whatsappReportRecipient") SELECT "gstEnabled", "gstRate", "id", "updatedAt", "whatsappReportEnabled", "whatsappReportHour", "whatsappReportLastSentClosingId", "whatsappReportRecipient" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
