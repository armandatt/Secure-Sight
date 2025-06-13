-- CreateTable
CREATE TABLE "RepoAnalysis" (
    "id" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "readmeText" TEXT NOT NULL,
    "codeText" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepoAnalysis_pkey" PRIMARY KEY ("id")
);
