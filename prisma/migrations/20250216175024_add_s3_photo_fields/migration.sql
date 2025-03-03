/*
  Warnings:

  - You are about to drop the column `google_data` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `scraped_data` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `yelp_data` on the `businesses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone_number]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "businesses" DROP COLUMN "google_data",
DROP COLUMN "scraped_data",
DROP COLUMN "yelp_data",
ADD COLUMN     "operating_hours" TEXT,
ADD COLUMN     "phone_number" VARCHAR(30);

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "format" TEXT,
ADD COLUMN     "lastProcessed" TIMESTAMP(3),
ADD COLUMN     "processingTime" DOUBLE PRECISION,
ADD COLUMN     "s3Key" TEXT,
ADD COLUMN     "s3KeyLarge" TEXT,
ADD COLUMN     "s3KeyMedium" TEXT,
ADD COLUMN     "s3KeySmall" TEXT,
ADD COLUMN     "s3KeyThumbnail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "businesses_phone_number_key" ON "businesses"("phone_number");
