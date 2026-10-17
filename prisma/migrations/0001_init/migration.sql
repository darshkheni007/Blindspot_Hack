-- Generated from prisma/schema.prisma by scripts/prisma-schema-to-sql.py

CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'TEAM');

CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'MEMBER');

CREATE TYPE "Domain" AS ENUM ('SOFTWARE', 'CONSTRUCTION', 'HEALTHCARE', 'FINANCE', 'DATA_ML', 'OTHER');

CREATE TYPE "Stage" AS ENUM ('PROPOSAL', 'IN_PROGRESS', 'PRE_LAUNCH');

CREATE TYPE "DocStatus" AS ENUM ('UPLOADING', 'PARSING', 'READY', 'FAILED');

CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TYPE "FindingCategory" AS ENUM ('ASSUMPTION', 'CONSTRAINT', 'QUESTION', 'CONTRADICTION', 'DATA_ISSUE');

CREATE TYPE "Confidence" AS ENUM ('EVIDENCE_BACKED', 'INFERRED', 'PATTERN_BASED');

CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED', 'DEFERRED', 'ALREADY_KNOWN');

CREATE TYPE "FeedbackKind" AS ENUM ('USEFUL', 'NOT_USEFUL', 'WRONG', 'DUPLICATE');

CREATE TYPE "AssumptionStatus" AS ENUM ('UNVALIDATED', 'VALIDATED', 'INVALID');

CREATE TYPE "QuestionStatus" AS ENUM ('OPEN', 'ASKED', 'ANSWERED', 'DROPPED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "passwordHash" TEXT,
  "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "plan" "Plan" NOT NULL DEFAULT 'FREE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "role" "MemberRole" NOT NULL DEFAULT 'OWNER',
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domain" "Domain" NOT NULL,
  "stage" "Stage" NOT NULL,
  "goal" TEXT NOT NULL,
  "deadline" TIMESTAMP(3),
  "budget" TEXT,
  "teamSize" INTEGER,
  "knownRisks" TEXT,
  "weights" JSONB,
  "isSample" BOOLEAN NOT NULL DEFAULT false,
  "lastAnalyzedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "ext" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "docType" TEXT NOT NULL DEFAULT 'Other',
  "status" "DocStatus" NOT NULL DEFAULT 'UPLOADING',
  "error" TEXT,
  "pageCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Chunk" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "locator" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
  "step" TEXT NOT NULL DEFAULT 'queued',
  "stepIndex" INTEGER NOT NULL DEFAULT 0,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "docHashes" JSONB NOT NULL,
  "stats" JSONB,
  "diff" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Finding" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "firstRunId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "groupKey" TEXT,
  "detector" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "FindingCategory" NOT NULL,
  "whyItMatters" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "isAbsence" BOOLEAN NOT NULL DEFAULT false,
  "checkedDocuments" JSONB NOT NULL,
  "confidence" "Confidence" NOT NULL,
  "impact" INTEGER NOT NULL,
  "likelihood" INTEGER NOT NULL,
  "irreversibility" INTEGER NOT NULL,
  "proximity" INTEGER NOT NULL,
  "cost" INTEGER NOT NULL,
  "justifications" JSONB NOT NULL,
  "priority" INTEGER NOT NULL,
  "previousPriority" INTEGER,
  "severity" "Severity" NOT NULL,
  "disproof" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "nextStep" TEXT NOT NULL,
  "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
  "statusReason" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "diffState" TEXT NOT NULL DEFAULT 'NEW',
  "verifier" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FindingComment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FindingComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FindingFeedback" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "FeedbackKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FindingFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Assumption" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "statement" TEXT NOT NULL,
  "sourceDoc" TEXT NOT NULL,
  "sourceLocator" TEXT NOT NULL,
  "sourceQuote" TEXT NOT NULL,
  "riskIfFalse" TEXT NOT NULL,
  "status" "AssumptionStatus" NOT NULL DEFAULT 'UNVALIDATED',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Assumption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Question" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "suggestedOwner" TEXT NOT NULL,
  "findingId" TEXT,
  "status" "QuestionStatus" NOT NULL DEFAULT 'OPEN',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DetectorCache" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "detector" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DetectorCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");

CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

CREATE INDEX "Document_workspaceId_projectId_idx" ON "Document"("workspaceId", "projectId");

CREATE INDEX "Chunk_documentId_ordinal_idx" ON "Chunk"("documentId", "ordinal");

CREATE INDEX "Chunk_workspaceId_projectId_idx" ON "Chunk"("workspaceId", "projectId");

CREATE INDEX "AnalysisRun_workspaceId_projectId_idx" ON "AnalysisRun"("workspaceId", "projectId");

CREATE UNIQUE INDEX "Finding_projectId_fingerprint_key" ON "Finding"("projectId", "fingerprint");

CREATE INDEX "Finding_workspaceId_projectId_idx" ON "Finding"("workspaceId", "projectId");

CREATE INDEX "FindingComment_findingId_idx" ON "FindingComment"("findingId");

CREATE UNIQUE INDEX "FindingFeedback_findingId_userId_key" ON "FindingFeedback"("findingId", "userId");

CREATE UNIQUE INDEX "Assumption_projectId_fingerprint_key" ON "Assumption"("projectId", "fingerprint");

CREATE INDEX "Assumption_workspaceId_projectId_idx" ON "Assumption"("workspaceId", "projectId");

CREATE UNIQUE INDEX "Question_projectId_fingerprint_key" ON "Question"("projectId", "fingerprint");

CREATE INDEX "Question_workspaceId_projectId_idx" ON "Question"("workspaceId", "projectId");

CREATE UNIQUE INDEX "DetectorCache_documentId_detector_key_key" ON "DetectorCache"("documentId", "detector", "key");

CREATE INDEX "UsageEvent_workspaceId_kind_createdAt_idx" ON "UsageEvent"("workspaceId", "kind", "createdAt");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Finding" ADD CONSTRAINT "Finding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FindingComment" ADD CONSTRAINT "FindingComment_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FindingComment" ADD CONSTRAINT "FindingComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FindingFeedback" ADD CONSTRAINT "FindingFeedback_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FindingFeedback" ADD CONSTRAINT "FindingFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assumption" ADD CONSTRAINT "Assumption_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Question" ADD CONSTRAINT "Question_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DetectorCache" ADD CONSTRAINT "DetectorCache_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
