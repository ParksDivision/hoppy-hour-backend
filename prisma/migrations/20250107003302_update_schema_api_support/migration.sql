/*
  Warnings:

  - You are about to drop the column `created_by` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `created_on` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `request_sent_on` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `request_type` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `updated_on` on the `api_data_google` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `created_on` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `request_sent_on` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `request_type` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `updated_on` on the `api_data_yelp` table. All the data in the column will be lost.
  - You are about to drop the column `business_name` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `business_url` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `created_on` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `deal_description` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `deal_hours` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `full_address` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `hours` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `photos` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `ratings_google` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `ratings_yelp` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `businesses` table. All the data in the column will be lost.
  - You are about to drop the column `business_id` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `created_on` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `updated_on` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `user_comments` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `created_on` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `updated_on` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `business_id` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `created_on` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `updated_on` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `user_votes` table. All the data in the column will be lost.
  - You are about to drop the column `account_type` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `created_on` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `date_of_birth` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `first_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `full_address` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `last_login` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `last_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phone_number` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updated_on` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[placeId]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[yelpId]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `user_preferences` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phoneNumber]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `requested_on` to the `api_data_google` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requested_on` to the `api_data_yelp` table without a default value. This is not possible if the table is not empty.
  - Added the required column `address` to the `businesses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `latitude` to the `businesses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitude` to the `businesses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `businesses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `businessId` to the `user_comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `user_comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `user_preferences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `businessId` to the `user_votes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `user_votes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "businesses" DROP CONSTRAINT "businesses_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_comments" DROP CONSTRAINT "user_comments_business_id_fkey";

-- DropForeignKey
ALTER TABLE "user_comments" DROP CONSTRAINT "user_comments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_votes" DROP CONSTRAINT "user_votes_business_id_fkey";

-- DropForeignKey
ALTER TABLE "user_votes" DROP CONSTRAINT "user_votes_user_id_fkey";

-- DropIndex
DROP INDEX "businesses_user_id_key";

-- DropIndex
DROP INDEX "user_preferences_user_id_key";

-- DropIndex
DROP INDEX "users_phone_number_key";

-- AlterTable
ALTER TABLE "api_data_google" DROP COLUMN "created_by",
DROP COLUMN "created_on",
DROP COLUMN "request_sent_on",
DROP COLUMN "request_type",
DROP COLUMN "status",
DROP COLUMN "updated_by",
DROP COLUMN "updated_on",
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedBy" INTEGER,
ADD COLUMN     "deletedOn" TIMESTAMP(3),
ADD COLUMN     "requested_on" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER,
ADD COLUMN     "updatedOn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "api_data_yelp" DROP COLUMN "created_by",
DROP COLUMN "created_on",
DROP COLUMN "request_sent_on",
DROP COLUMN "request_type",
DROP COLUMN "status",
DROP COLUMN "updated_by",
DROP COLUMN "updated_on",
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedBy" INTEGER,
ADD COLUMN     "deletedOn" TIMESTAMP(3),
ADD COLUMN     "requested_on" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" INTEGER,
ADD COLUMN     "updatedOn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "businesses" DROP COLUMN "business_name",
DROP COLUMN "business_url",
DROP COLUMN "created_by",
DROP COLUMN "created_on",
DROP COLUMN "deal_description",
DROP COLUMN "deal_hours",
DROP COLUMN "full_address",
DROP COLUMN "hours",
DROP COLUMN "photos",
DROP COLUMN "ratings_google",
DROP COLUMN "ratings_yelp",
DROP COLUMN "updated_by",
DROP COLUMN "user_id",
ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedBy" INTEGER,
ADD COLUMN     "deletedOn" TIMESTAMP(3),
ADD COLUMN     "googleData" JSONB,
ADD COLUMN     "isBar" BOOLEAN DEFAULT false,
ADD COLUMN     "isRestaurant" BOOLEAN DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "longitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "placeId" TEXT,
ADD COLUMN     "priceLevel" INTEGER,
ADD COLUMN     "ratingGoogle" DOUBLE PRECISION,
ADD COLUMN     "ratingOverall" DOUBLE PRECISION,
ADD COLUMN     "ratingYelp" DOUBLE PRECISION,
ADD COLUMN     "scrapedData" JSONB,
ADD COLUMN     "updatedBy" INTEGER,
ADD COLUMN     "updatedOn" TIMESTAMP(3),
ADD COLUMN     "url" TEXT,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "yelpData" JSONB,
ADD COLUMN     "yelpId" TEXT;

-- AlterTable
ALTER TABLE "user_comments" DROP COLUMN "business_id",
DROP COLUMN "created_by",
DROP COLUMN "created_on",
DROP COLUMN "updated_by",
DROP COLUMN "updated_on",
DROP COLUMN "user_id",
ADD COLUMN     "businessId" TEXT NOT NULL,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedBy" INTEGER,
ADD COLUMN     "deletedOn" TIMESTAMP(3),
ADD COLUMN     "updatedBy" INTEGER,
ADD COLUMN     "updatedOn" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user_preferences" DROP COLUMN "created_by",
DROP COLUMN "created_on",
DROP COLUMN "updated_by",
DROP COLUMN "updated_on",
DROP COLUMN "user_id",
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedBy" INTEGER,
ADD COLUMN     "deletedOn" TIMESTAMP(3),
ADD COLUMN     "updatedBy" INTEGER,
ADD COLUMN     "updatedOn" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "preferences" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "user_votes" DROP COLUMN "business_id",
DROP COLUMN "created_by",
DROP COLUMN "created_on",
DROP COLUMN "updated_by",
DROP COLUMN "updated_on",
DROP COLUMN "user_id",
ADD COLUMN     "businessId" TEXT NOT NULL,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedBy" INTEGER,
ADD COLUMN     "deletedOn" TIMESTAMP(3),
ADD COLUMN     "updatedBy" INTEGER,
ADD COLUMN     "updatedOn" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "account_type",
DROP COLUMN "created_by",
DROP COLUMN "created_on",
DROP COLUMN "date_of_birth",
DROP COLUMN "first_name",
DROP COLUMN "full_address",
DROP COLUMN "last_login",
DROP COLUMN "last_name",
DROP COLUMN "phone_number",
DROP COLUMN "updated_by",
DROP COLUMN "updated_on",
ADD COLUMN     "accountType" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dateOfBirth" TEXT,
ADD COLUMN     "deletedBy" INTEGER,
ADD COLUMN     "deletedOn" TIMESTAMP(3),
ADD COLUMN     "firstName" VARCHAR(50) NOT NULL,
ADD COLUMN     "lastLogin" TIMESTAMP(3),
ADD COLUMN     "lastName" VARCHAR(50) NOT NULL,
ADD COLUMN     "phoneNumber" VARCHAR(30),
ADD COLUMN     "updatedBy" INTEGER,
ADD COLUMN     "updatedOn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "url" TEXT,
    "mainPhoto" BOOLEAN NOT NULL DEFAULT false,
    "lastFetched" TIMESTAMP(3),
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedOn" TIMESTAMP(3),
    "updatedBy" INTEGER,
    "deletedOn" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_info" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "deals" TEXT[],
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedOn" TIMESTAMP(3),
    "updatedBy" INTEGER,
    "deletedOn" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "deal_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "photos_id_key" ON "photos"("id");

-- CreateIndex
CREATE INDEX "photos_businessId_idx" ON "photos"("businessId");

-- CreateIndex
CREATE INDEX "photos_mainPhoto_idx" ON "photos"("mainPhoto");

-- CreateIndex
CREATE UNIQUE INDEX "photos_businessId_sourceId_key" ON "photos"("businessId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_info_id_key" ON "deal_info"("id");

-- CreateIndex
CREATE INDEX "deal_info_businessId_dayOfWeek_idx" ON "deal_info"("businessId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_placeId_key" ON "businesses"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_yelpId_key" ON "businesses"("yelpId");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_userId_key" ON "businesses"("userId");

-- CreateIndex
CREATE INDEX "businesses_latitude_longitude_idx" ON "businesses"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "businesses_name_idx" ON "businesses"("name");

-- CreateIndex
CREATE INDEX "businesses_isBar_isRestaurant_idx" ON "businesses"("isBar", "isRestaurant");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_info" ADD CONSTRAINT "deal_info_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comments" ADD CONSTRAINT "user_comments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_comments" ADD CONSTRAINT "user_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_votes" ADD CONSTRAINT "user_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_votes" ADD CONSTRAINT "user_votes_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
