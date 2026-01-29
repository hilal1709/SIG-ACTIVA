/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable - Tambahkan kolom email dengan default value terlebih dahulu
ALTER TABLE "users" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';

-- Update existing users dengan email default berdasarkan username
UPDATE "users" SET "email" = username || '@semenindonesia.com' WHERE "email" = '';

-- Hapus default value setelah data terisi
ALTER TABLE "users" ALTER COLUMN "email" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
