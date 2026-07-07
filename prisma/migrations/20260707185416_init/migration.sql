-- CreateTable
CREATE TABLE "companies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "sizeTier" TEXT,
    "employeeCount" INTEGER,
    "cpaComId" TEXT,
    "cpaAffiliationTier" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "raw_signals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    CONSTRAINT "raw_signals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "signals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "signalType" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "pitchAngle" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heatContribution" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_briefs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "briefDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summaryText" TEXT NOT NULL,
    "topCompanyIds" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "connector_runs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_cpaComId_key" ON "companies"("cpaComId");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "raw_signals_companyId_processedAt_idx" ON "raw_signals"("companyId", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "raw_signals_source_externalId_key" ON "raw_signals"("source", "externalId");

-- CreateIndex
CREATE INDEX "signals_companyId_occurredAt_idx" ON "signals"("companyId", "occurredAt");
