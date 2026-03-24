-- CreateTable
CREATE TABLE "instagram_raw_data" (
    "id" TEXT NOT NULL,
    "google_raw_business_id" TEXT NOT NULL,
    "profile_url" VARCHAR(500),
    "username" VARCHAR(100),
    "posts" JSONB,
    "post_count" INTEGER,
    "fetch_status" VARCHAR(20),
    "error_message" VARCHAR(500),
    "fetched_at" TIMESTAMP,
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "instagram_raw_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facebook_raw_data" (
    "id" TEXT NOT NULL,
    "google_raw_business_id" TEXT NOT NULL,
    "profile_url" VARCHAR(500),
    "page_slug" VARCHAR(100),
    "posts" JSONB,
    "post_count" INTEGER,
    "fetch_status" VARCHAR(20),
    "error_message" VARCHAR(500),
    "fetched_at" TIMESTAMP,
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "facebook_raw_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twitter_raw_data" (
    "id" TEXT NOT NULL,
    "google_raw_business_id" TEXT NOT NULL,
    "profile_url" VARCHAR(500),
    "username" VARCHAR(100),
    "tweets" JSONB,
    "tweet_count" INTEGER,
    "fetch_status" VARCHAR(20),
    "error_message" VARCHAR(500),
    "fetched_at" TIMESTAMP,
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "twitter_raw_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_raw_data_google_raw_business_id_key" ON "instagram_raw_data"("google_raw_business_id");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_raw_data_google_raw_business_id_key" ON "facebook_raw_data"("google_raw_business_id");

-- CreateIndex
CREATE UNIQUE INDEX "twitter_raw_data_google_raw_business_id_key" ON "twitter_raw_data"("google_raw_business_id");

-- AddForeignKey
ALTER TABLE "instagram_raw_data" ADD CONSTRAINT "instagram_raw_data_google_raw_business_id_fkey" FOREIGN KEY ("google_raw_business_id") REFERENCES "google_raw_business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_raw_data" ADD CONSTRAINT "facebook_raw_data_google_raw_business_id_fkey" FOREIGN KEY ("google_raw_business_id") REFERENCES "google_raw_business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitter_raw_data" ADD CONSTRAINT "twitter_raw_data_google_raw_business_id_fkey" FOREIGN KEY ("google_raw_business_id") REFERENCES "google_raw_business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
