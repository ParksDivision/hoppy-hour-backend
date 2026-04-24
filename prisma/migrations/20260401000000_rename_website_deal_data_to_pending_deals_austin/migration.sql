-- Rename table (preserves all data and indexes)
ALTER TABLE "website_deal_data" RENAME TO "pending_deals_austin";

-- Rename the unique constraint to match new table name
ALTER INDEX "website_deal_data_google_raw_business_id_source_type_key" RENAME TO "pending_deals_austin_google_raw_business_id_source_type_key";

-- Rename the primary key index
ALTER INDEX "website_deal_data_pkey" RENAME TO "pending_deals_austin_pkey";
