-- CreateTable
CREATE TABLE "business_social_links" (
    "id" TEXT NOT NULL,
    "google_raw_business_id" TEXT NOT NULL,
    "website_url" VARCHAR(500),
    "facebook_url" VARCHAR(500),
    "instagram_url" VARCHAR(500),
    "twitter_url" VARCHAR(500),
    "scraped_at" TIMESTAMP,
    "scrape_method" VARCHAR(20),
    "scrape_status" VARCHAR(20),
    "error_message" VARCHAR(500),
    "raw_links_found" JSONB,
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "business_social_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_social_links_google_raw_business_id_key" ON "business_social_links"("google_raw_business_id");

-- AddForeignKey
ALTER TABLE "business_social_links" ADD CONSTRAINT "business_social_links_google_raw_business_id_fkey" FOREIGN KEY ("google_raw_business_id") REFERENCES "google_raw_business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
