-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('APPLICATION_RECEIVED', 'INTERVIEW_INVITATION', 'REJECTION', 'OFFER', 'NOT_JOB_RELATED');

-- CreateEnum
CREATE TYPE "EmailOutcome" AS ENUM ('UPDATED', 'NO_CHANGE', 'NEEDS_REVIEW', 'NO_MATCH', 'IGNORED');

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "companyName" TEXT,
    "jobTitle" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "outcome" "EmailOutcome" NOT NULL,
    "previousStatus" "ApplicationStatus",
    "newStatus" "ApplicationStatus",
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailEvent_gmailMessageId_key" ON "EmailEvent"("gmailMessageId");

-- CreateIndex
CREATE INDEX "EmailEvent_applicationId_idx" ON "EmailEvent"("applicationId");

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
