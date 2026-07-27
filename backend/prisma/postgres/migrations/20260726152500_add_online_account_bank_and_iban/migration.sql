-- AlterTable
ALTER TABLE "OnlineAccount" ADD COLUMN     "bankName" TEXT;
ALTER TABLE "OnlineAccount" ADD COLUMN     "iban" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "onlineAccountBank" TEXT;
