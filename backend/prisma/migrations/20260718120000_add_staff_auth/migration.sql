-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Staff" ADD COLUMN "systemRole" TEXT;
ALTER TABLE "Staff" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Staff_username_key" ON "Staff"("username");
