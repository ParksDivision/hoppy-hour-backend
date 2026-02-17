-- AlterTable
ALTER TABLE "google_raw_business" ADD COLUMN "google_place_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "google_raw_business_google_place_id_key" ON "google_raw_business"("google_place_id");
