import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes, createHash } from 'node:crypto';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definido');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const unit = await prisma.unit.upsert({
    where: { slug: 'ala-piloto' }, update: {},
    create: { slug: 'ala-piloto', name: 'Ala Piloto', type: 'WARD' },
  });
  const upcoming = new Date();
  upcoming.setUTCDate(upcoming.getUTCDate() + ((7 - upcoming.getUTCDay()) % 7 || 7));
  upcoming.setUTCHours(13, 0, 0, 0);
  const slug = `reuniao-${upcoming.toISOString().slice(0, 10)}`;
  const broadcast = await prisma.broadcast.upsert({
    where: { slug }, update: {},
    create: { slug, unitId: unit.id, title: 'Transmissão de teste', scheduledAt: upcoming },
  });
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await prisma.viewerInvite.create({
    data: {
      broadcastId: broadcast.id, tokenHash, maxUses: 2,
      expiresAt: new Date(upcoming.getTime() + 3 * 60 * 60 * 1000),
    },
  });
  console.log('Convite TESTE (não publique; exibir uma única vez):', token);
  console.log('Reunião criada como SCHEDULED:', broadcast.id);
  console.log('O controle do operador ainda NÃO está implementado.');
}
main().finally(async () => prisma.$disconnect());
