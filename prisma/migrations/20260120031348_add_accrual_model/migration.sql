-- CreateTable
CREATE TABLE "accruals" (
    "id" SERIAL NOT NULL,
    "kdAkr" TEXT NOT NULL,
    "alokasi" TEXT,
    "namaAkun" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "accrDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "type" TEXT DEFAULT 'Linear',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accruals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accruals_kdAkr_idx" ON "accruals"("kdAkr");

-- CreateIndex
CREATE INDEX "accruals_status_idx" ON "accruals"("status");

-- CreateIndex
CREATE INDEX "accruals_accrDate_idx" ON "accruals"("accrDate");
