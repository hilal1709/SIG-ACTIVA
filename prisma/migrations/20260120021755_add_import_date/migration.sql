-- AlterTable
ALTER TABLE "material_data" ADD COLUMN     "importDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "material_data_importDate_idx" ON "material_data"("importDate");
