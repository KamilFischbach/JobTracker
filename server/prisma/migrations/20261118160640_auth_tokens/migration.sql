-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('SIGNUP', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthToken_email_idx" ON "AuthToken"("email");

-- CreateIndex
CREATE INDEX "AuthToken_userId_idx" ON "AuthToken"("userId");

-- CreateIndex
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sign-up links carry the new password; reset links belong to a user.
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_purpose_check" CHECK (
  ("purpose" = 'SIGNUP' AND "passwordHash" IS NOT NULL AND "userId" IS NULL) OR
  ("purpose" = 'PASSWORD_RESET' AND "userId" IS NOT NULL AND "passwordHash" IS NULL)
);
