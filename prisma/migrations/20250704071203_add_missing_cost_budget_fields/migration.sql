-- AlterTable
ALTER TABLE "cost_budgets" ADD COLUMN     "cdnBandwidthUsed" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
ADD COLUMN     "cdnRequestsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emergencyMode" BOOLEAN NOT NULL DEFAULT false;
