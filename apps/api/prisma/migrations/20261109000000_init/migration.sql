-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('WARD', 'STAKE');

-- CreateEnum
CREATE TYPE "UnitRole" AS ENUM ('ADMIN', 'OPERATOR', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('SCHEDULED', 'READY', 'LIVE', 'PAUSED', 'ENDED', 'FAILED');

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "UnitType" NOT NULL DEFAULT 'WARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaRecoveryCodes" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "role" "UnitRole" NOT NULL,

    CONSTRAINT "UnitMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "streamPath" TEXT NOT NULL DEFAULT 'ala01',
    "status" "BroadcastStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerInvite" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "maxUses" INTEGER NOT NULL DEFAULT 2,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ViewerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerSession" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ViewerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OperatorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "unitId" TEXT,
    "broadcastId" TEXT,
    "details" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_slug_key" ON "Unit"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UnitMembership_unitId_role_idx" ON "UnitMembership"("unitId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "UnitMembership_userId_unitId_role_key" ON "UnitMembership"("userId", "unitId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Broadcast_slug_key" ON "Broadcast"("slug");

-- CreateIndex
CREATE INDEX "Broadcast_unitId_status_scheduledAt_idx" ON "Broadcast"("unitId", "status", "scheduledAt");

-- Unique Partial Index: One active broadcast (READY, LIVE, PAUSED) per unit
CREATE UNIQUE INDEX "Broadcast_one_active_per_unit"
ON "Broadcast" ("unitId")
WHERE "status" IN ('READY'::"BroadcastStatus", 'LIVE'::"BroadcastStatus", 'PAUSED'::"BroadcastStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ViewerInvite_tokenHash_key" ON "ViewerInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "ViewerInvite_broadcastId_expiresAt_idx" ON "ViewerInvite"("broadcastId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ViewerSession_sessionHash_key" ON "ViewerSession"("sessionHash");

-- CreateIndex
CREATE INDEX "ViewerSession_inviteId_expiresAt_idx" ON "ViewerSession"("inviteId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorSession_sessionHash_key" ON "OperatorSession"("sessionHash");

-- CreateIndex
CREATE INDEX "OperatorSession_userId_expiresAt_idx" ON "OperatorSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_unitId_occurredAt_idx" ON "AuditEvent"("unitId", "occurredAt");

-- AddForeignKey
ALTER TABLE "UnitMembership" ADD CONSTRAINT "UnitMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitMembership" ADD CONSTRAINT "UnitMembership_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerInvite" ADD CONSTRAINT "ViewerInvite_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerInvite" ADD CONSTRAINT "ViewerInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerSession" ADD CONSTRAINT "ViewerSession_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ViewerInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorSession" ADD CONSTRAINT "OperatorSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

