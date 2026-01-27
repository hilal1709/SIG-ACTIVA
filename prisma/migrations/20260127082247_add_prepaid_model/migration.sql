-- CreateTable
CREATE TABLE "prepaids" (
    "id" SERIAL NOT NULL,
    "companyCode" TEXT,
    "noPo" TEXT,
    "kdAkr" TEXT NOT NULL,
    "alokasi" TEXT NOT NULL,
    "namaAkun" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "deskripsi" TEXT,
    "headerText" TEXT,
    "klasifikasi" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "remaining" DOUBLE PRECISION NOT NULL,
    "costCenter" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "period" INTEGER NOT NULL,
    "periodUnit" TEXT NOT NULL DEFAULT 'bulan',
    "type" TEXT NOT NULL DEFAULT 'Linear',
    "pembagianType" TEXT NOT NULL DEFAULT 'otomatis',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prepaids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prepaid_periodes" (
    "id" SERIAL NOT NULL,
    "prepaidId" INTEGER NOT NULL,
    "periodeKe" INTEGER NOT NULL,
    "bulan" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "amountPrepaid" DOUBLE PRECISION NOT NULL,
    "isAmortized" BOOLEAN NOT NULL DEFAULT false,
    "amortizedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prepaid_periodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prepaids_kdAkr_idx" ON "prepaids"("kdAkr");

-- CreateIndex
CREATE INDEX "prepaids_startDate_idx" ON "prepaids"("startDate");

-- CreateIndex
CREATE INDEX "prepaid_periodes_prepaidId_idx" ON "prepaid_periodes"("prepaidId");

-- CreateIndex
CREATE INDEX "prepaid_periodes_bulan_tahun_idx" ON "prepaid_periodes"("bulan", "tahun");

-- AddForeignKey
ALTER TABLE "prepaid_periodes" ADD CONSTRAINT "prepaid_periodes_prepaidId_fkey" FOREIGN KEY ("prepaidId") REFERENCES "prepaids"("id") ON DELETE CASCADE ON UPDATE CASCADE;
