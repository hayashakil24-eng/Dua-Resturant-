-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "deviceUserId" TEXT;

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "attendanceDeviceIp" TEXT,
ADD COLUMN     "attendanceDevicePort" INTEGER NOT NULL DEFAULT 4370;

-- CreateIndex
CREATE UNIQUE INDEX "Staff_deviceUserId_key" ON "Staff"("deviceUserId");
