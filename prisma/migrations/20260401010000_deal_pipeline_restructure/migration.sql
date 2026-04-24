-- Step 1: Rename pending_deals_austin → raw_deal_analysis_austin (preserves 1199 rows)
ALTER TABLE "pending_deals_austin" RENAME TO "raw_deal_analysis_austin";
ALTER INDEX "pending_deals_austin_google_raw_business_id_source_type_key" RENAME TO "raw_deal_analysis_austin_google_raw_business_id_source_type_key";
ALTER INDEX "pending_deals_austin_pkey" RENAME TO "raw_deal_analysis_austin_pkey";

-- Step 2: Drop legacy pending_deals table
DROP TABLE IF EXISTS "pending_deals";

-- Step 3: Create new pending_deals_austin (1 row per business, staging)
CREATE TABLE "pending_deals_austin" (
    "id" TEXT NOT NULL,
    "google_raw_business_id" TEXT NOT NULL,
    "business_name" VARCHAR(255),
    "primary_source" VARCHAR(30),
    "deals" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP,
    "published_by" VARCHAR(50),
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "pending_deals_austin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_deals_austin_google_raw_business_id_key" ON "pending_deals_austin"("google_raw_business_id");
CREATE INDEX "pending_deals_austin_published_idx" ON "pending_deals_austin"("published");

ALTER TABLE "pending_deals_austin" ADD CONSTRAINT "pending_deals_austin_google_raw_business_id_fkey"
    FOREIGN KEY ("google_raw_business_id") REFERENCES "google_raw_business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Create production_deals_austin (1 row per business, live)
CREATE TABLE "production_deals_austin" (
    "id" TEXT NOT NULL,
    "google_raw_business_id" TEXT NOT NULL,
    "business_name" VARCHAR(255),
    "primary_source" VARCHAR(30),
    "deals" JSONB,
    "published_at" TIMESTAMP,
    "published_by" VARCHAR(50),
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "production_deals_austin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "production_deals_austin_google_raw_business_id_key" ON "production_deals_austin"("google_raw_business_id");

ALTER TABLE "production_deals_austin" ADD CONSTRAINT "production_deals_austin_google_raw_business_id_fkey"
    FOREIGN KEY ("google_raw_business_id") REFERENCES "google_raw_business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
