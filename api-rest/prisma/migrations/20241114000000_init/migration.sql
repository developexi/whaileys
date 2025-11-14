-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT,
    "number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "qrCode" TEXT,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastConnected" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "name" TEXT,
    "notify" TEXT,
    "verifiedName" TEXT,
    "imgUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionId_key" ON "sessions"("sessionId");

-- CreateIndex
CREATE INDEX "messages_sessionId_idx" ON "messages"("sessionId");

-- CreateIndex
CREATE INDEX "messages_remoteJid_idx" ON "messages"("remoteJid");

-- CreateIndex
CREATE UNIQUE INDEX "messages_sessionId_messageId_key" ON "messages"("sessionId", "messageId");

-- CreateIndex
CREATE INDEX "contacts_sessionId_idx" ON "contacts"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_sessionId_jid_key" ON "contacts"("sessionId", "jid");
