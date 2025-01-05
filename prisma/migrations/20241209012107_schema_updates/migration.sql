/*
  Warnings:

  - The `ratings_yelp` column on the `businesses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `ratings_google` column on the `businesses` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "api_data_google" ALTER COLUMN "data" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "api_data_yelp" ALTER COLUMN "data" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "businesses" DROP COLUMN "ratings_yelp",
ADD COLUMN     "ratings_yelp" DOUBLE PRECISION,
DROP COLUMN "ratings_google",
ADD COLUMN     "ratings_google" DOUBLE PRECISION;
