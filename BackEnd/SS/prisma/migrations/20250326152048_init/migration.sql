/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- CreateTable
CREATE TABLE "document_report" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "extracted_text" TEXT NOT NULL,
    "ai_detection_result" TEXT NOT NULL,
    "plagarism_score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "malicious_links" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "threat_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "malicious_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fake_documents" (
    "id" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fake_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "malicious_links_url_key" ON "malicious_links"("url");

-- CreateIndex
CREATE UNIQUE INDEX "fake_documents_document_name_key" ON "fake_documents"("document_name");

-- AddForeignKey
ALTER TABLE "document_report" ADD CONSTRAINT "document_report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
