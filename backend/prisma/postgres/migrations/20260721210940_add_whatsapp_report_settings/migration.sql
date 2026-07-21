-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "whatsappReportEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappReportHour" INTEGER NOT NULL DEFAULT 23,
ADD COLUMN     "whatsappReportLastSentClosingId" TEXT,
ADD COLUMN     "whatsappReportRecipient" TEXT;

