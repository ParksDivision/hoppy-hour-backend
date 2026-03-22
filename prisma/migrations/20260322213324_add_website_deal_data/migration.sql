-- CreateTable
CREATE TABLE "website_deal_data" (
    "id" TEXT NOT NULL,
    "google_raw_business_id" TEXT NOT NULL,
    "source_type" VARCHAR(30) NOT NULL,
    "source_url" VARCHAR(500),
    "deals" JSONB,
    "raw_ai_response" JSONB,
    "ai_model" VARCHAR(50),
    "ai_prompt_version" VARCHAR(20),
    "analysis_status" VARCHAR(20),
    "error_message" VARCHAR(1000),
    "analyzed_at" TIMESTAMP,
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "website_deal_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_deal_data_google_raw_business_id_source_type_key" ON "website_deal_data"("google_raw_business_id", "source_type");

-- AddForeignKey
ALTER TABLE "website_deal_data" ADD CONSTRAINT "website_deal_data_google_raw_business_id_fkey" FOREIGN KEY ("google_raw_business_id") REFERENCES "google_raw_business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
