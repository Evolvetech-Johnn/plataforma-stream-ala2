-- EXEMPLO para converter em migração versionada de produção DEPOIS de criar schema Prisma.
-- Não executar diretamente sobre dados ativos sem revisar conflitos existentes.
-- Uma ala não pode ter duas transmissões ao mesmo tempo em READY/LIVE/PAUSED.
CREATE UNIQUE INDEX IF NOT EXISTS "Broadcast_one_active_per_unit"
ON "Broadcast" ("unitId")
WHERE "status" IN ('READY'::"BroadcastStatus", 'LIVE'::"BroadcastStatus", 'PAUSED'::"BroadcastStatus");
