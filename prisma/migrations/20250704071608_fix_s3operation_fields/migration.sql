-- AlterTable
ALTER TABLE "s3_operations" ADD COLUMN     "cdnPurged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "s3Key" TEXT;

-- CreateIndex
CREATE INDEX "s3_operations_s3Key_idx" ON "s3_operations"("s3Key");
