/*
  Warnings:

  - You are about to drop the column `createdBy` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `createdOn` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `deletedOn` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `updatedOn` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `createdOn` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `deletedOn` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `updatedOn` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `createdOn` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `deletedOn` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `googleData` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `isBar` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `isRestaurant` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `placeId` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `priceLevel` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `ratingGoogle` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `ratingOverall` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `ratingYelp` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `scrapedData` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `updatedOn` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `yelpData` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `yelpId` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `businessId` on the `deal_info` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `deal_info` table. All the data in the column will be lost.
  - You are about to drop the column `createdOn` on the `deal_info` table. All the data in the column will be lost.
  - You are about to drop the column `dayOfWeek` on the `deal_info` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `deal_info` table. All the data in the column will be lost.
  - You are about to drop the column `deletedOn` on the `deal_info` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `deal_info` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `deal_info` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `deal_info` table. All the data in the column will be lost.
  - You are about to drop the column `updatedOn` on the `deal_info` table. All the data in the column will be lost.
  - You are about to drop the column `businessId` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `createdOn` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `deletedOn` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `lastFetched` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `mainPhoto` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `sourceId` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `updatedOn` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `businessId` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `createdOn` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `deletedOn` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `updatedOn` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `createdOn` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `deletedOn` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `updatedOn` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `businessId` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `createdOn` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `deletedOn` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `updatedOn` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `accountType` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `createdOn` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `dateOfBirth` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `deletedOn` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastLogin` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updatedOn` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[place_id]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[yelp_id]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[business_id,source_id]` on the table `photos` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id]` on the table `user_preferences` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone_number]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `business_id` to the `deal_info` table without a default value. This is not possible if the table is not empty.
  - Added the required column `day_of_week` to the `deal_info` table without a default value. This is not possible if the table is not empty.
  - Added the required column `end_time` to the `deal_info` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_time` to the `deal_info` table without a default value. This is not possible if the table is not empty.
  - Added the required column `business_id` to the `photos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source_id` to the `photos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `business_id` to the `user_comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `user_comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `user_preferences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `business_id` to the `user_votes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `user_votes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `first_name` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "businesses" DROP CONSTRAINT "businesses_userId_fkey";

-- DropForeignKey
ALTER TABLE "deal_info" DROP CONSTRAINT "deal_info_businessId_fkey";

-- DropForeignKey
ALTER TABLE "photos" DROP CONSTRAINT "photos_businessId_fkey";

-- DropForeignKey
ALTER TABLE "user_comments" DROP CONSTRAINT "user_comments_businessId_fkey";

-- DropForeignKey
ALTER TABLE "user_comments" DROP CONSTRAINT "user_comments_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_votes" DROP CONSTRAINT "user_votes_businessId_fkey";

-- DropForeignKey
ALTER TABLE "user_votes" DROP CONSTRAINT "user_votes_userId_fkey";

-- DropIndex
DROP INDEX "businesses_isBar_isRestaurant_idx";

-- DropIndex
DROP INDEX "businesses_placeId_key";

-- DropIndex
DROP INDEX "businesses_userId_key";

-- DropIndex
DROP INDEX "businesses_yelpId_key";

-- DropIndex
DROP INDEX "deal_info_businessId_dayOfWeek_idx";

-- DropIndex
DROP INDEX "photos_businessId_idx";

-- DropIndex
DROP INDEX "photos_businessId_sourceId_key";

-- DropIndex
DROP INDEX "photos_mainPhoto_idx";

-- DropIndex
DROP INDEX "user_preferences_userId_key";

-- DropIndex
DROP INDEX "users_phoneNumber_key";

-- AlterTable
ALTER TABLE "api_data_google" DROP COLUMN "createdBy",
DROP COLUMN "createdOn",
DROP COLUMN "deletedBy",
DROP COLUMN "deletedOn",
DROP COLUMN "updatedBy",
DROP COLUMN "updatedOn",
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "deleted_on" TIMESTAMP(3),
ADD COLUMN     "updated_by" INTEGER,
ADD COLUMN     "updated_on" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "api_data_yelp" DROP COLUMN "createdBy",
DROP COLUMN "createdOn",
DROP COLUMN "deletedBy",
DROP COLUMN "deletedOn",
DROP COLUMN "updatedBy",
DROP COLUMN "updatedOn",
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "deleted_on" TIMESTAMP(3),
ADD COLUMN     "updated_by" INTEGER,
ADD COLUMN     "updated_on" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "businesses" DROP COLUMN "createdBy",
DROP COLUMN "createdOn",
DROP COLUMN "deletedBy",
DROP COLUMN "deletedOn",
DROP COLUMN "googleData",
DROP COLUMN "isBar",
DROP COLUMN "isRestaurant",
DROP COLUMN "placeId",
DROP COLUMN "priceLevel",
DROP COLUMN "ratingGoogle",
DROP COLUMN "ratingOverall",
DROP COLUMN "ratingYelp",
DROP COLUMN "scrapedData",
DROP COLUMN "updatedBy",
DROP COLUMN "updatedOn",
DROP COLUMN "userId",
DROP COLUMN "yelpData",
DROP COLUMN "yelpId",
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "deleted_on" TIMESTAMP(3),
ADD COLUMN     "google_data" JSONB,
ADD COLUMN     "is_bar" BOOLEAN DEFAULT false,
ADD COLUMN     "is_restaurant" BOOLEAN DEFAULT false,
ADD COLUMN     "place_id" TEXT,
ADD COLUMN     "price_level" INTEGER,
ADD COLUMN     "rating_google" DOUBLE PRECISION,
ADD COLUMN     "rating_overall" DOUBLE PRECISION,
ADD COLUMN     "rating_yelp" DOUBLE PRECISION,
ADD COLUMN     "scraped_data" JSONB,
ADD COLUMN     "updated_by" INTEGER,
ADD COLUMN     "updated_on" TIMESTAMP(3),
ADD COLUMN     "user_id" TEXT,
ADD COLUMN     "yelp_data" JSONB,
ADD COLUMN     "yelp_id" TEXT;

-- AlterTable
ALTER TABLE "deal_info" DROP COLUMN "businessId",
DROP COLUMN "createdBy",
DROP COLUMN "createdOn",
DROP COLUMN "dayOfWeek",
DROP COLUMN "deletedBy",
DROP COLUMN "deletedOn",
DROP COLUMN "endTime",
DROP COLUMN "startTime",
DROP COLUMN "updatedBy",
DROP COLUMN "updatedOn",
ADD COLUMN     "business_id" TEXT NOT NULL,
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "day_of_week" INTEGER NOT NULL,
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "deleted_on" TIMESTAMP(3),
ADD COLUMN     "end_time" TEXT NOT NULL,
ADD COLUMN     "start_time" TEXT NOT NULL,
ADD COLUMN     "updated_by" INTEGER,
ADD COLUMN     "updated_on" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "photos" DROP COLUMN "businessId",
DROP COLUMN "createdBy",
DROP COLUMN "createdOn",
DROP COLUMN "deletedBy",
DROP COLUMN "deletedOn",
DROP COLUMN "lastFetched",
DROP COLUMN "mainPhoto",
DROP COLUMN "sourceId",
DROP COLUMN "updatedBy",
DROP COLUMN "updatedOn",
ADD COLUMN     "business_id" TEXT NOT NULL,
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "deleted_on" TIMESTAMP(3),
ADD COLUMN     "last_fetched" TIMESTAMP(3),
ADD COLUMN     "main_photo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source_id" TEXT NOT NULL,
ADD COLUMN     "updated_by" INTEGER,
ADD COLUMN     "updated_on" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_comments" DROP COLUMN "businessId",
DROP COLUMN "createdBy",
DROP COLUMN "createdOn",
DROP COLUMN "deletedBy",
DROP COLUMN "deletedOn",
DROP COLUMN "updatedBy",
DROP COLUMN "updatedOn",
DROP COLUMN "userId",
ADD COLUMN     "business_id" TEXT NOT NULL,
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "deleted_on" TIMESTAMP(3),
ADD COLUMN     "updated_by" INTEGER,
ADD COLUMN     "updated_on" TIMESTAMP(3),
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user_preferences" DROP COLUMN "createdBy",
DROP COLUMN "createdOn",
DROP COLUMN "deletedBy",
DROP COLUMN "deletedOn",
DROP COLUMN "updatedBy",
DROP COLUMN "updatedOn",
DROP COLUMN "userId",
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "deleted_on" TIMESTAMP(3),
ADD COLUMN     "updated_by" INTEGER,
ADD COLUMN     "updated_on" TIMESTAMP(3),
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user_votes" DROP COLUMN "businessId",
DROP COLUMN "createdBy",
DROP COLUMN "createdOn",
DROP COLUMN "deletedBy",
DROP COLUMN "deletedOn",
DROP COLUMN "updatedBy",
DROP COLUMN "updatedOn",
DROP COLUMN "userId",
ADD COLUMN     "business_id" TEXT NOT NULL,
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "deleted_on" TIMESTAMP(3),
ADD COLUMN     "updated_by" INTEGER,
ADD COLUMN     "updated_on" TIMESTAMP(3),
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "accountType",
DROP COLUMN "createdBy",
DROP COLUMN "createdOn",
DROP COLUMN "dateOfBirth",
DROP COLUMN "deletedBy",
DROP COLUMN "deletedOn",
DROP COLUMN "firstName",
DROP COLUMN "lastLogin",
DROP COLUMN "lastName",
DROP COLUMN "phoneNumber",
DROP COLUMN "updatedBy",
DROP COLUMN "updatedOn",
ADD COLUMN     "account_type" TEXT,
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "date_of_birth" TEXT,
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "deleted_on" TIMESTAMP(3),
ADD COLUMN     "first_name" VARCHAR(50) NOT NULL,
ADD COLUMN     "last_login" TIMESTAMP(3),
ADD COLUMN     "last_name" VARCHAR(50) NOT NULL,
ADD COLUMN     "phone_number" VARCHAR(30),
ADD COLUMN     "updated_by" INTEGER,
ADD COLUMN     "updated_on" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_place_id_key" ON "businesses"("place_id");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_yelp_id_key" ON "businesses"("yelp_id");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_user_id_key" ON "businesses"("user_id");

-- CreateIndex
CREATE INDEX "businesses_is_bar_is_restaurant_idx" ON "businesses"("is_bar", "is_restaurant");

-- CreateIndex
CREATE INDEX "deal_info_business_id_day_of_week_idx" ON "deal_info"("business_id", "day_of_week");

-- CreateIndex
CREATE INDEX "photos_business_id_idx" ON "photos"("business_id");

-- CreateIndex
CREATE INDEX "photos_main_photo_idx" ON "photos"("main_photo");

-- CreateIndex
CREATE UNIQUE INDEX "photos_business_id_source_id_key" ON "photos"("business_id", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_info" ADD CONSTRAINT "deal_info_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comments" ADD CONSTRAINT "user_comments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_comments" ADD CONSTRAINT "user_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_votes" ADD CONSTRAINT "user_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_votes" ADD CONSTRAINT "user_votes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
