-- CreateTable
CREATE TABLE "material_data" (
    "id" SERIAL NOT NULL,
    "materialId" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "stokAwalOpr" DOUBLE PRECISION NOT NULL,
    "stokAwalSap" DOUBLE PRECISION NOT NULL,
    "stokAwalSelisih" DOUBLE PRECISION NOT NULL,
    "stokAwalTotal" DOUBLE PRECISION NOT NULL,
    "produksiOpr" DOUBLE PRECISION NOT NULL,
    "produksiSap" DOUBLE PRECISION NOT NULL,
    "produksiSelisih" DOUBLE PRECISION NOT NULL,
    "produksiTotal" DOUBLE PRECISION NOT NULL,
    "rilisOpr" DOUBLE PRECISION NOT NULL,
    "rilisSap" DOUBLE PRECISION NOT NULL,
    "rilisSelisih" DOUBLE PRECISION NOT NULL,
    "rilisTotal" DOUBLE PRECISION NOT NULL,
    "stokAkhirOpr" DOUBLE PRECISION NOT NULL,
    "stokAkhirSap" DOUBLE PRECISION NOT NULL,
    "stokAkhirSelisih" DOUBLE PRECISION NOT NULL,
    "stokAkhirTotal" DOUBLE PRECISION NOT NULL,
    "blank" DOUBLE PRECISION NOT NULL,
    "blankTotal" DOUBLE PRECISION NOT NULL,
    "grandTotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_data_materialId_idx" ON "material_data"("materialId");

-- CreateIndex
CREATE INDEX "material_data_location_idx" ON "material_data"("location");
