/*
  Warnings:

  - You are about to drop the column `phone_number` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `businesses` table. All the data in the column will be lost.
  - The `operating_hours` column on the `businesses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `fileSize` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `lastProcessed` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `processingTime` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `s3Key` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `s3KeyLarge` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `s3KeyMedium` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `s3KeySmall` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `s3KeyThumbnail` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the `deal_info` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "deal_info" DROP CONSTRAINT "deal_info_business_id_fkey";

-- DropIndex
DROP INDEX "api_data_google_id_key";

-- DropIndex
DROP INDEX "api_data_yelp_id_key";

-- DropIndex
DROP INDEX "businesses_id_key";

-- DropIndex
DROP INDEX "businesses_phone_number_key";

-- DropIndex
DROP INDEX "photos_id_key";

-- DropIndex
DROP INDEX "user_comments_id_key";

-- DropIndex
DROP INDEX "user_preferences_id_key";

-- DropIndex
DROP INDEX "user_votes_id_key";

-- DropIndex
DROP INDEX "users_id_key";

-- AlterTable
ALTER TABLE "businesses" DROP COLUMN "phone_number",
DROP COLUMN "url",
ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "last_analyzed" TIMESTAMP(3),
ADD COLUMN     "normalized_address" TEXT,
ADD COLUMN     "normalized_name" TEXT,
ADD COLUMN     "normalized_phone" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "website" TEXT,
DROP COLUMN "operating_hours",
ADD COLUMN     "operating_hours" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "photos" DROP COLUMN "fileSize",
DROP COLUMN "lastProcessed",
DROP COLUMN "processingTime",
DROP COLUMN "s3Key",
DROP COLUMN "s3KeyLarge",
DROP COLUMN "s3KeyMedium",
DROP COLUMN "s3KeySmall",
DROP COLUMN "s3KeyThumbnail",
ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "last_processed" TIMESTAMP(3),
ADD COLUMN     "processing_time" DOUBLE PRECISION,
ADD COLUMN     "s3_key" TEXT,
ADD COLUMN     "s3_key_large" TEXT,
ADD COLUMN     "s3_key_medium" TEXT,
ADD COLUMN     "s3_key_small" TEXT,
ADD COLUMN     "s3_key_thumbnail" TEXT;

-- DropTable
DROP TABLE "deal_info";

-- CreateTable
CREATE TABLE "source_businesses" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "raw_data" JSONB NOT NULL,
    "last_fetched" TIMESTAMP(3) NOT NULL,
    "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_on" TIMESTAMP(3),
    "updated_by" INTEGER,
    "deleted_on" TIMESTAMP(3),
    "deleted_by" INTEGER,

    CONSTRAINT "source_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "day_of_week" INTEGER,
    "start_time" TEXT,
    "end_time" TEXT,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "extracted_by" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source_text" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_on" TIMESTAMP(3),
    "updated_by" INTEGER,
    "deleted_on" TIMESTAMP(3),
    "deleted_by" INTEGER,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "s3_operations" (
    "id" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "bytes" INTEGER,
    "businessId" TEXT,
    "photoId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "s3_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_budgets" (
    "id" TEXT NOT NULL,
    "monthYear" TEXT NOT NULL,
    "totalBudget" DOUBLE PRECISION NOT NULL DEFAULT 20.00,
    "currentSpent" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    "alertThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.80,
    "emergencyThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "maxRequestsPerHour" INTEGER NOT NULL DEFAULT 1000,
    "maxRequestsPerDay" INTEGER NOT NULL DEFAULT 10000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "budgetExceeded" BOOLEAN NOT NULL DEFAULT false,
    "alertSent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_businesses_business_id_idx" ON "source_businesses"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "source_businesses_source_source_id_key" ON "source_businesses"("source", "source_id");

-- CreateIndex
CREATE INDEX "deals_is_active_day_of_week_idx" ON "deals"("is_active", "day_of_week");

-- CreateIndex
CREATE INDEX "deals_business_id_is_active_idx" ON "deals"("business_id", "is_active");

-- CreateIndex
CREATE INDEX "s3_operations_created_at_idx" ON "s3_operations"("created_at");

-- CreateIndex
CREATE INDEX "s3_operations_operationType_idx" ON "s3_operations"("operationType");

-- CreateIndex
CREATE INDEX "s3_operations_businessId_idx" ON "s3_operations"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_budgets_monthYear_key" ON "cost_budgets"("monthYear");

-- CreateIndex
CREATE INDEX "cost_budgets_monthYear_idx" ON "cost_budgets"("monthYear");

-- CreateIndex
CREATE INDEX "businesses_normalized_name_idx" ON "businesses"("normalized_name");

-- CreateIndex
CREATE INDEX "businesses_domain_idx" ON "businesses"("domain");

-- CreateIndex
CREATE INDEX "businesses_normalized_phone_idx" ON "businesses"("normalized_phone");

-- AddForeignKey
ALTER TABLE "source_businesses" ADD CONSTRAINT "source_businesses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "s3_operations" ADD CONSTRAINT "s3_operations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
