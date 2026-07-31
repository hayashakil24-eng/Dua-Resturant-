-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "cancelled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "cancellationNotes" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "cancellationBy" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "cancellationRole" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "cancellationAt" TIMESTAMP(3);
ALTER TABLE "OrderItem" ADD COLUMN "materialLoss" INTEGER;
