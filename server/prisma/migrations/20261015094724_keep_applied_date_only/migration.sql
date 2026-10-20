/*
  Warnings:

  - You are about to drop the column `createdAt` on the `JobApplication` table. All the data in the column will be lost.
  - You are about to drop the column `followUpDate` on the `JobApplication` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `JobApplication` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "JobApplication" DROP COLUMN "createdAt",
DROP COLUMN "followUpDate",
DROP COLUMN "updatedAt";
