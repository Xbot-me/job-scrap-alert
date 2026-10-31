-- CreateEnum
CREATE TYPE "LeadKind" AS ENUM ('GIG', 'JOB');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'SAVED', 'CONTACTED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "RemoteScope" AS ENUM ('WORLDWIDE', 'ASIA_OK', 'TIMEZONE', 'UNSTATED');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "body" TEXT NOT NULL,
    "emails" TEXT[],
    "redditUser" TEXT,
    "applyUrl" TEXT,
    "pay" TEXT,
    "kind" "LeadKind" NOT NULL,
    "remote" "RemoteScope" NOT NULL,
    "skills" TEXT[],
    "score" INTEGER NOT NULL,
    "reasons" TEXT[],
    "postedAt" TIMESTAMP(3) NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "contactedAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fetched" INTEGER NOT NULL,
    "kept" INTEGER NOT NULL,
    "added" INTEGER NOT NULL,
    "errors" TEXT[],

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_status_score_idx" ON "Lead"("status", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_source_externalId_key" ON "Lead"("source", "externalId");
