/*
  Warnings:

  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN_SYSTEM', 'STAFF_ACCOUNTING', 'SUPERVISOR_ACCOUNTING', 'AUDITOR_INTERNAL', 'STAFF_PRODUCTION');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'STAFF_ACCOUNTING';
