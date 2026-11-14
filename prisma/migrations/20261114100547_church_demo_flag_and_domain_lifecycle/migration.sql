/*
  Warnings:

  - You are about to drop the column `verificationToken` on the `church_domains` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `church_domains` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "church_domains" DROP COLUMN "verificationToken",
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerStatus" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "sslStatus" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "verificationTokenHash" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "churches" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "church_domains_status_idx" ON "church_domains"("status");
