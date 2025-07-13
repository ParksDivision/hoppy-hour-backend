-- CreateIndex
CREATE INDEX "businesses_rating_overall_idx" ON "businesses"("rating_overall");

-- CreateIndex
CREATE INDEX "businesses_rating_overall_name_idx" ON "businesses"("rating_overall", "name");

-- CreateIndex
CREATE INDEX "deals_is_active_day_of_week_start_time_idx" ON "deals"("is_active", "day_of_week", "start_time");

-- CreateIndex
CREATE INDEX "deals_day_of_week_is_active_idx" ON "deals"("day_of_week", "is_active");

-- CreateIndex
CREATE INDEX "deals_is_active_idx" ON "deals"("is_active");

-- CreateIndex
CREATE INDEX "photos_business_id_main_photo_idx" ON "photos"("business_id", "main_photo");
