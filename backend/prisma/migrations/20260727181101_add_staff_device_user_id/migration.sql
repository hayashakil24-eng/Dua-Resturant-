-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "deviceUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Staff_deviceUserId_key" ON "Staff"("deviceUserId");
