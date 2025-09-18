-- CreateTable
CREATE TABLE "google_raw_business" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(75),
    "address_full" JSONB,
    "primary_phone" VARCHAR(30),
    "uri" VARCHAR(150),
    "data" JSONB,
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "google_raw_business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yelp_raw_business" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(75),
    "address_full" JSONB,
    "primary_phone" VARCHAR(30),
    "uri" VARCHAR(150),
    "data" JSONB,
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "yelp_raw_business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(75),
    "role" VARCHAR(50),
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses_austin" (
    "id" TEXT NOT NULL,
    "google_place_id" TEXT,
    "yelp_id" TEXT,
    "name" VARCHAR(75),
    "address_full" JSONB,
    "primary_phone" VARCHAR(30),
    "uri" VARCHAR(150),
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "businesses_austin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_deals" (
    "id" TEXT NOT NULL,
    "google_place_id" TEXT,
    "yelp_id" TEXT,
    "deal_type" VARCHAR(30),
    "name" VARCHAR(75),
    "address_full" JSONB,
    "primary_phone" VARCHAR(30),
    "uri" VARCHAR(150),
    "created_on" TIMESTAMP,
    "created_by" VARCHAR(50),
    "updated_on" TIMESTAMP,
    "updated_by" VARCHAR(50),

    CONSTRAINT "pending_deals_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "businesses_austin" ADD CONSTRAINT "businesses_austin_google_place_id_fkey" FOREIGN KEY ("google_place_id") REFERENCES "google_raw_business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses_austin" ADD CONSTRAINT "businesses_austin_yelp_id_fkey" FOREIGN KEY ("yelp_id") REFERENCES "yelp_raw_business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_deals" ADD CONSTRAINT "pending_deals_google_place_id_fkey" FOREIGN KEY ("google_place_id") REFERENCES "google_raw_business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_deals" ADD CONSTRAINT "pending_deals_yelp_id_fkey" FOREIGN KEY ("yelp_id") REFERENCES "yelp_raw_business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

