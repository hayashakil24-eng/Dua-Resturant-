-- CreateTable
CREATE TABLE "OutboxEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "OutboxEntry_status_idx" ON "OutboxEntry"("status");

-- CreateIndex
CREATE INDEX "OutboxEntry_entity_entityId_idx" ON "OutboxEntry"("entity", "entityId");
