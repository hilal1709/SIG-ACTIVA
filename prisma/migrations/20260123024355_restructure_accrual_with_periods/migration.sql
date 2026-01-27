/*
  Warnings:

  - You are about to drop the column `accrDate` on the `accruals` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `accruals` table. All the data in the column will be lost.
  - You are about to drop the column `periode` on the `accruals` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `accruals` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `accruals` table. All the data in the column will be lost.
  - Added the required column `jumlahPeriode` to the `accruals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `accruals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `accruals` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "accruals_accrDate_idx";

-- DropIndex
DROP INDEX "accruals_status_idx";

-- AlterTable
ALTER TABLE "accruals" DROP COLUMN "accrDate",
DROP COLUMN "amount",
DROP COLUMN "periode",
DROP COLUMN "status",
DROP COLUMN "type",
ADD COLUMN     "jumlahPeriode" INTEGER NOT NULL,
ADD COLUMN     "klasifikasi" TEXT,
ADD COLUMN     "pembagianType" TEXT NOT NULL DEFAULT 'otomatis',
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "totalAmount" DOUBLE PRECISION NOT NULL;

-- CreateTable
CREATE TABLE "accrual_periodes" (
    "id" SERIAL NOT NULL,
    "accrualId" INTEGER NOT NULL,
    "periodeKe" INTEGER NOT NULL,
    "bulan" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "amountAccrual" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accrual_periodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accrual_realisasis" (
    "id" SERIAL NOT NULL,
    "accrualPeriodeId" INTEGER NOT NULL,
    "tanggalRealisasi" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accrual_realisasis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accrual_periodes_accrualId_idx" ON "accrual_periodes"("accrualId");

-- CreateIndex
CREATE INDEX "accrual_periodes_bulan_tahun_idx" ON "accrual_periodes"("bulan", "tahun");

-- CreateIndex
CREATE INDEX "accrual_realisasis_accrualPeriodeId_idx" ON "accrual_realisasis"("accrualPeriodeId");

-- CreateIndex
CREATE INDEX "accrual_realisasis_tanggalRealisasi_idx" ON "accrual_realisasis"("tanggalRealisasi");

-- CreateIndex
CREATE INDEX "accruals_startDate_idx" ON "accruals"("startDate");

-- AddForeignKey
ALTER TABLE "accrual_periodes" ADD CONSTRAINT "accrual_periodes_accrualId_fkey" FOREIGN KEY ("accrualId") REFERENCES "accruals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accrual_realisasis" ADD CONSTRAINT "accrual_realisasis_accrualPeriodeId_fkey" FOREIGN KEY ("accrualPeriodeId") REFERENCES "accrual_periodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
