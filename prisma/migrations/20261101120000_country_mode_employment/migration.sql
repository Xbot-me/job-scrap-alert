-- CreateEnum
CREATE TYPE "Employment" AS ENUM ('FREELANCE', 'CONTRACT', 'PART_TIME', 'FULL_TIME', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- AlterEnum
ALTER TYPE "RemoteScope" ADD VALUE 'REGION';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "country" TEXT,
ADD COLUMN     "employment" "Employment" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "visa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workMode" "WorkMode" NOT NULL DEFAULT 'REMOTE',
ALTER COLUMN "remote" DROP NOT NULL;

-- Carry the old GIG/JOB split over before dropping it.
UPDATE "Lead" SET "employment" = CASE WHEN "kind" = 'GIG' THEN 'FREELANCE'::"Employment" ELSE 'FULL_TIME'::"Employment" END;

ALTER TABLE "Lead" DROP COLUMN "kind";

-- DropEnum
DROP TYPE "LeadKind";

-- CreateIndex
CREATE INDEX "Lead_country_idx" ON "Lead"("country");
